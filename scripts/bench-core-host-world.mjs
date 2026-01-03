import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { existsSync, writeFileSync } from "node:fs";

const PROFILES = {
  quick: { iterations: 200, warmup: 50, arraySize: 512 },
  standard: { iterations: 1000, warmup: 100, arraySize: 1024 },
  extreme: { iterations: 2000, warmup: 200, arraySize: 2048 },
};

const DEFAULT_PROFILE = "standard";

function printUsage() {
  console.log(
    [
      "Usage: node scripts/bench-core-host-world.mjs [options]",
      "",
      "Options:",
      "  --profile <quick|standard|extreme>",
      "  --mode <host|world|both>",
      "  --iterations <number>",
      "  --array-size <number>",
      "  --warmup <number>",
      "  --effects | --no-effects",
      "  --mem                  sample memory usage",
      "  --mem-sample-every <number>",
      "  --retain-snapshots      retain snapshots on sample ticks",
      "  --delta <number>",
      "  --debug                print per-run sanity samples",
      "  --json <path>           write results to JSON",
      "  --help",
      "",
      "Examples:",
      "  node scripts/bench-core-host-world.mjs --profile extreme",
      "  node scripts/bench-core-host-world.mjs --mode world --iterations 2000",
    ].join("\n")
  );
}

function parseArgs(argv) {
  let profile = DEFAULT_PROFILE;
  const overrides = {};

  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (raw === "--help" || raw === "-h") {
      printUsage();
      process.exit(0);
    }

    const [flag, value] = raw.includes("=") ? raw.split("=", 2) : [raw, null];

    switch (flag) {
      case "--profile":
        profile = value ?? argv[++i];
        break;
      case "--mode":
        overrides.mode = value ?? argv[++i];
        break;
      case "--iterations":
        overrides.iterations = Number(value ?? argv[++i]);
        break;
      case "--array-size":
        overrides.arraySize = Number(value ?? argv[++i]);
        break;
      case "--warmup":
        overrides.warmup = Number(value ?? argv[++i]);
        break;
      case "--effects":
        overrides.effects = true;
        break;
      case "--no-effects":
        overrides.effects = false;
        break;
      case "--mem":
        overrides.mem = true;
        break;
      case "--mem-sample-every":
        overrides.memSampleEvery = Number(value ?? argv[++i]);
        break;
      case "--retain-snapshots":
        overrides.retainSnapshots = true;
        break;
      case "--delta":
        overrides.delta = Number(value ?? argv[++i]);
        break;
      case "--debug":
        overrides.debug = true;
        break;
      case "--json":
        overrides.json = value ?? argv[++i];
        break;
      default:
        console.error(`Unknown option: ${raw}`);
        printUsage();
        process.exit(1);
    }
  }

  const profileConfig = PROFILES[profile];
  if (!profileConfig) {
    console.error(`Unknown profile: ${profile}`);
    printUsage();
    process.exit(1);
  }

  const config = {
    profile,
    mode: "both",
    iterations: profileConfig.iterations,
    warmup: profileConfig.warmup,
    arraySize: profileConfig.arraySize,
    effects: true,
    mem: false,
    memSampleEvery: 50,
    retainSnapshots: false,
    delta: 1,
    json: null,
    debug: false,
    ...overrides,
  };

  if (!["host", "world", "both"].includes(config.mode)) {
    console.error(`Invalid mode: ${config.mode}`);
    process.exit(1);
  }
  if (!Number.isFinite(config.iterations) || config.iterations <= 0) {
    console.error("iterations must be a positive number");
    process.exit(1);
  }
  if (!Number.isFinite(config.arraySize) || config.arraySize <= 0) {
    console.error("array-size must be a positive number");
    process.exit(1);
  }
  if (!Number.isFinite(config.warmup) || config.warmup < 0) {
    console.error("warmup must be zero or a positive number");
    process.exit(1);
  }
  if (!Number.isFinite(config.memSampleEvery) || config.memSampleEvery <= 0) {
    console.error("mem-sample-every must be a positive number");
    process.exit(1);
  }
  if (!Number.isFinite(config.delta)) {
    console.error("delta must be a number");
    process.exit(1);
  }

  return config;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const weight = idx - lo;
  return sorted[lo] * (1 - weight) + sorted[hi] * weight;
}

