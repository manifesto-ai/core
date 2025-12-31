/**
 * World Protocol Event Bus
 *
 * Internal event bus for World Protocol events.
 *
 * Design decisions (per FDR):
 * - Synchronous delivery (EVT-R7)
 * - Exception isolation (EVT-R5, FDR-E009)
 * - No source filtering (FDR-E008) - all events emitted, subscriber filters
 * - Multiple simultaneous subscribers (EVT-R3)
 * - Immediate unsubscribe effect (EVT-R6)
 */

import type {
  WorldEvent,
  WorldEventType,
  WorldEventHandler,
  Unsubscribe,
} from "./types.js";

/**
 * WorldEventBus manages event subscriptions and delivery.
 *
 * Features:
 * - Subscribe to all events or specific event types
 * - Synchronous event delivery
 * - Exception isolation (handler errors don't break World)
 * - Multiple simultaneous subscribers
 */
export class WorldEventBus {
  private handlers: Set<WorldEventHandler> = new Set();

  /**
   * Subscribe to all events
   */
  subscribe(handler: WorldEventHandler): Unsubscribe;

  /**
   * Subscribe to specific event types
   */
  subscribe(types: WorldEventType[], handler: WorldEventHandler): Unsubscribe;

  subscribe(
    typesOrHandler: WorldEventType[] | WorldEventHandler,
    maybeHandler?: WorldEventHandler
  ): Unsubscribe {
    if (typeof typesOrHandler === "function") {
      // Subscribe to all events
      const handler = typesOrHandler;
      this.handlers.add(handler);
      return () => {
        this.handlers.delete(handler);
      };
    } else {
      // Subscribe to specific types
      const types = new Set(typesOrHandler);
      const handler = maybeHandler!;

      // Wrap handler with type filter
      const filteredHandler: WorldEventHandler = (event) => {
        if (types.has(event.type)) {
          handler(event);
        }
      };

      this.handlers.add(filteredHandler);

      return () => {
        this.handlers.delete(filteredHandler);
      };
    }
  }

  /**
   * Emit an event to all subscribers.
   *
   * Per FDR-E009: Handler exceptions are isolated and logged.
   * Per FDR-E002: Delivery is synchronous (before this method returns).
   */
  emit(event: WorldEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        // Log but don't propagate (FDR-E009)
        console.error(
          `[WorldEventBus] Handler threw for event ${event.type}:`,
          error
        );
      }
    }
  }

  /**
   * Get current subscriber count (for testing)
   */
  get subscriberCount(): number {
    return this.handlers.size;
  }

  /**
   * Clear all subscribers (for testing)
   */
  clear(): void {
    this.handlers.clear();
  }
}

/**
 * Create a new WorldEventBus instance
 */
export function createWorldEventBus(): WorldEventBus {
  return new WorldEventBus();
}
