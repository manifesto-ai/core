/**
 * useUIEvents Hook
 *
 * React hooks for subscribing to UI events (toasts, notifications).
 */

import { useSyncExternalStore, useCallback, useEffect, useRef } from 'react';
import type { ProjectionManager, UIEvent, UIEventListener } from '../../types.js';

/**
 * Subscribe to pending UI events.
 *
 * @param manager - ProjectionManager instance
 * @returns Array of pending (not dismissed) events
 *
 * @example
 * ```tsx
 * function ToastContainer({ manager }: { manager: ProjectionManager }) {
 *   const events = useUIEvents(manager);
 *
 *   return (
 *     <div className="toast-container">
 *       {events.map((event) => (
 *         <Toast
 *           key={event.id}
 *           message={event.message}
 *           severity={event.severity}
 *           onClose={() => manager.dismissEvent(event.id)}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useUIEvents(manager: ProjectionManager): UIEvent[] {
  const eventsRef = useRef<UIEvent[]>([]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return manager.subscribeEvents(() => {
        eventsRef.current = manager.getPendingEvents();
        onStoreChange();
      });
    },
    [manager]
  );

  const getSnapshot = useCallback(() => {
    return manager.getPendingEvents();
  }, [manager]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Hook for toast-style event handling.
 * Calls onEvent for each new event.
 *
 * @param manager - ProjectionManager instance
 * @param onEvent - Callback for each new event
 * @returns Object with dismiss functions
 *
 * @example
 * ```tsx
 * function App({ manager }: { manager: ProjectionManager }) {
 *   const { dismiss, dismissAll } = useUIEventHandler(manager, (event) => {
 *     // Show toast using your preferred toast library
 *     toast({
 *       message: event.message,
 *       type: event.severity,
 *     });
 *   });
 *
 *   return <button onClick={dismissAll}>Clear All</button>;
 * }
 * ```
 */
export function useUIEventHandler(
  manager: ProjectionManager,
  onEvent: UIEventListener
): {
  dismiss: (eventId: string) => void;
  dismissAll: () => void;
} {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    return manager.subscribeEvents((event) => {
      onEventRef.current(event);
    });
  }, [manager]);

  const dismiss = useCallback(
    (eventId: string) => manager.dismissEvent(eventId),
    [manager]
  );

  const dismissAll = useCallback(
    () => manager.dismissAllEvents(),
    [manager]
  );

  return { dismiss, dismissAll };
}

/**
 * Filter events by severity.
 *
 * @param events - Array of UI events
 * @param severity - Severity to filter by
 * @returns Filtered events
 */
export function filterEventsBySeverity(
  events: UIEvent[],
  severity: UIEvent['severity']
): UIEvent[] {
  return events.filter((e) => e.severity === severity);
}

/**
 * Get the latest event.
 *
 * @param events - Array of UI events
 * @returns Latest event or undefined
 */
export function getLatestEvent(events: UIEvent[]): UIEvent | undefined {
  if (events.length === 0) return undefined;
  return events[events.length - 1];
}

/**
 * Check if there are any error events.
 *
 * @param events - Array of UI events
 * @returns True if there are error events
 */
export function hasErrorEvents(events: UIEvent[]): boolean {
  return events.some((e) => e.severity === 'error');
}