function summarizeSamples(samples, totalMs) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = samples.reduce((acc, value) => acc + value, 0);
  const mean = samples.length > 0 ? sum / samples.length : 0;
  const min = samples.length > 0 ? sorted[0] : 0;
  const max = samples.length > 0 ? sorted[sorted.length - 1] : 0;
  const median = percentile(sorted, 0.5);
  const p95 = percentile(sorted, 0.95);
  const p99 = percentile(sorted, 0.99);
  const opsPerSec = totalMs > 0 ? (samples.length / totalMs) * 1000 : 0;

  return {
    totalMs,
    iterations: samples.length,
    minMs: min,
    maxMs: max,
    avgMs: mean,
    medianMs: median,
    p95Ms: p95,
    p99Ms: p99,
    opsPerSec,
  };
}

function formatMs(value) {
  return `${value.toFixed(2)} ms`;
}

function formatOps(value) {
  return `${value.toFixed(2)} ops/s`;
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = value;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  return `${amount.toFixed(2)} ${units[unitIndex]}`;
}

function printResult(label, stats) {
  console.log(
    [
      `${label}`,
      `  total:    ${formatMs(stats.totalMs)}`,
      `  ops/sec:  ${formatOps(stats.opsPerSec)}`,
      `  avg:      ${formatMs(stats.avgMs)}`,
      `  p50:      ${formatMs(stats.medianMs)}`,
      `  p95:      ${formatMs(stats.p95Ms)}`,
      `  p99:      ${formatMs(stats.p99Ms)}`,
      `  min/max:  ${formatMs(stats.minMs)} / ${formatMs(stats.maxMs)}`,
    ].join("\n")
  );
}

function shouldSampleMemory(iteration, totalIterations, sampleEvery) {
  if (sampleEvery <= 0) return false;
  return iteration % sampleEvery === 0 || iteration === totalIterations;
}

function sampleMemory(samples, iteration, elapsedMs, retainedSnapshots) {
  const usage = process.memoryUsage();
  samples.push({
    iter: iteration,
    elapsedMs,
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    rss: usage.rss,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers ?? 0,
    retainedSnapshots: retainedSnapshots ?? 0,
  });
}

function summarizeMemorySamples(samples) {
  if (!samples || samples.length === 0) return null;
  const heapUsed = samples.map((sample) => sample.heapUsed);
  const rss = samples.map((sample) => sample.rss);
  const start = samples[0];
  const end = samples[samples.length - 1];

  return {
    samples: samples.length,
    heapUsed: {
      start: start.heapUsed,
      end: end.heapUsed,
      min: Math.min(...heapUsed),
      max: Math.max(...heapUsed),
      delta: end.heapUsed - start.heapUsed,
    },
    rss: {
      start: start.rss,
      end: end.rss,
      min: Math.min(...rss),
      max: Math.max(...rss),
      delta: end.rss - start.rss,
    },
    retainedSnapshots: end.retainedSnapshots ?? 0,
  };
}

function printMemorySummary(label, summary) {
  if (!summary) return;
  console.log(`${label} memory:`);
  console.log(
    `  heapUsed: start ${formatBytes(summary.heapUsed.start)} end ${formatBytes(summary.heapUsed.end)} peak ${formatBytes(summary.heapUsed.max)} delta ${formatBytes(summary.heapUsed.delta)}`
  );
  console.log(
    `  rss:      start ${formatBytes(summary.rss.start)} end ${formatBytes(summary.rss.end)} peak ${formatBytes(summary.rss.max)} delta ${formatBytes(summary.rss.delta)}`
  );
  if (summary.retainedSnapshots) {
    console.log(`  retained snapshots: ${summary.retainedSnapshots}`);
  }
}

function buildInitialData(arraySize) {
  const items = Array.from({ length: arraySize }, (_, i) => i);
  return {
    items,
    counter: 0,
    lastAppliedNonce: -1,
  };
}

