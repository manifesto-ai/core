/**
 * Translator Effect Handlers
 *
 * Implements effect handlers for the 6-stage translation pipeline.
 * Each handler executes a pipeline stage and returns patches to
 * update the Translator state machine.
 *
 * Effect types from translator.mel:
 * - translator.chunk - Chunking stage
 * - translator.normalize - Normalization stage
 * - translator.fastPath - Fast path matching
 * - translator.retrieve - Schema retrieval
 * - translator.memory - Memory selection
 * - translator.propose - LLM-based proposal
 * - translator.assemble - Fragment assembly
 *
 * @see translator.mel for domain definition
 * @see @manifesto-ai/host for EffectHandler interface
 */

import type { Patch, Snapshot, Requirement } from "@manifesto-ai/core";
import type { TranslatorConfig, TranslationContext, DomainSchema } from "../domain/index.js";
import {
  executeChunking,
  executeNormalization,
  executeFastPath,
  executeRetrieval,
  executeMemory,
  executeProposer,
  type PipelineState,
  type PipelineStage,
  type MemorySelector,
  type MemorySelectorCompat,
  type MemoryContentFetcher,
  createMemorySelectorAdapter,
} from "../pipeline/index.js";
import { deriveTypeIndex } from "../utils/index.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Effect context provided to handlers.
 * Compatible with @manifesto-ai/host EffectContext.
 */
export interface TranslatorEffectContext {
  readonly snapshot: Readonly<Snapshot>;
  readonly requirement: Requirement;
}

/**
 * Effect handler function signature.
 * Compatible with @manifesto-ai/host EffectHandler.
 */
export type TranslatorEffectHandler = (
  type: string,
  params: Record<string, unknown>,
  context: TranslatorEffectContext
) => Promise<Patch[]>;

/**
 * Effect handler registry interface.
 * Compatible with @manifesto-ai/host EffectHandlerRegistry.
 */
export interface TranslatorEffectRegistry {
  register(type: string, handler: TranslatorEffectHandler): void;
  has(type: string): boolean;
  get(type: string): { handler: TranslatorEffectHandler } | undefined;
}

/**
 * Dependencies for translator effect handlers.
 */
export interface TranslatorEffectDependencies {
  /**
   * Translator configuration.
   */
  config: TranslatorConfig;

  /**
   * Domain schema for the target world.
   */
  schema: DomainSchema;

  /**
   * World ID for the target world.
   */
  worldId: string;

  /**
   * Optional memory selector compatible with @manifesto-ai/memory.
   */
  memorySelector?: MemorySelectorCompat;

  /**
   * Optional content fetcher for memory selection.
   */
  memoryContentFetcher?: MemoryContentFetcher;

