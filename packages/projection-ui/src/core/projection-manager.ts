/**
 * Projection Manager
 *
 * Coordinates all projections from a DomainRuntime.
 * Manages subscriptions, state updates, and lifecycle.
 */

import type {
  SemanticPath,
  DomainRuntime,
  Unsubscribe,
  ManifestoDomain,
} from '@manifesto-ai/core';
import type {
  ProjectionManager,
  CreateProjectionManagerOptions,
  UIFieldState,
  UIFieldStateMap,
  UIActionState,
  UIActionStateMap,
  UIEvent,
  FieldStateListener,
  ActionStateListener,
  UIEventListener,
  FieldProjectionConfig,
  ActionProjectionConfig,
  EventProjectionConfig,
} from '../types.js';
import {
  projectFieldPolicy,
  createFieldProjectionDiff,
} from '../projection/field-projection.js';
import {
  projectActionState,
  createActionProjectionDiff,
} from '../projection/action-projection.js';
import { projectEvent } from '../projection/event-projection.js';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract source paths from domain definition.
 */
function extractSourcePaths<TData, TState>(
  domain: ManifestoDomain<TData, TState>
): SemanticPath[] {
  return Object.keys(domain.paths.sources);
}

/**
 * Extract action IDs from domain definition.
 */
function extractActionIds<TData, TState>(
  domain: ManifestoDomain<TData, TState>
): string[] {
  return Object.keys(domain.actions);
}

/**
 * Project all field policies from runtime.
 */
function projectAllFields<TData, TState>(
  runtime: DomainRuntime<TData, TState>,
  paths: SemanticPath[],
  config?: FieldProjectionConfig
): UIFieldStateMap {
  const result: UIFieldStateMap = new Map();

  for (const path of paths) {
    const policy = runtime.getFieldPolicy(path);
    result.set(path, projectFieldPolicy(path, policy, config));
  }

  return result;
}

/**
 * Project all actions from runtime.
 */
function projectAllActions<TData, TState>(
  runtime: DomainRuntime<TData, TState>,
  actionIds: string[],
  config?: ActionProjectionConfig
): UIActionStateMap {
  const result: UIActionStateMap = new Map();

  for (const actionId of actionIds) {
    const preconditions = runtime.getPreconditions(actionId);
    result.set(actionId, projectActionState(actionId, preconditions, config));
  }

  return result;
}

// =============================================================================
// Create Projection Manager
// =============================================================================

/**
 * Create a ProjectionManager instance.
 *
 * @param options - Configuration options
 * @returns ProjectionManager instance
 */
