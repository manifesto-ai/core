/**
 * @manifesto-ai/projection-ui - Types
 *
 * Core types for UI projection layer.
 * Converts domain policies to framework-agnostic UI states.
 */

import type {
  SemanticPath,
  ResolvedFieldPolicy,
  PreconditionStatus,
  DomainEvent,
  DomainRuntime,
  Unsubscribe,
} from '@manifesto-ai/core';

// =============================================================================
// UI Field State
// =============================================================================

/**
 * Projected UI state for a field.
 * Framework-agnostic representation of how a field should be rendered.
 *
 * Domain decides "what" (relevant, editable, required).
 * UI decides "how" (visible vs hidden, enabled vs disabled).
 */
export type UIFieldState = {
  /** Semantic path to the field */
  path: SemanticPath;

  /** Whether the field should be visible/rendered */
  visible: boolean;

  /** Whether the field should be enabled/interactive */
  enabled: boolean;

  /** Whether the field should show required indicator */
  required: boolean;

  /** Reason for being disabled (for tooltips, aria-describedby) */
  disabledReason?: string;

  /** Reason for being hidden (for debugging/logging) */
  hiddenReason?: string;

  /** Reason for being required (for validation messages) */
  requiredReason?: string;

  /** Timestamp of last update */
  updatedAt: number;
};

/**
 * Map of field states by path.
 */
export type UIFieldStateMap = Map<SemanticPath, UIFieldState>;

// =============================================================================
// UI Action State
// =============================================================================

/**
 * Projected UI state for an action (button, form submit, etc.)
 */
export type UIActionState = {
  /** Action identifier */
  actionId: string;

  /** Whether the action can be triggered */
  available: boolean;

  /** Whether the action is currently executing */
  executing: boolean;

  /** Human-readable reasons why action is unavailable */
  unavailableReasons: string[];

  /** Detailed precondition statuses for debugging/tooltips */
  preconditions: UIPreconditionState[];

  /** Timestamp of last update */
  updatedAt: number;
};

/**
 * Simplified precondition state for UI display.
 */
export type UIPreconditionState = {
  /** Path being checked */
  path: SemanticPath;

  /** Whether condition is satisfied */
  satisfied: boolean;

  /** Human-readable explanation */
  reason?: string;
};

/**
 * Map of action states by action ID.
 */
export type UIActionStateMap = Map<string, UIActionState>;

// =============================================================================
// UI Events (Toasts, Notifications)
// =============================================================================

/**
 * UI event severity levels.
 */
export type UIEventSeverity = 'success' | 'info' | 'warning' | 'error';

/**
 * Projected UI event for notifications/toasts.
 */
export type UIEvent = {
  /** Unique event ID */
  id: string;

  /** Event severity/type */
  severity: UIEventSeverity;

  /** Main message */
  message: string;

  /** Optional detailed description */
  description?: string;

  /** Source domain event channel */
  channel: string;

  /** Original payload (for custom handling) */
  payload: unknown;

  /** Timestamp */
  timestamp: number;

  /** Auto-dismiss duration in ms (undefined = no auto-dismiss) */
  duration?: number;

  /** Whether event has been dismissed */
  dismissed: boolean;
};

/**
 * Event transformer function.
 * Converts domain events to UI events.
 */
export type EventTransformer = (event: DomainEvent) => UIEvent | null;

// =============================================================================
// Projection Configuration
// =============================================================================

/**
 * Configuration for field projection.
 */
export type FieldProjectionConfig = {
  /** Paths to project (empty = all source paths) */
  paths?: SemanticPath[];

  /** Whether to include derived paths (default: false) */
  includeDerived?: boolean;

  /** Custom visibility resolver (override default) */
  visibilityResolver?: (policy: ResolvedFieldPolicy) => boolean;

  /** Custom enabled resolver (override default) */
  enabledResolver?: (policy: ResolvedFieldPolicy) => boolean;
};

/**
 * Configuration for action projection.
 */
export type ActionProjectionConfig = {
  /** Actions to project (empty = all actions) */
  actionIds?: string[];

  /** Whether to include detailed preconditions (default: true) */
  includePreconditions?: boolean;
};

