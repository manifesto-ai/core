/**
 * Primitive Layer Types
 *
 * UI 컴포넌트의 Props 타입 및 PrimitiveSet 인터페이스 정의
 * Primitive는 Molecular 수준 (Label + Input + Error 조합) 으로 캡슐화됩니다.
 */

import type { ReactNode } from 'react'
import type {
  FieldSnapshot,
  ColumnDefinition,
  TableRow,
  DetailRow,
  TableSelection,
  TableSorting,
  ViewAction,
} from '@manifesto-ai/view-snapshot'

// ============================================================================
// Field Primitive
// ============================================================================

/**
 * 필드 레이아웃 종류
 */
export type FieldLayout = 'vertical' | 'horizontal' | 'inline'

/**
 * 필드 슬롯 커스터마이징
 */
export interface FieldSlots {
  /** 라벨 슬롯 오버라이드 */
  label?: (props: { field: FieldSnapshot }) => ReactNode
  /** 설명 슬롯 오버라이드 */
  description?: (props: { field: FieldSnapshot }) => ReactNode
  /** 에러 슬롯 오버라이드 */
  error?: (props: { errors: readonly string[] }) => ReactNode
}

/**
 * Field Primitive Props
 *
 * Molecular 수준의 필드 컴포넌트 (Label + Input + Error 조합)
 */
export interface FieldPrimitiveProps {
  /** 필드 스냅샷 */
  field: FieldSnapshot
  /** 값 변경 핸들러 */
  onChange: (value: unknown) => void
  /** 레이아웃 방향 */
  layout?: FieldLayout
  /** 라벨 숨김 여부 */
  hideLabel?: boolean
  /** 에러 숨김 여부 */
  hideError?: boolean
  /** 슬롯 커스터마이징 */
  slots?: FieldSlots
  /** 읽기 전용 여부 */
  readonly?: boolean
  /** 추가 CSS 클래스 */
  className?: string
}

// ============================================================================
// Button Primitive
// ============================================================================

/**
 * 버튼 변형
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'

/**
 * 버튼 크기
 */
export type ButtonSize = 'sm' | 'md' | 'lg'

/**
 * Button Primitive Props
 */
export interface ButtonPrimitiveProps {
  /** 버튼 텍스트 */
  children: ReactNode
  /** 클릭 핸들러 */
  onClick?: () => void
  /** 버튼 변형 */
  variant?: ButtonVariant
  /** 버튼 크기 */
  size?: ButtonSize
  /** 비활성화 여부 */
  disabled?: boolean
  /** 로딩 상태 */
  loading?: boolean
  /** 버튼 타입 */
  type?: 'button' | 'submit' | 'reset'
  /** 추가 CSS 클래스 */
  className?: string
}

// ============================================================================
// ActionBar Primitive
// ============================================================================

/**
 * 액션 핸들러 타입
 */
export type ActionHandler = (action: ViewAction) => void

/**
 * ActionBar Primitive Props
 */
export interface ActionBarPrimitiveProps {
  /** 액션 목록 */
  actions: readonly ViewAction[]
  /** 액션 클릭 핸들러 */
  onAction: ActionHandler
  /** 정렬 방향 */
  align?: 'left' | 'center' | 'right'
  /** 추가 CSS 클래스 */
  className?: string
}

// ============================================================================
// Table Primitive
// ============================================================================

/**
 * 행 선택 핸들러
 */
export type RowSelectHandler = (rowId: string, append?: boolean) => void

/**
 * 정렬 핸들러
 */
export type SortHandler = (columnId: string) => void

/**
 * Table Primitive Props
 */
export interface TablePrimitiveProps {
  /** 컬럼 정의 */
  columns: readonly ColumnDefinition[]
  /** 행 데이터 */
  rows: readonly TableRow[]
  /** 선택 상태 */
  selection?: TableSelection
  /** 정렬 상태 */
  sorting?: TableSorting
  /** 전체 선택 여부 (파생 상태) */
  isAllSelected?: boolean
  /** 일부 선택 여부 (파생 상태) */
  isIndeterminate?: boolean
  /** 행 선택 핸들러 */
  onRowSelect?: RowSelectHandler
  /** 전체 선택 핸들러 */
  onSelectAll?: () => void
  /** 전체 선택 해제 핸들러 */
  onDeselectAll?: () => void
  /** 정렬 핸들러 */
  onSort?: SortHandler
  /** 행 클릭 핸들러 */
  onRowClick?: (row: TableRow) => void
  /** 행 액션 핸들러 */
  onRowAction?: (action: ViewAction, row: TableRow) => void
  /** 추가 CSS 클래스 */
  className?: string
}

/**
 * TableSkeleton Primitive Props
 */
export interface TableSkeletonProps {
  /** 컬럼 개수 */
  columnCount: number
  /** 행 개수 (기본값: 5) */
  rowCount?: number
  /** 추가 CSS 클래스 */
  className?: string
}

/**
 * TableEmpty Primitive Props
 */
export interface TableEmptyProps {
  /** 메시지 */
  message?: string
  /** 아이콘 */
  icon?: ReactNode
  /** 추가 CSS 클래스 */
  className?: string
}

/**
 * TableError Primitive Props
 */
export interface TableErrorProps {
  /** 에러 객체 */
  error: {
    type: 'network' | 'business'
    message: string
  }
  /** 재시도 핸들러 */
  onRetry?: () => void
  /** 추가 CSS 클래스 */
  className?: string
}

// ============================================================================
// DetailTable Primitive
// ============================================================================

/**
 * DetailTable Primitive Props
 */
