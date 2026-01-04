/**
 * Pipeline Orchestrator
 *
 * Orchestrates the 6-stage translation pipeline:
 * 0. Chunking (deterministic)
 * 1. Normalization (deterministic)
 * 2. Fast Path (deterministic)
 * 3. Retrieval (LLM-assisted)
 * 4. Memory (graceful degradation)
 * 5. Proposer (LLM-based)
 * 6. Assembly (deterministic)
 */

import type {
  TranslationContext,
  TranslationResult,
  TranslationTrace,
  StageTraces,
  AmbiguityResolution,
  TranslatorConfig,
} from "../domain/index.js";
import type {
  PipelineState,
  PipelineConfig,
  TranslatorPipeline,
  PipelineTelemetry,
} from "./types.js";

import { executeChunking, createChunkingTrace } from "./stage-0-chunking.js";
import {
  executeNormalization,
  createNormalizationTrace,
} from "./stage-1-normalization.js";
import { executeFastPath, createFastPathTrace } from "./stage-2-fast-path.js";
import { executeRetrieval, createRetrievalTrace } from "./stage-3-retrieval.js";
import { executeMemory, createMemoryStageTrace } from "./stage-4-memory.js";
import { executeProposer, createProposerTrace } from "./stage-5-proposer.js";
import {
  executeAssembly,
  createAssemblyTrace,
  buildTranslationResult,
  type AssemblyResult,
} from "./stage-6-assembly.js";
import { generateTraceId, computeInputHash } from "../utils/index.js";
import type { LLMProvider } from "../llm/index.js";

/**
 * Create the translation pipeline
 */
export function createPipeline(
  config: TranslatorConfig,
  telemetry?: PipelineTelemetry
): TranslatorPipeline {
  const pipelineConfig = derivePipelineConfig(config);

  return {
    translate: (input, context) =>
      runPipeline(input, context, pipelineConfig, telemetry),
    resolve: (resolution, context) =>
      resolveAmbiguity(resolution, context, pipelineConfig, telemetry),
  };
}

/**
 * Derive pipeline config from translator config
 */
function derivePipelineConfig(config: TranslatorConfig): PipelineConfig {
  return {
    fastPathOnly: config.fastPathOnly ?? false,
    fastPathEnabled: config.fastPathEnabled ?? true,
    autoAcceptThreshold: config.confidencePolicy?.autoAcceptThreshold ?? 0.95,
    rejectThreshold: config.confidencePolicy?.rejectThreshold ?? 0.3,
    includeInputPreview: config.traceConfig?.includeInputPreview ?? true,
    maxPreviewLength: config.traceConfig?.maxPreviewLength ?? 200,
  };
}

/**
 * Run the full translation pipeline
 */
