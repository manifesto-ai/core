/**
 * Action Module
 *
 * @see SPEC §8 Action Execution
 * @module
 */

export { ActionHandleImpl, generateProposalId } from "./handle.js";
export { executeAction, createRejectedResult } from "./executor.js";
export type { ActionContext } from "./executor.js";
