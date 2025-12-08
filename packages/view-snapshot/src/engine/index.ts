/**
 * ViewSnapshot Engine
 *
 * 엔진 컴포넌트 re-export
 */

// ViewSnapshotEngine
export {
  ViewSnapshotEngine,
  createViewSnapshotEngine,
} from './ViewSnapshotEngine'
export type {
  IViewSnapshotEngine,
  ViewSnapshotEngineOptions,
  SnapshotChangeListener,
} from './ViewSnapshotEngine'

// NodeRegistry
export {
  NodeRegistry,
  createNodeRegistry,
} from './NodeRegistry'
export type {
  INodeRegistry,
  RegisteredFormNode,
  RegisteredListNode,
  NodeType,
  RegisteredNode,
} from './NodeRegistry'

// TemplateRegistry
export {
  TemplateRegistry,
  createTemplateRegistry,
  registerDefaultTemplates,
  DEFAULT_CONFIRM_TEMPLATE,
  DEFAULT_DELETE_CONFIRM_TEMPLATE,
  DEFAULT_SUCCESS_TOAST_TEMPLATE,
  DEFAULT_ERROR_TOAST_TEMPLATE,
  DEFAULT_TEMPLATES,
} from './TemplateRegistry'
export type { ITemplateRegistry } from './TemplateRegistry'

// OverlayManager
export {
  OverlayManager,
  createOverlayManager,
} from './OverlayManager'
export type {
  IOverlayManager,
  OpenOverlayOptions,
  OverlayResultHandler,
} from './OverlayManager'

// IntentDispatcher
export {
  IntentDispatcher,
  createIntentDispatcher,
} from './IntentDispatcher'
export type {
  IIntentDispatcher,
  IntentDispatcherOptions,
} from './IntentDispatcher'
