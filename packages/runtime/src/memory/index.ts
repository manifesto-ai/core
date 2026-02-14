/**
 * Memory Module
 *
 * Memory integration and provider management.
 *
 * @see SPEC §14
 * @see SPEC v2.0.0 §11 (Context Freezing)
 * @module
 */

export { NoneVerifier, computeVerified } from "./verifier.js";

export { MemoryHub, createMemoryHub } from "./hub.js";

export {
  EnabledMemoryFacade,
  DisabledMemoryFacade,
  createMemoryFacade,
} from "./facade.js";
export type { MemoryFacadeContext } from "./facade.js";

// v2.0.0 Context Freezing
export {
  freezeMemoryContext,
  markMemoryRecallFailed,
  getMemoryContext,
  wasMemoryRecallFailed,
  hasMemoryContext,
  freezeRecallResult,
  getFrozenRecallResult,
  clearAppNamespace,
} from "./context-freezing.js";
export type { AppInputNamespace, AppExecutionContext } from "./context-freezing.js";
