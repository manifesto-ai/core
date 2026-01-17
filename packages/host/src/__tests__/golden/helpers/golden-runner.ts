/**
 * Golden Test Runner Infrastructure
 *
 * Provides utilities for running golden tests that compare execution results
 * against known-good snapshots. Supports:
 * - End-to-end scenario execution
 * - Trace snapshot comparison
 * - Determinism verification
 * - Complex effect scenario testing
 *
 * @see host-SPEC-v2.0.1.md
 */

import type { DomainSchema, Snapshot, Intent, Patch, Requirement, FieldType } from "@manifesto-ai/core";
import { hashSchemaSync } from "@manifesto-ai/core";
import type { TraceEvent, ExecutionKey } from "../../compliance/hcts-types.js";
import type { DeterministicRuntime } from "../../compliance/hcts-runtime.js";
import { createTestRuntime } from "../../compliance/hcts-runtime.js";
import { V2HostAdapter } from "../../compliance/adapter-v2.js";
import { SimpleTestEffectRunner } from "../../compliance/hcts-adapter.js";
import type { EffectHandler, EffectContext } from "../../../effects/types.js";

/**
 * Golden test scenario definition
 */
export interface GoldenScenario {
  /** Unique scenario identifier */
  id: string;

  /** Human-readable description */
  description: string;

  /** Domain schema for the scenario */
  schema: DomainSchema;

  /** Initial state data */
  initialData: Record<string, unknown>;

  /** Effect handlers for the scenario */
  effectHandlers?: Record<string, EffectHandler>;

  /** Sequence of intents to execute */
  intents: Array<{
    type: string;
    input?: Record<string, unknown>;
  }>;

  /** Expected final state (for comparison) */
  expectedFinalState?: Record<string, unknown>;

  /** Expected trace events (for comparison) */
  expectedTracePattern?: Partial<TraceEvent>[];
}

/**
 * Golden test execution result
 */
export interface GoldenResult {
  /** Final snapshot after all intents */
  finalSnapshot: Snapshot;

  /** Full trace of all events */
  trace: TraceEvent[];

  /** Normalized trace for comparison (removes timestamps, etc.) */
  normalizedTrace: NormalizedTraceEvent[];

  /** State snapshots after each intent */
  stateHistory: Array<{
    intentType: string;
    snapshot: Snapshot;
  }>;

  /** Execution metadata */
  metadata: {
    scenarioId: string;
    intentCount: number;
    totalTraceEvents: number;
    executionTimeVirtual: number;
  };
}

/**
 * Normalized trace event for comparison (removes non-deterministic fields)
 */
export interface NormalizedTraceEvent {
  t: string;
  key: string;
  [key: string]: unknown;
}

/**
 * Golden Test Runner
 *
 * Executes scenarios and produces reproducible results for golden comparison.
 */
export class GoldenRunner {
  private runtime: DeterministicRuntime;
  private adapter: V2HostAdapter;
  private effectRunner: SimpleTestEffectRunner;
  private executionKey: ExecutionKey = "golden-test-key";

  constructor() {
    this.runtime = createTestRuntime();
    this.adapter = new V2HostAdapter();
    this.effectRunner = new SimpleTestEffectRunner();
  }

