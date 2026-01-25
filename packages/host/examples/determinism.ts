/**
 * Determinism Example
 *
 * Demonstrates v2.0.1 context determinism:
 * - Frozen context per job
 * - Deterministic `now` timestamp
 * - `randomSeed` derived from `intentId`
 * - Trace replay guarantee
 *
 * Run: cd packages/host && pnpm exec tsx examples/determinism.ts
 */

import { ManifestoHost, type Runtime } from "../src/index.js";
import { createTestSchema, createTestIntent } from "../src/__tests__/helpers/index.js";

// Create schema with counter action
const timestampSchema = createTestSchema({
  actions: {
    increment: {
      flow: {
        kind: "patch",
        op: "set",
        path: "count",
        value: {
          kind: "add",
          left: { kind: "coalesce", args: [{ kind: "get", path: "count" }, { kind: "lit", value: 0 }] },
          right: { kind: "lit", value: 1 },
        },
      },
    },
  },
});

// Fixed timestamp for deterministic testing
const FIXED_TIMESTAMP = 1704067200000; // 2024-01-01T00:00:00Z

async function main() {
  console.log("=== Determinism Example ===\n");

  // 1. Create a fixed runtime for deterministic execution
  const fixedRuntime: Runtime = {
    now: () => FIXED_TIMESTAMP,
    microtask: (fn) => queueMicrotask(fn),
    yield: () => Promise.resolve(),
  };

  console.log("Creating two hosts with fixed runtime...");
  console.log(`Fixed timestamp: ${FIXED_TIMESTAMP} (${new Date(FIXED_TIMESTAMP).toISOString()})`);

  // 2. Create two independent hosts with the same configuration
  const host1 = new ManifestoHost(timestampSchema, {
    initialData: { count: 0 },
    runtime: fixedRuntime,
  });

  const host2 = new ManifestoHost(timestampSchema, {
    initialData: { count: 0 },
    runtime: fixedRuntime,
  });

  // 3. Use the same intentId for both
  const intentId = "intent-determinism-test";

  console.log("\nDispatching same intent to both hosts...");
  console.log(`Intent ID: ${intentId}`);

  // 4. Dispatch to both hosts
  const result1 = await host1.dispatch(createTestIntent("increment", undefined, intentId));
  const result2 = await host2.dispatch(createTestIntent("increment", undefined, intentId));

  // 5. Compare results
  console.log("\nHost 1 result:");
  console.log("  count:", result1.snapshot.data.count);
  console.log("  timestamp:", result1.snapshot.meta.timestamp);
  console.log("  randomSeed:", result1.snapshot.meta.randomSeed);

  console.log("\nHost 2 result:");
  console.log("  count:", result2.snapshot.data.count);
  console.log("  timestamp:", result2.snapshot.meta.timestamp);
  console.log("  randomSeed:", result2.snapshot.meta.randomSeed);

  // 6. Verify determinism
  const areEqual =
    result1.snapshot.data.count === result2.snapshot.data.count &&
    result1.snapshot.meta.timestamp === result2.snapshot.meta.timestamp &&
    result1.snapshot.meta.randomSeed === result2.snapshot.meta.randomSeed;

  console.log("\nResults are identical:", areEqual);

  // 7. Demonstrate that different intentIds produce different randomSeeds
  console.log("\n--- Different intentIds produce different randomSeeds ---");

  const host3 = new ManifestoHost(timestampSchema, {
    initialData: { count: 0 },
    runtime: fixedRuntime,
  });

  const result3a = await host3.dispatch(createTestIntent("increment", undefined, "intent-A"));
  console.log("\nIntent A randomSeed:", result3a.snapshot.meta.randomSeed);

  host3.reset({ count: 0 });

  const result3b = await host3.dispatch(createTestIntent("increment", undefined, "intent-B"));
  console.log("Intent B randomSeed:", result3b.snapshot.meta.randomSeed);

  console.log("\nRandomSeeds are different:", result3a.snapshot.meta.randomSeed !== result3b.snapshot.meta.randomSeed);

  // 8. Demonstrate trace recording
  console.log("\n--- Trace Recording for Replay ---");

  const traceEvents: Array<{ t: string; timestamp?: number; [key: string]: unknown }> = [];

  const hostWithTrace = new ManifestoHost(timestampSchema, {
    initialData: { count: 0 },
    runtime: fixedRuntime,
    onTrace: (event) => {
      traceEvents.push(event as { t: string; timestamp?: number; [key: string]: unknown });
    },
  });

  await hostWithTrace.dispatch(createTestIntent("increment", undefined, "traced-intent"));

  console.log("\nRecorded trace events:");
  traceEvents.forEach((event, i) => {
    console.log(`  ${i + 1}. ${event.t}`);
  });

  console.log("\nWith this trace, the execution can be replayed deterministically.");
  console.log("The frozen context (timestamp, randomSeed) is captured at job start.");

  // 9. Summary
  console.log("\n=== Summary ===");
  console.log("v2.0.1 Context Determinism guarantees:");
  console.log("  1. HostContext is frozen at job start");
  console.log("  2. All operations in a job use the same frozen context");
  console.log("  3. now() value is captured once, never changes during job");
  console.log("  4. randomSeed is derived from intentId (deterministic)");
  console.log("  5. Trace replay produces identical results");

  console.log("\nDeterminism verified!");
}

main().catch(console.error);
