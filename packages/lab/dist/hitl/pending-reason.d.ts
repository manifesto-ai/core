/**
 * Pending Reason
 *
 * Factory functions for creating PendingReason objects.
 * Added in v1.1.
 */
import type { PendingReason, PendingReasonCode, PendingReasonDetails } from "../types.js";
/**
 * Create a LOW_CONFIDENCE pending reason.
 *
 * @param actual - The actual confidence value
 * @param required - The required confidence threshold
 * @param suggestions - Optional resolution suggestions
 */
export declare function lowConfidence(actual: number, required: number, suggestions?: string[]): PendingReason;
/**
 * Create an AMBIGUOUS_INTENT pending reason.
 *
 * @param interpretations - Possible interpretations
 * @param question - The question to resolve ambiguity
 * @param suggestions - Optional resolution suggestions
 */
export declare function ambiguousIntent(interpretations: unknown[], question: string, suggestions?: string[]): PendingReason;
/**
 * Create a REQUIRES_CONFIRMATION pending reason.
 *
 * @param policy - The policy requiring confirmation
 * @param risk - The risk level
 * @param suggestions - Optional resolution suggestions
 */
export declare function requiresConfirmation(policy: string, risk: "low" | "medium" | "high", suggestions?: string[]): PendingReason;
/**
 * Create a SCOPE_EXCEEDED pending reason.
 *
 * @param requested - The requested scopes
 * @param allowed - The allowed scopes
 * @param suggestions - Optional resolution suggestions
 */
export declare function scopeExceeded(requested: string[], allowed: string[], suggestions?: string[]): PendingReason;
/**
 * Create a RESOURCE_LIMIT pending reason.
 *
 * @param resourceType - The type of resource
 * @param requested - The requested amount
 * @param limit - The limit
 * @param suggestions - Optional resolution suggestions
 */
export declare function resourceLimit(resourceType: string, requested: number, limit: number, suggestions?: string[]): PendingReason;
/**
 * Create a custom pending reason.
 *
 * @param code - The reason code
 * @param description - Human-readable description
 * @param details - Structured details
 * @param suggestions - Optional resolution suggestions
 */
export declare function createPendingReason(code: PendingReasonCode, description: string, details?: PendingReasonDetails, suggestions?: string[]): PendingReason;
/**
 * PendingReason factory namespace.
 */
export declare const PendingReasons: {
    lowConfidence: typeof lowConfidence;
    ambiguousIntent: typeof ambiguousIntent;
    requiresConfirmation: typeof requiresConfirmation;
    scopeExceeded: typeof scopeExceeded;
    resourceLimit: typeof resourceLimit;
    create: typeof createPendingReason;
};
//# sourceMappingURL=pending-reason.d.ts.map