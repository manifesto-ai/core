/**
 * Lab Events
 *
 * Lab-specific event handling and emission.
 */

import type { LabEvent, LabEventHandler, Unsubscribe } from "../types.js";

/**
 * Lab event emitter.
 */
export interface LabEventEmitter {
  /** Subscribe to lab events */
  subscribe(handler: LabEventHandler): Unsubscribe;

  /** Emit a lab event */
  emit(event: LabEvent): void;

  /** Clear all handlers */
  clear(): void;
}

/**
 * Create a lab event emitter.
 */
export function createLabEventEmitter(): LabEventEmitter {
  const handlers = new Set<LabEventHandler>();

  return {
    subscribe(handler: LabEventHandler): Unsubscribe {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },

    emit(event: LabEvent): void {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error("[LabEventEmitter] Handler error:", error);
        }
      }
    },

    clear(): void {
      handlers.clear();
    },
  };
}
