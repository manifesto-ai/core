/**
 * Session Implementation
 *
 * Session provides an immutable actor+branch context for action execution.
 *
 * @see SPEC §10 Session Management
 * @module
 */

import type {
  ActionHandle,
  ActOptions,
  AppState,
  RecallRequest,
  RecallResult,
  Session,
  SessionOptions,
} from "../types/index.js";

import { MemoryDisabledError, SystemActionRoutingError } from "../errors/index.js";
import { RESERVED_NAMESPACE_PREFIX } from "../constants.js";

/**
 * Callback interface for Session to communicate with App.
 */
export interface SessionCallbacks {
  /** Execute an action with session context */
  executeAction: (
    actorId: string,
    branchId: string,
    type: string,
    input: unknown,
    opts?: ActOptions
  ) => ActionHandle;

  /** Get state for a branch */
  getStateForBranch: (branchId: string) => AppState<unknown>;

  /** Perform memory recall */
  recall: (
    req: RecallRequest | readonly RecallRequest[],
    ctx: { actorId: string; branchId: string }
  ) => Promise<RecallResult>;

  /** Check if memory is enabled */
  isMemoryEnabled: () => boolean;
}

/**
 * Internal Session implementation.
 *
 * Session is an immutable context that binds:
 * - actorId: The identity performing actions
 * - branchId: The branch context for actions
 *
 * @see SPEC §10.1 SESS-ACT-1~4
 */
export class SessionImpl implements Session {
  private _callbacks: SessionCallbacks;
  private _kind: "human" | "agent" | "system";
  private _name?: string;
  private _meta?: Record<string, unknown>;

  constructor(
    public readonly actorId: string,
    public readonly branchId: string,
    callbacks: SessionCallbacks,
    opts?: SessionOptions
  ) {
    this._callbacks = callbacks;
    this._kind = opts?.kind ?? "human";
    this._name = opts?.name;
    this._meta = opts?.meta;
  }

  /**
   * Execute an action with this session's actor and branch context.
   *
   * SESS-ACT-1: actorId is immutably bound to session
   * SESS-ACT-2: branchId is immutably bound to session
   * SESS-ACT-3: opts.actorId cannot override session actorId
   * SESS-ACT-4: opts.branchId cannot override session branchId
   *
   * @throws SystemActionRoutingError if type is a system.* action
   *
   * @see SPEC §10.2
   * @see SPEC §17.8 SYS-INV-3
   */
  act(type: string, input?: unknown, opts?: ActOptions): ActionHandle {
    // SYS-INV-3: session.act() MUST reject system.* actions
    if (type.startsWith(RESERVED_NAMESPACE_PREFIX)) {
      throw new SystemActionRoutingError(type, "session");
    }

    // SESS-ACT-3, SESS-ACT-4: Session context takes precedence
    // Ignore actorId and branchId from opts - session context is immutable
    return this._callbacks.executeAction(
      this.actorId,
      this.branchId,
      type,
      input,
      {
        ...opts,
        // Override any provided actorId/branchId with session context
        actorId: this.actorId,
        branchId: this.branchId,
      }
    );
  }

  /**
   * Perform memory recall with session context.
   *
   * @throws MemoryDisabledError if memory is disabled
   *
   * @see SPEC §10.3
   */
  async recall(
    req: RecallRequest | readonly RecallRequest[]
  ): Promise<RecallResult> {
    if (!this._callbacks.isMemoryEnabled()) {
      throw new MemoryDisabledError("recall");
    }

    return this._callbacks.recall(req, {
      actorId: this.actorId,
      branchId: this.branchId,
    });
  }

  /**
   * Get current state for this session's branch.
   *
   * @see SPEC §10.4
   */
  getState<T = unknown>(): AppState<T> {
    return this._callbacks.getStateForBranch(this.branchId) as AppState<T>;
  }

  // ===========================================================================
  // Additional Accessors (for internal use)
  // ===========================================================================

  /**
   * Get session kind.
   * @internal
   */
  get kind(): "human" | "agent" | "system" {
    return this._kind;
  }

  /**
   * Get session name.
   * @internal
   */
  get name(): string | undefined {
    return this._name;
  }

  /**
   * Get session metadata.
   * @internal
   */
  get meta(): Record<string, unknown> | undefined {
    return this._meta;
  }
}
