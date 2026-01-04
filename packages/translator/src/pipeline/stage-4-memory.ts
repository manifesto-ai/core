/**
 * Stage 4: Memory (Graceful Degradation)
 *
 * Retrieves translation context from Memory:
 * - Translation examples
 * - Schema history
 * - Glossary terms
 * - Resolution history
 *
 * Per SPEC-1.1.1v:
 * - Memory is Default: absence triggers graceful degradation
 * - MUST NOT fail if Memory unavailable
 * - MUST record degradation in trace
 *
 * Integration with @manifesto-ai/memory:
 * - Accepts MemorySelector from memory package via adapter
 * - Converts SelectedMemory[] (World references) to MemoryContent
 * - Requires content fetcher callback to load actual World content
 */

import type {
  RetrievalResult,
  MemoryStageResult,
  MemoryContent,
  MemoryStageTrace,
  TranslationExample,
  SchemaSnapshot,
  GlossaryTermEntry,
  ResolutionRecord,
} from "../domain/index.js";
import type { PipelineState, StageResult } from "./types.js";
import type { ActorRef } from "../domain/types.js";

// =============================================================================
// Type-Compatible Definitions for @manifesto-ai/memory
// (Avoids Zod 3/4 compatibility issues by defining compatible types locally)
// =============================================================================

/**
 * Memory reference to a past World.
 * Compatible with @manifesto-ai/memory MemoryRef.
 */
export interface MemoryRef {
  worldId: string;
}

/**
 * A selected memory with context.
 * Compatible with @manifesto-ai/memory SelectedMemory.
 */
export interface SelectedMemory {
  ref: MemoryRef;
  reason: string;
  confidence: number;
  verified: boolean;
  evidence?: {
    method: string;
    valid: boolean;
    verifiedAt?: number;
    verifiedBy?: ActorRef;
  };
}

/**
 * Selection request.
 * Compatible with @manifesto-ai/memory SelectionRequest.
 */
export interface SelectionRequest {
  query: string;
  atWorldId: string;
  selector: ActorRef;
  constraints?: {
    maxResults?: number;
    minConfidence?: number;
    requireVerified?: boolean;
  };
}

/**
 * Selection result.
 * Compatible with @manifesto-ai/memory SelectionResult.
 */
export interface SelectionResult {
  selected: SelectedMemory[];
  selectedAt: number;
}

/**
 * Memory selector interface compatible with @manifesto-ai/memory.
 * Can be used directly with memory package's MemorySelector implementations.
 */
export interface MemorySelectorCompat {
  select(request: SelectionRequest): Promise<SelectionResult>;
}

// =============================================================================
// Translator-Specific Memory Selector
// =============================================================================

/**
 * Legacy memory selector interface (Translator-specific)
 * @deprecated Use MemorySelectorCompat with adapter instead
 */
export interface MemorySelector {
  /**
   * Select relevant memory content
   */
  select(query: MemoryQuery): Promise<MemoryContent>;
}

/**
 * Memory query parameters
 */
export interface MemoryQuery {
  /** World ID */
  worldId: string;
  /** Normalized input */
  input: string;
  /** Anchor candidates from retrieval */
  anchors: string[];
  /** Maximum examples to retrieve */
  maxExamples?: number;
  /** Minimum confidence for examples */
  minConfidence?: number;
}

/**
 * Memory configuration
 */
export interface MemoryConfig {
  /** Memory selector (optional) */
  selector?: MemorySelector;
  /** Maximum examples */
  maxExamples: number;
  /** Minimum confidence */
  minConfidence: number;
  /** Whether to require memory (error if unavailable) */
  requireMemory: boolean;
}

const DEFAULT_CONFIG: MemoryConfig = {
  maxExamples: 5,
  minConfidence: 0.5,
  requireMemory: false,
};

/**
 * Execute memory stage
 */
