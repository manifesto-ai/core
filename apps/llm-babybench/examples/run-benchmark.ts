#!/usr/bin/env npx tsx
/**
 * LLM-BabyBench Benchmark Runner
 *
 * Runs BabyAI tasks with different actors using Manifesto World governance.
 *
 * Usage:
 *   npx tsx examples/run-benchmark.ts --config predict --actor bfs --limit 10
 *   npx tsx examples/run-benchmark.ts --config plan --actor hybrid --limit 5
 *   npx tsx examples/run-benchmark.ts --config predict --actor llm --limit 3
 */

import { parseArgs } from "util";
import {
  createTask,
  runTask,
  type TaskResult,
} from "../src/bench/index.js";
import {
  createBFSActor,
  createLLMActor,
  createHybridActor,
} from "../src/actors/index.js";
import { loadDataset, type DatasetConfig } from "../src/dataset/index.js";
import type { Actor } from "../src/bench/index.js";

// =============================================================================
// CLI Args
// =============================================================================

interface BenchmarkConfig {
  config: DatasetConfig;
  actor: "bfs" | "llm" | "hybrid";
  model: string;
  limit: number;
  debug: boolean;
}

function parseConfig(): BenchmarkConfig {
  const { values } = parseArgs({
    options: {
      config: {
        type: "string",
        short: "c",
        default: "predict",
      },
      actor: {
        type: "string",
        short: "a",
        default: "bfs",
      },
      model: {
        type: "string",
        short: "m",
        default: "gpt-4o-mini",
      },
      limit: {
        type: "string",
        short: "n",
        default: "10",
      },
      debug: {
        type: "boolean",
        short: "d",
        default: false,
      },
    },
  });

  return {
    config: values.config as DatasetConfig,
    actor: values.actor as "bfs" | "llm" | "hybrid",
    model: values.model as string,
    limit: parseInt(values.limit as string, 10),
    debug: values.debug as boolean,
  };
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const config = parseConfig();

  console.log("=".repeat(60));
  console.log("LLM-BabyBench");
  console.log("=".repeat(60));
  console.log(`Config:     ${config.config}`);
  console.log(`Actor:      ${config.actor}`);
  console.log(`Model:      ${config.model}`);
  console.log(`Limit:      ${config.limit}`);
  console.log(`Mode:       ManifestoWorld governance`);
  console.log("=".repeat(60));

  // 1. Create actor
  console.log("\n[1/3] Creating actor...");
  const actor = createActor(config);
  console.log(`  Actor ID: ${actor.id}`);

  // 2. Load dataset
  console.log("[2/3] Loading dataset...");
  const rows = await loadDataset(config.config, { limit: config.limit });
  console.log(`  Loaded ${rows.length} tasks`);

  // 3. Run tasks
  console.log("[3/3] Running tasks...\n");

  const results: TaskResult[] = [];
  let successCount = 0;
  let failureCount = 0;
  let timeoutCount = 0;
  let totalSteps = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const task = createTask(row, config.config);

    process.stdout.write(`  [${i + 1}/${rows.length}] ${task.id}... `);

    // Reset actor state before each task
    actor.reset();

    const result = await runTask(task, actor);
    results.push(result);

    // Update stats
    totalSteps += result.steps;

    switch (result.outcome) {
      case "success":
        successCount++;
        console.log(`SUCCESS (${result.steps} steps)`);
        break;
      case "failure":
        failureCount++;
        console.log(`FAILURE: ${result.reason}`);
        break;
      case "timeout":
        timeoutCount++;
        console.log(`TIMEOUT: ${result.reason}`);
        break;
    }

    if (config.debug) {
      console.log(`    Steps: ${result.steps}`);
    }
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("RESULTS SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total tasks:       ${rows.length}`);
  console.log(
    `Success:           ${successCount} (${((successCount / rows.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `Failure:           ${failureCount} (${((failureCount / rows.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `Timeout:           ${timeoutCount} (${((timeoutCount / rows.length) * 100).toFixed(1)}%)`
  );
  console.log("-".repeat(60));
  console.log(`Total steps:       ${totalSteps}`);
  console.log(`Avg steps/task:    ${(totalSteps / rows.length).toFixed(2)}`);
  console.log("=".repeat(60));

  // Manifesto proof
  console.log("\n" + "=".repeat(60));
  console.log("MANIFESTO WORLD GOVERNANCE");
  console.log("=".repeat(60));
  console.log("Using: @manifesto-ai/world ManifestoWorld");
  console.log("       World.submitProposal() for all state changes");
  console.log("       Domain flow.effect() for game logic");
  console.log("-".repeat(60));
  console.log(`Actor ${config.actor} executed ${totalSteps} steps`);
  console.log("All actions validated through World governance layer");
  console.log("=".repeat(60));
}

function createActor(config: BenchmarkConfig): Actor {
  switch (config.actor) {
    case "bfs":
      return createBFSActor({ debug: config.debug });
    case "llm":
      return createLLMActor({
        model: config.model,
        temperature: 0.2,
        debug: config.debug,
      });
    case "hybrid":
      return createHybridActor({
        model: config.model,
        temperature: 0.2,
        debug: config.debug,
      });
    default:
      throw new Error(`Unknown actor: ${config.actor}`);
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
