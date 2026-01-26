/**
 * @fileoverview Ambiguity Scorer
 *
 * Converts LLM ambiguity indicators to numerical ambiguityScore.
 */

import type { AmbiguityIndicators } from "../llm/provider.js";
import type { ResolutionStatus } from "../types/node.js";

// =============================================================================
// Constants
// =============================================================================

/**
 * Weights for ambiguity score calculation.
 */
const WEIGHTS = {
  /** Weight for inverse confidence */
  confidenceInverse: 0.3,
  /** Weight for unresolved reference */
  unresolvedRef: 0.2,
  /** Weight per missing role (capped) */
  missingRole: 0.15,
  /** Maximum contribution from missing roles */
  missingRoleMax: 0.45,
  /** Weight for multiple interpretations */
  multipleInterpretations: 0.25,
} as const;

// =============================================================================
// Scorer
// =============================================================================

/**
 * Calculate ambiguity score from LLM indicators.
 *
 * The score is a weighted combination of:
 * - Inverse confidence: (1 - confidence) * 0.3
 * - Unresolved reference: +0.2
 * - Missing roles: +0.15 per role (max 0.45)
 * - Multiple interpretations: +0.25
 *
 * Result is clamped to [0, 1].
 *
 * @param indicators - Ambiguity indicators from LLM
 * @returns Ambiguity score in [0, 1]
 */
export function calculateAmbiguityScore(indicators: AmbiguityIndicators): number {
  let score = 0;

  // Inverse confidence contribution
  score += (1 - indicators.confidenceScore) * WEIGHTS.confidenceInverse;

  // Unresolved reference contribution
  if (indicators.hasUnresolvedRef) {
    score += WEIGHTS.unresolvedRef;
  }

  // Missing roles contribution (capped)
  const missingRoleContribution = Math.min(
    indicators.missingRequiredRoles.length * WEIGHTS.missingRole,
    WEIGHTS.missingRoleMax
  );
  score += missingRoleContribution;

  // Multiple interpretations contribution
  if (indicators.multipleInterpretations) {
    score += WEIGHTS.multipleInterpretations;
  }

  // Clamp to [0, 1]
  return Math.min(Math.max(score, 0), 1);
}

/**
 * Determine resolution status from ambiguity score and indicators.
 *
 * - "Resolved": score < 0.2 and no missing roles
 * - "Ambiguous": score < 0.7 or has missing roles but not too many
 * - "Abstract": score >= 0.7 or too many missing roles
 *
 * @param score - Ambiguity score
 * @param indicators - Ambiguity indicators
 * @returns Resolution status
 */
export function determineResolutionStatus(
  score: number,
  indicators: AmbiguityIndicators
): ResolutionStatus {
  const hasMissingRoles = indicators.missingRequiredRoles.length > 0;
  const manyMissingRoles = indicators.missingRequiredRoles.length >= 2;

  // Abstract: very uncertain or many missing roles
  if (score >= 0.7 || manyMissingRoles) {
    return "Abstract";
  }

  // Resolved: confident, no unresolved refs, no missing roles
  if (
    score < 0.2 &&
    !indicators.hasUnresolvedRef &&
    !hasMissingRoles &&
    !indicators.multipleInterpretations
  ) {
    return "Resolved";
  }

  // Ambiguous: everything else
  return "Ambiguous";
}

/**
 * Generate clarifying questions based on indicators.
 */
export function generateClarifyingQuestions(
  lemma: string,
  indicators: AmbiguityIndicators
): readonly string[] {
  const questions: string[] = [];

  if (indicators.hasUnresolvedRef) {
    questions.push("Which item are you referring to?");
  }

  for (const role of indicators.missingRequiredRoles) {
    switch (role) {
      case "TARGET":
        questions.push(`What would you like to ${lemma.toLowerCase()}?`);
        break;
      case "THEME":
        questions.push(`What value or content should be used?`);
        break;
      case "DEST":
        questions.push(`Where should this be placed?`);
        break;
      case "SOURCE":
        questions.push(`Where should this come from?`);
        break;
      case "BENEFICIARY":
        questions.push(`Who is this for?`);
        break;
      case "INSTRUMENT":
        questions.push(`How should this be done?`);
        break;
    }
  }

  if (indicators.multipleInterpretations) {
    questions.push("Could you be more specific about what you mean?");
  }

  return questions;
}
