/**
 * Ink Primitives
 *
 * Terminal UI 기본 컴포넌트
 */

import type { FieldSnapshot, ViewAction } from '@manifesto-ai/view-snapshot'

export { Field, type FieldProps } from './Field'
export { Table, type TableProps } from './Table'
export { ActionBar, type ActionBarProps } from './ActionBar'

// ============================================================================
// InkPrimitiveSet
// ============================================================================

/**
 * Ink Primitive 컴포넌트 세트
 *
 * 렌더러에서 사용할 Primitive 컴포넌트들의 집합
 */
export interface InkPrimitiveSet {
  /** 필드 렌더링 컴포넌트 */
  Field: React.FC<{
    field: FieldSnapshot
    onChange?: (value: unknown) => void
    isFocused?: boolean
  }>
  /** 테이블 렌더링 컴포넌트 */
  Table: React.FC<{
    columns: readonly import('@manifesto-ai/view-snapshot').ColumnDefinition[]
    rows: readonly import('@manifesto-ai/view-snapshot').TableRow[]
    selection?: import('@manifesto-ai/view-snapshot').TableSelection
    pagination?: import('@manifesto-ai/view-snapshot').TablePagination
    sorting?: import('@manifesto-ai/view-snapshot').TableSorting
    onSelectRow?: (rowId: string) => void
    onSort?: (columnId: string) => void
    onPageChange?: (page: number) => void
    isFocused?: boolean
    terminalWidth?: number
  }>
  /** 액션바 렌더링 컴포넌트 */
  ActionBar: React.FC<{
    actions: readonly ViewAction[]
    onAction?: (action: ViewAction) => void
    isFocused?: boolean
    selectedCount?: number
  }>
}

// ============================================================================
// Default Primitive Set
// ============================================================================

import { Field } from './Field'
import { Table } from './Table'
import { ActionBar } from './ActionBar'

/**
 * 기본 InkPrimitiveSet 생성
 */
export const createDefaultInkPrimitives = (): InkPrimitiveSet => ({
  Field,
  Table,
  ActionBar,
})
