/**
 * Translator Host Implementation
 *
 * Provides a complete runtime for the Translator state machine.
 * Integrates effect handlers with @manifesto-ai/host.
 *
 * @example
 * ```typescript
 * import { createTranslatorHost } from "@manifesto-ai/translator";
 *
 * const host = createTranslatorHost({
 *   config: {
 *     slmModel: "gpt-4o-mini",
 *     retrievalTier: 0,
 *     fastPathEnabled: true,
 *   },
 *   schema: myDomainSchema,
 *   worldId: "world-123",
 * });
 *
 * // Run translation
 * const result = await host.translate("Add email field to user");
 *
 * // Subscribe to state changes
 * host.subscribe((state) => console.log("State:", state));
 * ```
 */

import type { Snapshot, Patch, DomainSchema as CoreDomainSchema } from "@manifesto-ai/core";
import { createSnapshot, apply } from "@manifesto-ai/core";
import type {
  TranslatorConfig,
  DomainSchema,
  PatchFragment,
} from "../domain/index.js";
import { createConfig } from "../domain/config.js";
import {
  createTranslatorEffectHandlers,
  type TranslatorEffectDependencies,
  type TranslatorEffectContext,
} from "../effects/index.js";
import type {
  MemorySelectorCompat,
  MemoryContentFetcher,
  MemorySelector,
} from "../pipeline/index.js";
import { generateIntentId } from "../utils/index.js";

// Import the compiled schema
// Use fs.readFileSync for JSON import compatibility
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const translatorSchemaPath = join(__dirname, "../domain/translator-compiled.json");

// Lazy-load the schema to avoid module resolution issues
let _translatorSchema: CoreDomainSchema | null = null;
function getTranslatorSchema(): CoreDomainSchema {
  if (!_translatorSchema) {
    const content = readFileSync(translatorSchemaPath, "utf-8");
    _translatorSchema = JSON.parse(content) as CoreDomainSchema;
  }
  return _translatorSchema;
}

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for TranslatorHost.
 */
export interface TranslatorHostConfig {
  /**
   * Translator configuration.
   */
  config?: Partial<TranslatorConfig>;

  /**
   * Domain schema for the target world.
   */
  schema: DomainSchema;

  /**
   * World ID for the target world.
   */
  worldId: string;

  /**
   * Schema hash for the target world.
   */
  schemaHash?: string;

  /**
   * Initial snapshot state.
   */
  initialState?: Record<string, unknown>;

  /**
   * Memory selector compatible with @manifesto-ai/memory.
   */
  memorySelector?: MemorySelectorCompat;

  /**
   * Content fetcher for memory selection.
   */
  memoryContentFetcher?: MemoryContentFetcher;

  /**
   * Legacy memory selector (Translator-specific).
   * @deprecated Use memorySelector + memoryContentFetcher instead.
   */
  legacyMemorySelector?: MemorySelector;
}

/**
 * Translation result from the host.
 */
export interface TranslatorHostResult {
  /**
   * Final status of the translation.
   */
  status: "success" | "error" | "awaiting_resolution";

  /**
   * Generated fragments (if successful).
   */
  fragments?: PatchFragment[];

  /**
   * Error information (if failed).
   */
  error?: {
    code: string;
    message: string;
  };

  /**
   * Ambiguity report (if awaiting resolution).
   */
  ambiguityReport?: unknown;

  /**
   * Final snapshot state.
   */
  snapshot: Snapshot;

  /**
   * Trace information.
   */
  trace?: unknown;
}

/**
 * State change listener callback.
 */
export type StateChangeListener = (snapshot: Snapshot) => void;

// =============================================================================
// TranslatorHost Class
// =============================================================================

/**
 * Translator Host
 *
 * Manages the Translator state machine and effect execution.
 */
export class TranslatorHost {
  private snapshot: Snapshot;
  private schema: CoreDomainSchema;
  private config: TranslatorConfig;
  private deps: TranslatorEffectDependencies;
  private effectHandlers: Map<string, (type: string, params: Record<string, unknown>, context: TranslatorEffectContext) => Promise<Patch[]>>;
  private listeners: Set<StateChangeListener> = new Set();

