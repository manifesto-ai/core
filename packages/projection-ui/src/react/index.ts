/**
 * React module exports
 *
 * Import from '@manifesto-ai/projection-ui/react'
 */

// Hooks
export {
  useFieldProjection,
  useFieldProjections,
  useAllFieldProjections,
  useActionProjection,
  useAction,
  useActionProjections,
  useAllActionProjections,
  useUIEvents,
  useUIEventHandler,
  filterEventsBySeverity,
  getLatestEvent,
  hasErrorEvents,
  useProjectionManager,
  useProjectionManagerWithDeps,
} from './hooks/index.js';

// Context
export {
  ProjectionProvider,
  useProjection,
  useProjectionOptional,
  type ProjectionProviderProps,
} from './context/index.js';
