/**
 * HITL Context v1.1
 *
 * Extended HITL context with prompt builder.
 * Added in v1.1.
 */
import { buildPrompt } from "./prompt.js";
import { getDefaultActions } from "./actions.js";
/**
 * Create an HITLContextV1 instance.
 *
 * @param options - Creation options
 * @returns HITLContextV1 instance
 */
export function createHITLContext(options) {
    const { snapshot, proposal, pendingReason, renderContext, decisionRecord, } = options;
    // Use provided actions or generate defaults based on pending reason
    const availableActions = options.availableActions ?? getDefaultActions(pendingReason.code);
    // Create the context object
    const context = {
        snapshot,
        proposal,
        pendingReason,
        availableActions,
        renderContext,
        decisionRecord,
        toPrompt(promptOptions) {
            return buildPrompt({
                snapshot,
                proposal,
                pendingReason,
                availableActions,
                renderContext,
                promptOptions,
            });
        },
    };
    return context;
}
// =============================================================================
// Utilities
// =============================================================================
/**
 * Create a decision record for a pending decision.
 *
 * @param authorityId - The authority that made the decision
 * @param options - Additional options
 * @returns DecisionRecord
 */
export function createPendingDecisionRecord(authorityId, options) {
    return {
        authorityId,
        decision: "pending",
        timestamp: Date.now(),
        verificationMethod: options?.verificationMethod,
        confidence: options?.confidence,
        note: options?.note,
    };
}
/**
 * Check if a context can be auto-resolved based on suggestions.
 *
 * @param context - The HITL context
 * @returns true if auto-resolution is possible
 */
export function canAutoResolve(context) {
    // Can auto-resolve if:
    // 1. Low confidence with confidence close to threshold
    // 2. Requires confirmation for low-risk actions
    const reason = context.pendingReason;
    if (reason.code === "LOW_CONFIDENCE") {
        const details = reason.details.confidence;
        if (details) {
            // Auto-resolve if within 10% of threshold
            const gap = details.required - details.actual;
            return gap <= 0.1;
        }
    }
    if (reason.code === "REQUIRES_CONFIRMATION") {
        const details = reason.details.confirmation;
        if (details && details.risk === "low") {
            return true;
        }
    }
    return false;
}
/**
 * Get suggested action for auto-resolution.
 *
 * @param context - The HITL context
 * @returns Suggested action type or null
 */
export function getSuggestedAction(context) {
    if (!canAutoResolve(context)) {
        return null;
    }
    const reason = context.pendingReason;
    if (reason.code === "LOW_CONFIDENCE") {
        return "retry";
    }
    if (reason.code === "REQUIRES_CONFIRMATION") {
        const details = reason.details.confirmation;
        if (details?.risk === "low") {
            return "retry"; // Auto-approve low-risk
        }
    }
    return null;
}
//# sourceMappingURL=context-v1.js.map