  /**
   * Execute a golden scenario and return the result
   */
  async execute(scenario: GoldenScenario): Promise<GoldenResult> {
    // Reset state
    this.runtime.reset();
    this.effectRunner = new SimpleTestEffectRunner();

    // Register effect handlers
    if (scenario.effectHandlers) {
      for (const [type, handler] of Object.entries(scenario.effectHandlers)) {
        this.effectRunner.register(type, handler);
      }
    }

    // Create adapter
    await this.adapter.create({
      schema: scenario.schema,
      effectRunner: this.effectRunner,
      runtime: this.runtime,
    });

    // Seed initial snapshot
    const initialSnapshot = createGoldenSnapshot(scenario.initialData, scenario.schema.hash);
    this.adapter.seedSnapshot(this.executionKey, initialSnapshot);

    // Track state history
    const stateHistory: GoldenResult["stateHistory"] = [];

    // Execute each intent
    let intentCounter = 0;
    for (const intentDef of scenario.intents) {
      intentCounter++;
      const intent: Intent = {
        type: intentDef.type,
        input: intentDef.input,
        intentId: `golden-intent-${intentCounter}`,
      };

      this.adapter.submitIntent(this.executionKey, intent);
      await this.adapter.drain(this.executionKey);

      // Record state after this intent
      stateHistory.push({
        intentType: intentDef.type,
        snapshot: this.adapter.getSnapshot(this.executionKey),
      });
    }

    // Get results
    const finalSnapshot = this.adapter.getSnapshot(this.executionKey);
    const trace = this.adapter.getTrace(this.executionKey);

    return {
      finalSnapshot,
      trace,
      normalizedTrace: normalizeTrace(trace),
      stateHistory,
      metadata: {
        scenarioId: scenario.id,
        intentCount: scenario.intents.length,
        totalTraceEvents: trace.length,
        executionTimeVirtual: this.runtime.now(),
      },
    };
  }

  /**
   * Execute the same scenario multiple times and verify determinism
   */
  async verifyDeterminism(scenario: GoldenScenario, runs: number = 3): Promise<{
    deterministic: boolean;
    results: GoldenResult[];
    differences?: string[];
  }> {
    const results: GoldenResult[] = [];

    for (let i = 0; i < runs; i++) {
      // Create fresh instances for each run
      this.runtime = createTestRuntime();
      this.adapter = new V2HostAdapter();
      this.effectRunner = new SimpleTestEffectRunner();

      const result = await this.execute(scenario);
      results.push(result);
    }

    // Compare all results
    const differences: string[] = [];
    const baseline = results[0];

    for (let i = 1; i < results.length; i++) {
      const current = results[i];

      // Compare final state
      if (JSON.stringify(baseline.finalSnapshot.data) !== JSON.stringify(current.finalSnapshot.data)) {
        differences.push(`Run ${i + 1}: Final state differs from baseline`);
      }

      // Compare normalized trace
      if (JSON.stringify(baseline.normalizedTrace) !== JSON.stringify(current.normalizedTrace)) {
        differences.push(`Run ${i + 1}: Trace pattern differs from baseline`);
      }

      // Compare trace event count
      if (baseline.trace.length !== current.trace.length) {
        differences.push(`Run ${i + 1}: Trace event count differs (${baseline.trace.length} vs ${current.trace.length})`);
      }
    }

    return {
      deterministic: differences.length === 0,
      results,
      differences: differences.length > 0 ? differences : undefined,
    };
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    await this.adapter.dispose();
  }
}

/**
 * Create a golden test snapshot with deterministic metadata
 */
export function createGoldenSnapshot(
  data: Record<string, unknown>,
  schemaHash: string
): Snapshot {
  return {
    data,
    computed: {},
    system: {
      status: "idle",
      pendingRequirements: [],
      lastError: null,
      errors: [],
      currentAction: null,
    },
    meta: {
      version: 0,
      timestamp: 0, // Deterministic
      randomSeed: "golden-seed",
      schemaHash,
    },
    input: undefined,
  };
}

/**
 * Normalize an ID by removing all random parts (numbers and random strings)
 * This ensures deterministic comparison across runs
 */
function normalizeId(id: string): string {
  // Replace numbers with N
  // Replace random alphanumeric suffixes (after dashes) with X
  return id
    .replace(/\d+/g, "N")
    .replace(/-[a-zA-Z]+$/g, "-X"); // Replace random suffix like "-hNawqku" with "-X"
}

/**
 * Normalize trace events for comparison by removing non-deterministic fields
 */
