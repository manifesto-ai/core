/**
 * @fileoverview Translate Action
 *
 * Full pipeline execution: S1 → S2 → S3 → S4 → S5 → S6 → S7
 * Transforms natural language to IntentBody.
 * Aligned with SPEC §6.1.
 */

import type { App } from "@manifesto-ai/app";
import type { LLMClient } from "../pipeline/llm-client.js";
import {
  type TranslateInput,
  type TranslateOutput,
  type TranslatorState,
  type TranslateResult,
  type SimKeyHex,
} from "../types/index.js";
import {
  normalize,
  propose,
  canonicalize,
  featureCheck,
  resolveReferences,
  buildResolutionContext,
  lowerIR,
  validateActionBody,
  isActionRelatedLemma,
  extractActionBody,
} from "../pipeline/index.js";
import {
  createCompositeLexicon,
  createLearnedLexicon,
  deriveProjectLexicon,
  createBuiltinLexicon,
} from "../lexicon/index.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Translate action context
 */
export type TranslateContext = {
  /** Application instance */
  readonly app: App;
  /** LLM client for S2 */
  readonly llmClient: LLMClient;
  /** Current translator state */
  readonly state: TranslatorState;
  /** Whether to run in strict mode */
  readonly strict?: boolean;
};

// =============================================================================
// Action Implementation
// =============================================================================

/**
 * Execute translate action
 *
 * Runs full pipeline S1-S7 to transform natural language to IntentBody.
 *
 * @param input - Translate action input
 * @param context - Action context with app and LLM client
 * @returns TranslateOutput
 */
export async function translate(
  input: TranslateInput,
  context: TranslateContext
): Promise<TranslateOutput> {
  const { app, llmClient, state, strict = false } = context;
  const requestId = generateRequestId();

  // Build lexicons
  const builtin = createBuiltinLexicon();
  const project = deriveProjectLexicon(app.getDomainSchema());
  const learned = createLearnedLexicon(state.learnedEntries, builtin);
  const lexicon = createCompositeLexicon(learned, project, builtin);

  // Get schema hash from app
  const schemaHash = app.getDomainSchema().hash;

  // =========================================================================
  // S1: Normalize
  // =========================================================================
  const normalizeResult = normalize(input.text);

  if (!normalizeResult.ok) {
    return {
      requestId,
      result: { kind: "error", error: normalizeResult.error },
      simKey: null,
    };
  }

  // =========================================================================
  // S2: Propose (LLM)
  // =========================================================================
  const proposeResult = await propose(
    {
      normalizedText: normalizeResult.normalized,
      lang: normalizeResult.detectedLang,
      lexicon,
    },
    llmClient
  );

  if (!proposeResult.ok) {
    return {
      requestId,
      result: { kind: "error", error: proposeResult.error },
      simKey: null,
    };
  }

  const ir = proposeResult.ir;

  // =========================================================================
  // S3: Canonicalize
  // =========================================================================
  const canonicalizeResult = canonicalize(ir);
  const canonicalizedIR = canonicalizeResult.canonical;
  const simKey = canonicalizeResult.simKey;
  const simKeyHex: SimKeyHex = canonicalizeResult.simKeyHex;

  // =========================================================================
  // S4: Feature Check
  // =========================================================================
  const featureCheckResult = featureCheck(
    canonicalizedIR,
    lexicon,
    learned,
    project,
    builtin,
    strict
  );

  if (!featureCheckResult.ok) {
    return {
      requestId,
      result: { kind: "error", error: featureCheckResult.error },
      simKey: simKeyHex,
    };
  }

  // =========================================================================
  // S5: Resolve References
  // =========================================================================
  const resolutionContext = buildResolutionContext(
    state.requests,
    state.config.resolverContextDepth
  );
  const resolveResult = resolveReferences(canonicalizedIR, resolutionContext);

  const resolvedIR = resolveResult.ir;
  const resolutions = resolveResult.resolutions;

  // =========================================================================
  // S6: Lower
  // =========================================================================
  const lowerResult = lowerIR(
    resolvedIR,
    lexicon,
    learned,
    project,
    builtin,
    schemaHash,
    resolutions
  );

  // =========================================================================
  // S7: Validate Action Body (conditional)
  // =========================================================================
  if (
    lowerResult.loweringResult.kind === "resolved" &&
    isActionRelatedLemma(ir.event.lemma)
  ) {
    const actionBody = extractActionBody(lowerResult.loweringResult.body.input);
    if (actionBody) {
      const validateResult = validateActionBody(actionBody);
      if (!validateResult.ok) {
        return {
          requestId,
          result: { kind: "error", error: validateResult.error },
          simKey: simKeyHex,
        };
      }
    }
  }

  // =========================================================================
  // Build Output
  // =========================================================================
  if (lowerResult.loweringResult.kind === "resolved") {
    const result: TranslateResult = {
      kind: "success",
      body: lowerResult.loweringResult.body,
    };

    return {
      requestId,
      result,
      simKey: simKeyHex,
      intentKey: lowerResult.intentKey,
    };
  }

  if (lowerResult.loweringResult.kind === "ambiguous") {
    return {
      requestId,
      result: {
        kind: "ambiguous",
        candidates: lowerResult.loweringResult.candidates,
      },
      simKey: simKeyHex,
    };
  }

  // Unresolved (cold start)
  return {
    requestId,
    result: {
      kind: "unresolved",
      partial: lowerResult.loweringResult.partial,
      missing: lowerResult.loweringResult.missing,
    },
    simKey: simKeyHex,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
