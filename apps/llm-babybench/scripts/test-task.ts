#!/usr/bin/env npx tsx
/**
 * LLM-BabyBench Single Task Tester
 *
 * Run a single benchmark task and see detailed results.
 *
 * Usage:
 *   npx tsx scripts/test-task.ts                           # Default: predict, task 0, bfs
 *   npx tsx scripts/test-task.ts --config predict --task 5
 *   npx tsx scripts/test-task.ts --actor llm --model gpt-4o
 *   npx tsx scripts/test-task.ts --actor human             # Interactive mode
 */

import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../../../.env.local") });

import { parseArgs } from "util";
import { loadDataset } from "../src/dataset/index.js";
import { createTask, runTask, type BenchTask } from "../src/bench/index.js";
import { createBFSActor, createLLMActor, createHybridActor } from "../src/actors/index.js";
import type { DatasetConfig } from "../src/dataset/types.js";
import type { Actor } from "../src/bench/index.js";

interface Config {
  datasetConfig: DatasetConfig;
  taskIndex: number;
  actorType: "bfs" | "llm" | "hybrid" | "human";
  model: string;
  verbose: boolean;
}

function parseConfig(): Config {
  const { values } = parseArgs({
    options: {
      config: { type: "string", short: "c", default: "predict" },
      task: { type: "string", short: "t", default: "0" },
      actor: { type: "string", short: "a", default: "bfs" },
      model: { type: "string", short: "m", default: "gpt-4o-mini" },
      verbose: { type: "boolean", short: "v", default: false },
    },
  });

  return {
    datasetConfig: values.config as DatasetConfig,
    taskIndex: parseInt(values.task as string, 10),
    actorType: values.actor as Config["actorType"],
    model: values.model as string,
    verbose: values.verbose as boolean,
  };
}

function createActor(config: Config): Actor {
  switch (config.actorType) {
    case "bfs":
      return createBFSActor({ debug: config.verbose });
    case "llm":
      return createLLMActor({ model: config.model, debug: config.verbose });
    case "hybrid":
      return createHybridActor({ model: config.model, debug: config.verbose });
    case "human":
      throw new Error("Human mode not supported in this script. Use interactive-mode.ts instead.");
  }
}

function printTaskInfo(task: BenchTask): void {
  console.log("\n=== Task Info ===");
  console.log(`Level: ${task.row.level_name}`);
  console.log(`Seed: ${task.row.seed}`);
  console.log(`Mission: ${task.initialState.mission}`);
  console.log(`Grid: ${task.initialState.grid.width}x${task.initialState.grid.height}`);
  console.log(`Agent: (${task.initialState.agent.x}, ${task.initialState.agent.y}) facing ${["East", "South", "West", "North"][task.initialState.agent.direction]}`);
  console.log(`Objects: ${task.initialState.objects.length}`);
  for (const obj of task.initialState.objects) {
    console.log(`  - ${obj.color} ${obj.type} at (${obj.x}, ${obj.y})`);
  }
  console.log(`Max Steps: ${task.initialState.maxSteps}`);
}

async function main(): Promise<void> {
  const config = parseConfig();

  console.log("\n=== LLM-BabyBench Task Tester ===");
  console.log(`Config: ${config.datasetConfig}`);
  console.log(`Task: ${config.taskIndex}`);
  console.log(`Actor: ${config.actorType}`);
  if (config.actorType === "llm" || config.actorType === "hybrid") {
    console.log(`Model: ${config.model}`);
  }

  // Load dataset
  console.log("\nLoading dataset...");
  const rows = await loadDataset(config.datasetConfig, { limit: config.taskIndex + 1 });

  if (rows.length <= config.taskIndex) {
    console.error(`Task ${config.taskIndex} not found. Dataset has ${rows.length} rows.`);
    process.exit(1);
  }

  const row = rows[config.taskIndex];
  const task = createTask(row, config.datasetConfig);

  printTaskInfo(task);

  // Create actor
  const actor = createActor(config);

  // Run task
  console.log("\n=== Running Task ===");
  const startTime = Date.now();

  const result = await runTask(task, actor);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  // Print results
  console.log("\n=== Results ===");
  const isSuccess = result.outcome === "success";
  console.log(`Status: ${isSuccess ? "✅ SUCCESS" : `❌ ${result.outcome.toUpperCase()}`}`);
  console.log(`Steps: ${result.steps}/${task.initialState.maxSteps}`);
  console.log(`Time: ${elapsed}s`);

  if (result.reason) {
    console.log(`\nReason: ${result.reason}`);
  }

  console.log();
  process.exit(isSuccess ? 0 : 1);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
