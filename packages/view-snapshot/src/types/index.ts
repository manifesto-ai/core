/**
 * ViewSnapshot Types
 *
 * ViewSnapshot 아키텍처의 모든 타입 정의를 re-export
 */

// Async State
export type {
  AsyncErrorType,
  AsyncError,
  IdleState,
  LoadingState,
  SuccessState,
  ErrorState,
  AsyncState,
  AsyncData,
  AsyncWithData,
  AsyncPending,
} from './async'

export {
  isIdle,
  isLoading,
  isSuccess,
  isError,
  isSettled,
  idle,
  loading,
  success,
  error,
  networkError,
  businessError,
  validationError,
} from './async'

// Actions
export type { ViewAction, ActionCondition, OverlayConfig } from './actions'

// Fields
export type {
  FieldType,
  FieldOption,
  FieldSnapshot,
  ColumnType,
  ColumnDefinition,
  TableRow,
  DetailRowType,
  DetailRow,
} from './fields'

// Overlays
export type {
  OverlayKind,
  ToastVariant,
  OverlayInstance,
  OverlayTemplate,
  OverlayResult,
} from './overlays'

// Nodes
export type {
  ViewNodeKind,
  ViewSnapshotNode,
  FocusContext,
  PageSnapshot,
  TabItem,
  TabsSnapshot,
  FormSnapshot,
  SelectionMode,
  TableSelection,
  TablePagination,
  SortDirection,
  TableSorting,
  TableSnapshot,
  DetailTableSnapshot,
  AnySnapshot,
} from './nodes'

// Intents
export type {
  SetFieldValueIntent,
  SubmitFormIntent,
  ResetFormIntent,
  SelectRowIntent,
  SelectAllRowsIntent,
  DeselectAllRowsIntent,
  ChangePageIntent,
  SortColumnIntent,
  SwitchTabIntent,
  OpenOverlayIntent,
  SubmitOverlayIntent,
  CloseOverlayIntent,
  ConfirmDialogIntent,
  DismissToastIntent,
  TriggerActionIntent,
  ViewIntent,
  ViewIntentType,
  IntentSuccessResult,
  IntentErrorType,
  IntentErrorResult,
  IntentResult,
} from './intents'

// Dispatcher
export type {
  HandlerContext,
  IntentHandler,
  NextFunction,
  IntentMiddleware,
  MiddlewareOptions,
  RegisteredMiddleware,
  IIntentDispatcher,
  UndoHistoryEntry,
  InverseIntentCreator,
} from './dispatcher'
