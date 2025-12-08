/**
 * ViewSnapshot Action Types
 *
 * 노드에서 수행 가능한 액션 정의
 */

// ============================================================================
// Action Condition
// ============================================================================

/**
 * 액션 실행 조건
 */
export interface ActionCondition {
  /** 선택 필요 여부 */
  readonly requiresSelection?: boolean
  /** 최소 선택 개수 */
  readonly minSelection?: number
  /** 최대 선택 개수 */
  readonly maxSelection?: number
  /** 필수 입력 필드 */
  readonly requiredFields?: readonly string[]
}

// ============================================================================
// Overlay Config
// ============================================================================

/**
 * 오버레이 생성 설정
 */
export interface OverlayConfig {
  /** 오버레이 종류 */
  readonly kind: 'modal' | 'dialog' | 'toast'
  /** 오버레이 템플릿 ID */
  readonly template: string
  /** 데이터 소스 (selectedRow, selectedRows, form 등) */
  readonly dataSource?: string
  /** 동적 메시지 템플릿 ({count} 등 치환) */
  readonly messageTemplate?: string
}

// ============================================================================
// View Action
// ============================================================================

/**
 * 노드에서 수행 가능한 액션
 */
export interface ViewAction {
  /** 액션 타입 */
  readonly type: string
  /** 표시 이름 */
  readonly label?: string
  /** 영향받는 노드 ID (정적 노드용) */
  readonly targetNodeId?: string
  /** 대상 노드에 미치는 효과 */
  readonly effect?: string
  /** 액션 실행 조건 */
  readonly condition?: ActionCondition
  /** 오버레이 생성 설정 */
  readonly overlay?: OverlayConfig
}