/**
 * Configuration for event projection.
 */
export type EventProjectionConfig = {
  /** Channels to subscribe to (default: ['ui']) */
  channels?: string[];

  /** Default event transformer */
  transformer?: EventTransformer;

  /** Per-channel transformers (override default) */
  channelTransformers?: Record<string, EventTransformer>;

  /** Default auto-dismiss duration in ms */
  defaultDuration?: number;
};

// =============================================================================
// Listeners
// =============================================================================

/**
 * Listener for field state changes.
 */
export type FieldStateListener = (
  states: UIFieldStateMap,
  changedPaths: SemanticPath[]
) => void;

/**
 * Listener for action state changes.
 */
export type ActionStateListener = (
  states: UIActionStateMap,
  changedActionIds: string[]
) => void;

/**
 * Listener for UI events.
 */
export type UIEventListener = (event: UIEvent) => void;

// =============================================================================
// Projection Manager
// =============================================================================

/**
 * Projection Manager interface.
 * Coordinates all projections from a DomainRuntime.
 */
export interface ProjectionManager<TData = unknown, TState = unknown> {
  /** The underlying runtime */
  readonly runtime: DomainRuntime<TData, TState>;

  // === Field Projection ===

  /** Get current field state */
  getFieldState(path: SemanticPath): UIFieldState | undefined;

  /** Get all field states */
  getFieldStates(): UIFieldStateMap;

  /** Subscribe to field state changes */
  subscribeFields(listener: FieldStateListener): Unsubscribe;

  // === Action Projection ===

  /** Get current action state */
  getActionState(actionId: string): UIActionState | undefined;

  /** Get all action states */
  getActionStates(): UIActionStateMap;

  /** Subscribe to action state changes */
  subscribeActions(listener: ActionStateListener): Unsubscribe;

  /** Mark action as executing */
  setActionExecuting(actionId: string, executing: boolean): void;

  // === Event Projection ===

  /** Get pending (not dismissed) events */
  getPendingEvents(): UIEvent[];

  /** Dismiss an event by ID */
  dismissEvent(eventId: string): void;

  /** Dismiss all events */
  dismissAllEvents(): void;

  /** Subscribe to UI events */
  subscribeEvents(listener: UIEventListener): Unsubscribe;

  // === Lifecycle ===

  /** Refresh all projections */
  refresh(): void;

  /** Dispose and cleanup */
  dispose(): void;
}

/**
 * Options for creating a ProjectionManager.
 */
export type CreateProjectionManagerOptions<TData = unknown, TState = unknown> = {
  /** Domain runtime to project from */
  runtime: DomainRuntime<TData, TState>;

  /** Field projection config */
  fields?: FieldProjectionConfig;

  /** Action projection config */
  actions?: ActionProjectionConfig;

  /** Event projection config */
  events?: EventProjectionConfig;
};

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if value is a valid UIEventSeverity.
 */
export function isUIEventSeverity(value: unknown): value is UIEventSeverity {
  return (
    value === 'success' ||
    value === 'info' ||
    value === 'warning' ||
    value === 'error'
  );
}

/**
 * Check if value is a valid UIFieldState.
 */
export function isUIFieldState(value: unknown): value is UIFieldState {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.path === 'string' &&
    typeof obj.visible === 'boolean' &&
    typeof obj.enabled === 'boolean' &&
    typeof obj.required === 'boolean' &&
    typeof obj.updatedAt === 'number'
  );
}

/**
 * Check if value is a valid UIActionState.
 */
export function isUIActionState(value: unknown): value is UIActionState {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.actionId === 'string' &&
    typeof obj.available === 'boolean' &&
    typeof obj.executing === 'boolean' &&
    Array.isArray(obj.unavailableReasons) &&
    Array.isArray(obj.preconditions) &&
    typeof obj.updatedAt === 'number'
  );
}

/**
 * Check if value is a valid UIEvent.
 */
export function isUIEvent(value: unknown): value is UIEvent {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    isUIEventSeverity(obj.severity) &&
    typeof obj.message === 'string' &&
    typeof obj.channel === 'string' &&
    typeof obj.timestamp === 'number' &&
    typeof obj.dismissed === 'boolean'
  );
}