export function normalizeTrace(trace: TraceEvent[]): NormalizedTraceEvent[] {
  return trace.map((event) => {
    const normalized: NormalizedTraceEvent = { t: event.t, key: (event as any).key ?? "" };

    // Copy relevant fields based on event type
    switch (event.t) {
      case "runner:kick":
      case "runner:start":
      case "runner:end":
        // Remove timestamp
        break;

      case "runner:recheck":
        normalized.queueEmpty = event.queueEmpty;
        normalized.kickRequested = event.kickRequested;
        break;

      case "job:start":
      case "job:end":
        normalized.jobType = event.jobType;
        // Normalize jobId - remove random suffix
        normalized.jobIdPattern = normalizeId(event.jobId);
        break;

      case "core:compute":
        normalized.intentIdPattern = normalizeId(event.intentId);
        normalized.iteration = event.iteration;
        break;

      case "core:apply":
        normalized.patchCount = event.patchCount;
        normalized.source = event.source;
        break;

      case "effect:dispatch":
        normalized.requirementIdPattern = normalizeId(event.requirementId);
        normalized.effectType = event.effectType;
        break;

      case "effect:fulfill:drop":
        normalized.requirementIdPattern = normalizeId(event.requirementId);
        normalized.reason = event.reason;
        break;

      case "effect:fulfill:apply":
        normalized.requirementIdPattern = normalizeId(event.requirementId);
        normalized.patchCount = event.patchCount;
        break;

      case "effect:fulfill:error":
        normalized.requirementIdPattern = normalizeId(event.requirementId);
        normalized.phase = event.phase;
        break;

      case "requirement:clear":
        normalized.requirementIdPattern = normalizeId(event.requirementId);
        break;

      case "continue:enqueue":
        normalized.intentIdPattern = normalizeId(event.intentId);
        break;

      case "context:frozen":
        normalized.jobIdPattern = normalizeId(event.jobId);
        // Include now for determinism check but normalize format
        normalized.now = event.now;
        normalized.randomSeedPattern = normalizeId(event.randomSeed);
        break;

      case "fatal:escalate":
        normalized.intentIdPattern = normalizeId(event.intentId);
        normalized.error = event.error;
        break;
    }

    return normalized;
  });
}

/**
 * Compare two golden results for equality
 */
export function compareGoldenResults(
  expected: GoldenResult,
  actual: GoldenResult
): { equal: boolean; differences: string[] } {
  const differences: string[] = [];

  // Compare final state
  if (JSON.stringify(expected.finalSnapshot.data) !== JSON.stringify(actual.finalSnapshot.data)) {
    differences.push("Final snapshot data differs");
  }

  // Compare normalized trace
  if (JSON.stringify(expected.normalizedTrace) !== JSON.stringify(actual.normalizedTrace)) {
    differences.push("Normalized trace differs");
  }

  // Compare state history length
  if (expected.stateHistory.length !== actual.stateHistory.length) {
    differences.push(`State history length differs: ${expected.stateHistory.length} vs ${actual.stateHistory.length}`);
  }

  // Compare metadata
  if (expected.metadata.intentCount !== actual.metadata.intentCount) {
    differences.push(`Intent count differs: ${expected.metadata.intentCount} vs ${actual.metadata.intentCount}`);
  }

  return {
    equal: differences.length === 0,
    differences,
  };
}

/**
 * Create a runner instance
 */
export function createGoldenRunner(): GoldenRunner {
  return new GoldenRunner();
}

/**
 * Helper to create a simple schema for golden tests
 */
export function createGoldenSchema(config: {
  id?: string;
  fields: Record<string, { type: FieldType; required?: boolean }>;
  actions: Record<string, { flow: any }>;
  computed?: Record<string, { expr: any; deps: string[] }>;
}): DomainSchema {
  const schemaWithoutHash: Omit<DomainSchema, "hash"> = {
    id: config.id ?? "golden:test",
    version: "1.0.0",
    types: {},
    state: {
      fields: Object.fromEntries(
        Object.entries(config.fields).map(([name, spec]) => [
          name,
          { type: spec.type, required: spec.required ?? true },
        ])
      ),
    },
    computed: {
      fields: config.computed ?? {},
    },
    actions: config.actions,
  };

  return {
    ...schemaWithoutHash,
    hash: hashSchemaSync(schemaWithoutHash),
  };
}
