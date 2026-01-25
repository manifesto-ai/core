/**
 * System Module
 *
 * System Runtime for system.* action handling.
 *
 * @see SPEC §16
 * @module
 */

export { createSystemSchema, createInitialSystemState } from "./schema.js";

export { SystemRuntime } from "./runtime.js";
export type { SystemRuntimeConfig, SystemExecutionContext } from "./runtime.js";

export { SystemFacadeImpl, createSystemFacade } from "./facade.js";