function createBenchmarkDomain({ z, defineDomain, effects }) {
  return defineDomain(
    z.object({
      items: z.array(z.number()),
      counter: z.number(),
      lastAppliedNonce: z.number(),
    }),
    ({ state, computed, actions, expr, flow }) => {
      const { sum, sumSquares } = computed.define({
        sum: expr.sum(state.items),
        sumSquares: expr.sum(
          expr.map(state.items, (value) => expr.mul(value, value))
        ),
      });

      const baseSteps = [
        flow.patch(state.items).set(
          expr.map(state.items, (value) => expr.add(value, expr.input("delta")))
        ),
        flow.patch(state.counter).set(expr.add(state.counter, 1)),
        flow.patch(state.lastAppliedNonce).set(expr.input("nonce")),
      ];

      if (effects) {
        baseSteps.push(flow.effect("noop", { delta: expr.input("delta") }));
      }

      const { tick } = actions.define({
        tick: {
          input: z.object({
            delta: z.number(),
            nonce: z.number(),
          }),
          flow: flow.guard(
            expr.neq(state.lastAppliedNonce, expr.input("nonce")),
            flow.seq(...baseSteps)
          ),
        },
      });

      return { computed: { sum, sumSquares }, actions: { tick } };
    },
    { id: "manifesto://bench/core-host-world", version: "1.0.0" }
  );
}

async function runHostLoop({
  domain,
  createHost,
  createSnapshot,
  createIntent,
  config,
  iterations,
  measure,
}) {
  const initialData = buildInitialData(config.arraySize);
  const initialSnapshot = createSnapshot(initialData, domain.schema.hash, {
    now: 0,
    randomSeed: "bench",
    durationMs: 0,
  });

  const host = createHost(domain.schema, {
    snapshot: initialSnapshot,
    loop: { maxIterations: 10 },
    context: {
      now: () => 0,
      randomSeed: () => "bench",
    },
  });

  if (config.effects) {
    host.registerEffect("noop", async () => []);
  }

  const durations = measure ? new Array(iterations) : [];
  const memorySamples = config.mem ? [] : null;
  const retainedSnapshots = config.retainSnapshots ? [] : null;
  let lastSnapshot = initialSnapshot;

  const startTotal = performance.now();
  if (memorySamples) {
    sampleMemory(memorySamples, 0, 0, retainedSnapshots?.length ?? 0);
  }
  for (let i = 0; i < iterations; i++) {
    const intent = createIntent(
      "tick",
      { delta: config.delta, nonce: i },
      `host-intent-${i}`
    );
    const start = measure ? performance.now() : 0;
    const result = await host.dispatch(intent);
    if (config.debug && (i === 0 || i === iterations - 1)) {
      const data = result.snapshot?.data ?? {};
      const items = Array.isArray(data.items) ? data.items : [];
      const firstItem = items.length > 0 ? items[0] : undefined;
      const lastItem = items.length > 0 ? items[items.length - 1] : undefined;
      const lastError = result.snapshot?.system?.lastError;
      const errorCode = lastError ? lastError.code : "none";
      const errorMessage = lastError ? lastError.message : "none";
      console.log(
        `[host] iter=${i} status=${result.status} system=${result.snapshot?.system?.status} error=${errorCode} message=${errorMessage} counter=${data.counter} lastAppliedNonce=${data.lastAppliedNonce} items[0]=${firstItem} items[last]=${lastItem}`
      );
    }
    if (measure) {
      durations[i] = performance.now() - start;
    }
    lastSnapshot = result.snapshot;

    if (memorySamples && shouldSampleMemory(i + 1, iterations, config.memSampleEvery)) {
      if (retainedSnapshots) {
        retainedSnapshots.push(result.snapshot);
      }
      sampleMemory(
        memorySamples,
        i + 1,
        performance.now() - startTotal,
        retainedSnapshots?.length ?? 0
      );
    }
  }
  const totalMs = performance.now() - startTotal;

  return {
    totalMs,
    durations,
    snapshot: lastSnapshot,
    memorySamples,
  };
}