  /**
   * Legacy memory selector (Translator-specific).
   * @deprecated Use memorySelector + memoryContentFetcher instead.
   */
  legacyMemorySelector?: MemorySelector;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract translation context from snapshot.
 */
function deriveContext(
  snapshot: Snapshot,
  deps: TranslatorEffectDependencies
): TranslationContext {
  const data = snapshot.data as Record<string, unknown>;

  return {
    atWorldId: (data.atWorldId as string) ?? deps.worldId,
    schema: deps.schema,
    typeIndex: deriveTypeIndex(deps.schema),
    intentId: (data.intentId as string) ?? "",
  };
}

/**
 * Create pipeline state from snapshot.
 */
function createPipelineState(
  snapshot: Snapshot,
  deps: TranslatorEffectDependencies
): PipelineState {
  const data = snapshot.data as Record<string, unknown>;

  // Map MEL status to PipelineStage (MEL uses different stage names)
  const statusToPipelineStage: Record<string, PipelineStage> = {
    idle: "idle",
    chunking: "chunking",
    normalizing: "normalization",
    fast_path: "fastPath",
    retrieval: "retrieval",
    memory: "memory",
    proposing: "proposer",
    assembling: "assembly",
    success: "complete",
    error: "complete",
    awaiting_resolution: "complete",
  };

  const status = (data.status as string) ?? "idle";
  const pipelineStage = statusToPipelineStage[status] ?? "idle";

  return {
    input: (data.input as string) ?? "",
    context: deriveContext(snapshot, deps),
    currentStage: pipelineStage,
    traces: {},
    startedAt: new Date(),
    sections: undefined,
    normalization: data.normalizationJson
      ? JSON.parse(data.normalizationJson as string)
      : undefined,
    fastPath: data.fastPathJson
      ? JSON.parse(data.fastPathJson as string)
      : undefined,
    retrieval: data.retrievalJson
      ? JSON.parse(data.retrievalJson as string)
      : undefined,
    memory: data.memoryJson
      ? JSON.parse(data.memoryJson as string)
      : undefined,
    proposal: data.proposalJson
      ? JSON.parse(data.proposalJson as string)
      : undefined,
  };
}

/**
 * Create a set patch.
 */
function setPatch(path: string, value: unknown): Patch {
  return { op: "set", path, value };
}

// =============================================================================
// Effect Handlers
// =============================================================================

/**
 * Create translator effect handlers.
 */
export function createTranslatorEffectHandlers(
  deps: TranslatorEffectDependencies
): Map<string, TranslatorEffectHandler> {
  const handlers = new Map<string, TranslatorEffectHandler>();

  // Resolve memory selector
  const memorySelector: MemorySelector | undefined = deps.legacyMemorySelector
    ?? (deps.memorySelector && deps.memoryContentFetcher
      ? createMemorySelectorAdapter(
          deps.memorySelector,
          deps.memoryContentFetcher,
          { actorId: "translator", kind: "system" }
        )
      : undefined);

  // ========== translator.chunk ==========
  handlers.set(
    "translator.chunk",
    async (_type, params, context): Promise<Patch[]> => {
      const state = createPipelineState(context.snapshot, deps);
      const input = (params.input as string) ?? state.input;

      const result = await executeChunking(input, state);

      if (!result.success) {
        return [
          setPatch("status", "error"),
          setPatch("errorJson", JSON.stringify({
            code: "CHUNKING_ERROR",
            message: result.error?.message ?? "Chunking failed",
          })),
        ];
      }

      const chunks = result.data!.map((s, i) => ({
        text: s.text,
        index: i,
      }));

      return [
        setPatch("status", "normalizing"),
        setPatch("chunksJson", JSON.stringify(chunks)),
      ];
    }
  );

  // ========== translator.normalize ==========
  handlers.set(
    "translator.normalize",
    async (_type, params, context): Promise<Patch[]> => {
      const state = createPipelineState(context.snapshot, deps);
      const input = (params.input as string) ?? state.input;

      const result = await executeNormalization(input, state);

      if (!result.success) {
        return [
          setPatch("status", "error"),
          setPatch("errorJson", JSON.stringify({
            code: "NORMALIZATION_ERROR",
            message: result.error?.message ?? "Normalization failed",
          })),
        ];
      }

      return [
        setPatch("status", "fast_path"),
        setPatch("normalizationJson", JSON.stringify(result.data)),
      ];
    }
  );

  // ========== translator.fastPath ==========
  handlers.set(
    "translator.fastPath",
    async (_type, _params, context): Promise<Patch[]> => {
      const state = createPipelineState(context.snapshot, deps);

      if (!state.normalization) {
        return [
          setPatch("status", "error"),
          setPatch("errorJson", JSON.stringify({
            code: "FAST_PATH_ERROR",
            message: "Normalization result required for fast path",
          })),
        ];
      }

      const result = await executeFastPath(state.normalization, state);

      if (!result.success) {
        return [
          setPatch("status", "error"),
          setPatch("errorJson", JSON.stringify({
            code: "FAST_PATH_ERROR",
            message: result.error?.message ?? "Fast path failed",
          })),
        ];
      }

      const fastPath = result.data!;

      // If matched and fast-path-only mode, go to assembly
      if (fastPath.matched && deps.config.fastPathOnly) {
        return [
          setPatch("status", "assembling"),
          setPatch("fastPathJson", JSON.stringify(fastPath)),
        ];
      }

      // If matched with high confidence, go to assembly
      if (fastPath.matched && fastPath.best) {
        const threshold = deps.config.confidencePolicy?.autoAcceptThreshold ?? 0.95;
        if (fastPath.best.confidence >= threshold) {
          return [
            setPatch("status", "assembling"),
            setPatch("fastPathJson", JSON.stringify(fastPath)),
          ];
        }
      }

      // Otherwise, continue to retrieval
      return [
        setPatch("status", "retrieval"),
        setPatch("fastPathJson", JSON.stringify(fastPath)),
      ];
    }
  );

  // ========== translator.retrieve ==========
  handlers.set(
    "translator.retrieve",
    async (_type, _params, context): Promise<Patch[]> => {
      const state = createPipelineState(context.snapshot, deps);

      if (!state.normalization) {
        return [
          setPatch("status", "error"),
          setPatch("errorJson", JSON.stringify({
            code: "RETRIEVAL_ERROR",
            message: "Normalization result required for retrieval",
          })),
        ];
      }

      const result = await executeRetrieval(state.normalization, state);

      if (!result.success) {
        return [
          setPatch("status", "error"),
          setPatch("errorJson", JSON.stringify({
            code: "RETRIEVAL_ERROR",
            message: result.error?.message ?? "Retrieval failed",
          })),
        ];
      }

      return [
        setPatch("status", "memory"),
        setPatch("retrievalJson", JSON.stringify(result.data)),
      ];
    }
  );

  // ========== translator.memory ==========
  handlers.set(
    "translator.memory",
    async (_type, _params, context): Promise<Patch[]> => {
      const state = createPipelineState(context.snapshot, deps);

      if (!state.retrieval) {
        return [
          setPatch("status", "error"),
          setPatch("errorJson", JSON.stringify({
            code: "MEMORY_ERROR",
            message: "Retrieval result required for memory",
          })),
        ];
      }

      const result = await executeMemory(state.retrieval, state, {
        selector: memorySelector,
      });

      if (!result.success) {
        // Memory stage has graceful degradation, shouldn't fail
        return [
          setPatch("status", "error"),
          setPatch("errorJson", JSON.stringify({
            code: "MEMORY_ERROR",
            message: result.error?.message ?? "Memory failed",
          })),
        ];
      }

      return [
        setPatch("status", "proposing"),
        setPatch("memoryJson", JSON.stringify(result.data)),
      ];
    }
  );

  // ========== translator.propose ==========
  handlers.set(
    "translator.propose",
    async (_type, _params, context): Promise<Patch[]> => {
      const state = createPipelineState(context.snapshot, deps);

      if (!state.normalization || !state.retrieval || !state.memory) {
        return [
          setPatch("status", "error"),
          setPatch("errorJson", JSON.stringify({
            code: "PROPOSER_ERROR",
            message: "Previous stage results required for proposer",
          })),
        ];
      }

      const result = await executeProposer(
        state.normalization,
        state.retrieval,
        state.memory,
        state
      );

      if (!result.success) {
        return [
          setPatch("status", "error"),
          setPatch("errorJson", JSON.stringify({
            code: "PROPOSER_ERROR",
            message: result.error?.message ?? "Proposer failed",
          })),
        ];
      }

      const proposal = result.data!;

      // Check proposal kind
      if (proposal.kind === "ambiguity") {
        return [
          setPatch("status", "awaiting_resolution"),
          setPatch("proposalJson", JSON.stringify(proposal)),
          setPatch("ambiguityReportJson", JSON.stringify(proposal.ambiguity)),
        ];
      }

      if (proposal.kind === "empty") {
        return [
          setPatch("status", "error"),
          setPatch("errorJson", JSON.stringify({
            code: "NO_TRANSLATION",
            message: "Proposer produced no fragments",
          })),
        ];
      }

      // Proposal has fragments, continue to assembly
      return [
        setPatch("status", "assembling"),
        setPatch("proposalJson", JSON.stringify(proposal)),
      ];
    }
  );

  // ========== translator.assemble ==========
  handlers.set(
    "translator.assemble",
    async (_type, _params, context): Promise<Patch[]> => {
      const state = createPipelineState(context.snapshot, deps);
      const data = context.snapshot.data as Record<string, unknown>;

      // Get fragments from proposal or fast path
      let fragments: unknown[] = [];

      if (state.proposal?.kind === "fragments") {
        fragments = state.proposal.fragments;
      } else if (state.fastPath?.matched && state.fastPath.best) {
        fragments = state.fastPath.best.fragments;
      }

      if (fragments.length === 0) {
        return [
          setPatch("status", "error"),
          setPatch("errorJson", JSON.stringify({
            code: "ASSEMBLY_ERROR",
            message: "No fragments to assemble",
          })),
        ];
      }

      // Assembly is complete
      return [
        setPatch("status", "success"),
        setPatch("fragmentsJson", JSON.stringify(fragments)),
        setPatch("completedAt", Date.now()),
      ];
    }
  );

  return handlers;
}

/**
 * Register translator effect handlers with a registry.
 */
export function registerTranslatorEffects(
  registry: TranslatorEffectRegistry,
  deps: TranslatorEffectDependencies
): void {
  const handlers = createTranslatorEffectHandlers(deps);

  for (const [type, handler] of handlers) {
    if (!registry.has(type)) {
      registry.register(type, handler);
    }
  }
}
