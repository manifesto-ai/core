/**
 * Hook Context Implementation
 *
 * @see SPEC §11.2
 * @module
 */

import type { AppRef, HookContext } from "../core/types/index.js";

/**
 * Internal HookContext implementation.
 *
 * @see SPEC §11.2
 */
export class HookContextImpl implements HookContext {
  constructor(
    public readonly app: AppRef,
    public readonly timestamp: number
  ) {
  }
}

/**
 * Create a HookContext with the given parameters.
 */
export function createHookContext(
  app: AppRef,
  timestamp: number
): HookContext {
  return new HookContextImpl(app, timestamp);
}
