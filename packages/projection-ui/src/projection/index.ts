/**
 * Projection module exports
 */

export {
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
} from './field-projection.js';

export {
  projectActionState,
  projectActionStates,
  createActionProjectionDiff,
  isActionStateEqual,
  getAvailableActions,
  getUnavailableActions,
  getExecutingActions,
  setExecuting,
} from './action-projection.js';

export {
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
} from './event-projection.js';