export function createProjectionManager<TData = unknown, TState = unknown>(
  options: CreateProjectionManagerOptions<TData, TState> & {
    /** Domain definition (needed for extracting paths/actions) */
    domain?: ManifestoDomain<TData, TState>;
  }
): ProjectionManager<TData, TState> {
  const { runtime, fields, actions, events, domain } = options;

  // State
  let fieldStates: UIFieldStateMap = new Map();
  let actionStates: UIActionStateMap = new Map();
  let uiEvents: UIEvent[] = [];
  let disposed = false;

  // Listeners
  const fieldListeners = new Set<FieldStateListener>();
  const actionListeners = new Set<ActionStateListener>();
  const eventListeners = new Set<UIEventListener>();

  // Runtime subscriptions
  const subscriptions: Unsubscribe[] = [];

  // Get paths and action IDs to project
  const fieldPaths = fields?.paths ?? (domain ? extractSourcePaths(domain) : []);
  const actionIds = actions?.actionIds ?? (domain ? extractActionIds(domain) : []);
  const eventChannels = events?.channels ?? ['ui'];

  // Initialize projections
  if (fieldPaths.length > 0) {
    fieldStates = projectAllFields(runtime, fieldPaths, fields);
  }
  if (actionIds.length > 0) {
    actionStates = projectAllActions(runtime, actionIds, actions);
  }

  // Subscribe to runtime snapshot changes
  const snapshotUnsub = runtime.subscribe(() => {
    if (disposed) return;

    // Reproject fields
    if (fieldPaths.length > 0) {
      const previousFields = fieldStates;
      fieldStates = projectAllFields(runtime, fieldPaths, fields);
      const changedFields = createFieldProjectionDiff(previousFields, fieldStates);

      if (changedFields.length > 0) {
        for (const listener of fieldListeners) {
          listener(fieldStates, changedFields);
        }
      }
    }

    // Reproject actions
    if (actionIds.length > 0) {
      const previousActions = actionStates;
      actionStates = projectAllActions(runtime, actionIds, actions);
      const changedActions = createActionProjectionDiff(
        previousActions,
        actionStates
      );

      if (changedActions.length > 0) {
        for (const listener of actionListeners) {
          listener(actionStates, changedActions);
        }
      }
    }
  });
  subscriptions.push(snapshotUnsub);

  // Subscribe to domain events
  for (const channel of eventChannels) {
    const eventUnsub = runtime.subscribeEvents(channel, (domainEvent) => {
      if (disposed) return;

      const uiEvent = projectEvent(domainEvent, events);
      if (uiEvent) {
        uiEvents.push(uiEvent);

        // Notify listeners
        for (const listener of eventListeners) {
          listener(uiEvent);
        }

        // Schedule auto-dismiss
        if (uiEvent.duration !== undefined && uiEvent.duration > 0) {
          setTimeout(() => {
            const event = uiEvents.find((e) => e.id === uiEvent.id);
            if (event) {
              event.dismissed = true;
              uiEvents = uiEvents.filter((e) => !e.dismissed);
            }
          }, uiEvent.duration);
        }
      }
    });
    subscriptions.push(eventUnsub);
  }

  // Return manager interface
  return {
    runtime,

    // Field projection
    getFieldState(path: SemanticPath): UIFieldState | undefined {
      return fieldStates.get(path);
    },

    getFieldStates(): UIFieldStateMap {
      return new Map(fieldStates);
    },

    subscribeFields(listener: FieldStateListener): Unsubscribe {
      fieldListeners.add(listener);
      return () => fieldListeners.delete(listener);
    },

    // Action projection
    getActionState(actionId: string): UIActionState | undefined {
      return actionStates.get(actionId);
    },

    getActionStates(): UIActionStateMap {
      return new Map(actionStates);
    },

    subscribeActions(listener: ActionStateListener): Unsubscribe {
      actionListeners.add(listener);
      return () => actionListeners.delete(listener);
    },

    setActionExecuting(actionId: string, executing: boolean): void {
      const state = actionStates.get(actionId);
      if (state) {
        const updatedState: UIActionState = {
          ...state,
          executing,
          updatedAt: Date.now(),
        };
        actionStates.set(actionId, updatedState);

        // Notify listeners
        for (const listener of actionListeners) {
          listener(actionStates, [actionId]);
        }
      }
    },

    // Event projection
    getPendingEvents(): UIEvent[] {
      return uiEvents.filter((e) => !e.dismissed);
    },

    dismissEvent(eventId: string): void {
      const event = uiEvents.find((e) => e.id === eventId);
      if (event) {
        event.dismissed = true;
        uiEvents = uiEvents.filter((e) => !e.dismissed);
      }
    },

    dismissAllEvents(): void {
      for (const event of uiEvents) {
        event.dismissed = true;
      }
      uiEvents = [];
    },

    subscribeEvents(listener: UIEventListener): Unsubscribe {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },

    // Lifecycle
    refresh(): void {
      if (fieldPaths.length > 0) {
        fieldStates = projectAllFields(runtime, fieldPaths, fields);
      }
      if (actionIds.length > 0) {
        actionStates = projectAllActions(runtime, actionIds, actions);
      }
    },

    dispose(): void {
      disposed = true;
      for (const unsub of subscriptions) {
        unsub();
      }
      subscriptions.length = 0;
      fieldListeners.clear();
      actionListeners.clear();
      eventListeners.clear();
      uiEvents = [];
    },
  };
}
