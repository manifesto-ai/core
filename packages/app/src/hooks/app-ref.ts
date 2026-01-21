/**
 * AppRef Implementation
 *
 * Read-only facade for hooks that prevents re-entrant mutations.
 *
 * @see SPEC v2.0.0 §17.2
 * @module
 */

import type { DomainSchema } from "@manifesto-ai/core";
import type {
  AppRef,
  AppState,
  AppStatus,
  ActOptions,
  Branch,
  ProposalId,
} from "../core/types/index.js";
import type { WorldId } from "@manifesto-ai/world";
import type { JobQueue } from "./queue.js";

/**
 * Callbacks for AppRef operations.
 */
export interface AppRefCallbacks {
  getStatus(): AppStatus;
  getState<T>(): AppState<T>;
  getDomainSchema(): DomainSchema;
  getCurrentHead(): WorldId;
  currentBranch(): Branch;
  generateProposalId(): ProposalId;
}

/**
 * AppRefImpl: Read-only facade for hooks.
 *
 * HOOK-6: Hooks receive AppRef, not full App
 * HOOK-7: enqueueAction() MUST defer execution until after hook completes
 *
 * @see SPEC v2.0.0 §17.2
 */
export class AppRefImpl implements AppRef {
  private _callbacks: AppRefCallbacks;
  private _queue: JobQueue;
  private _enqueueAction: (
    proposalId: ProposalId,
    type: string,
    input?: unknown,
    opts?: ActOptions
  ) => void;

  constructor(
    callbacks: AppRefCallbacks,
    queue: JobQueue,
    enqueueAction: (
      proposalId: ProposalId,
      type: string,
      input?: unknown,
      opts?: ActOptions
    ) => void
  ) {
    this._callbacks = callbacks;
    this._queue = queue;
    this._enqueueAction = enqueueAction;
  }

  /**
   * Get current app status.
   */
  get status(): AppStatus {
    return this._callbacks.getStatus();
  }

  /**
   * Get current state.
   */
  getState<T = unknown>(): AppState<T> {
    return this._callbacks.getState<T>();
  }

  /**
   * Get domain schema.
   */
  getDomainSchema(): DomainSchema {
    return this._callbacks.getDomainSchema();
  }

  /**
   * Get current head WorldId.
   */
  getCurrentHead(): WorldId {
    return this._callbacks.getCurrentHead();
  }

  /**
   * Get current branch.
   */
  currentBranch(): Branch {
    return this._callbacks.currentBranch();
  }

  /**
   * Enqueue an action for execution after current hook completes.
   *
   * HOOK-7: MUST defer execution until after current hook completes.
   * NOT synchronous execution — prevents re-entrancy.
   *
   * @see SPEC v2.0.0 §17.2
   */
  enqueueAction(type: string, input?: unknown, opts?: ActOptions): ProposalId {
    // Generate proposalId immediately (HANDLE-9)
    const proposalId = this._callbacks.generateProposalId();

    // Defer actual execution via job queue
    this._queue.enqueue(
      () => {
        // Execute action via callback (deferred)
        this._enqueueAction(proposalId, type, input, opts);
      },
      { label: `enqueueAction:${type}:${proposalId}` }
    );

    // Return proposalId immediately for tracking
    return proposalId;
  }
}

/**
 * Create an AppRef with the given callbacks.
 */
export function createAppRef(
  callbacks: AppRefCallbacks,
  queue: JobQueue,
  enqueueAction: (
    proposalId: ProposalId,
    type: string,
    input?: unknown,
    opts?: ActOptions
  ) => void
): AppRef {
  return new AppRefImpl(callbacks, queue, enqueueAction);
}
