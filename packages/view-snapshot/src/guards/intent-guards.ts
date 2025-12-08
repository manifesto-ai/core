/**
 * ViewSnapshot Intent Type Guards
 *
 * Intent 타입 판별을 위한 타입 가드 함수
 */

import type {
  ViewIntent,
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
} from '../types'

// ============================================================================
// Form Intent Guards
// ============================================================================

/**
 * SetFieldValueIntent 타입 가드
 */
export const isSetFieldValueIntent = (intent: ViewIntent): intent is SetFieldValueIntent =>
  intent.type === 'setFieldValue'

/**
 * SubmitFormIntent 타입 가드
 */
export const isSubmitFormIntent = (intent: ViewIntent): intent is SubmitFormIntent =>
  intent.type === 'submit'

/**
 * ResetFormIntent 타입 가드
 */
export const isResetFormIntent = (intent: ViewIntent): intent is ResetFormIntent =>
  intent.type === 'reset'

/**
 * Form Intent 타입 가드 (SetFieldValue | Submit | Reset)
 */
export type FormIntent = SetFieldValueIntent | SubmitFormIntent | ResetFormIntent

export const isFormIntent = (intent: ViewIntent): intent is FormIntent =>
  intent.type === 'setFieldValue' ||
  intent.type === 'submit' ||
  intent.type === 'reset'

// ============================================================================
// Table Intent Guards
// ============================================================================

/**
 * SelectRowIntent 타입 가드
 */
export const isSelectRowIntent = (intent: ViewIntent): intent is SelectRowIntent =>
  intent.type === 'selectRow'

/**
 * SelectAllRowsIntent 타입 가드
 */
export const isSelectAllRowsIntent = (intent: ViewIntent): intent is SelectAllRowsIntent =>
  intent.type === 'selectAll'

/**
 * DeselectAllRowsIntent 타입 가드
 */
export const isDeselectAllRowsIntent = (intent: ViewIntent): intent is DeselectAllRowsIntent =>
  intent.type === 'deselectAll'

/**
 * ChangePageIntent 타입 가드
 */
export const isChangePageIntent = (intent: ViewIntent): intent is ChangePageIntent =>
  intent.type === 'changePage'

/**
 * SortColumnIntent 타입 가드
 */
export const isSortColumnIntent = (intent: ViewIntent): intent is SortColumnIntent =>
  intent.type === 'sortColumn'

/**
 * Table Intent 타입 가드
 */
export type TableIntent =
  | SelectRowIntent
  | SelectAllRowsIntent
  | DeselectAllRowsIntent
  | ChangePageIntent
  | SortColumnIntent

export const isTableIntent = (intent: ViewIntent): intent is TableIntent =>
  intent.type === 'selectRow' ||
  intent.type === 'selectAll' ||
  intent.type === 'deselectAll' ||
  intent.type === 'changePage' ||
  intent.type === 'sortColumn'

// ============================================================================
// Tabs Intent Guards
// ============================================================================

/**
 * SwitchTabIntent 타입 가드
 */
export const isSwitchTabIntent = (intent: ViewIntent): intent is SwitchTabIntent =>
  intent.type === 'switchTab'

/**
 * Tabs Intent 타입 가드
 */
export type TabsIntent = SwitchTabIntent

export const isTabsIntent = (intent: ViewIntent): intent is TabsIntent =>
  intent.type === 'switchTab'

// ============================================================================
// Overlay Intent Guards
// ============================================================================

/**
 * OpenOverlayIntent 타입 가드
 */
export const isOpenOverlayIntent = (intent: ViewIntent): intent is OpenOverlayIntent =>
  intent.type === 'openOverlay'

/**
 * SubmitOverlayIntent 타입 가드
 */
export const isSubmitOverlayIntent = (intent: ViewIntent): intent is SubmitOverlayIntent =>
  intent.type === 'submitOverlay'

/**
 * CloseOverlayIntent 타입 가드
 */
export const isCloseOverlayIntent = (intent: ViewIntent): intent is CloseOverlayIntent =>
  intent.type === 'closeOverlay'

/**
 * ConfirmDialogIntent 타입 가드
 */
export const isConfirmDialogIntent = (intent: ViewIntent): intent is ConfirmDialogIntent =>
  intent.type === 'confirmDialog'

/**
 * DismissToastIntent 타입 가드
 */
export const isDismissToastIntent = (intent: ViewIntent): intent is DismissToastIntent =>
  intent.type === 'dismissToast'

/**
 * Overlay Intent 타입 가드
 */
export type OverlayIntent =
  | OpenOverlayIntent
  | SubmitOverlayIntent
  | CloseOverlayIntent
  | ConfirmDialogIntent
  | DismissToastIntent

export const isOverlayIntent = (intent: ViewIntent): intent is OverlayIntent =>
  intent.type === 'openOverlay' ||
  intent.type === 'submitOverlay' ||
  intent.type === 'closeOverlay' ||
  intent.type === 'confirmDialog' ||
  intent.type === 'dismissToast'

// ============================================================================
// Trigger Action Intent Guards
// ============================================================================

/**
 * TriggerActionIntent 타입 가드
 */
export const isTriggerActionIntent = (intent: ViewIntent): intent is TriggerActionIntent =>
  intent.type === 'triggerAction'

// ============================================================================
// Intent with nodeId
// ============================================================================

/**
 * nodeId를 가진 Intent 타입
 */
export type IntentWithNodeId =
  | SetFieldValueIntent
  | SubmitFormIntent
  | ResetFormIntent
  | SelectRowIntent
  | SelectAllRowsIntent
  | DeselectAllRowsIntent
  | ChangePageIntent
  | SortColumnIntent
  | SwitchTabIntent
  | TriggerActionIntent

/**
 * nodeId를 가진 Intent인지 확인
 */
export const hasNodeId = (intent: ViewIntent): intent is IntentWithNodeId =>
  'nodeId' in intent

/**
 * instanceId를 가진 Intent 타입
 */
export type IntentWithInstanceId =
  | SubmitOverlayIntent
  | CloseOverlayIntent
  | ConfirmDialogIntent
  | DismissToastIntent

/**
 * instanceId를 가진 Intent인지 확인
 */
export const hasInstanceId = (intent: ViewIntent): intent is IntentWithInstanceId =>
  'instanceId' in intent
