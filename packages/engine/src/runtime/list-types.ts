/**
 * List Runtime Types
 *
 * ListRuntime을 위한 타입 정의
 */

import type { ListColumn } from '@manifesto-ai/schema'
import type { EvaluationContext } from '../evaluator'
import type { FetchHandler, NavigateHandler, EmitHandler } from './form-runtime'

// Re-export shared handler types
export type { FetchHandler, NavigateHandler, EmitHandler }

// ============================================================================
// Column Meta
// ============================================================================

/**
 * 런타임 컬럼 메타데이터
 */
export interface ColumnMeta {
  readonly id: string
  readonly entityFieldId: string
  readonly label: string
  readonly type: ListColumn['type']
  readonly width?: string | number
  readonly minWidth?: number
  readonly maxWidth?: number
  readonly sortable: boolean
  readonly filterable: boolean
  readonly hidden: boolean
  readonly align: 'left' | 'center' | 'right'
}

// ============================================================================
// List State
// ============================================================================

/**
 * ListRuntime 상태
 */
export interface ListState {
  // Data
  readonly rows: readonly Record<string, unknown>[]
  readonly totalCount: number

  // Pagination
  readonly currentPage: number
  readonly pageSize: number
  readonly totalPages: number

  // Sorting
  readonly sortField: string | null
  readonly sortDirection: 'asc' | 'desc' | null

  // Filtering
  readonly searchTerm: string
  readonly filters: Readonly<Record<string, unknown>>

  // Selection
  readonly selectedIds: ReadonlySet<string>
  readonly isAllSelected: boolean
  readonly isIndeterminate: boolean

  // Loading states
  readonly isLoading: boolean
  readonly isRefreshing: boolean
  readonly error: ListRuntimeError | null

  // Column metadata
  readonly columns: ReadonlyMap<string, ColumnMeta>
}

// ============================================================================
// List Events
// ============================================================================

/**
 * ListRuntime 이벤트 타입
 */
export type ListEvent =
  // Pagination
  | { type: 'PAGE_CHANGE'; page: number }
  | { type: 'PAGE_SIZE_CHANGE'; pageSize: number }

  // Sorting
  | { type: 'SORT_CHANGE'; field: string; direction: 'asc' | 'desc' | null }
  | { type: 'SORT_TOGGLE'; field: string }

  // Filtering
  | { type: 'SEARCH_CHANGE'; searchTerm: string }
  | { type: 'FILTER_CHANGE'; fieldId: string; value: unknown }
  | { type: 'FILTERS_RESET' }

  // Selection
  | { type: 'SELECT_ROW'; rowId: string }
  | { type: 'DESELECT_ROW'; rowId: string }
  | { type: 'TOGGLE_ROW'; rowId: string }
  | { type: 'SELECT_ALL' }
  | { type: 'DESELECT_ALL' }

  // Row interactions
  | { type: 'ROW_CLICK'; rowId: string; row: Record<string, unknown> }
  | { type: 'ROW_ACTION'; rowId: string; actionId: string; row: Record<string, unknown> }

  // Bulk actions
  | { type: 'BULK_ACTION'; actionId: string; selectedIds: readonly string[] }

  // Data operations
  | { type: 'LOAD' }
  | { type: 'REFRESH' }

// ============================================================================
// Errors
// ============================================================================

/**
 * ListRuntime 에러 타입
 */
export type ListRuntimeError =
  | { type: 'SCHEMA_ERROR'; message: string }
  | { type: 'FETCH_ERROR'; message: string; cause?: unknown }
  | { type: 'ACTION_ERROR'; message: string; actionId: string; cause?: unknown }
  | { type: 'EVALUATION_ERROR'; message: string; expression?: string }

// ============================================================================
// Handlers (ListRuntime specific)
// ============================================================================

/**
 * Action 핸들러 타입 - 커스텀 액션 실행을 위한 DI 인터페이스
 */
export type ActionHandler = (
  actionId: string,
  context: {
    row?: Record<string, unknown>
    rows?: readonly Record<string, unknown>[]
    selectedIds?: readonly string[]
  }
) => Promise<void> | void

// ============================================================================
// Options
// ============================================================================

/**
 * ListRuntime 옵션
 */
export interface ListRuntimeOptions {
  /** 컨텍스트 (Expression 평가용) */
  context?: Partial<EvaluationContext>

  /** Row ID 필드명 (기본값: 'id') */
  idField?: string

  /** API 호출 핸들러 */
  fetchHandler?: FetchHandler

  /** Navigate 핸들러 (라우팅용) */
  navigateHandler?: NavigateHandler

  /** Emit 핸들러 (이벤트 발행용) */
  emitHandler?: EmitHandler

  /** Action 핸들러 (커스텀 액션 실행용) */
  actionHandler?: ActionHandler

  /** 초기 데이터 (static 데이터 소스 오버라이드) */
  initialData?: readonly Record<string, unknown>[]

  /** 디버그 모드 */
  debug?: boolean
}

// ============================================================================
// Listeners
// ============================================================================

/**
 * 상태 변경 리스너
 */
export interface ListChangeListener {
  (state: ListState): void
}

/**
 * 이벤트 리스너
 */
export interface ListEventListener {
  (event: ListEvent): void
}

// ============================================================================
// Data Fetch Response
// ============================================================================

/**
 * API 응답 데이터 구조
 */
export interface ListFetchResponse {
  rows: Record<string, unknown>[]
  total: number
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Row ID 타입
 */
export type RowId = string | number

/**
 * Sort 설정
 */
export interface SortConfig {
  field: string
  direction: 'asc' | 'desc'
}

/**
 * Filter 값 타입
 */
export type FilterValue = string | number | boolean | null | undefined | readonly (string | number)[]
