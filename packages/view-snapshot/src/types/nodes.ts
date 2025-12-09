/**
 * ViewSnapshot Node Types
 *
 * ViewSnapshot의 핵심 노드 타입 정의
 * - PageSnapshot: 최상위 페이지 컨테이너
 * - TabsSnapshot: 탭 네비게이션
 * - FormSnapshot: 폼 (FilterForm, EditForm 등)
 * - TableSnapshot: 데이터 테이블
 * - DetailTableSnapshot: 읽기 전용 상세 정보 테이블
 */

import type { ViewAction } from './actions'
import type { FieldSnapshot, ColumnDefinition, TableRow, DetailRow } from './fields'
import type { OverlayInstance } from './overlays'

// ============================================================================
// Base Types
// ============================================================================

/**
 * 노드 종류
 */
export type ViewNodeKind =
  | 'page'
  | 'tabs'
  | 'form'
  | 'table'
  | 'detailTable'
  | 'modal'
  | 'dialog'
  | 'toast'

/**
 * 모든 ViewSnapshot 노드의 기본 인터페이스
 */
export interface ViewSnapshotNode {
  /** 고유 식별자 */
  readonly nodeId: string
  /** 노드 타입 */
  readonly kind: ViewNodeKind
  /** 사람/Agent가 읽을 수 있는 이름 */
  readonly label?: string
  /** 이 노드에서 가능한 액션들 */
  readonly actions: readonly ViewAction[]
}

// ============================================================================
// Page Node
// ============================================================================

/**
 * 페이지 포커스 컨텍스트
 *
 * 현재 포커스된 노드와 오버레이를 추적합니다.
 */
export interface FocusContext {
  /** 현재 활성 오버레이 ID (없으면 null) */
  readonly activeOverlayId: string | null
  /** 현재 포커스된 노드 ID */
  readonly activeNodeId: string
}

/**
 * 최상위 페이지 노드
 */
export interface PageSnapshot extends ViewSnapshotNode {
  readonly kind: 'page'
  /** 정적 자식 노드들 */
  readonly children: readonly ViewSnapshotNode[]
  /** 현재 열린 오버레이 스택 */
  readonly overlays: readonly OverlayInstance[]
  /** 포커스 컨텍스트 (선택적 - 렌더러에서 관리) */
  readonly focusContext?: FocusContext
}

// ============================================================================
// Tabs Node
// ============================================================================

/**
 * 탭 아이템
 */
export interface TabItem {
  /** 탭 ID */
  readonly id: string
  /** 탭 라벨 */
  readonly label: string
  /** 비활성화 여부 */
  readonly disabled?: boolean
}

/**
 * 탭 노드
 */
export interface TabsSnapshot extends ViewSnapshotNode {
  readonly kind: 'tabs'
  /** 현재 활성 탭 ID */
  readonly activeTabId: string
  /** 탭 목록 */
  readonly tabs: readonly TabItem[]
}

// ============================================================================
// Form Node
// ============================================================================

/**
 * 폼 노드 - FilterForm, EditForm 등 모든 폼에 사용
 */
export interface FormSnapshot extends ViewSnapshotNode {
  readonly kind: 'form'
  /** 필드 목록 */
  readonly fields: readonly FieldSnapshot[]
  /** 폼 유효성 */
  readonly isValid: boolean
  /** 변경 여부 */
  readonly isDirty: boolean
  /** 제출 중 여부 */
  readonly isSubmitting: boolean
}

// ============================================================================
// Table Node
// ============================================================================

/**
 * 선택 모드
 */
export type SelectionMode = 'none' | 'single' | 'multiple'

/**
 * 테이블 선택 상태
 */
export interface TableSelection {
  /** 선택 모드 */
  readonly mode: SelectionMode
  /** 선택된 행 ID 목록 */
  readonly selectedRowIds: readonly string[]
}

/**
 * 테이블 페이지네이션
 */
export interface TablePagination {
  /** 현재 페이지 (1-based) */
  readonly currentPage: number
  /** 전체 페이지 수 */
  readonly totalPages: number
  /** 페이지 크기 */
  readonly pageSize: number
  /** 전체 항목 수 */
  readonly totalItems: number
}

/**
 * 정렬 방향
 */
export type SortDirection = 'asc' | 'desc'

/**
 * 테이블 정렬 상태
 */
export interface TableSorting {
  /** 정렬 컬럼 ID */
  readonly columnId: string
  /** 정렬 방향 */
  readonly direction: SortDirection
}

/**
 * 테이블 노드
 */
export interface TableSnapshot extends ViewSnapshotNode {
  readonly kind: 'table'
  /** 컬럼 정의 */
  readonly columns: readonly ColumnDefinition[]
  /** 행 데이터 */
  readonly rows: readonly TableRow[]
  /** 선택 상태 */
  readonly selection: TableSelection
  /** 페이지네이션 */
  readonly pagination: TablePagination
  /** 정렬 상태 (선택적) */
  readonly sorting?: TableSorting
}

// ============================================================================
// Detail Table Node
// ============================================================================

/**
 * 읽기 전용 상세 정보 테이블
 */
export interface DetailTableSnapshot extends ViewSnapshotNode {
  readonly kind: 'detailTable'
  /** 상세 행 목록 */
  readonly rows: readonly DetailRow[]
}

// ============================================================================
// Union Types
// ============================================================================

/**
 * 모든 스냅샷 노드 타입의 유니온
 */
export type AnySnapshot =
  | PageSnapshot
  | TabsSnapshot
  | FormSnapshot
  | TableSnapshot
  | DetailTableSnapshot
