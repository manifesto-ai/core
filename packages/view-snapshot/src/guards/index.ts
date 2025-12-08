/**
 * ViewSnapshot Guards
 *
 * 타입 가드 함수 re-export
 */

// Node Guards
export {
  isPageSnapshot,
  isTabsSnapshot,
  isFormSnapshot,
  isTableSnapshot,
  isDetailTableSnapshot,
  hasChildren,
  hasOverlays,
  findNodeById,
  traverseNodes,
} from './node-guards'

// Intent Guards
export {
  // Form
  isSetFieldValueIntent,
  isSubmitFormIntent,
  isResetFormIntent,
  isFormIntent,
  // Table
  isSelectRowIntent,
  isSelectAllRowsIntent,
  isDeselectAllRowsIntent,
  isChangePageIntent,
  isSortColumnIntent,
  isTableIntent,
  // Tabs
  isSwitchTabIntent,
  isTabsIntent,
  // Overlay
  isOpenOverlayIntent,
  isSubmitOverlayIntent,
  isCloseOverlayIntent,
  isConfirmDialogIntent,
  isDismissToastIntent,
  isOverlayIntent,
  // Trigger Action
  isTriggerActionIntent,
  // Utility
  hasNodeId,
  hasInstanceId,
} from './intent-guards'

// Intent Guard Types
export type {
  FormIntent,
  TableIntent,
  TabsIntent,
  OverlayIntent,
  IntentWithNodeId,
  IntentWithInstanceId,
} from './intent-guards'
