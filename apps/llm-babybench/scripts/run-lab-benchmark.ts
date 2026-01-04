#!/usr/bin/env npx tsx
/**
 * LLM-BabyBench Lab Benchmark Runner
 *
 * Runs benchmark tests with Lab integration for trace recording and report generation.
 *
 * Features:
 * - Tests each difficulty level with multiple iterations
 * - Records traces using Lab package
 * - Generates comprehensive reports (JSON, Markdown, HTML)
 * - Aggregates metrics across runs
 *
 * Usage:
 *   npx tsx scripts/run-lab-benchmark.ts                           # Run all configs
 *   npx tsx scripts/run-lab-benchmark.ts --config predict          # Single config
 *   npx tsx scripts/run-lab-benchmark.ts --iterations 3            # 3 iterations per level
 *   npx tsx scripts/run-lab-benchmark.ts --actor llm --model gpt-4o
 */

import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as fs from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../../../.env.local") });

import { parseArgs } from "util";
import { createTask, runTask, type TaskResult, type Actor } from "../src/bench/index.js";
import { createBFSActor, createLLMActor, createHybridActor } from "../src/actors/index.js";
import { loadDataset, type DatasetConfig, type BabyBenchRow } from "../src/dataset/index.js";
import { summarize, formatSummary, toMarkdown, toHTML, toReportJSON, type TraceSummary, type LabTrace } from "@manifesto-ai/lab";

// =============================================================================
// Types
// =============================================================================

interface BenchmarkConfig {
  configs: DatasetConfig[];
  actorType: "bfs" | "llm" | "hybrid";
  model: string;
  iterations: number;
  outputDir: string;
  debug: boolean;
}

interface LevelResult {
  levelName: string;
  config: DatasetConfig;
  iterations: IterationResult[];
  summary: LevelSummary;
}

interface IterationResult {
  iteration: number;
  taskResults: TaskResult[];
  successRate: number;
  avgSteps: number;
  durationMs: number;
}

interface LevelSummary {
  totalRuns: number;
  successRate: number;
  avgSteps: number;
  avgDurationMs: number;
  successRateStdDev: number;
}

interface BenchmarkReport {
  meta: {
    startedAt: string;
    completedAt: string;
    durationMs: number;
    actor: string;
    model?: string;
    iterationsPerLevel: number;
  };
  configs: Record<DatasetConfig, ConfigReport>;
  overall: OverallSummary;
}

interface ConfigReport {
  levels: LevelResult[];
  summary: {
    totalLevels: number;
    avgSuccessRate: number;
    avgSteps: number;
    totalRuns: number;
  };
}

interface OverallSummary {
  totalConfigs: number;
  totalLevels: number;
  totalRuns: number;
  overallSuccessRate: number;
  avgSteps: number;
  avgDurationMs: number;
}

// =============================================================================
// CLI Args
// =============================================================================

function parseConfig(): BenchmarkConfig {
  const { values } = parseArgs({
    options: {
      config: { type: "string", short: "c" },
      actor: { type: "string", short: "a", default: "bfs" },
      model: { type: "string", short: "m", default: "gpt-4o-mini" },
      iterations: { type: "string", short: "i", default: "5" },
      output: { type: "string", short: "o", default: "./benchmark-reports" },
      debug: { type: "boolean", short: "d", default: false },
    },
  });

  const configs: DatasetConfig[] = values.config
    ? [values.config as DatasetConfig]
    : ["predict", "plan", "decompose"];

  return {
    configs,
    actorType: values.actor as "bfs" | "llm" | "hybrid",
    model: values.model as string,
    iterations: parseInt(values.iterations as string, 10),
    outputDir: values.output as string,
    debug: values.debug as boolean,
  };
}

// =============================================================================
// Actor Factory
// =============================================================================

