/**
 * ViewSnapshot Types
 *
 * ViewSnapshot 아키텍처의 모든 타입 정의를 re-export
 */

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
