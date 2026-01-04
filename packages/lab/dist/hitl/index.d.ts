/**
 * HITL Module
 *
 * Human-in-the-Loop decision support.
 */
export { createHITLController, type HITLControllerInternal } from "./controller.js";
export { lowConfidence, ambiguousIntent, requiresConfirmation, scopeExceeded, resourceLimit, createPendingReason, PendingReasons, } from "./pending-reason.js";
export { retry, modify, requestInfo, escalate, abort, getDefaultActions, HITLActions, } from "./actions.js";
export { buildPrompt, promptToText, promptToJSON, type BuildPromptOptions, } from "./prompt.js";
export { createHITLContext, createPendingDecisionRecord, canAutoResolve, getSuggestedAction, type CreateHITLContextOptions, } from "./context-v1.js";
//# sourceMappingURL=index.d.ts.map