async function runPipeline(
  input: string,
  context: TranslationContext,
  config: PipelineConfig,
  telemetry?: PipelineTelemetry
): Promise<TranslationResult> {
  const startedAt = new Date();
  const traces: StageTraces = {};

  // Initialize pipeline state
  const state: PipelineState = {
    input,
    context,
    currentStage: "idle",
    traces,
    startedAt,
  };

  try {
    // Stage 0: Chunking
    state.currentStage = "chunking";
    telemetry?.onStageStart?.("chunking");

    const chunkingResult = await executeChunking(input, state);
    if (!chunkingResult.success) {
      throw chunkingResult.error;
    }
    state.sections = chunkingResult.data!;
    traces.chunking = createChunkingTrace(
      state.sections,
      chunkingResult.durationMs
    );
    telemetry?.onStageComplete?.("chunking", chunkingResult.durationMs);

    // Stage 1: Normalization (for first section or combined)
    state.currentStage = "normalization";
    telemetry?.onStageStart?.("normalization");

    const textToNormalize =
      state.sections.length === 1
        ? state.sections[0].text
        : state.sections.map((s) => s.text).join(" ");

    const normResult = await executeNormalization(textToNormalize, state);
    if (!normResult.success) {
      throw normResult.error;
    }
    state.normalization = normResult.data!;
    traces.normalization = createNormalizationTrace(
      state.normalization,
      normResult.durationMs
    );
    telemetry?.onStageComplete?.("normalization", normResult.durationMs);

    // Stage 2: Fast Path
    state.currentStage = "fastPath";
    telemetry?.onStageStart?.("fastPath");

    const fastPathResult = await executeFastPath(state.normalization, state);
    if (!fastPathResult.success) {
      throw fastPathResult.error;
    }
    state.fastPath = fastPathResult.data!;
    traces.fastPath = createFastPathTrace(
      state.fastPath,
      fastPathResult.durationMs
    );
    telemetry?.onStageComplete?.("fastPath", fastPathResult.durationMs);

    // If fast path matched with high confidence, skip to assembly
    if (state.fastPath.matched && config.fastPathEnabled) {
      return assembleFromFastPath(state, config, traces, startedAt, telemetry);
    }

    // If fast path only mode, fail
    if (config.fastPathOnly) {
      return createErrorResult(
        "Fast path did not match in fast-path-only mode",
        "FAST_PATH_MISS",
        traces,
        startedAt,
        config,
        context
      );
    }

    // Stage 3: Retrieval
    state.currentStage = "retrieval";
    telemetry?.onStageStart?.("retrieval");

    const retrievalResult = await executeRetrieval(state.normalization, state);
    if (!retrievalResult.success) {
      throw retrievalResult.error;
    }
    state.retrieval = retrievalResult.data!;
    traces.retrieval = createRetrievalTrace(
      state.retrieval,
      retrievalResult.durationMs
    );
    telemetry?.onStageComplete?.("retrieval", retrievalResult.durationMs);

    // Stage 4: Memory (graceful degradation)
    state.currentStage = "memory";
    telemetry?.onStageStart?.("memory");

    const memoryResult = await executeMemory(state.retrieval, state);
    if (!memoryResult.success) {
      throw memoryResult.error;
    }
    state.memory = memoryResult.data!;
    traces.memory = createMemoryStageTrace(state.memory, memoryResult.durationMs);
    telemetry?.onStageComplete?.("memory", memoryResult.durationMs);

    // Stage 5: Proposer
    state.currentStage = "proposer";
    telemetry?.onStageStart?.("proposer");

    const proposerResult = await executeProposer(
      state.normalization,
      state.retrieval,
      state.memory,
      state
    );
    if (!proposerResult.success) {
      throw proposerResult.error;
    }
    state.proposal = proposerResult.data!;
    traces.proposer = createProposerTrace(
      state.proposal,
      "none", // No LLM configured yet
      0,
      0,
      false,
      proposerResult.durationMs
    );
    telemetry?.onStageComplete?.("proposer", proposerResult.durationMs);

    // If proposer produced fragments, assemble
    if (state.proposal.kind === "fragments") {
      return assembleFromProposer(state, config, traces, startedAt, telemetry);
    }

    // If proposer detected ambiguity, return it
    if (state.proposal.kind === "ambiguity") {
      const trace = buildTrace(state, traces, startedAt, config, "ambiguity");
      return {
        kind: "ambiguity",
        report: state.proposal.ambiguity,
        trace,
      };
    }

    // If fast path has candidates, use them
    if (state.fastPath.candidates.length > 0) {
      return assembleFromFastPath(state, config, traces, startedAt, telemetry);
    }

    // No results available
    return createErrorResult(
      "No translation candidates found",
      "NO_CANDIDATES",
      traces,
      startedAt,
      config,
      context
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    telemetry?.onStageError?.(state.currentStage, err);

    return createErrorResult(
      err.message,
      "PIPELINE_ERROR",
      traces,
      startedAt,
      config,
      context
    );
  }
}

/**
 * Assemble result from fast path
 */
async function assembleFromFastPath(
  state: PipelineState,
  config: PipelineConfig,
  traces: StageTraces,
  startedAt: Date,
  telemetry?: PipelineTelemetry
): Promise<TranslationResult> {
  state.currentStage = "assembly";
  telemetry?.onStageStart?.("assembly");

  const assemblyResult = await executeAssembly(state.fastPath!, state, config);
  if (!assemblyResult.success) {
    throw assemblyResult.error;
  }

  const assembly = assemblyResult.data!;
  traces.assembly = createAssemblyTrace(
    assembly,
    assembly.fragments ?? [],
    assemblyResult.durationMs
  );
  telemetry?.onStageComplete?.("assembly", assemblyResult.durationMs);

  const trace = buildTrace(state, traces, startedAt, config, assembly.kind);
  const result = buildTranslationResult(assembly, trace);

  state.currentStage = "complete";
  telemetry?.onComplete?.(result);

  return result;
}

/**
 * Assemble result from proposer
 */
async function assembleFromProposer(
  state: PipelineState,
  config: PipelineConfig,
  traces: StageTraces,
  startedAt: Date,
  telemetry?: PipelineTelemetry
): Promise<TranslationResult> {
  state.currentStage = "assembly";
  telemetry?.onStageStart?.("assembly");

  // Use proposal fragments directly
  const proposal = state.proposal!;
  if (proposal.kind !== "fragments") {
    throw new Error("Expected fragments from proposer");
  }

  const assemblyResult = await executeAssembly(proposal, state, config);
  if (!assemblyResult.success) {
    throw assemblyResult.error;
  }

  const assembly = assemblyResult.data!;
  traces.assembly = createAssemblyTrace(
    assembly,
    assembly.fragments ?? [],
    assemblyResult.durationMs
  );
  telemetry?.onStageComplete?.("assembly", assemblyResult.durationMs);

  const trace = buildTrace(state, traces, startedAt, config, assembly.kind);
  const result = buildTranslationResult(assembly, trace);

  state.currentStage = "complete";
  telemetry?.onComplete?.(result);

  return result;
}

/**
 * Resolve ambiguity
 */
async function resolveAmbiguity(
  resolution: AmbiguityResolution,
  context: TranslationContext,
  config: PipelineConfig,
  telemetry?: PipelineTelemetry
): Promise<TranslationResult> {
  const startedAt = new Date();
  const traces: StageTraces = {};

  // Initialize state for resolution
  const state: PipelineState = {
    input: "",
    context,
    currentStage: "assembly",
    traces,
    startedAt,
  };

  try {
    // Find the selected option
    const selectedOptionId =
      resolution.choice.kind === "option" ? resolution.choice.optionId : null;

    if (selectedOptionId === "opt-cancel") {
      return createErrorResult(
        "User cancelled resolution",
        "USER_CANCELLED",
        traces,
        startedAt,
        config,
        context
      );
    }

    // For now, return error as we don't have the original report stored
    // In a full implementation, we'd look up the report and apply the selection
    return createErrorResult(
      "Ambiguity resolution requires stored report context",
      "RESOLUTION_NOT_IMPLEMENTED",
      traces,
      startedAt,
      config,
      context
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    telemetry?.onStageError?.("assembly", err);

    return createErrorResult(
      err.message,
      "RESOLUTION_ERROR",
      traces,
      startedAt,
      config,
      context
    );
  }
}

/**
 * Build translation trace
 */
function buildTrace(
  state: PipelineState,
  traces: StageTraces,
  startedAt: Date,
  config: PipelineConfig,
  resultKind: "fragment" | "ambiguity" | "error"
): TranslationTrace {
  const endedAt = new Date();
  const durationMs = endedAt.getTime() - startedAt.getTime();
  const detectedLanguage = state.normalization?.language ?? "en";

  return {
    traceId: generateTraceId(),
    request: {
      intentId: state.context.intentId,
      atWorldId: state.context.atWorldId,
      inputLength: state.input.length,
      inputPreview: config.includeInputPreview
        ? state.input.slice(0, config.maxPreviewLength)
        : undefined,
      inputHash: computeInputHash(state.input),
      language: detectedLanguage,
    },
    stages: traces,
    resultKind,
    timing: {
      startedAt: startedAt.toISOString(),
      completedAt: endedAt.toISOString(),
      durationMs,
    },
  };
}

/**
 * Create error result
 */
function createErrorResult(
  message: string,
  code: string,
  traces: StageTraces,
  startedAt: Date,
  config: PipelineConfig,
  context: TranslationContext
): TranslationResult {
  const endedAt = new Date();
  const durationMs = endedAt.getTime() - startedAt.getTime();

  return {
    kind: "error",
    error: {
      code: code as any,
      message,
      recoverable: false,
      details: {},
    },
    trace: {
      traceId: generateTraceId(),
      request: {
        intentId: context.intentId,
        atWorldId: context.atWorldId,
        inputLength: 0,
        inputHash: "",
        language: "en",
      },
      stages: traces,
      resultKind: "error",
      timing: {
        startedAt: startedAt.toISOString(),
        completedAt: endedAt.toISOString(),
        durationMs,
      },
    },
  };
}

// Re-export types and stage functions
export * from "./types.js";
export * from "./stage-0-chunking.js";
export * from "./stage-1-normalization.js";
export * from "./stage-2-fast-path.js";
export * from "./stage-3-retrieval.js";
export * from "./stage-4-memory.js";
export * from "./stage-5-proposer.js";
export * from "./stage-6-assembly.js";
