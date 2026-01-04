/**
 * Stage 5: Proposer (LLM-based)
 *
 * Uses LLM to propose fragments based on:
 * - Normalized input
 * - Anchor candidates from retrieval
 * - Examples from memory
 *
 * Per SPEC-1.1.1v:
 * - INV-002: Untrusted Proposer - output is proposal, never truth
 * - Output must include confidence and evidence
 */

import type {
  MemoryStageResult,
  ProposalResult,
  ProposerTrace,
  NormalizationResult,
  RetrievalResult,
  AnchorCandidate,
} from "../domain/index.js";
import type {
  LLMProvider,
  ProposeRequest,
  ProposeResponse,
  TranslationExample as LLMExample,
} from "../llm/index.js";
import type { PipelineState, StageResult } from "./types.js";

/**
 * Proposer configuration
 */
export interface ProposerConfig {
  /** LLM provider */
  provider?: LLMProvider;
  /** Maximum tokens for generation */
  maxTokens: number;
  /** Temperature for generation */
  temperature: number;
  /** Escalation threshold (if confidence < this, try larger model) */
  escalationThreshold: number;
  /** Model for escalation */
  escalationModel?: string;
}

const DEFAULT_CONFIG: ProposerConfig = {
  maxTokens: 2048,
  temperature: 0.1,
  escalationThreshold: 0.5,
};

/**
 * Execute proposer stage
 */
export async function executeProposer(
  normalization: NormalizationResult,
  retrieval: RetrievalResult,
  memory: MemoryStageResult,
  state: PipelineState,
  config: Partial<ProposerConfig> = {}
): Promise<StageResult<ProposalResult>> {
  const startTime = Date.now();
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    // Check if provider is configured
    if (!fullConfig.provider) {
      // Return empty result if no provider
      return {
        success: true,
        data: {
          kind: "empty",
          confidence: 0,
          evidence: ["No LLM provider configured"],
        },
        durationMs: Date.now() - startTime,
      };
    }

    // Validate provider configuration
    const validation = fullConfig.provider.validateConfig();
    if (!validation.valid) {
      return {
        success: true,
        data: {
          kind: "empty",
          confidence: 0,
          evidence: [`Provider not configured: ${validation.errors.join(", ")}`],
        },
        durationMs: Date.now() - startTime,
      };
    }

    // Build propose request
    const request = buildProposeRequest(
      normalization,
      retrieval,
      memory,
      state,
      fullConfig
    );

    // Call provider
    const result = await fullConfig.provider.propose(request);

    if (!result.success) {
      // Provider error - return empty with error evidence
      return {
        success: true,
        data: {
          kind: "empty",
          confidence: 0,
          evidence: [
            `LLM error: ${result.error?.message ?? "Unknown error"}`,
          ],
        },
        durationMs: Date.now() - startTime,
      };
    }

    // Convert provider response to proposal result
    const proposalResult = convertResponse(result.data!);

    // Check for escalation
    if (
      proposalResult.kind === "fragments" &&
      proposalResult.confidence < fullConfig.escalationThreshold &&
      fullConfig.escalationModel
    ) {
      // TODO: Implement escalation to larger model
      // For now, just record that escalation was considered
      proposalResult.evidence.push(
        `Low confidence (${proposalResult.confidence.toFixed(2)}), escalation available`
      );
    }

    return {
      success: true,
      data: proposalResult,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Build propose request from stage outputs
 */
function buildProposeRequest(
  normalization: NormalizationResult,
  retrieval: RetrievalResult,
  memory: MemoryStageResult,
  state: PipelineState,
  config: ProposerConfig
): ProposeRequest {
  // Use retrieval candidates directly
  const anchors = retrieval.candidates;

  // Convert memory examples to LLM format
  const examples: LLMExample[] = memory.content.translationExamples.map((e) => ({
    input: e.normalizedInput,
    fragments: e.fragments,
    context: `World: ${e.worldId}, Verified: ${e.verified}`,
  }));

  return {
    input: normalization.canonical,
    canonicalInput: normalization.canonical,
    schema: state.context.schema,
    typeIndex: state.context.typeIndex,
    anchors,
    examples,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
    intentId: state.context.intentId,
  };
}

/**
 * Convert provider response to proposal result
 */
function convertResponse(response: ProposeResponse): ProposalResult {
  switch (response.kind) {
    case "fragments":
      return {
        kind: "fragments",
        fragments: response.fragments,
        confidence: response.confidence,
        evidence: [`LLM confidence: ${response.confidence.toFixed(2)}`],
      };

    case "ambiguity":
      return {
        kind: "ambiguity",
        ambiguity: response.report,
        confidence: 0.5,
        evidence: ["LLM detected ambiguity"],
      };

    case "empty":
      return {
        kind: "empty",
        confidence: 0,
        evidence: [response.reason],
      };
  }
}

/**
 * Create proposer trace
 */
export function createProposerTrace(
  result: ProposalResult,
  modelId: string,
  promptTokens: number,
  completionTokens: number,
  escalated: boolean,
  durationMs: number
): ProposerTrace {
  return {
    modelId,
    promptTokens,
    completionTokens,
    escalated,
    escalationReason: escalated ? "Low confidence" : undefined,
    durationMs,
  };
}
