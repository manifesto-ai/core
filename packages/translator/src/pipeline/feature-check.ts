/**
 * @fileoverview S4: Feature Check Stage
 *
 * Verifies selectional restrictions via Lexicon.
 * Deterministic stage.
 * Aligned with SPEC §5.1 S4.
 */

import {
  checkFeatures,
  type IntentIR,
  type Lexicon,
  type CheckResult,
  type CheckError,
} from "@manifesto-ai/intent-ir";
import { createError, type TranslatorError, type LexiconSource } from "../types/index.js";
import { determineLexiconSource } from "../lexicon/index.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Feature check stage result
 */
export type FeatureCheckResult =
  | {
      readonly ok: true;
      readonly lexiconSource: LexiconSource;
      readonly checksPerformed: readonly FeatureCheck[];
    }
  | {
      readonly ok: false;
      readonly failure: CheckError;
      readonly error: TranslatorError;
    };

/**
 * Individual feature check record
 */
export type FeatureCheck = {
  readonly role: string;
  readonly constraint: string;
  readonly passed: boolean;
};

/**
 * Feature check trace output
 */
export type FeatureCheckTrace = {
  readonly lexiconUsed: LexiconSource;
  readonly checksPerformed: readonly FeatureCheck[];
  readonly result: "pass" | "fail";
  readonly failure?: CheckError;
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format CheckError for display
 */
function formatCheckError(error: CheckError): string {
  switch (error.code) {
    case "UNKNOWN_LEMMA":
      return `Unknown lemma: ${error.lemma}`;
    case "CLASS_MISMATCH":
      return `Event class mismatch: expected ${error.expected}, got ${error.actual}`;
    case "MISSING_ROLE":
      return `Missing required role: ${error.role}`;
    case "INVALID_TERM_KIND":
      return `Invalid term kind for ${error.role}: expected ${error.expected.join("|")}, got ${error.actual}`;
    case "INVALID_ENTITY_TYPE":
      return `Invalid entity type for ${error.role}: ${error.entityType} not in [${error.allowed.join(", ")}]`;
    case "INVALID_VALUE_TYPE":
      return `Invalid value type for ${error.role}: ${error.valueType} not in [${error.allowed.join(", ")}]`;
    case "UNKNOWN_ENTITY_TYPE":
      return `Unknown entity type: ${error.entityType}`;
    default:
      return `Feature check error: ${(error as { code: string }).code}`;
  }
}

/**
 * Extract role from CheckError if available
 */
function extractRoleFromError(error: CheckError): string {
  if ("role" in error) {
    return error.role;
  }
  return "unknown";
}

/**
 * Convert CheckError to FeatureCheck record
 */
function errorToCheck(error: CheckError): FeatureCheck {
  return {
    role: extractRoleFromError(error),
    constraint: error.code,
    passed: false,
  };
}

// =============================================================================
// Stage Implementation
// =============================================================================

/**
 * S4: Feature Check - Verify selectional restrictions via Lexicon
 *
 * TAPP-PIPE-1: This stage is deterministic.
 *
 * @param ir - Canonicalized IntentIR from S3
 * @param lexicon - Composite lexicon (Learned → Project → Builtin)
 * @param learned - Learned lexicon (for source determination)
 * @param project - Project lexicon (for source determination)
 * @param builtin - Builtin lexicon (for source determination)
 * @param strict - Error on feature check failure
 * @returns FeatureCheckResult
 */
export function featureCheck(
  ir: IntentIR,
  lexicon: Lexicon,
  learned: Lexicon,
  project: Lexicon,
  builtin: Lexicon,
  strict: boolean
): FeatureCheckResult {
  const lemma = ir.event.lemma;

  // Resolve event entry to check if lemma exists
  const entry = lexicon.resolveEvent(lemma);

  if (!entry) {
    // Lemma not found in any lexicon
    const unknownLemmaError: CheckError = { code: "UNKNOWN_LEMMA", lemma };

    if (strict) {
      return {
        ok: false,
        failure: unknownLemmaError,
        error: createError(
          "FEATURE_CHECK_FAILED",
          formatCheckError(unknownLemmaError),
          { stage: "feature_check", recoverable: true, detail: { lemma } }
        ),
      };
    }

    // Non-strict mode: allow unknown lemmas (cold start support)
    return {
      ok: true,
      lexiconSource: "builtin", // Fallback indication
      checksPerformed: [],
    };
  }

  // Determine lexicon source
  const source = determineLexiconSource(learned, project, builtin, lemma) ?? "builtin";

  // Run feature checks using Intent IR's checkFeatures
  // checkFeatures takes (ir, lexicon) - it looks up the entry internally
  const checkResult: CheckResult = checkFeatures(ir, lexicon);

  if (!checkResult.valid) {
    if (strict) {
      return {
        ok: false,
        failure: checkResult.error,
        error: createError(
          "FEATURE_CHECK_FAILED",
          formatCheckError(checkResult.error),
          { stage: "feature_check", recoverable: true, detail: checkResult.error }
        ),
      };
    }

    // Non-strict mode: continue with warnings
    // In v0.1, we log but don't fail
    return {
      ok: true,
      lexiconSource: source,
      checksPerformed: [errorToCheck(checkResult.error)],
    };
  }

  return {
    ok: true,
    lexiconSource: source,
    checksPerformed: [],
  };
}

/**
 * Create feature check trace from result
 */
export function createFeatureCheckTrace(
  result: FeatureCheckResult
): FeatureCheckTrace {
  if (result.ok) {
    return {
      lexiconUsed: result.lexiconSource,
      checksPerformed: result.checksPerformed,
      result: "pass",
    };
  }

  return {
    lexiconUsed: "builtin",
    checksPerformed: [errorToCheck(result.failure)],
    result: "fail",
    failure: result.failure,
  };
}