async function runWorldLoop({
  domain,
  createManifestoWorld,
  createIntentInstance,
  createSnapshot,
  config,
  iterations,
  measure,
}) {
  const initialData = buildInitialData(config.arraySize);
  const initialSnapshot = createSnapshot(initialData, domain.schema.hash, {
    now: 0,
    randomSeed: "bench",
    durationMs: 0,
  });

  const world = createManifestoWorld({
    schemaHash: domain.schema.hash,
    host: config.host,
  });

  const actor = { actorId: "bench-actor", kind: "system" };
  world.registerActor(actor, { mode: "auto_approve", reason: "benchmark" });

  const genesis = await world.createGenesis(initialSnapshot);
  let currentWorldId = genesis.worldId;

  const durations = measure ? new Array(iterations) : [];
  const memorySamples = config.mem ? [] : null;
  const retainedSnapshots = config.retainSnapshots ? [] : null;
  const startTotal = performance.now();
  if (memorySamples) {
    sampleMemory(memorySamples, 0, 0, retainedSnapshots?.length ?? 0);
  }

  for (let i = 0; i < iterations; i++) {
    const intentInstance = await createIntentInstance({
      body: {
        type: "tick",
        input: { delta: config.delta, nonce: i },
      },
      schemaHash: domain.schema.hash,
      projectionId: "bench",
      source: { kind: "system", eventId: `bench-${i}` },
      actor,
      intentId: `world-intent-${i}`,
    });

    const start = measure ? performance.now() : 0;
    const result = await world.submitProposal(
      actor.actorId,
      intentInstance,
      currentWorldId
    );
    if (measure) {
      durations[i] = performance.now() - start;
    }
    if (result.error || !result.resultWorld) {
      throw new Error(result.error?.message ?? "World execution failed");
    }
    currentWorldId = result.resultWorld.worldId;

    if (memorySamples && shouldSampleMemory(i + 1, iterations, config.memSampleEvery)) {
      if (retainedSnapshots) {
        const snapshot = await world.getSnapshot(currentWorldId);
        retainedSnapshots.push(snapshot);
      }
      sampleMemory(
        memorySamples,
        i + 1,
        performance.now() - startTotal,
        retainedSnapshots?.length ?? 0
      );
    }
  }

  const totalMs = performance.now() - startTotal;
  const snapshot = await world.getSnapshot(currentWorldId);

  return { totalMs, durations, snapshot, memorySamples };
}

