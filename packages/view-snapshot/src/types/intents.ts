/**
 * ViewSnapshot Intent Types
 *
 * Agent가 ViewSnapshot의 상태를 변경하기 위해 발행하는 명령
 */

import type { SortDirection } from './nodes'

// ============================================================================
// Form Intents
// ============================================================================

/**
 * 필드 값 설정 Intent
 */
export interface SetFieldValueIntent {
  readonly type: 'setFieldValue'
  readonly nodeId: string
  readonly fieldId: string
  readonly value: unknown
}

/**
 * 폼 제출 Intent
 */
export interface SubmitFormIntent {
  readonly type: 'submit'
  readonly nodeId: string
}

/**
 * 폼 초기화 Intent
 */
export interface ResetFormIntent {
  readonly type: 'reset'
  readonly nodeId: string
}

// ============================================================================
// Table Intents
// ============================================================================

/**
 * 행 선택 Intent
 */
export interface SelectRowIntent {
  readonly type: 'selectRow'
  readonly nodeId: string
  readonly rowId: string
  /** true면 기존 선택에 추가, false면 교체 */
  readonly append?: boolean
}

/**
 * 전체 행 선택 Intent
 */
export interface SelectAllRowsIntent {
  readonly type: 'selectAll'
  readonly nodeId: string
}

/**
 * 전체 행 선택 해제 Intent
 */
export interface DeselectAllRowsIntent {
  readonly type: 'deselectAll'
  readonly nodeId: string
}

/**
 * 페이지 변경 Intent
 */
export interface ChangePageIntent {
  readonly type: 'changePage'
  readonly nodeId: string
  readonly page: number
}

/**
 * 컬럼 정렬 Intent
 */
export interface SortColumnIntent {
  readonly type: 'sortColumn'
  readonly nodeId: string
  readonly columnId: string
  /** 없으면 토글 */
  readonly direction?: SortDirection
}

// ============================================================================
// Tabs Intent
// ============================================================================

/**
 * 탭 전환 Intent
 */
export interface SwitchTabIntent {
  readonly type: 'switchTab'
  readonly nodeId: string
  readonly tabId: string
}

// ============================================================================
// Overlay Intents
// ============================================================================

/**
 * 오버레이 열기 Intent - 데이터 파이프라인 방식
 */
export interface OpenOverlayIntent {
  readonly type: 'openOverlay'
  /** 오버레이 템플릿 ID */
  readonly template: string
  /** 직접 데이터 주입 */
  readonly boundData?: Readonly<Record<string, unknown>>
  /** 데이터를 가져올 노드 (selectedRow 등) */
  readonly dataSourceNodeId?: string
}

/**
 * 오버레이 내 폼 제출 후 닫기 (결과 반환)
 */
export interface SubmitOverlayIntent {
  readonly type: 'submitOverlay'
  readonly instanceId: string
}

/**
 * 오버레이 닫기 (취소)
 */
export interface CloseOverlayIntent {
  readonly type: 'closeOverlay'
  readonly instanceId: string
}

/**
 * Confirmation Dialog 확인
 */
export interface ConfirmDialogIntent {
  readonly type: 'confirmDialog'
  readonly instanceId: string
}

/**
 * Toast 닫기 (수동)
 */
export interface DismissToastIntent {
  readonly type: 'dismissToast'
  readonly instanceId: string
}

// ============================================================================
// Action Trigger Intent
// ============================================================================

/**
 * 노드에 정의된 액션 트리거
 */
export interface TriggerActionIntent {
  readonly type: 'triggerAction'
  readonly nodeId: string
  readonly actionType: string
}

// ============================================================================
// Union Type
// ============================================================================

/**
 * 모든 Intent 타입의 유니온
 */
export type ViewIntent =
  // Form
  | SetFieldValueIntent
  | SubmitFormIntent
  | ResetFormIntent
  // Table
  | SelectRowIntent
  | SelectAllRowsIntent
  | DeselectAllRowsIntent
  | ChangePageIntent
  | SortColumnIntent
  // Tabs
  | SwitchTabIntent
  // Overlay
  | OpenOverlayIntent
  | SubmitOverlayIntent
  | CloseOverlayIntent
  | ConfirmDialogIntent
  | DismissToastIntent
  // Generic
  | TriggerActionIntent

/**
 * Intent 타입 문자열
 */
export type ViewIntentType = ViewIntent['type']

// ============================================================================
// Intent Result Types
// ============================================================================

/**
 * Intent 실행 성공 결과
 */
export interface IntentSuccessResult {
  readonly success: true
}

/**
 * Intent 실행 에러 종류
 */
export type IntentErrorType =
  | 'NODE_NOT_FOUND'
  | 'FIELD_NOT_FOUND'
  | 'ROW_NOT_FOUND'
  | 'OVERLAY_NOT_FOUND'
  | 'TEMPLATE_NOT_FOUND'
  | 'INVALID_OPERATION'
  | 'CONDITION_NOT_MET'
  | 'RUNTIME_ERROR'

/**
 * Intent 실행 에러 결과
 */
export interface IntentErrorResult {
  readonly success: false
  readonly errorType: IntentErrorType
  readonly message: string
}

/**
 * Intent 실행 결과
 */
export type IntentResult = IntentSuccessResult | IntentErrorResult
