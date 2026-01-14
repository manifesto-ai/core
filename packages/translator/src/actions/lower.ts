/**
 * @fileoverview Lower Action
 *
 * Deterministic pipeline only: S3 → S4 → S5 → S6 → S7
 * Transforms IntentIR to IntentBody without LLM.
 * Aligned with SPEC §6.2.
 */

import type { App } from "@manifesto-ai/app";
import {
  type LowerInput,
  type LowerOutput,
  type TranslatorState,
  type SimKeyHex,
} from "../types/index.js";
import {
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
 * Lower action context
 */
export type LowerContext = {
  /** Application instance */
  readonly app: App;
  /** Current translator state */
  readonly state: TranslatorState;
  /** Whether to run in strict mode */
  readonly strict?: boolean;
};

// =============================================================================
// Action Implementation
// =============================================================================

/**
 * Execute lower action
 *
 * Runs deterministic pipeline S3-S7 to transform IntentIR to IntentBody.
 * Used when IntentIR is already available (e.g., from cache or external source).
 *
 * @param input - Lower action input
 * @param context - Action context with app
 * @returns LowerOutput
 */
export function lower(
  input: LowerInput,
  context: LowerContext
): LowerOutput {
  const { app, state, strict = false } = context;
  const requestId = input.requestId ?? generateRequestId();

  // Build lexicons
  const builtin = createBuiltinLexicon();
  const project = deriveProjectLexicon(app.getDomainSchema());
  const learned = createLearnedLexicon(state.learnedEntries, builtin);
  const lexicon = createCompositeLexicon(learned, project, builtin);

  // Get schema hash from app
  const schemaHash = app.getDomainSchema().hash;

  const ir = input.ir;

  // =========================================================================
  // S3: Canonicalize
  // =========================================================================
  const canonicalizeResult = canonicalize(ir);
  const canonicalizedIR = canonicalizeResult.canonical;
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
  return {
    requestId,
    result: lowerResult.loweringResult,
    simKey: simKeyHex,
    intentKey: lowerResult.intentKey,
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
