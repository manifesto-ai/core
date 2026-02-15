/**
 * Hook System Module
 *
 * @see SPEC §11 Hook System
 * @see SPEC v2.0.0 §17 (AppRef pattern)
 * @module
 */

export { HookableImpl } from "./hookable.js";
export type { HookState } from "./hookable.js";

export { JobQueue } from "./queue.js";

export { HookContextImpl, createHookContext } from "./context.js";

// v2.0.0 AppRef pattern
export { AppRefImpl, createAppRef } from "./app-ref.js";
export type { AppRefCallbacks } from "./app-ref.js";