export interface DetailTablePrimitiveProps {
  /** 상세 행 목록 */
  rows: readonly DetailRow[]
  /** 행 액션 핸들러 */
  onRowAction?: (action: ViewAction) => void
  /** 추가 CSS 클래스 */
  className?: string
}

// ============================================================================
// Pagination Primitive
// ============================================================================

/**
 * Pagination Primitive Props
 */
export interface PaginationPrimitiveProps {
  /** 현재 페이지 (1-based) */
  currentPage: number
  /** 전체 페이지 수 */
  totalPages: number
  /** 페이지 크기 */
  pageSize: number
  /** 전체 항목 수 */
  totalItems: number
  /** 페이지 변경 핸들러 */
  onPageChange: (page: number) => void
  /** 페이지 크기 변경 핸들러 */
  onPageSizeChange?: (pageSize: number) => void
  /** 페이지 크기 옵션 */
  pageSizeOptions?: readonly number[]
  /** 추가 CSS 클래스 */
  className?: string
}

// ============================================================================
// Layout Primitives
// ============================================================================

/**
 * Card Primitive Props
 */
export interface CardPrimitiveProps {
  /** 카드 내용 */
  children: ReactNode
  /** 제목 */
  title?: string
  /** 설명 */
  description?: string
  /** 헤더 액션 */
  headerActions?: ReactNode
  /** 푸터 */
  footer?: ReactNode
  /** 추가 CSS 클래스 */
  className?: string
}

/**
 * 스택 방향
 */
export type StackDirection = 'horizontal' | 'vertical'

/**
 * 스택 정렬
 */
export type StackAlign = 'start' | 'center' | 'end' | 'stretch'

/**
 * 스택 간격
 */
export type StackGap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'

/**
 * Stack Primitive Props
 */
export interface StackPrimitiveProps {
  /** 스택 내용 */
  children: ReactNode
  /** 방향 */
  direction?: StackDirection
  /** 정렬 */
  align?: StackAlign
  /** 간격 */
  gap?: StackGap
  /** 추가 CSS 클래스 */
  className?: string
}

// ============================================================================
// Overlay Primitives
// ============================================================================

/**
 * Modal Primitive Props
 */
export interface ModalPrimitiveProps {
  /** 열림 상태 */
  open: boolean
  /** 닫기 핸들러 */
  onClose: () => void
  /** 제목 */
  title?: string
  /** 내용 */
  children: ReactNode
  /** 푸터 */
  footer?: ReactNode
  /** 크기 */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  /** 외부 클릭으로 닫기 허용 */
  closeOnOverlayClick?: boolean
  /** 추가 CSS 클래스 */
  className?: string
}

/**
 * Dialog Primitive Props
 */
export interface DialogPrimitiveProps {
  /** 열림 상태 */
  open: boolean
  /** 제목 */
  title?: string
  /** 메시지 */
  message: string
  /** 확인 버튼 라벨 */
  confirmLabel?: string
  /** 취소 버튼 라벨 */
  cancelLabel?: string
  /** 확인 핸들러 */
  onConfirm: () => void
  /** 취소 핸들러 */
  onCancel: () => void
  /** 변형 (위험 액션인지 여부) */
  variant?: 'default' | 'destructive'
  /** 추가 CSS 클래스 */
  className?: string
}

/**
 * Toast 변형
 */
export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

/**
 * Toast Primitive Props
 */
export interface ToastPrimitiveProps {
  /** 열림 상태 */
  open: boolean
  /** 메시지 */
  message: string
  /** 변형 */
  variant?: ToastVariant
  /** 닫기 핸들러 */
  onClose: () => void
  /** 액션 버튼 */
  action?: {
    label: string
    onClick: () => void
  }
  /** 추가 CSS 클래스 */
  className?: string
}

// ============================================================================
// Tabs Primitive
// ============================================================================

/**
 * 탭 아이템
 */
export interface TabItem {
  /** 탭 ID */
  id: string
  /** 탭 라벨 */
  label: string
  /** 비활성화 여부 */
  disabled?: boolean
}

/**
 * Tabs Primitive Props
 */
export interface TabsPrimitiveProps {
  /** 탭 목록 */
  tabs: readonly TabItem[]
  /** 현재 활성 탭 ID */
  activeTabId: string
  /** 탭 변경 핸들러 */
  onTabChange: (tabId: string) => void
  /** 추가 CSS 클래스 */
  className?: string
}

// ============================================================================
// PrimitiveSet Interface
// ============================================================================

/**
 * Primitive 컴포넌트 세트
 *
 * 디자인 시스템과의 결합점입니다. Shadcn, Material-UI 등
 * 다양한 UI 라이브러리 바인딩이 가능합니다.
 */
export interface PrimitiveSet {
  // Field (Molecular)
  Field: React.FC<FieldPrimitiveProps>

  // Actions
  Button: React.FC<ButtonPrimitiveProps>
  ActionBar: React.FC<ActionBarPrimitiveProps>

  // Table
  Table: React.FC<TablePrimitiveProps>
  DetailTable: React.FC<DetailTablePrimitiveProps>
  Pagination: React.FC<PaginationPrimitiveProps>
  TableSkeleton: React.FC<TableSkeletonProps>
  TableEmpty: React.FC<TableEmptyProps>
  TableError: React.FC<TableErrorProps>

  // Layout
  Card: React.FC<CardPrimitiveProps>
  Stack: React.FC<StackPrimitiveProps>

  // Overlay
  Modal: React.FC<ModalPrimitiveProps>
  Dialog: React.FC<DialogPrimitiveProps>
  Toast: React.FC<ToastPrimitiveProps>

  // Tabs
  Tabs: React.FC<TabsPrimitiveProps>
}