export async function executeMemory(
  retrieval: RetrievalResult,
  state: PipelineState,
  config: Partial<MemoryConfig> = {}
): Promise<StageResult<MemoryStageResult>> {
  const startTime = Date.now();
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    // Check if memory selector is configured
    if (!fullConfig.selector) {
      // Graceful degradation
      const emptyContent = createEmptyContent();
      const durationMs = Date.now() - startTime;

      return {
        success: true,
        data: {
          content: emptyContent,
          selectedCount: 0,
          degraded: true,
          trace: createMemoryTrace(
            state.context.atWorldId,
            0,
            true,
            "SELECTOR_NOT_CONFIGURED",
            durationMs
          ),
        },
        durationMs,
      };
    }

    // Build query
    const query: MemoryQuery = {
      worldId: state.context.atWorldId,
      input: state.normalization?.canonical ?? "",
      anchors: retrieval.candidates.map((c) => c.path),
      maxExamples: fullConfig.maxExamples,
      minConfidence: fullConfig.minConfidence,
    };

    // Execute selection
    let content: MemoryContent;
    try {
      content = await fullConfig.selector.select(query);
    } catch (error) {
      // Graceful degradation on selector error
      const emptyContent = createEmptyContent();
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: true,
        data: {
          content: emptyContent,
          selectedCount: 0,
          degraded: true,
          trace: createMemoryTrace(
            state.context.atWorldId,
            0,
            true,
            "SELECTOR_ERROR",
            durationMs,
            errorMessage
          ),
        },
        durationMs,
      };
    }

    // Check if selection is empty
    const selectedCount =
      content.translationExamples.length +
      content.schemaHistory.length +
      content.glossaryTerms.length +
      content.resolutionHistory.length;

    if (selectedCount === 0) {
      const durationMs = Date.now() - startTime;

      return {
        success: true,
        data: {
          content,
          selectedCount: 0,
          degraded: true,
          trace: createMemoryTrace(
            state.context.atWorldId,
            0,
            true,
            "SELECTION_EMPTY",
            durationMs
          ),
        },
        durationMs,
      };
    }

    // Calculate average confidence from examples
    const avgConfidence = calculateAverageConfidence(content.translationExamples);

    const durationMs = Date.now() - startTime;

    return {
      success: true,
      data: {
        content,
        selectedCount,
        averageConfidence: avgConfidence,
        degraded: false,
        trace: createMemoryTrace(
          state.context.atWorldId,
          selectedCount,
          false,
          undefined,
          durationMs
        ),
      },
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    // If memory is required, propagate error
    if (fullConfig.requireMemory) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        durationMs,
      };
    }

    // Otherwise, graceful degradation
    const emptyContent = createEmptyContent();
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: true,
      data: {
        content: emptyContent,
        selectedCount: 0,
        degraded: true,
        trace: createMemoryTrace(
          state.context.atWorldId,
          0,
          true,
          "SELECTOR_ERROR",
          durationMs,
          errorMessage
        ),
      },
      durationMs,
    };
  }
}

/**
 * Create empty memory content
 */
function createEmptyContent(): MemoryContent {
  return {
    translationExamples: [],
    schemaHistory: [],
    glossaryTerms: [],
    resolutionHistory: [],
  };
}

/**
 * Calculate average confidence from examples
 */
function calculateAverageConfidence(examples: TranslationExample[]): number {
  if (examples.length === 0) return 0;
  const sum = examples.reduce((acc, e) => acc + e.confidence, 0);
  return sum / examples.length;
}

/**
 * Create memory stage trace
 */
function createMemoryTrace(
  worldId: string,
  selectedCount: number,
  degraded: boolean,
  degradeReason?: "SELECTOR_NOT_CONFIGURED" | "SELECTION_EMPTY" | "SELECTOR_ERROR",
  durationMs: number = 0,
  errorMessage?: string
): MemoryStageTrace {
  return {
    attempted: true,
    atWorldId: worldId,
    selectedCount,
    degraded,
    degradeReason,
    errorMessage,
    durationMs,
  };
}

/**
 * Create a no-op memory selector for testing
 */
export function createNoOpMemorySelector(): MemorySelector {
  return {
    async select(_query: MemoryQuery): Promise<MemoryContent> {
      return createEmptyContent();
    },
  };
}

