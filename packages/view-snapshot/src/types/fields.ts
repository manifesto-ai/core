/**
 * ViewSnapshot Field Types
 *
 * 폼 필드, 테이블 컬럼/행, 상세 테이블 행 타입 정의
 */

import type { ViewAction } from './actions'

// ============================================================================
// Field Types
// ============================================================================

/**
 * 필드 타입
 */
export type FieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'radio'
  | 'datepicker'
  | 'daterangepicker'
  | 'textarea'
  | 'file'

/**
 * 선택 옵션 (Select/Radio 전용)
 */
export interface FieldOption {
  readonly value: string | number
  readonly label: string
  readonly disabled?: boolean
}

/**
 * 필드 스냅샷
 */
export interface FieldSnapshot {
  /** 필드 ID */
  readonly id: string
  /** 필드 타입 */
  readonly type: FieldType
  /** 표시 라벨 */
  readonly label: string
  /** 현재 값 */
  readonly value: unknown

  // 상태
  /** 숨김 여부 */
  readonly hidden?: boolean
  /** 비활성화 여부 */
  readonly disabled?: boolean
  /** 필수 여부 */
  readonly required?: boolean
  /** 에러 메시지 목록 */
  readonly errors?: readonly string[]

  // Select/Radio 전용
  /** 선택 옵션 목록 */
  readonly options?: readonly FieldOption[]
}

// ============================================================================
// Table Column Types
// ============================================================================

/**
 * 컬럼 타입
 */
export type ColumnType = 'text' | 'number' | 'date' | 'status' | 'checkbox' | 'actions'

/**
 * 테이블 컬럼 정의
 */
export interface ColumnDefinition {
  /** 컬럼 ID */
  readonly id: string
  /** 표시 라벨 */
  readonly label: string
  /** 컬럼 타입 */
  readonly type?: ColumnType
  /** 정렬 가능 여부 */
  readonly sortable?: boolean
}

/**
 * 테이블 행
 */
export interface TableRow {
  /** 행 ID */
  readonly id: string
  /** 행 데이터 */
  readonly data: Readonly<Record<string, unknown>>
}

// ============================================================================
// Detail Table Types
// ============================================================================

/**
 * 상세 행 타입
 */
export type DetailRowType = 'text' | 'number' | 'date' | 'image' | 'link' | 'button' | 'status'

/**
 * 상세 테이블 행
 */
export interface DetailRow {
  /** 행 ID */
  readonly id: string
  /** 표시 라벨 */
  readonly label: string
  /** 행 타입 */
  readonly type: DetailRowType
  /** 값 */
  readonly value: unknown

  // Link 전용
  /** 링크 URL */
  readonly href?: string

  // Button 전용
  /** 버튼 액션 */
  readonly buttonAction?: ViewAction
}
