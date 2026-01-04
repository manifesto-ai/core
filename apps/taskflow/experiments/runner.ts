/**
 * Experiment Runner
 *
 * Orchestrates the execution of all baselines against TaskBench.
 * Collects results and saves them for analysis.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  ExperimentState,
  ExperimentResult,
  TaskBenchItem,
  RunnerOptions,
  ExperimentMethod,
} from './types';
import { runManifesto } from './baselines/manifesto';
import { runOpenAIFunctions } from './baselines/openai-functions';
import { runClaudeTools } from './baselines/claude-tools';
import { runReact } from './baselines/react';
import { compareStates, isStateMatch, computeMinRequiredTools } from './measure';

// ============================================
// Load TaskBench Data
// ============================================

interface TaskBenchData {
  version: string;
  tasks: TaskBenchItem[];
}

interface InitialStateData {
  baseState: ExperimentState;
}

async function loadTaskBench(): Promise<TaskBenchItem[]> {
  const tasksPath = path.join(__dirname, 'taskset', 'tasks.json');
  const data = await fs.readFile(tasksPath, 'utf-8');
  const parsed: TaskBenchData = JSON.parse(data);
  return parsed.tasks;
}

async function loadInitialState(): Promise<ExperimentState> {
  const statePath = path.join(__dirname, 'taskset', 'initial-state.json');
  const data = await fs.readFile(statePath, 'utf-8');
  const parsed: InitialStateData = JSON.parse(data);
  return parsed.baseState;
}

// ============================================
// Method Configurations
// ============================================

interface MethodConfig {
  name: ExperimentMethod;
  models: string[];
  fn: (
    input: string,
    initialState: ExperimentState,
    model: string,
    taskId: string,
    taskCategory: string
  ) => Promise<ExperimentResult>;
}

const METHODS: MethodConfig[] = [
  {
    name: 'manifesto',
    models: ['gpt-4o-mini'],
    fn: async (input, state, model, taskId, category) =>
      runManifesto(input, state, taskId, category as any),
  },
  {
    name: 'openai-func',
    models: ['gpt-4o-mini', 'gpt-4o'],
    fn: async (input, state, model, taskId, category) =>
      runOpenAIFunctions(input, state, model as any, taskId, category as any),
  },
  {
    name: 'claude-tool',
    models: ['claude-3-5-sonnet-20241022'],
    fn: async (input, state, model, taskId, category) =>
      runClaudeTools(input, state, model as any, taskId, category as any),
  },
  {
    name: 'react',
    models: ['gpt-4o-mini', 'gpt-4o'],
    fn: async (input, state, model, taskId, category) =>
      runReact(input, state, model as any, taskId, category as any),
  },
];

// ============================================
// Main Runner
// ============================================

export async function runExperiment(options: RunnerOptions = {}): Promise<ExperimentResult[]> {
  const {
    subset,
    methods: methodFilter,
    repeat = 1,
    output = 'results/latest.json',
    verbose = false,
  } = options;

  // Load data
  const allTasks = await loadTaskBench();
  const initialState = await loadInitialState();

  // Filter tasks if subset specified
  const tasks = subset ? allTasks.filter((t) => subset.includes(t.id)) : allTasks;

  // Filter methods if specified
  const methodsToRun = methodFilter
    ? METHODS.filter((m) => methodFilter.includes(m.name))
    : METHODS;

  const results: ExperimentResult[] = [];
  const totalRuns = tasks.length * methodsToRun.reduce((acc, m) => acc + m.models.length, 0) * repeat;
  let currentRun = 0;

  console.log(`\n🚀 Starting experiment with ${tasks.length} tasks, ${methodsToRun.length} methods\n`);
  console.log(`Total runs: ${totalRuns}\n`);

  for (const task of tasks) {
    for (const method of methodsToRun) {
      for (const model of method.models) {
        for (let i = 0; i < repeat; i++) {
          currentRun++;
          const progress = ((currentRun / totalRuns) * 100).toFixed(1);

          if (verbose) {
            console.log(
              `[${progress}%] Running ${method.name}/${model} on ${task.id} (${i + 1}/${repeat})...`
            );
          } else {
            process.stdout.write(`\r[${progress}%] ${task.id} - ${method.name}/${model}          `);
          }

          try {
            // Clone initial state for each run
            const stateClone: ExperimentState = JSON.parse(JSON.stringify(initialState));

            // Run baseline
            const result = await method.fn(
              task.input,
              stateClone,
              model,
              task.id,
              task.category
            );

            // Update result with expected state comparison
            // Note: For now, we compare against initial state
            // TODO: Generate expected states for each task
            result.minRequiredTools = computeMinRequiredTools(task.id, task.category);

            results.push(result);

            if (verbose && result.error) {
              console.log(`  ⚠️ Error: ${result.error}`);
            }
          } catch (error) {
            console.error(`\n❌ Fatal error on ${task.id} - ${method.name}/${model}:`, error);
          }
        }
      }
    }
  }

  console.log('\n\n✅ Experiment completed\n');

  // Save results
  const outputPath = path.join(__dirname, output);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  console.log(`📊 Results saved to ${outputPath}\n`);

  // Print summary
  printSummary(results);

  return results;
}

// ============================================
// Summary Printing
// ============================================

function printSummary(results: ExperimentResult[]): void {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                         EXPERIMENT SUMMARY                          ');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Group by method/model
  const grouped = new Map<string, ExperimentResult[]>();

  for (const result of results) {
    const key = `${result.method}/${result.model}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(result);
  }

  // Print table header
  console.log('┌─────────────────────────────┬───────┬─────────┬──────────┬─────────┬──────────┐');
  console.log('│ Method/Model                │ Calls │ Tokens  │ Cost     │ Latency │ Success  │');
  console.log('├─────────────────────────────┼───────┼─────────┼──────────┼─────────┼──────────┤');

  for (const [key, groupResults] of grouped) {
    const avgCalls = average(groupResults.map((r) => r.llmCalls));
    const avgTokens = average(groupResults.map((r) => r.totalTokens));
    const avgCost = average(groupResults.map((r) => r.costUsd));
    const avgLatency = average(groupResults.map((r) => r.latencyMs));
    const successRate = (groupResults.filter((r) => r.success).length / groupResults.length) * 100;

    console.log(
      `│ ${key.padEnd(27)} │ ${avgCalls.toFixed(1).padStart(5)} │ ${avgTokens.toFixed(0).padStart(7)} │ $${avgCost.toFixed(4).padStart(7)} │ ${(avgLatency / 1000).toFixed(1).padStart(5)}s │ ${successRate.toFixed(0).padStart(6)}%  │`
    );
  }

  console.log('└─────────────────────────────┴───────┴─────────┴──────────┴─────────┴──────────┘\n');

  // Print by category
  console.log('By Category:\n');
  console.log('┌─────────────┬───────────────────────────────────────────────────────────────────┐');
  console.log('│ Category    │ Manifesto │ OpenAI-mini │ OpenAI-4o │ Claude │ ReAct-mini │ ReAct │');
  console.log('├─────────────┼───────────┼─────────────┼───────────┼────────┼────────────┼───────┤');

  const categories = ['simple', 'multi-field', 'contextual', 'bulk', 'exception'];

  for (const category of categories) {
    const categoryResults = results.filter((r) => r.taskCategory === category);
    const row = [category.padEnd(11)];

    for (const method of ['manifesto', 'openai-func', 'openai-func', 'claude-tool', 'react', 'react']) {
      const model = method === 'manifesto' ? 'gpt-4o-mini' :
                    method === 'claude-tool' ? 'claude-3-5-sonnet-20241022' :
                    method.includes('4o') ? 'gpt-4o' : 'gpt-4o-mini';

      const methodResults = categoryResults.filter(
        (r) => r.method === method.replace('-4o', '-func') && r.model === model
      );

      if (methodResults.length > 0) {
        const avgCalls = average(methodResults.map((r) => r.llmCalls));
        row.push(avgCalls.toFixed(1).padStart(method === 'manifesto' ? 9 : method.includes('mini') ? 11 : 9));
      } else {
        row.push('-'.padStart(method === 'manifesto' ? 9 : method.includes('mini') ? 11 : 9));
      }
    }

    console.log(`│ ${row.join(' │ ')} │`);
  }

  console.log('└─────────────┴───────────┴─────────────┴───────────┴────────┴────────────┴───────┘\n');
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// ============================================
// CLI Entry Point
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const options: RunnerOptions = {
    verbose: args.includes('--verbose') || args.includes('-v'),
  };

  // Parse subset
  const subsetIdx = args.indexOf('--subset');
  if (subsetIdx !== -1 && args[subsetIdx + 1]) {
    options.subset = args[subsetIdx + 1].split(',');
  }

  // Parse methods
  const methodsIdx = args.indexOf('--methods');
  if (methodsIdx !== -1 && args[methodsIdx + 1]) {
    options.methods = args[methodsIdx + 1].split(',') as ExperimentMethod[];
  }

  // Parse repeat
  const repeatIdx = args.indexOf('--repeat');
  if (repeatIdx !== -1 && args[repeatIdx + 1]) {
    options.repeat = parseInt(args[repeatIdx + 1], 10);
  }

  // Parse output
  const outputIdx = args.indexOf('--output');
  if (outputIdx !== -1 && args[outputIdx + 1]) {
    options.output = args[outputIdx + 1];
  }

  await runExperiment(options);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
