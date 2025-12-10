/**
 * @manifesto-ai/projection-ui
 *
 * UI Projection layer for Manifesto AI.
 * Converts domain policies to framework-agnostic UI states.
 *
 * Philosophy:
 * - Domain decides "what" (relevant, editable, required)
 * - UI decides "how" (visible vs hidden, enabled vs disabled)
 *
 * @example
 * ```typescript
 * import { createProjectionManager } from '@manifesto-ai/projection-ui';
 * import { createRuntime } from '@manifesto-ai/core';
 *
 * const runtime = createRuntime({ domain, initialData });
 * const manager = createProjectionManager({
 *   runtime,
 *   domain,
 *   fields: { paths: ['data.name', 'data.email'] },
 *   actions: { actionIds: ['action.submit'] },
 * });
 *
 * // Get field state
 * const nameState = manager.getFieldState('data.name');
 * if (nameState?.visible) {
 *   // Render field
 * }
 *
 * // Subscribe to changes
 * manager.subscribeFields((states, changedPaths) => {
 *   console.log('Fields changed:', changedPaths);
 * });
 * ```
 */

// =============================================================================
// Core Types
// =============================================================================
export type {
  // Field State
  UIFieldState,
  UIFieldStateMap,

  // Action State
  UIActionState,
  UIActionStateMap,
  UIPreconditionState,

  // Events
  UIEvent,
  UIEventSeverity,
  EventTransformer,

  // Configuration
  FieldProjectionConfig,
  ActionProjectionConfig,
  EventProjectionConfig,
  CreateProjectionManagerOptions,

  // Listeners
  FieldStateListener,
  ActionStateListener,
  UIEventListener,

  // Manager
  ProjectionManager,
} from './types.js';

// Type Guards
export {
  isUIEventSeverity,
  isUIFieldState,
  isUIActionState,
  isUIEvent,
} from './types.js';

// =============================================================================
// Projection Functions
// =============================================================================
export {
  // Field Projection
  projectFieldPolicy,
  projectFieldPolicies,
  createFieldProjectionDiff,
  isFieldStateEqual,
  mergeFieldStates,
  filterVisibleFields,
  filterEnabledFields,
  getRequiredFields,
  defaultVisibilityResolver,
  defaultEnabledResolver,

  // Action Projection
  projectActionState,
  projectActionStates,
  createActionProjectionDiff,
  isActionStateEqual,
  getAvailableActions,
  getUnavailableActions,
  getExecutingActions,
  setExecuting,

  // Event Projection
  projectEvent,
  defaultEventTransformer,
  createToastEvent,
  createSuccessToast,
  createErrorToast,
  createWarningToast,
  createInfoToast,
  filterPendingEvents,
  dismissEvent,
  dismissAllEvents,
  getEventsBySeverity,
  getEventsByChannel,
  generateEventId,
  resetEventIdCounter,
  inferSeverity,
} from './projection/index.js';

// =============================================================================
// Projection Manager
// =============================================================================
export { createProjectionManager } from './core/index.js';