async function main() {
  const config = parseArgs(process.argv.slice(2));

  let modules;
  try {
    const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const distPaths = {
      builder: path.join(rootDir, "packages", "builder", "dist", "index.js"),
      core: path.join(rootDir, "packages", "core", "dist", "index.js"),
      host: path.join(rootDir, "packages", "host", "dist", "index.js"),
      world: path.join(rootDir, "packages", "world", "dist", "index.js"),
    };

    const missing = Object.entries(distPaths)
      .filter(([, p]) => !existsSync(p))
      .map(([name, p]) => `${name}: ${p}`);

    if (missing.length > 0) {
      console.error("Missing build outputs:");
      for (const entry of missing) {
        console.error(`  ${entry}`);
      }
      console.error("Run `pnpm build` and try again.");
      process.exit(1);
    }

    const [{ z }, builder, core, host, world] = await Promise.all([
      import("zod"),
      import(pathToFileURL(distPaths.builder).href),
      import(pathToFileURL(distPaths.core).href),
      import(pathToFileURL(distPaths.host).href),
      import(pathToFileURL(distPaths.world).href),
    ]);
    modules = { z, builder, core, host, world };
  } catch (error) {
    console.error("Failed to load Manifesto packages.");
    console.error("Run `pnpm build` and try again.");
    throw error;
  }

  const domain = createBenchmarkDomain({
    z: modules.z,
    defineDomain: modules.builder.defineDomain,
    effects: config.effects,
  });

  const envInfo = {
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    cpus: os.cpus().length,
    cpuModel: os.cpus()[0]?.model ?? "unknown",
    memoryGb: Number((os.totalmem() / (1024 ** 3)).toFixed(2)),
  };

  console.log("Manifesto core-host-world benchmark");
  console.log(`Node: ${envInfo.node}`);
  console.log(`Platform: ${envInfo.platform}`);
  console.log(`CPU: ${envInfo.cpuModel} (${envInfo.cpus} cores)`);
  console.log(`Memory: ${envInfo.memoryGb} GB`);
  console.log("");
  console.log("Config:");
  console.log(`  profile: ${config.profile}`);
  console.log(`  mode: ${config.mode}`);
  console.log(`  iterations: ${config.iterations}`);
  console.log(`  warmup: ${config.warmup}`);
  console.log(`  arraySize: ${config.arraySize}`);
  console.log(`  effects: ${config.effects}`);
  console.log(`  mem: ${config.mem}`);
  console.log(`  memSampleEvery: ${config.memSampleEvery}`);
  console.log(`  retainSnapshots: ${config.retainSnapshots}`);
  console.log(`  delta: ${config.delta}`);
  console.log("");

  const results = [];

  if (config.mode === "host" || config.mode === "both") {
    if (config.warmup > 0) {
      await runHostLoop({
        domain,
        createHost: modules.host.createHost,
        createSnapshot: modules.core.createSnapshot,
        createIntent: modules.core.createIntent,
        config,
        iterations: config.warmup,
        measure: false,
      });
    }

    const hostResult = await runHostLoop({
      domain,
      createHost: modules.host.createHost,
      createSnapshot: modules.core.createSnapshot,
      createIntent: modules.core.createIntent,
      config,
      iterations: config.iterations,
      measure: true,
    });

    const stats = summarizeSamples(hostResult.durations, hostResult.totalMs);
    const memorySummary = summarizeMemorySamples(hostResult.memorySamples);
    printResult("Host", stats);
    if (config.mem) {
      printMemorySummary("Host", memorySummary);
    }
    results.push({
      name: "host",
      stats,
      memory: memorySummary,
      memorySamples: hostResult.memorySamples ?? null,
    });

    const hostCounter = hostResult.snapshot?.data?.counter;
    if (hostCounter !== config.iterations) {
      console.log(
        `Host validation: counter mismatch (expected ${config.iterations}, got ${hostCounter})`
      );
    }
    console.log("");
  }

  if (config.mode === "world" || config.mode === "both") {
    const makeWorldHost = () => {
      const hostInstance = modules.host.createHost(domain.schema, {
        snapshot: modules.core.createSnapshot(
          buildInitialData(config.arraySize),
          domain.schema.hash,
          { now: 0, randomSeed: "bench", durationMs: 0 }
        ),
        loop: { maxIterations: 10 },
        context: {
          now: () => 0,
          randomSeed: () => "bench",
        },
      });

      if (config.effects) {
        hostInstance.registerEffect("noop", async () => []);
      }

      return hostInstance;
    };

    if (config.warmup > 0) {
      const warmupHost = makeWorldHost();
      await runWorldLoop({
        domain,
        createManifestoWorld: modules.world.createManifestoWorld,
        createIntentInstance: modules.world.createIntentInstance,
        createSnapshot: modules.core.createSnapshot,
        config: { ...config, host: warmupHost },
        iterations: config.warmup,
        measure: false,
      });
    }

    const benchHost = makeWorldHost();
    const worldResult = await runWorldLoop({
      domain,
      createManifestoWorld: modules.world.createManifestoWorld,
      createIntentInstance: modules.world.createIntentInstance,
      createSnapshot: modules.core.createSnapshot,
      config: { ...config, host: benchHost },
      iterations: config.iterations,
      measure: true,
    });

    const stats = summarizeSamples(worldResult.durations, worldResult.totalMs);
    const memorySummary = summarizeMemorySamples(worldResult.memorySamples);
    printResult("World (includes Host + Core)", stats);
    if (config.mem) {
      printMemorySummary("World", memorySummary);
    }
    results.push({
      name: "world",
      stats,
      memory: memorySummary,
      memorySamples: worldResult.memorySamples ?? null,
    });

    const worldCounter = worldResult.snapshot?.data?.counter;
    if (config.debug) {
      const data = worldResult.snapshot?.data ?? {};
      const items = Array.isArray(data.items) ? data.items : [];
      const firstItem = items.length > 0 ? items[0] : undefined;
      const lastItem = items.length > 0 ? items[items.length - 1] : undefined;
      console.log(
        `[world] counter=${data.counter} lastAppliedNonce=${data.lastAppliedNonce} items[0]=${firstItem} items[last]=${lastItem}`
      );
    }
    if (worldCounter !== config.iterations) {
      console.log(
        `World validation: counter mismatch (expected ${config.iterations}, got ${worldCounter})`
      );
    }
    console.log("");
  }

  if (config.json) {
    const payload = {
      config,
      env: envInfo,
      results,
      recordedAt: new Date().toISOString(),
    };
    writeFileSync(config.json, JSON.stringify(payload, null, 2));
    console.log(`Wrote results to ${config.json}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
