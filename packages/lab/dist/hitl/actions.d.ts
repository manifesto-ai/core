/**
 * HITL Actions
 *
 * Factory functions for creating HITLAction objects.
 * Added in v1.1.
 */
import type { HITLAction } from "../types.js";
/**
 * Create a retry action.
 *
 * @param description - Description of the retry action
 * @param hint - Optional hint for retrying
 */
export declare function retry(description?: string, hint?: string): HITLAction;
/**
 * Create a modify action.
 *
 * @param allowedModifications - List of allowed modifications
 * @param description - Optional description
 */
export declare function modify(allowedModifications: string[], description?: string): HITLAction;
/**
 * Create a request_info action.
 *
 * @param suggestedQuestions - Questions to ask for clarification
 * @param description - Optional description
 */
export declare function requestInfo(suggestedQuestions: string[], description?: string): HITLAction;
/**
 * Create an escalate action.
 *
 * @param to - The authority or role to escalate to
 * @param description - Optional description
 */
export declare function escalate(to: string, description?: string): HITLAction;
/**
 * Create an abort action.
 *
 * @param description - Optional description
 */
export declare function abort(description?: string): HITLAction;
/**
 * Default actions for low confidence scenarios.
 */
export declare function defaultLowConfidenceActions(): HITLAction[];
/**
 * Default actions for ambiguous intent scenarios.
 */
export declare function defaultAmbiguousIntentActions(): HITLAction[];
/**
 * Default actions for confirmation required scenarios.
 */
export declare function defaultConfirmationActions(): HITLAction[];
/**
 * Default actions for scope exceeded scenarios.
 */
export declare function defaultScopeExceededActions(): HITLAction[];
/**
 * Default actions for resource limit scenarios.
 */
export declare function defaultResourceLimitActions(): HITLAction[];
/**
 * Get default actions based on pending reason code.
 */
export declare function getDefaultActions(code: "LOW_CONFIDENCE" | "AMBIGUOUS_INTENT" | "REQUIRES_CONFIRMATION" | "SCOPE_EXCEEDED" | "RESOURCE_LIMIT"): HITLAction[];
/**
 * HITLActions factory namespace.
 */
export declare const HITLActions: {
    retry: typeof retry;
    modify: typeof modify;
    requestInfo: typeof requestInfo;
    escalate: typeof escalate;
    abort: typeof abort;
    getDefaultActions: typeof getDefaultActions;
    defaults: {
        lowConfidence: typeof defaultLowConfidenceActions;
        ambiguousIntent: typeof defaultAmbiguousIntentActions;
        confirmation: typeof defaultConfirmationActions;
        scopeExceeded: typeof defaultScopeExceededActions;
        resourceLimit: typeof defaultResourceLimitActions;
    };
};
//# sourceMappingURL=actions.d.ts.map