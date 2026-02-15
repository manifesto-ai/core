/**
 * Lifecycle Manager Module
 *
 * Manages App lifecycle state and hook emissions.
 *
 * @see SPEC v2.0.0 §7.1
 * @module
 */

import type { AppRef, AppStatus, Hookable, AppHooks, HookContext } from "../types/index.js";
import { HookableImpl, createHookContext } from "../hooks/index.js";
import { AppNotReadyError, AppDisposedError } from "../errors/index.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Context info for hook emissions.
 */
export interface ContextInfo {
  actorId?: string;
  branchId?: string;
  worldId?: string;
}

/**
 * Lifecycle Manager interface.
 *
 * Manages App lifecycle state transitions and hook emissions.
 */
export interface LifecycleManager {
  /**
   * Current app status.
   */
  readonly status: AppStatus;

  /**
   * Hook registry.
   */
  readonly hooks: Hookable<AppHooks>;

  /**
   * Transition to a new status.
   *
   * @param status - The new status
   */
  transitionTo(status: AppStatus): void;

  /**
   * Emit a hook event.
   *
   * @param name - Hook event name
   * @param payload - Hook payload (optional for lifecycle hooks)
   * @param context - Context info for hook context
   */
  emitHook<K extends keyof AppHooks>(
    name: K,
    payload: Parameters<AppHooks[K]>[0],
    context?: ContextInfo
  ): Promise<void>;

  /**
   * Ensure app is ready before API calls.
   *
   * @see SPEC §5.6 READY-1, READY-2
   * @param apiName - The API name being called
   * @throws AppNotReadyError if not ready
   * @throws AppDisposedError if disposed
   */
  ensureReady(apiName: string): void;

  /**
   * Check if app is disposed or disposing.
   */
  isDisposed(): boolean;

  /**
   * Create a hook context.
   *
   * @param context - Context info
   */
  createHookContext(context?: ContextInfo): HookContext;

  /**
   * Set AppRef for hook contexts.
   */
  setAppRef(appRef: AppRef): void;

  /**
   * Get the internal HookableImpl for advanced operations.
   */
  getHookableImpl(): HookableImpl<AppHooks>;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Lifecycle Manager implementation.
 */
export class LifecycleManagerImpl implements LifecycleManager {
  private _status: AppStatus = "created";
  private _hooks: HookableImpl<AppHooks> = new HookableImpl();
  private _appRef: AppRef | null = null;

  get status(): AppStatus {
    return this._status;
  }

  get hooks(): Hookable<AppHooks> {
    return this._hooks;
  }

  transitionTo(status: AppStatus): void {
    this._status = status;
  }

  async emitHook<K extends keyof AppHooks>(
    name: K,
    payload: Parameters<AppHooks[K]>[0],
    context?: ContextInfo
  ): Promise<void> {
    const hookContext = this.createHookContext(context);
    await this._hooks.emit(name, payload, hookContext);
  }

  ensureReady(apiName: string): void {
    if (this._status === "disposed" || this._status === "disposing") {
      throw new AppDisposedError(apiName);
    }
    if (this._status !== "ready") {
      throw new AppNotReadyError(apiName);
    }
  }

  isDisposed(): boolean {
    return this._status === "disposed" || this._status === "disposing";
  }

  createHookContext(context?: ContextInfo): HookContext {
    if (!this._appRef) {
      throw new Error("HookContext requires AppRef");
    }
    return createHookContext(this._appRef, Date.now());
  }

  setAppRef(appRef: AppRef): void {
    this._appRef = appRef;
  }

  getHookableImpl(): HookableImpl<AppHooks> {
    return this._hooks;
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a new LifecycleManager instance.
 */
export function createLifecycleManager(): LifecycleManager {
  return new LifecycleManagerImpl();
}