  constructor(hostConfig: TranslatorHostConfig) {
    // Initialize config with defaults
    this.config = createConfig(hostConfig.config ?? {});

    // Set up effect dependencies
    this.deps = {
      config: this.config,
      schema: hostConfig.schema,
      worldId: hostConfig.worldId,
      memorySelector: hostConfig.memorySelector,
      memoryContentFetcher: hostConfig.memoryContentFetcher,
      legacyMemorySelector: hostConfig.legacyMemorySelector,
    };

    // Create effect handlers
    this.effectHandlers = createTranslatorEffectHandlers(this.deps);

    // Load translator schema
    this.schema = getTranslatorSchema();

    // Create initial snapshot
    const initialData = {
      status: "idle",
      input: null,
      atWorldId: hostConfig.worldId,
      schemaHash: hostConfig.schemaHash ?? null,
      intentId: null,
      chunksJson: null,
      normalizationJson: null,
      fastPathJson: null,
      retrievalJson: null,
      memoryJson: null,
      proposalJson: null,
      fragmentsJson: null,
      ambiguityReportJson: null,
      errorJson: null,
      traceId: null,
      startedAt: null,
      completedAt: null,
      ...hostConfig.initialState,
    };

    // Create snapshot with data and schema hash
    const schemaHash = this.schema.hash ?? "translator-1.1.1v";
    this.snapshot = createSnapshot(initialData, schemaHash);
  }

  /**
   * Get current snapshot.
   */
  getSnapshot(): Snapshot {
    return this.snapshot;
  }

  /**
   * Get current state data.
   */
  getState(): Record<string, unknown> {
    return this.snapshot.data as Record<string, unknown>;
  }

