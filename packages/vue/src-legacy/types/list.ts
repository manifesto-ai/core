/**
 * List Types for ListRenderer
 *
 * ListView + CellRegistry 패턴을 위한 타입 정의
 */

import type { Component, InjectionKey, Ref, ComputedRef } from 'vue'
import type { ListViewSchema, ListColumn } from '@manifesto-ai/schema'
import type {
  EvaluationContext,
  ListRuntimeError,
  ColumnMeta,
  FetchHandler,
  NavigateHandler,
  EmitHandler,
  ActionHandler,
} from '@manifesto-ai/engine'
import type { UseListRuntimeReturn } from '../composables/useListRuntime'

// ============================================================================
// Cell Component Types
// ============================================================================

/**
 * Cell 렌더러 컴포넌트가 받는 Props
 */
export interface CellRendererProps {
  /** 컬럼 스키마 정의 */
  column: ListColumn
  /** 컬럼 메타데이터 (런타임 상태) */
  columnMeta: ColumnMeta
  /** 셀 값 */
  value: unknown
  /** 전체 행 데이터 */
  row: Record<string, unknown>
  /** 행 ID */
  rowId: string
  /** 행 인덱스 (0-based) */
  rowIndex: number
}

// ============================================================================
// Cell Registry Types
// ============================================================================

/**
 * Cell 등록 정보
 */
export interface CellRegistration {
  /** Vue 컴포넌트 또는 동적 import 함수 */
  component: Component | (() => Promise<{ default: Component }>)
  /** 기본 props (선택) */
  defaultProps?: Record<string, unknown>
}

/**
 * Cell 레지스트리 인터페이스
 */
export interface ICellRegistry {
  /** Cell 컴포넌트 등록 */
  register(type: string, registration: CellRegistration | Component | (() => Promise<{ default: Component }>)): void
  /** Cell 컴포넌트 조회 */
  get(type: string): CellRegistration | undefined
  /** 등록 여부 확인 */
  has(type: string): boolean
  /** 전체 등록된 타입 목록 */
  getTypes(): string[]
  /** 레지스트리 복제 (확장용) */
  clone(): ICellRegistry
}

// ============================================================================
// ListRenderer Types
// ============================================================================

/**
 * ListRenderer Props
 */
export interface ListRendererProps {
  /** ListView 스키마 */
  schema: ListViewSchema
  /** 평가 컨텍스트 (hidden expression 등) */
  context?: Partial<EvaluationContext>
  /** 행 ID 필드명 (기본: 'id') */
  idField?: string
  /** 읽기 전용 모드 */
  readonly?: boolean
  /** 초기 데이터 (API 대신 직접 제공) */
  initialData?: Record<string, unknown>[]
  /** 디버그 모드 */
  debug?: boolean
  /** 커스텀 Cell 레지스트리 */
  cellRegistry?: ICellRegistry
  /** API fetch 핸들러 */
  fetchHandler?: FetchHandler
  /** 네비게이션 핸들러 */
  navigateHandler?: NavigateHandler
  /** 이벤트 emit 핸들러 */
  emitHandler?: EmitHandler
  /** 액션 핸들러 */
  actionHandler?: ActionHandler
}

/**
 * ListRenderer Emits
 */
export interface ListRendererEmits {
  /** 행 클릭 */
  (e: 'rowClick', rowId: string, row: Record<string, unknown>): void
  /** 행 액션 실행 */
  (e: 'rowAction', rowId: string, actionId: string, row: Record<string, unknown>): void
  /** Bulk 액션 실행 */
  (e: 'bulkAction', actionId: string, selectedIds: string[]): void
  /** 선택 변경 */
  (e: 'selectionChange', selectedIds: string[]): void
  /** 페이지 변경 */
  (e: 'pageChange', page: number, pageSize: number): void
  /** 정렬 변경 */
  (e: 'sortChange', field: string | null, direction: 'asc' | 'desc' | null): void
  /** 검색어 변경 */
  (e: 'searchChange', term: string): void
  /** 에러 발생 */
  (e: 'error', error: ListRuntimeError): void
}

// ============================================================================
// Row Action Types
// ============================================================================

/**
 * 행 액션 정의
 */
export interface RowAction {
  /** 액션 ID */
  id: string
  /** 표시 라벨 */
  label: string
  /** 아이콘 (선택) */
  icon?: string
  /** 스타일 변형 */
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  /** 비활성화 조건 */
  disabled?: boolean
}

/**
 * Bulk 액션 정의
 */
export interface BulkAction {
  /** 액션 ID */
  id: string
  /** 표시 라벨 */
  label: string
  /** 아이콘 (선택) */
  icon?: string
  /** 스타일 변형 */
  variant?: 'default' | 'primary' | 'danger'
  /** 최소 선택 수 (기본: 1) */
  minSelection?: number
  /** 최대 선택 수 (선택) */
  maxSelection?: number
}

// ============================================================================
// Injection Keys
// ============================================================================

/** ListRuntime injection key */
export const LIST_RUNTIME_KEY: InjectionKey<UseListRuntimeReturn> = Symbol('listRuntime')

/** CellRegistry injection key */
export const CELL_REGISTRY_KEY: InjectionKey<ComputedRef<ICellRegistry>> = Symbol('cellRegistry')

/** List schema injection key */
export const LIST_SCHEMA_KEY: InjectionKey<ComputedRef<ListViewSchema>> = Symbol('listSchema')

/** List readonly state injection key */
export const LIST_READONLY_KEY: InjectionKey<Ref<boolean>> = Symbol('listReadonly')

/** List ID field injection key */
export const LIST_ID_FIELD_KEY: InjectionKey<string> = Symbol('listIdField')