/**
 * Create memory trace for stage traces
 */
export function createMemoryStageTrace(
  result: MemoryStageResult,
  durationMs: number
): MemoryStageTrace {
  return (
    result.trace ?? {
      attempted: true,
      atWorldId: "",
      selectedCount: result.selectedCount,
      averageConfidence: result.averageConfidence,
      degraded: result.degraded,
      durationMs,
    }
  );
}

// =============================================================================
// Memory Package Adapter
// =============================================================================

/**
 * Content fetcher callback for retrieving World content.
 *
 * This callback is provided by the application to fetch actual content
 * from selected World references. The application knows how to:
 * 1. Load World snapshots from storage
 * 2. Extract translation examples, schema history, etc.
 * 3. Transform to MemoryContent format
 */
export interface MemoryContentFetcher {
  /**
   * Fetch content from selected memories.
   *
   * @param selected - Selected memory references from MemorySelector
   * @param query - Original query context
   * @returns MemoryContent extracted from selected Worlds
   */
  fetch(selected: SelectedMemory[], query: MemoryQuery): Promise<MemoryContent>;
}

/**
 * Adapter to use @manifesto-ai/memory MemorySelector with Translator.
 *
 * The memory package's MemorySelector returns World references (SelectedMemory[]),
 * but Translator needs actual content (MemoryContent). This adapter bridges
 * the two by using a content fetcher to load World content.
 *
 * @example
 * ```typescript
 * import { MemorySelector as MemoryPkgSelector } from "@manifesto-ai/memory";
 *
 * const memoryPkgSelector: MemoryPkgSelector = createMySelector();
 * const contentFetcher: MemoryContentFetcher = createMyFetcher();
 *
 * const translatorSelector = createMemorySelectorAdapter(
 *   memoryPkgSelector,
 *   contentFetcher,
 *   { actorId: "translator", kind: "system" }
 * );
 *
 * // Use with executeMemory
 * const result = await executeMemory(retrieval, state, {
 *   selector: translatorSelector
 * });
 * ```
 */
export function createMemorySelectorAdapter(
  selector: MemorySelectorCompat,
  fetcher: MemoryContentFetcher,
  defaultActor: ActorRef = { actorId: "translator", kind: "system" }
): MemorySelector {
  return {
    async select(query: MemoryQuery): Promise<MemoryContent> {
      // Build SelectionRequest from MemoryQuery
      const request: SelectionRequest = {
        query: query.input,
        atWorldId: query.worldId,
        selector: defaultActor,
        constraints: {
          maxResults: query.maxExamples,
          minConfidence: query.minConfidence,
        },
      };

      // Call memory package's selector
      const result = await selector.select(request);

      // Use content fetcher to convert SelectedMemory[] to MemoryContent
      const content = await fetcher.fetch(result.selected, query);

      return content;
    },
  };
}

/**
 * Create a simple content fetcher that extracts basic information.
 *
 * This is a minimal implementation that creates TranslationExample stubs
 * from selected memories. Applications should provide their own fetcher
 * for full functionality.
 */
export function createSimpleContentFetcher(): MemoryContentFetcher {
  return {
    async fetch(selected: SelectedMemory[], _query: MemoryQuery): Promise<MemoryContent> {
      // Create translation examples from selected memories
      const translationExamples: TranslationExample[] = selected.map((mem) => ({
        worldId: mem.ref.worldId,
        input: mem.reason, // Use reason as placeholder
        normalizedInput: mem.reason.toLowerCase(),
        fragments: [],
        confidence: mem.confidence,
        verified: mem.verified,
      }));

      return {
        translationExamples,
        schemaHistory: [],
        glossaryTerms: [],
        resolutionHistory: [],
      };
    },
  };
}

/**
 * Create a no-op memory selector compatible with @manifesto-ai/memory interface.
 */
export function createNoOpMemorySelectorCompat(): MemorySelectorCompat {
  return {
    async select(_request: SelectionRequest): Promise<SelectionResult> {
      return {
        selected: [],
        selectedAt: Date.now(),
      };
    },
  };
}
