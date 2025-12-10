/**
 * Event Projection
 *
 * Converts domain events to UI events (toasts, notifications).
 * Handles severity inference, auto-dismiss, and custom transformers.
 */

import type { DomainEvent } from '@manifesto-ai/core';
import type {
  UIEvent,
  UIEventSeverity,
  EventTransformer,
  EventProjectionConfig,
} from '../types.js';

// =============================================================================
// ID Generation
// =============================================================================

let eventIdCounter = 0;

/**
 * Generate a unique event ID.
 */
export function generateEventId(): string {
  return `ui-event-${Date.now()}-${++eventIdCounter}`;
}

/**
 * Reset event ID counter (for testing).
 */
export function resetEventIdCounter(): void {
  eventIdCounter = 0;
}

// =============================================================================
// Severity Inference
// =============================================================================

/**
 * Infer severity from payload fields.
 *
 * @param explicit - Explicit severity value from payload
 * @param type - Event type from payload
 * @returns Inferred severity
 */
export function inferSeverity(
  explicit?: unknown,
  type?: unknown
): UIEventSeverity {
  // Check explicit severity
  if (
    explicit === 'success' ||
    explicit === 'info' ||
    explicit === 'warning' ||
    explicit === 'error'
  ) {
    return explicit;
  }

  // Infer from type string
  if (typeof type === 'string') {
    const lower = type.toLowerCase();
    if (lower.includes('error') || lower.includes('fail')) return 'error';
    if (lower.includes('warn')) return 'warning';
    if (lower.includes('success') || lower.includes('complete')) return 'success';
  }

  return 'info';
}

// =============================================================================
// Default Transformer
// =============================================================================

/**
 * Default event transformer.
 * Converts domain events to UI events based on payload structure.
 */
export const defaultEventTransformer: EventTransformer = (
  event: DomainEvent
): UIEvent | null => {
  const payload = event.payload as Record<string, unknown> | undefined;

  // Extract message
  const message =
    typeof payload?.message === 'string'
      ? payload.message
      : `Event from ${event.channel}`;

  // Extract other fields
  const severity = inferSeverity(payload?.severity, payload?.type);
  const description =
    typeof payload?.description === 'string' ? payload.description : undefined;
  const duration =
    typeof payload?.duration === 'number' ? payload.duration : undefined;

  return {
    id: generateEventId(),
    severity,
    message,
    description,
    channel: event.channel,
    payload: event.payload,
    timestamp: event.timestamp,
    duration,
    dismissed: false,
  };
};

// =============================================================================
// Projection Functions
// =============================================================================

/**
 * Project a domain event to a UI event.
 *
 * @param event - Domain event from runtime
 * @param config - Optional projection configuration
 * @returns UIEvent or null if event should be filtered
 */
export function projectEvent(
  event: DomainEvent,
  config?: EventProjectionConfig
): UIEvent | null {
  // Get transformer for channel
  const channelTransformer = config?.channelTransformers?.[event.channel];
  const transformer =
    channelTransformer ?? config?.transformer ?? defaultEventTransformer;

  const uiEvent = transformer(event);

  // Apply default duration if not set
  if (
    uiEvent &&
    config?.defaultDuration !== undefined &&
    uiEvent.duration === undefined
  ) {
    uiEvent.duration = config.defaultDuration;
  }

  return uiEvent;
}

/**
 * Create a toast-style UI event manually.
 *
 * @param message - Toast message
 * @param severity - Event severity
 * @param options - Additional options
 * @returns UIEvent
 */
export function createToastEvent(
  message: string,
  severity: UIEventSeverity = 'info',
  options?: {
    description?: string;
    duration?: number;
    channel?: string;
    payload?: unknown;
  }
): UIEvent {
  return {
    id: generateEventId(),
    severity,
    message,
    description: options?.description,
    channel: options?.channel ?? 'manual',
    payload: options?.payload ?? { message, severity, ...options },
    timestamp: Date.now(),
    duration: options?.duration,
    dismissed: false,
  };
}

/**
 * Create success toast.
 */
export function createSuccessToast(
  message: string,
  options?: { description?: string; duration?: number }
): UIEvent {
  return createToastEvent(message, 'success', options);
}

/**
 * Create error toast.
 */
export function createErrorToast(
  message: string,
  options?: { description?: string; duration?: number }
): UIEvent {
  return createToastEvent(message, 'error', options);
}

/**
 * Create warning toast.
 */
export function createWarningToast(
  message: string,
  options?: { description?: string; duration?: number }
): UIEvent {
  return createToastEvent(message, 'warning', options);
}

/**
 * Create info toast.
 */
export function createInfoToast(
  message: string,
  options?: { description?: string; duration?: number }
): UIEvent {
  return createToastEvent(message, 'info', options);
}

// =============================================================================
// Event Management
// =============================================================================

/**
 * Filter out dismissed events.
 */
export function filterPendingEvents(events: UIEvent[]): UIEvent[] {
  return events.filter((e) => !e.dismissed);
}

/**
 * Dismiss an event by ID.
 * Returns a new array with the event marked as dismissed.
 */
export function dismissEvent(events: UIEvent[], eventId: string): UIEvent[] {
  return events.map((e) => (e.id === eventId ? { ...e, dismissed: true } : e));
}

/**
 * Dismiss all events.
 * Returns a new array with all events marked as dismissed.
 */
export function dismissAllEvents(events: UIEvent[]): UIEvent[] {
  return events.map((e) => ({ ...e, dismissed: true }));
}

/**
 * Get events by severity.
 */
export function getEventsBySeverity(
  events: UIEvent[],
  severity: UIEventSeverity
): UIEvent[] {
  return events.filter((e) => e.severity === severity && !e.dismissed);
}

/**
 * Get events by channel.
 */
export function getEventsByChannel(
  events: UIEvent[],
  channel: string
): UIEvent[] {
  return events.filter((e) => e.channel === channel && !e.dismissed);
}