  /**
   * Subscribe to state changes.
   */
  subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of state change.
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }

  /**
   * Apply patches to the snapshot.
   */
  private applyPatches(patches: Patch[]): void {
    if (patches.length > 0) {
      this.snapshot = apply(this.schema, this.snapshot, patches);
    }
    this.notifyListeners();
  }

  /**
   * Execute an effect and apply resulting patches.
   */
  private async executeEffect(
    effectType: string,
    params: Record<string, unknown>
  ): Promise<void> {
    const handler = this.effectHandlers.get(effectType);
    if (!handler) {
      throw new Error(`No handler for effect type: ${effectType}`);
    }

    // Create a minimal requirement context
    // (In a full integration, this would come from the core compute loop)
    const context: TranslatorEffectContext = {
      snapshot: this.snapshot,
      requirement: {
        id: `${effectType}-${Date.now()}`,
        type: effectType,
        params,
        actionId: "translate",
        flowPosition: {
          nodePath: "translate",
          snapshotVersion: this.snapshot.meta?.version ?? 0,
        },
        createdAt: Date.now(),
      },
    };

    const patches = await handler(effectType, params, context);
    this.applyPatches(patches);
  }

  /**
   * Run the translation pipeline.
   *
   * @param input - Natural language input to translate
   * @returns Translation result
   */
  async translate(input: string): Promise<TranslatorHostResult> {
    const intentId = generateIntentId();

    // Reset state and set input
    this.applyPatches([
      { op: "set", path: "status", value: "chunking" },
      { op: "set", path: "input", value: input },
      { op: "set", path: "intentId", value: intentId },
      { op: "set", path: "startedAt", value: Date.now() },
      { op: "set", path: "errorJson", value: null },
      { op: "set", path: "fragmentsJson", value: null },
      { op: "set", path: "ambiguityReportJson", value: null },
    ]);

    try {
      // Run pipeline stages
      await this.runPipeline(input);

      // Return result based on final status
      return this.buildResult();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.applyPatches([
        { op: "set", path: "status", value: "error" },
        {
          op: "set",
          path: "errorJson",
          value: JSON.stringify({ code: "PIPELINE_ERROR", message }),
        },
        { op: "set", path: "completedAt", value: Date.now() },
      ]);

      return this.buildResult();
    }
  }

  /**
   * Run the translation pipeline stages.
   */
  private async runPipeline(input: string): Promise<void> {
    const state = this.getState();
    const maxIterations = 10; // Safety limit
    let iterations = 0;

    while (iterations < maxIterations) {
      const currentStatus = this.getState().status as string;

      // Terminal states
      if (
        currentStatus === "success" ||
        currentStatus === "error" ||
        currentStatus === "awaiting_resolution"
      ) {
        break;
      }

      // Execute stage based on status
      switch (currentStatus) {
        case "chunking":
          await this.executeEffect("translator.chunk", { input });
          break;

        case "normalizing":
          await this.executeEffect("translator.normalize", { input });
          break;

        case "fast_path":
          await this.executeEffect("translator.fastPath", {});
          break;

        case "retrieval":
          await this.executeEffect("translator.retrieve", {});
          break;

        case "memory":
          await this.executeEffect("translator.memory", {});
          break;

        case "proposing":
          await this.executeEffect("translator.propose", {});
          break;

        case "assembling":
          await this.executeEffect("translator.assemble", {});
          break;

        default:
          // Unknown state, break out
          this.applyPatches([
            { op: "set", path: "status", value: "error" },
            {
              op: "set",
              path: "errorJson",
              value: JSON.stringify({
                code: "UNKNOWN_STATE",
                message: `Unknown pipeline state: ${currentStatus}`,
              }),
            },
          ]);
          break;
      }

      iterations++;
    }

    // Set completion time if not already set
    const finalState = this.getState();
    if (!finalState.completedAt) {
      this.applyPatches([{ op: "set", path: "completedAt", value: Date.now() }]);
    }
  }

  /**
   * Build result from current state.
   */
  private buildResult(): TranslatorHostResult {
    const state = this.getState();
    const status = state.status as string;

    const result: TranslatorHostResult = {
      status: status as "success" | "error" | "awaiting_resolution",
      snapshot: this.snapshot,
    };

    // Parse fragments if available
    if (state.fragmentsJson) {
      try {
        result.fragments = JSON.parse(state.fragmentsJson as string);
      } catch {
        // Ignore parse errors
      }
    }

    // Parse error if available
    if (state.errorJson) {
      try {
        result.error = JSON.parse(state.errorJson as string);
      } catch {
        // Ignore parse errors
      }
    }

    // Parse ambiguity report if available
    if (state.ambiguityReportJson) {
      try {
        result.ambiguityReport = JSON.parse(state.ambiguityReportJson as string);
      } catch {
        // Ignore parse errors
      }
    }

    return result;
  }

  /**
   * Resolve an ambiguity.
   *
   * @param reportId - ID of the ambiguity report
   * @param selectedOptionId - ID of the selected option
   * @returns Translation result after resolution
   */
  async resolve(
    reportId: string,
    selectedOptionId: string
  ): Promise<TranslatorHostResult> {
    const state = this.getState();

    if (state.status !== "awaiting_resolution") {
      throw new Error("No pending ambiguity to resolve");
    }

    // Update state with resolution
    this.applyPatches([
      { op: "set", path: "status", value: "proposing" },
      { op: "set", path: "ambiguityReportJson", value: null },
    ]);

    // Re-run proposer with resolution context
    await this.executeEffect("translator.propose", {
      resolution: {
        reportId,
        selectedOptionId,
      },
    });

    // Continue pipeline
    const input = state.input as string;
    await this.runPipeline(input);

    return this.buildResult();
  }

  /**
   * Reset the host to idle state.
   */
  reset(): void {
    this.applyPatches([
      { op: "set", path: "status", value: "idle" },
      { op: "set", path: "input", value: null },
      { op: "set", path: "intentId", value: null },
      { op: "set", path: "chunksJson", value: null },
      { op: "set", path: "normalizationJson", value: null },
      { op: "set", path: "fastPathJson", value: null },
      { op: "set", path: "retrievalJson", value: null },
      { op: "set", path: "memoryJson", value: null },
      { op: "set", path: "proposalJson", value: null },
      { op: "set", path: "fragmentsJson", value: null },
      { op: "set", path: "ambiguityReportJson", value: null },
      { op: "set", path: "errorJson", value: null },
      { op: "set", path: "traceId", value: null },
      { op: "set", path: "startedAt", value: null },
      { op: "set", path: "completedAt", value: null },
    ]);
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new TranslatorHost.
 */
export function createTranslatorHost(
  config: TranslatorHostConfig
): TranslatorHost {
  return new TranslatorHost(config);
}
