/**
 * Hooks Module
 *
 * Hook system implementation: hookable, job queue, AppRef, and HookContext.
 *
 * @see SPEC §11 Hook System
 * @module
 */

export { HookableImpl } from "./hookable.js";
export { JobQueue } from "./queue.js";
export { AppRefImpl, createAppRef } from "./app-ref.js";
export type { AppRefCallbacks } from "./app-ref.js";
export { HookContextImpl, createHookContext } from "./context.js";
