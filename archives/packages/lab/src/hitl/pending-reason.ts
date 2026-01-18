/**
 * Pending Reason
 *
 * Factory functions for creating PendingReason objects.
 * Added in v1.1.
 */

import type {
  PendingReason,
  PendingReasonCode,
  PendingReasonDetails,
} from "../types.js";

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a LOW_CONFIDENCE pending reason.
 *
 * @param actual - The actual confidence value
 * @param required - The required confidence threshold
 * @param suggestions - Optional resolution suggestions
 */
export function lowConfidence(
  actual: number,
  required: number,
  suggestions?: string[]
): PendingReason {
  return {
    code: "LOW_CONFIDENCE",
    description: `Confidence ${(actual * 100).toFixed(0)}% is below required ${(required * 100).toFixed(0)}%`,
    details: {
      confidence: { actual, required },
    },
    suggestions: suggestions ?? [
      "Provide more context to increase confidence",
      "Confirm the action manually",
      "Modify the action to reduce uncertainty",
    ],
  };
}

/**
 * Create an AMBIGUOUS_INTENT pending reason.
 *
 * @param interpretations - Possible interpretations
 * @param question - The question to resolve ambiguity
 * @param suggestions - Optional resolution suggestions
 */
export function ambiguousIntent(
  interpretations: unknown[],
  question: string,
  suggestions?: string[]
): PendingReason {
  return {
    code: "AMBIGUOUS_INTENT",
    description: `Multiple interpretations possible: ${question}`,
    details: {
      ambiguity: { interpretations, question },
    },
    suggestions: suggestions ?? [
      "Clarify which interpretation is intended",
      "Provide additional context",
      "Select one of the possible interpretations",
    ],
  };
}

/**
 * Create a REQUIRES_CONFIRMATION pending reason.
 *
 * @param policy - The policy requiring confirmation
 * @param risk - The risk level
 * @param suggestions - Optional resolution suggestions
 */
export function requiresConfirmation(
  policy: string,
  risk: "low" | "medium" | "high",
  suggestions?: string[]
): PendingReason {
  const riskDesc = {
    low: "low-risk",
    medium: "moderate-risk",
    high: "high-risk",
  };

  return {
    code: "REQUIRES_CONFIRMATION",
    description: `Policy "${policy}" requires confirmation for ${riskDesc[risk]} action`,
    details: {
      confirmation: { policy, risk },
    },
    suggestions: suggestions ?? [
      "Review and confirm the action",
      "Reject if the action is not appropriate",
    ],
  };
}

/**
 * Create a SCOPE_EXCEEDED pending reason.
 *
 * @param requested - The requested scopes
 * @param allowed - The allowed scopes
 * @param suggestions - Optional resolution suggestions
 */
export function scopeExceeded(
  requested: string[],
  allowed: string[],
  suggestions?: string[]
): PendingReason {
  const exceeding = requested.filter((r) => !allowed.includes(r));

  return {
    code: "SCOPE_EXCEEDED",
    description: `Action requires scope(s) not allowed: ${exceeding.join(", ")}`,
    details: {
      scope: { requested, allowed },
    },
    suggestions: suggestions ?? [
      "Modify the action to stay within allowed scope",
      "Request additional permissions",
      "Approve with elevated permissions",
    ],
  };
}

/**
 * Create a RESOURCE_LIMIT pending reason.
 *
 * @param resourceType - The type of resource
 * @param requested - The requested amount
 * @param limit - The limit
 * @param suggestions - Optional resolution suggestions
 */
export function resourceLimit(
  resourceType: string,
  requested: number,
  limit: number,
  suggestions?: string[]
): PendingReason {
  return {
    code: "RESOURCE_LIMIT",
    description: `Requested ${resourceType}: ${requested} exceeds limit: ${limit}`,
    details: {
      resource: { type: resourceType, requested, limit },
    },
    suggestions: suggestions ?? [
      "Reduce the requested resource amount",
      "Request a limit increase",
      "Split the action into smaller parts",
    ],
  };
}

/**
 * Create a custom pending reason.
 *
 * @param code - The reason code
 * @param description - Human-readable description
 * @param details - Structured details
 * @param suggestions - Optional resolution suggestions
 */
export function createPendingReason(
  code: PendingReasonCode,
  description: string,
  details: PendingReasonDetails = {},
  suggestions?: string[]
): PendingReason {
  return {
    code,
    description,
    details,
    suggestions,
  };
}

// =============================================================================
// Namespace Export
// =============================================================================

/**
 * PendingReason factory namespace.
 */
export const PendingReasons = {
  lowConfidence,
  ambiguousIntent,
  requiresConfirmation,
  scopeExceeded,
  resourceLimit,
  create: createPendingReason,
};
