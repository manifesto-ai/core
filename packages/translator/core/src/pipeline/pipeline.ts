/**
 * @fileoverview TranslatorPipeline (SPEC Section 7)
 *
 * Main orchestrator for the translation pipeline.
 *
 * Per SPEC Section 7.1:
 * - Composes Decompose → Translate (parallel) → Merge
 * - Validates chunks and graph
 * - Runs plugin hooks at each phase
 *
 * @module pipeline/pipeline
 */

import type { Chunk } from "../core/types/chunk.js";
import type { IntentGraph } from "../core/types/intent-graph.js";
import type { DiagnosticsReadonly } from "../core/types/diagnostics.js";
import type { DecomposeStrategy } from "../core/interfaces/decomposer.js";
import type { TranslateStrategy } from "../core/interfaces/translator.js";
import type { MergeStrategy } from "../core/interfaces/merger.js";
import type {
  PipelinePlugin,
  PipelineHooks,
  ReadonlyPipelineContext,
  ChunkHookContext,
} from "../plugins/types.js";
import { hasOverlappingChunks } from "../core/types/chunk.js";
import {
  PipelineError,
  OverlapSafetyError,
  InspectorGraphReturnError,
} from "../core/types/errors.js";
import { DiagnosticsBagImpl, createDiagnosticsBag } from "./diagnostics-bag.js";
import { ParallelExecutor } from "./parallel-executor.js";
import { validateChunks } from "../helpers/validate-chunks.js";
import { validateGraph } from "../helpers/validate-graph.js";

// =============================================================================
// PipelineOptions
// =============================================================================

/**
 * Pipeline configuration options.
 *
 * Per SPEC Section 7.1
 */
export interface PipelineOptions {
  /** Concurrent chunk translation limit (default: 5) */
  concurrency?: number;

  /** Overall timeout (ms) */
  timeout?: number;

  /** Per-chunk timeout (ms) */
  chunkTimeout?: number;

  /** Maximum chunk size (passed to decomposer) */
  maxChunkSize?: number;

  /**
   * Enable deduplication.
   * Forced to true if overlap is detected.
   * Error if false with overlap (OVL-2).
   */
  deduplicate?: boolean;

  /** Error handling policy */
  errorPolicy?: "fail-fast" | "best-effort";

  /** Cross-chunk linking strategy */
  linkStrategy?: "conservative" | "aggressive" | "none";
}

// =============================================================================
// PipelineResult
// =============================================================================

/**
 * Result of pipeline execution.
 *
 * Per SPEC Section 7.1
 */
export interface PipelineResult {
  readonly graph: IntentGraph;
  readonly diagnostics: DiagnosticsReadonly;
  readonly meta: Readonly<{
    chunkCount: number;
    nodeCount: number;
    processingTimeMs: number;
    hasOverlap: boolean;
  }>;
}

// =============================================================================
// TranslatorPipeline
// =============================================================================

/**
 * Main orchestrator for the translation pipeline.
 *
 * Per SPEC Section 7.1:
 * - Composes DecomposeStrategy, TranslateStrategy, MergeStrategy
 * - Validates chunks (D-INV-*) and graph (G-INV-*)
 * - Runs plugin hooks at each phase (PLG-*)
 * - Handles overlap detection and deduplication (OVL-*)
 * - Executes chunk translation in parallel (PEX-*)
 */
export class TranslatorPipeline {
  private readonly decomposer: DecomposeStrategy;
  private readonly translator: TranslateStrategy;
  private readonly merger: MergeStrategy;
  private readonly options: PipelineOptions;
  private readonly plugins: readonly PipelinePlugin[];

  constructor(
    decomposer: DecomposeStrategy,
    translator: TranslateStrategy,
    merger: MergeStrategy,
    options?: PipelineOptions,
    plugins?: readonly PipelinePlugin[]
  ) {
    this.decomposer = decomposer;
    this.translator = translator;
    this.merger = merger;
    this.options = options ?? {};
    this.plugins = plugins ?? [];
  }

