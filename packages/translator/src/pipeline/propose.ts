/**
 * @fileoverview S2: Propose Stage
 *
 * LLM-based IntentIR proposal from natural language.
 * Non-deterministic stage (LLM dependency).
 * Aligned with SPEC §5.1 S2.
 */

import type { IntentIR, Lexicon } from "@manifesto-ai/intent-ir";
import type { LLMClient, ProposeRequest, ProposeResponse } from "./llm-client.js";
import { createError, type TranslatorError } from "../types/index.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Propose stage input
 */
export type ProposeInput = {
  /** Normalized text from S1 */
  readonly normalizedText: string;
  /** Detected language */
  readonly lang: string;
  /** Schema context for the LLM */
  readonly schemaContext?: string;
  /** Composite lexicon for available lemmas */
  readonly lexicon?: Lexicon;
  /** Recent conversation context */
  readonly recentContext?: readonly string[];
};

/**
 * Propose stage result
 */
export type ProposeResult =
  | {
      readonly ok: true;
      readonly ir: IntentIR;
      readonly rawOutput: string;
      readonly model?: string;
      readonly usage?: {
        readonly promptTokens: number;
        readonly completionTokens: number;
      };
    }
  | {
      readonly ok: false;
      readonly error: TranslatorError;
    };

/**
 * Propose stage trace output
 */
export type ProposeTrace = {
  readonly inputText: string;
  readonly lang: string;
  readonly model?: string;
  readonly result: "success" | "error";
  readonly usage?: {
    readonly promptTokens: number;
    readonly completionTokens: number;
  };
  readonly errorCode?: string;
};

// =============================================================================
// Stage Implementation
// =============================================================================

/**
 * S2: Propose IntentIR from normalized natural language
 *
 * TAPP-PIPE-2: This stage is non-deterministic (LLM).
 * TAPP-LLM-1: LLM proposes IntentIR from PF.
 *
 * @param input - Propose stage input
 * @param client - LLM client for proposal
 * @returns Promise resolving to ProposeResult
 */
export async function propose(
  input: ProposeInput,
  client: LLMClient
): Promise<ProposeResult> {
  // Check if client is ready
  if (!client.isReady()) {
    return {
      ok: false,
      error: createError(
        "IR_PROPOSAL_FAILED",
        `LLM client (${client.getProvider()}) is not ready`,
        { stage: "propose", recoverable: true }
      ),
    };
  }

  // Build available lemmas from lexicon
  const availableLemmas = input.lexicon
    ? extractAvailableLemmas(input.lexicon)
    : undefined;

  // Build request
  const request: ProposeRequest = {
    text: input.normalizedText,
    lang: input.lang,
    schemaContext: input.schemaContext,
    availableLemmas,
    recentContext: input.recentContext,
  };

  try {
    // Call LLM client
    const response: ProposeResponse = await client.propose(request);

    // Validate response IR structure
    const validationError = validateIR(response.ir);
    if (validationError) {
      return {
        ok: false,
        error: createError(
          "IR_INVALID",
          validationError,
          { stage: "propose", recoverable: true, detail: response.ir }
        ),
      };
    }

    return {
      ok: true,
      ir: response.ir,
      rawOutput: response.rawOutput,
      model: response.model,
      usage: response.usage,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: createError(
        "IR_PROPOSAL_FAILED",
        `LLM proposal failed: ${message}`,
        { stage: "propose", recoverable: true }
      ),
    };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract available lemmas from lexicon
 *
 * Note: In v0.1, we don't enumerate lemmas - LLM uses schema context instead.
 * Future versions may add Lexicon.listEvents() for lemma enumeration.
 */
function extractAvailableLemmas(_lexicon: Lexicon): readonly string[] {
  // v0.1: Return empty - LLM uses schema context for guidance
  // Future: lexicon.listEvents() for explicit lemma enumeration
  return [];
}

/**
 * Validate IntentIR basic structure
 */
function validateIR(ir: IntentIR): string | null {
  // Check version
  if (!ir.v || typeof ir.v !== "string") {
    return "Missing or invalid version field";
  }

  // Check force
  if (!ir.force || !["DO", "DONT", "ASK", "TRY"].includes(ir.force)) {
    return `Invalid force field: ${ir.force}`;
  }

  // Check event
  if (!ir.event || typeof ir.event !== "object") {
    return "Missing or invalid event field";
  }

  if (!ir.event.lemma || typeof ir.event.lemma !== "string") {
    return "Missing or invalid event.lemma field";
  }

  if (!ir.event.class || typeof ir.event.class !== "string") {
    return "Missing or invalid event.class field";
  }

  // args is optional but must be object if present
  if (ir.args !== undefined && typeof ir.args !== "object") {
    return "Invalid args field";
  }

  return null;
}

/**
 * Create propose trace from result
 */
export function createProposeTrace(
  input: ProposeInput,
  result: ProposeResult
): ProposeTrace {
  if (result.ok) {
    return {
      inputText: input.normalizedText,
      lang: input.lang,
      model: result.model,
      result: "success",
      usage: result.usage,
    };
  }

  return {
    inputText: input.normalizedText,
    lang: input.lang,
    result: "error",
    errorCode: result.error.code,
  };
}