function createActor(config: BenchmarkConfig): Actor {
  switch (config.actorType) {
    case "bfs":
      return createBFSActor({ debug: config.debug });
    case "llm":
      return createLLMActor({ model: config.model, debug: config.debug });
    case "hybrid":
      return createHybridActor({ model: config.model, debug: config.debug });
    default:
      throw new Error(`Unknown actor type: ${config.actorType}`);
  }
}

// =============================================================================
// Benchmark Runner
// =============================================================================

async function runLevelBenchmark(
  levelName: string,
  rows: BabyBenchRow[],
  datasetConfig: DatasetConfig,
  actor: Actor,
  iterations: number,
  debug: boolean
): Promise<LevelResult> {
  const iterationResults: IterationResult[] = [];

  for (let iter = 0; iter < iterations; iter++) {
    const startTime = Date.now();
    const taskResults: TaskResult[] = [];
    let successCount = 0;
    let totalSteps = 0;

    // Sample 5 random tasks from this level for each iteration
    const sampleSize = Math.min(5, rows.length);
    const sampledRows = shuffleArray([...rows]).slice(0, sampleSize);

    for (const row of sampledRows) {
      const task = createTask(row, datasetConfig);
      actor.reset?.();

      try {
        const result = await runTask(task, actor);
        taskResults.push(result);

        if (result.outcome === "success") {
          successCount++;
        }
        totalSteps += result.steps;

        if (debug) {
          const status = result.outcome === "success" ? "✅" : "❌";
          console.log(`      ${status} Task ${task.id}: ${result.outcome} (${result.steps} steps)`);
        }
      } catch (error) {
        taskResults.push({
          taskId: task.id,
          outcome: "failure",
          steps: 0,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const durationMs = Date.now() - startTime;
    const successRate = taskResults.length > 0 ? successCount / taskResults.length : 0;
    const avgSteps = taskResults.length > 0 ? totalSteps / taskResults.length : 0;

    iterationResults.push({
      iteration: iter + 1,
      taskResults,
      successRate,
      avgSteps,
      durationMs,
    });
  }

  // Calculate level summary
  const successRates = iterationResults.map((r) => r.successRate);
  const avgSuccessRate = successRates.reduce((a, b) => a + b, 0) / successRates.length;
  const avgSteps = iterationResults.reduce((a, r) => a + r.avgSteps, 0) / iterationResults.length;
  const avgDurationMs = iterationResults.reduce((a, r) => a + r.durationMs, 0) / iterationResults.length;

  // Calculate standard deviation
  const variance = successRates.reduce((a, r) => a + Math.pow(r - avgSuccessRate, 2), 0) / successRates.length;
  const stdDev = Math.sqrt(variance);

  return {
    levelName,
    config: datasetConfig,
    iterations: iterationResults,
    summary: {
      totalRuns: iterationResults.length,
      successRate: avgSuccessRate,
      avgSteps,
      avgDurationMs,
      successRateStdDev: stdDev,
    },
  };
}

async function runConfigBenchmark(
  config: DatasetConfig,
  actor: Actor,
  iterations: number,
  debug: boolean
): Promise<ConfigReport> {
  console.log(`\n[${config.toUpperCase()}] Loading dataset...`);
  const allRows = await loadDataset(config);

  // Group rows by level
  const levelMap = new Map<string, BabyBenchRow[]>();
  for (const row of allRows) {
    const level = row.level_name;
    if (!levelMap.has(level)) {
      levelMap.set(level, []);
    }
    levelMap.get(level)!.push(row);
  }

  const levels = [...levelMap.keys()].sort();
  console.log(`  Found ${levels.length} levels, ${allRows.length} total tasks`);

  const levelResults: LevelResult[] = [];
  let successSum = 0;
  let stepsSum = 0;
  let totalRuns = 0;

  for (let i = 0; i < levels.length; i++) {
    const levelName = levels[i];
    const rows = levelMap.get(levelName)!;

    console.log(`  [${i + 1}/${levels.length}] ${levelName} (${rows.length} tasks, ${iterations} iterations)...`);

    const result = await runLevelBenchmark(levelName, rows, config, actor, iterations, debug);
    levelResults.push(result);

    successSum += result.summary.successRate;
    stepsSum += result.summary.avgSteps;
    totalRuns += result.summary.totalRuns;

    // Progress indicator
    const pct = ((result.summary.successRate) * 100).toFixed(1);
    const bar = "█".repeat(Math.floor(result.summary.successRate * 20)) + "░".repeat(20 - Math.floor(result.summary.successRate * 20));
    console.log(`      [${bar}] ${pct}% success, avg ${result.summary.avgSteps.toFixed(1)} steps`);
  }

  return {
    levels: levelResults,
    summary: {
      totalLevels: levels.length,
      avgSuccessRate: levels.length > 0 ? successSum / levels.length : 0,
      avgSteps: levels.length > 0 ? stepsSum / levels.length : 0,
      totalRuns,
    },
  };
}

// =============================================================================
// Report Generation
// =============================================================================

function generateBenchmarkReport(
  configReports: Record<DatasetConfig, ConfigReport>,
  config: BenchmarkConfig,
  startedAt: Date,
  completedAt: Date
): BenchmarkReport {
  const configs = Object.keys(configReports) as DatasetConfig[];

  let totalLevels = 0;
  let totalRuns = 0;
  let successSum = 0;
  let stepsSum = 0;
  let durationSum = 0;

  for (const configName of configs) {
    const report = configReports[configName];
    totalLevels += report.summary.totalLevels;
    totalRuns += report.summary.totalRuns;
    successSum += report.summary.avgSuccessRate * report.summary.totalLevels;
    stepsSum += report.summary.avgSteps * report.summary.totalLevels;

    for (const level of report.levels) {
      durationSum += level.summary.avgDurationMs * level.summary.totalRuns;
    }
  }

  return {
    meta: {
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      actor: config.actorType,
      model: config.actorType !== "bfs" ? config.model : undefined,
      iterationsPerLevel: config.iterations,
    },
    configs: configReports,
    overall: {
      totalConfigs: configs.length,
      totalLevels,
      totalRuns,
      overallSuccessRate: totalLevels > 0 ? successSum / totalLevels : 0,
      avgSteps: totalLevels > 0 ? stepsSum / totalLevels : 0,
      avgDurationMs: totalRuns > 0 ? durationSum / totalRuns : 0,
    },
  };
}

function formatBenchmarkReportMarkdown(report: BenchmarkReport): string {
  const lines: string[] = [];

  lines.push("# LLM-BabyBench Benchmark Report");
  lines.push("");
  lines.push("## Overview");
  lines.push("");
  lines.push("| Property | Value |");
  lines.push("|----------|-------|");
  lines.push(`| Actor | ${report.meta.actor} |`);
  if (report.meta.model) {
    lines.push(`| Model | ${report.meta.model} |`);
  }
  lines.push(`| Iterations per Level | ${report.meta.iterationsPerLevel} |`);
  lines.push(`| Started | ${report.meta.startedAt} |`);
  lines.push(`| Completed | ${report.meta.completedAt} |`);
  lines.push(`| Duration | ${formatDuration(report.meta.durationMs)} |`);
  lines.push("");

  lines.push("## Overall Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| Total Configs | ${report.overall.totalConfigs} |`);
  lines.push(`| Total Levels | ${report.overall.totalLevels} |`);
  lines.push(`| Total Runs | ${report.overall.totalRuns} |`);
  lines.push(`| Overall Success Rate | **${(report.overall.overallSuccessRate * 100).toFixed(1)}%** |`);
  lines.push(`| Avg Steps | ${report.overall.avgSteps.toFixed(2)} |`);
  lines.push(`| Avg Duration | ${formatDuration(report.overall.avgDurationMs)} |`);
  lines.push("");

  for (const [configName, configReport] of Object.entries(report.configs)) {
    lines.push(`## ${configName.toUpperCase()} Config`);
    lines.push("");
    lines.push(`**Summary:** ${configReport.summary.totalLevels} levels, ${(configReport.summary.avgSuccessRate * 100).toFixed(1)}% avg success rate`);
    lines.push("");
    lines.push("| Level | Success Rate | Avg Steps | Std Dev |");
    lines.push("|-------|--------------|-----------|---------|");

    for (const level of configReport.levels) {
      const successPct = (level.summary.successRate * 100).toFixed(1);
      const stdDevPct = (level.summary.successRateStdDev * 100).toFixed(1);
      lines.push(`| ${level.levelName} | ${successPct}% | ${level.summary.avgSteps.toFixed(1)} | ±${stdDevPct}% |`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("*Generated by LLM-BabyBench with @manifesto-ai/lab*");

  return lines.join("\n");
}

function formatBenchmarkReportHTML(report: BenchmarkReport): string {
  const successClass = (rate: number) =>
    rate >= 0.8 ? "success" : rate >= 0.5 ? "warning" : "failure";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LLM-BabyBench Benchmark Report</title>
  <style>
    :root {
      --success-color: #22c55e;
      --warning-color: #f59e0b;
      --failure-color: #ef4444;
      --border-color: #e5e7eb;
      --bg-color: #f9fafb;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
    }
    h1, h2, h3 { margin-top: 2rem; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { padding: 0.75rem; border: 1px solid var(--border-color); text-align: left; }
    th { background: var(--bg-color); }
    .rate { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: 600; }
    .rate.success { background: #dcfce7; color: #166534; }
    .rate.warning { background: #fef3c7; color: #92400e; }
    .rate.failure { background: #fee2e2; color: #991b1b; }
    .progress-bar { width: 100px; height: 20px; background: #e5e7eb; border-radius: 4px; overflow: hidden; display: inline-block; }
    .progress-fill { height: 100%; background: var(--success-color); }
    .code { font-family: 'Monaco', 'Consolas', monospace; background: var(--bg-color); padding: 0.125rem 0.375rem; border-radius: 0.25rem; }
    footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--border-color); font-size: 0.875rem; color: #6b7280; }
    .summary-box { background: var(--bg-color); padding: 1.5rem; border-radius: 8px; margin: 1rem 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
    .summary-item { text-align: center; }
    .summary-item .value { font-size: 2rem; font-weight: bold; color: #111827; }
    .summary-item .label { font-size: 0.875rem; color: #6b7280; }
  </style>
</head>
<body>
  <h1>LLM-BabyBench Benchmark Report</h1>

  <div class="summary-box">
    <div class="summary-grid">
      <div class="summary-item">
        <div class="value rate ${successClass(report.overall.overallSuccessRate)}">${(report.overall.overallSuccessRate * 100).toFixed(1)}%</div>
        <div class="label">Overall Success Rate</div>
      </div>
      <div class="summary-item">
        <div class="value">${report.overall.totalRuns}</div>
        <div class="label">Total Runs</div>
      </div>
      <div class="summary-item">
        <div class="value">${report.overall.avgSteps.toFixed(1)}</div>
        <div class="label">Avg Steps</div>
      </div>
    </div>
  </div>

  <h2>Configuration</h2>
  <table>
    <tr><th>Property</th><th>Value</th></tr>
    <tr><td>Actor</td><td><span class="code">${report.meta.actor}</span></td></tr>
    ${report.meta.model ? `<tr><td>Model</td><td><span class="code">${report.meta.model}</span></td></tr>` : ""}
    <tr><td>Iterations per Level</td><td>${report.meta.iterationsPerLevel}</td></tr>
    <tr><td>Duration</td><td>${formatDuration(report.meta.durationMs)}</td></tr>
  </table>

  ${Object.entries(report.configs)
    .map(
      ([configName, configReport]) => `
  <h2>${configName.toUpperCase()} Config</h2>
  <p><strong>${configReport.summary.totalLevels} levels</strong>, <span class="rate ${successClass(configReport.summary.avgSuccessRate)}">${(configReport.summary.avgSuccessRate * 100).toFixed(1)}%</span> avg success rate</p>
  <table>
    <tr>
      <th>Level</th>
      <th>Success Rate</th>
      <th>Progress</th>
      <th>Avg Steps</th>
      <th>Std Dev</th>
    </tr>
    ${configReport.levels
      .map(
        (level) => `
    <tr>
      <td>${level.levelName}</td>
      <td><span class="rate ${successClass(level.summary.successRate)}">${(level.summary.successRate * 100).toFixed(1)}%</span></td>
      <td>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${level.summary.successRate * 100}%"></div>
        </div>
      </td>
      <td>${level.summary.avgSteps.toFixed(1)}</td>
      <td>±${(level.summary.successRateStdDev * 100).toFixed(1)}%</td>
    </tr>`
      )
      .join("\n")}
  </table>`
    )
    .join("\n")}

  <footer>
    Generated by LLM-BabyBench with @manifesto-ai/lab
  </footer>
</body>
</html>`;
}

// =============================================================================
// Utilities
// =============================================================================

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const config = parseConfig();
  const startedAt = new Date();

  console.log("=".repeat(60));
  console.log("LLM-BabyBench Lab Benchmark Runner");
  console.log("=".repeat(60));
  console.log(`Configs:     ${config.configs.join(", ")}`);
  console.log(`Actor:       ${config.actorType}`);
  if (config.actorType !== "bfs") {
    console.log(`Model:       ${config.model}`);
  }
  console.log(`Iterations:  ${config.iterations} per level`);
  console.log(`Output:      ${config.outputDir}`);
  console.log("=".repeat(60));

  // Ensure output directory exists
  ensureDir(config.outputDir);

  // Create actor
  const actor = createActor(config);

  // Run benchmarks for each config
  const configReports: Record<DatasetConfig, ConfigReport> = {} as Record<DatasetConfig, ConfigReport>;

  for (const datasetConfig of config.configs) {
    configReports[datasetConfig] = await runConfigBenchmark(
      datasetConfig,
      actor,
      config.iterations,
      config.debug
    );
  }

  const completedAt = new Date();

  // Generate report
  const report = generateBenchmarkReport(configReports, config, startedAt, completedAt);

  // Save reports
  const timestamp = startedAt.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const baseFilename = `benchmark-${config.actorType}-${timestamp}`;

  // JSON
  const jsonPath = resolve(config.outputDir, `${baseFilename}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`\n✅ JSON report saved: ${jsonPath}`);

  // Markdown
  const mdPath = resolve(config.outputDir, `${baseFilename}.md`);
  fs.writeFileSync(mdPath, formatBenchmarkReportMarkdown(report));
  console.log(`✅ Markdown report saved: ${mdPath}`);

  // HTML
  const htmlPath = resolve(config.outputDir, `${baseFilename}.html`);
  fs.writeFileSync(htmlPath, formatBenchmarkReportHTML(report));
  console.log(`✅ HTML report saved: ${htmlPath}`);

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("BENCHMARK COMPLETE");
  console.log("=".repeat(60));
  console.log(`Duration:        ${formatDuration(report.meta.durationMs)}`);
  console.log(`Total Runs:      ${report.overall.totalRuns}`);
  console.log(`Success Rate:    ${(report.overall.overallSuccessRate * 100).toFixed(1)}%`);
  console.log(`Avg Steps:       ${report.overall.avgSteps.toFixed(2)}`);
  console.log("=".repeat(60));

  // Per-config summary
  for (const [configName, configReport] of Object.entries(report.configs)) {
    console.log(`\n[${configName.toUpperCase()}]`);
    console.log(`  Levels:       ${configReport.summary.totalLevels}`);
    console.log(`  Success Rate: ${(configReport.summary.avgSuccessRate * 100).toFixed(1)}%`);
    console.log(`  Avg Steps:    ${configReport.summary.avgSteps.toFixed(2)}`);
  }

  console.log("\n✅ Reports saved to:", config.outputDir);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
