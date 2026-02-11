/**
 * Subscription System
 *
 * Provides reactive state subscriptions with selector-based change detection.
 *
 * @see SPEC §12 Subscription API
 * @module
 */

import type { AppState, SubscribeOptions, Unsubscribe } from "@manifesto-ai/shared";

/**
 * Internal subscriber representation.
 */
interface Subscriber<TSelected> {
  /** Selector function */
  selector: (state: AppState<unknown>) => TSelected;
  /** Listener function */
  listener: (selected: TSelected) => void;
  /** Equality function */
  equalityFn: (a: TSelected, b: TSelected) => boolean;
  /** Batch mode */
  batchMode: "immediate" | "transaction" | { debounce: number };
  /** Last selected value (for change detection) */
  lastValue: TSelected | undefined;
  /** Has been initialized */
  initialized: boolean;
  /** Debounce timer ID */
  debounceTimer?: ReturnType<typeof setTimeout>;
  /** Pending notification flag (for transaction mode) */
  pendingNotify: boolean;
}

/**
 * Subscription store manages all subscriptions for an App instance.
 */
export class SubscriptionStore {
  private _subscribers: Set<Subscriber<unknown>> = new Set();
  private _currentState: AppState<unknown> | null = null;
  private _inTransaction = false;

  /**
   * Set the current state (called during initialization and state updates).
   */
  setState(state: AppState<unknown>): void {
    this._currentState = state;
  }

  /**
   * Get current state.
   */
  getState(): AppState<unknown> | null {
    return this._currentState;
  }

  /**
   * Subscribe to state changes with a selector.
   *
   * @see SPEC §12.1
   */
  subscribe<TSelected>(
    selector: (state: AppState<unknown>) => TSelected,
    listener: (selected: TSelected) => void,
    opts?: SubscribeOptions<TSelected>
  ): Unsubscribe {
    const equalityFn = opts?.equalityFn ?? Object.is;
    const batchMode = opts?.batchMode ?? "transaction";
    const fireImmediately = opts?.fireImmediately ?? false;

    const subscriber: Subscriber<TSelected> = {
      selector,
      listener,
      equalityFn,
      batchMode,
      lastValue: undefined,
      initialized: false,
      pendingNotify: false,
    };

    // Initialize lastValue from current state (if available)
    // This allows change detection to work from the first notify
    if (this._currentState !== null) {
      const selected = selector(this._currentState);
      subscriber.lastValue = selected;
      subscriber.initialized = true;

      // Only invoke listener immediately if fireImmediately is true
      if (fireImmediately) {
        listener(selected);
      }
    }

    this._subscribers.add(subscriber as Subscriber<unknown>);

    return () => {
      // Clear any pending debounce timer
      if (subscriber.debounceTimer !== undefined) {
        clearTimeout(subscriber.debounceTimer);
      }
      this._subscribers.delete(subscriber as Subscriber<unknown>);
    };
  }

  /**
   * Notify all subscribers of a state change.
   *
   * @param newState - The new state
   * @param transactionComplete - Whether this marks end of a transaction
   */
  notify(newState: AppState<unknown>, transactionComplete = false): void {
    this._currentState = newState;

    for (const subscriber of this._subscribers) {
      this._notifySubscriber(subscriber, newState, transactionComplete);
    }
  }

  /**
   * Start a transaction. Notifications in transaction mode will be deferred.
   */
  startTransaction(): void {
    this._inTransaction = true;
  }

  /**
   * End a transaction. Flush pending notifications for transaction-mode subscribers.
   */
  endTransaction(): void {
    this._inTransaction = false;

    if (this._currentState === null) return;

    // Notify transaction-mode subscribers with pending notifications
    for (const subscriber of this._subscribers) {
      if (
        subscriber.batchMode === "transaction" &&
        subscriber.pendingNotify
      ) {
        subscriber.pendingNotify = false;
        this._invokeListener(subscriber, this._currentState);
      }
    }
  }

  /**
   * Check if currently in a transaction.
   */
  isInTransaction(): boolean {
    return this._inTransaction;
  }

  /**
   * Get count of subscribers.
   */
  subscriberCount(): number {
    return this._subscribers.size;
  }

  /**
   * Clear all subscribers.
   */
  clear(): void {
    // Clear any pending debounce timers
    for (const subscriber of this._subscribers) {
      if (subscriber.debounceTimer !== undefined) {
        clearTimeout(subscriber.debounceTimer);
      }
    }
    this._subscribers.clear();
  }

  /**
   * Notify a single subscriber.
   */
  private _notifySubscriber(
    subscriber: Subscriber<unknown>,
    newState: AppState<unknown>,
    transactionComplete: boolean
  ): void {
    const selected = subscriber.selector(newState);

    // Check if value changed (skip if first time and not initialized)
    if (subscriber.initialized) {
      if (subscriber.equalityFn(subscriber.lastValue as unknown, selected)) {
        // No change, skip notification
        return;
      }
    }

    subscriber.lastValue = selected;
    subscriber.initialized = true;

    // Handle based on batch mode
    if (subscriber.batchMode === "immediate") {
      subscriber.listener(selected);
    } else if (subscriber.batchMode === "transaction") {
      if (this._inTransaction) {
        // Mark as pending, will notify when transaction ends
        subscriber.pendingNotify = true;
      } else if (transactionComplete) {
        // Transaction just completed, notify now
        subscriber.listener(selected);
      } else {
        // Not in transaction, notify immediately
        subscriber.listener(selected);
      }
    } else if (typeof subscriber.batchMode === "object" && "debounce" in subscriber.batchMode) {
      // Debounce mode
      const debounceMs = subscriber.batchMode.debounce;

      if (subscriber.debounceTimer !== undefined) {
        clearTimeout(subscriber.debounceTimer);
      }

      subscriber.debounceTimer = setTimeout(() => {
        subscriber.debounceTimer = undefined;
        subscriber.listener(selected);
      }, debounceMs);
    }
  }

  /**
   * Invoke listener with current selected value.
   */
  private _invokeListener(
    subscriber: Subscriber<unknown>,
    state: AppState<unknown>
  ): void {
    const selected = subscriber.selector(state);
    subscriber.lastValue = selected;
    subscriber.listener(selected);
  }
}

/**
 * Create a new subscription store.
 */
export function createSubscriptionStore(): SubscriptionStore {
  return new SubscriptionStore();
}
