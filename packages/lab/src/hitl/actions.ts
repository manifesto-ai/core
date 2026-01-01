/**
 * HITL Actions
 *
 * Factory functions for creating HITLAction objects.
 * Added in v1.1.
 */

import type { HITLAction } from "../types.js";

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a retry action.
 *
 * @param description - Description of the retry action
 * @param hint - Optional hint for retrying
 */
export function retry(description?: string, hint?: string): HITLAction {
  return {
    type: "retry",
    description: description ?? "Retry the proposal with modifications",
    hint,
  };
}

/**
 * Create a modify action.
 *
 * @param allowedModifications - List of allowed modifications
 * @param description - Optional description
 */
export function modify(
  allowedModifications: string[],
  description?: string
): HITLAction {
  return {
    type: "modify",
    description: description ?? "Modify the proposal before resubmitting",
    allowedModifications,
  };
}

/**
 * Create a request_info action.
 *
 * @param suggestedQuestions - Questions to ask for clarification
 * @param description - Optional description
 */
export function requestInfo(
  suggestedQuestions: string[],
  description?: string
): HITLAction {
  return {
    type: "request_info",
    description: description ?? "Request additional information",
    suggestedQuestions,
  };
}

/**
 * Create an escalate action.
 *
 * @param to - The authority or role to escalate to
 * @param description - Optional description
 */
export function escalate(to: string, description?: string): HITLAction {
  return {
    type: "escalate",
    description: description ?? `Escalate to ${to}`,
    to,
  };
}

/**
 * Create an abort action.
 *
 * @param description - Optional description
 */
export function abort(description?: string): HITLAction {
  return {
    type: "abort",
    description: description ?? "Abort the current operation",
  };
}

// =============================================================================
// Standard Action Sets
// =============================================================================

/**
 * Default actions for low confidence scenarios.
 */
export function defaultLowConfidenceActions(): HITLAction[] {
  return [
    retry(
      "Retry with more context",
      "Provide additional information to increase confidence"
    ),
    modify(["input", "parameters"], "Modify the proposal parameters"),
    requestInfo(
      ["What is the expected outcome?", "Are there any constraints?"],
      "Ask clarifying questions"
    ),
    abort("Cancel this operation"),
  ];
}

/**
 * Default actions for ambiguous intent scenarios.
 */
export function defaultAmbiguousIntentActions(): HITLAction[] {
  return [
    requestInfo(
      ["Which interpretation is correct?"],
      "Clarify the intended interpretation"
    ),
    modify(["intent"], "Specify a clearer intent"),
    abort("Cancel due to ambiguity"),
  ];
}

/**
 * Default actions for confirmation required scenarios.
 */
export function defaultConfirmationActions(): HITLAction[] {
  return [
    retry("Approve and proceed", "Confirm this action is intended"),
    abort("Reject this action"),
  ];
}

/**
 * Default actions for scope exceeded scenarios.
 */
export function defaultScopeExceededActions(): HITLAction[] {
  return [
    modify(["scope"], "Reduce scope to allowed limits"),
    escalate("admin", "Request elevated permissions"),
    abort("Cancel operation"),
  ];
}

/**
 * Default actions for resource limit scenarios.
 */
export function defaultResourceLimitActions(): HITLAction[] {
  return [
    modify(["resources"], "Reduce resource requirements"),
    escalate("admin", "Request limit increase"),
    abort("Cancel operation"),
  ];
}

/**
 * Get default actions based on pending reason code.
 */
export function getDefaultActions(
  code: "LOW_CONFIDENCE" | "AMBIGUOUS_INTENT" | "REQUIRES_CONFIRMATION" | "SCOPE_EXCEEDED" | "RESOURCE_LIMIT"
): HITLAction[] {
  switch (code) {
    case "LOW_CONFIDENCE":
      return defaultLowConfidenceActions();
    case "AMBIGUOUS_INTENT":
      return defaultAmbiguousIntentActions();
    case "REQUIRES_CONFIRMATION":
      return defaultConfirmationActions();
    case "SCOPE_EXCEEDED":
      return defaultScopeExceededActions();
    case "RESOURCE_LIMIT":
      return defaultResourceLimitActions();
  }
}

// =============================================================================
// Namespace Export
// =============================================================================

/**
 * HITLActions factory namespace.
 */
export const HITLActions = {
  retry,
  modify,
  requestInfo,
  escalate,
  abort,
  getDefaultActions,
  defaults: {
    lowConfidence: defaultLowConfidenceActions,
    ambiguousIntent: defaultAmbiguousIntentActions,
    confirmation: defaultConfirmationActions,
    scopeExceeded: defaultScopeExceededActions,
    resourceLimit: defaultResourceLimitActions,
  },
};