  /**
   * Process input text through the full pipeline.
   *
   * @param input - Natural language input
   * @returns Pipeline result with graph and diagnostics
   */
  async process(input: string): Promise<PipelineResult> {
    const startTime = Date.now();
    const diagnostics = createDiagnosticsBag();

    // Create run-scoped hooks for each plugin (PLG-1)
    const runHooks = this.plugins.map((plugin) => ({
      plugin,
      hooks: plugin.createRunHooks(),
    }));

    // Build mutable context
    const ctx: MutablePipelineContext = {
      input,
      diagnostics,
    };

    try {
      // === Phase 1: Decompose ===
      await this.runHooks(runHooks, "beforeDecompose", ctx);

      const chunks = await this.decomposer.decompose(input, {
        maxChunkSize: this.options.maxChunkSize,
      });
      ctx.chunks = chunks;

      // PLG-9: Validate decompose results
      const chunkValidation = validateChunks(chunks, input);
      if (!chunkValidation.valid) {
        throw new PipelineError(
          chunkValidation.error.message,
          chunkValidation.error.code,
          "afterDecompose",
          chunkValidation.error.chunkIndex
        );
      }

      await this.runHooks(runHooks, "afterDecompose", ctx);

      // === Phase 2: Overlap Detection (OVL-1, OVL-2) ===
      const hasOverlap = hasOverlappingChunks(chunks);
      if (hasOverlap && this.options.deduplicate === false) {
        throw new OverlapSafetyError(
          "Overlap detected in chunks but deduplicate=false. " +
            "Either enable deduplication or use non-overlapping decomposer (OVL-2)."
        );
      }
      const effectiveDeduplicate = hasOverlap
        ? true
        : (this.options.deduplicate ?? false);

      // === Phase 3: Translate (parallel) ===
      const executor = new ParallelExecutor<Chunk, IntentGraph>({
        concurrency: this.options.concurrency ?? 5,
        timeout: this.options.chunkTimeout,
        onError: this.options.errorPolicy ?? "fail-fast",
      });

      const graphs = await executor.execute(chunks, async (chunk, index) => {
        // Create chunk-specific context
        const chunkCtx: ChunkHookContext = {
          ...ctx,
          chunkIndex: index,
          chunk,
        };

        // beforeTranslateChunk hooks (PLG-7)
        await this.runChunkHooks(runHooks, "beforeTranslateChunk", chunkCtx);

        const graph = await this.translator.translate(chunk.text, {
          language: this.options.maxChunkSize ? undefined : undefined,
        });

        // afterTranslateChunk hooks (PLG-7)
        const afterCtx: ChunkHookContext = {
          ...chunkCtx,
          chunkGraph: graph,
        };
        await this.runChunkHooks(runHooks, "afterTranslateChunk", afterCtx);

        return graph;
      });
      ctx.graphs = graphs;

      // === Phase 4: Merge ===
      await this.runHooks(runHooks, "beforeMerge", ctx);

      let merged = this.merger.merge(graphs, {
        prefixNodeIds: true,
        deduplicate: effectiveDeduplicate,
        linkStrategy: this.options.linkStrategy ?? "conservative",
      });
      ctx.merged = merged;

      // afterMerge hooks - transformers can modify graph (PLG-3, PLG-14)
      merged = await this.runAfterMergeHooks(runHooks, ctx);
      ctx.merged = merged;

      // === Phase 5: Validation ===
      const structuralValidation = validateGraph(merged);
      ctx.structuralValidation = structuralValidation;

      if (!structuralValidation.valid) {
        throw new PipelineError(
          structuralValidation.error.message,
          structuralValidation.error.code,
          "afterStructuralValidate",
          undefined,
          structuralValidation.error
        );
      }

      await this.runHooks(runHooks, "afterStructuralValidate", ctx);

      // Note: Lexicon validation is optional and typically done by exporter
      // await this.runHooks(runHooks, "afterLexiconValidate", ctx);

      return {
        graph: merged,
        diagnostics,
        meta: {
          chunkCount: chunks.length,
          nodeCount: merged.nodes.length,
          processingTimeMs: Date.now() - startTime,
          hasOverlap,
        },
      };
    } catch (error) {
      // Re-throw PipelineError as-is
      if (error instanceof PipelineError) {
        throw error;
      }
      if (error instanceof OverlapSafetyError) {
        throw error;
      }
      if (error instanceof InspectorGraphReturnError) {
        throw error;
      }
      // Wrap other errors
      throw new PipelineError(
        `Pipeline failed: ${error instanceof Error ? error.message : String(error)}`,
        "INTERNAL_ERROR",
        "beforeDecompose",
        undefined,
        error
      );
    }
  }

  /**
   * Run hooks for a specific phase.
   */
  private async runHooks(
    runHooks: Array<{ plugin: PipelinePlugin; hooks: PipelineHooks }>,
    phase: keyof Omit<PipelineHooks, "beforeTranslateChunk" | "afterTranslateChunk" | "afterMerge">,
    ctx: ReadonlyPipelineContext
  ): Promise<void> {
    // PLG-11: Plugins execute in injection order
    for (const { hooks } of runHooks) {
      const hook = hooks[phase];
      if (hook) {
        await hook(ctx);
      }
    }
  }

  /**
   * Run chunk hooks for parallel phase.
   */
  private async runChunkHooks(
    runHooks: Array<{ plugin: PipelinePlugin; hooks: PipelineHooks }>,
    phase: "beforeTranslateChunk" | "afterTranslateChunk",
    ctx: ChunkHookContext
  ): Promise<void> {
    // PLG-7, PLG-11
    for (const { hooks } of runHooks) {
      const hook = hooks[phase];
      if (hook) {
        await hook(ctx);
      }
    }
  }

  /**
   * Run afterMerge hooks with transformer support.
   * PLG-3: Transformers can return modified graph.
   * PLG-4: Pipeline re-validates after transformer modification.
   * PLG-14: Inspector returning IntentGraph is an error.
   */
  private async runAfterMergeHooks(
    runHooks: Array<{ plugin: PipelinePlugin; hooks: PipelineHooks }>,
    ctx: MutablePipelineContext
  ): Promise<IntentGraph> {
    let graph = ctx.merged!;

    for (const { plugin, hooks } of runHooks) {
      const hook = hooks.afterMerge;
      if (hook) {
        const result = await hook(ctx);

        // PLG-14: Inspector plugins MUST NOT return IntentGraph
        if (result && typeof result === "object" && "nodes" in result) {
          if (plugin.kind === "inspector") {
            throw new InspectorGraphReturnError(plugin.name);
          }

          // PLG-3: Transformer returned modified graph
          graph = result;
          ctx.merged = graph;

          // PLG-4: Re-validate after modification
          const validation = validateGraph(graph);
          if (!validation.valid) {
            throw new PipelineError(
              `Transformer plugin "${plugin.name}" produced invalid graph: ${validation.error.message}`,
              validation.error.code,
              "afterMerge",
              undefined,
              validation.error
            );
          }
        }
      }
    }

    return graph;
  }
}

/**
 * Mutable context used during pipeline execution.
 */
interface MutablePipelineContext {
  input: string;
  chunks?: Chunk[];
  graphs?: IntentGraph[];
  merged?: IntentGraph;
  structuralValidation?: ReturnType<typeof validateGraph>;
  lexiconValidation?: ReturnType<typeof validateGraph>;
  diagnostics: DiagnosticsBagImpl;
}
