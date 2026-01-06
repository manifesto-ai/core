/**
 * Branch Module
 *
 * @see SPEC §9 Branch Management
 * @module
 */

export { BranchImpl, generateBranchId, generateWorldId } from "./branch.js";
export type { BranchCallbacks } from "./branch.js";

export { BranchManager } from "./manager.js";
export type { BranchManagerConfig } from "./manager.js";
