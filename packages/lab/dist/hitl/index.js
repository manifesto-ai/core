/**
 * HITL Module
 *
 * Human-in-the-Loop decision support.
 */
export { createHITLController } from "./controller.js";
// v1.1: Pending Reason
export { lowConfidence, ambiguousIntent, requiresConfirmation, scopeExceeded, resourceLimit, createPendingReason, PendingReasons, } from "./pending-reason.js";
// v1.1: HITL Actions
export { retry, modify, requestInfo, escalate, abort, getDefaultActions, HITLActions, } from "./actions.js";
// v1.1: Prompt Builder
export { buildPrompt, promptToText, promptToJSON, } from "./prompt.js";
// v1.1: HITL Context
export { createHITLContext, createPendingDecisionRecord, canAutoResolve, getSuggestedAction, } from "./context-v1.js";
//# sourceMappingURL=index.js.map