/**
 * List Context
 *
 * React Context for ListRenderer
 */

import { createContext, useContext } from 'react'
import type { UseListRuntimeReturn } from '../../hooks/useListRuntime'
import type { ListViewSchema, ListColumn, ColumnType } from '@manifesto-ai/schema'
import type { ColumnMeta } from '@manifesto-ai/engine'

// ============================================================================
// Context Types
// ============================================================================

export interface ListContextValue {
  runtime: UseListRuntimeReturn
  schema: ListViewSchema
  readonly: boolean
  idField: string
}

// ============================================================================
// Cell Renderer Types
// ============================================================================

export interface CellRenderProps {
  column: ColumnMeta
  columnSchema: ListColumn
  value: unknown
  row: Record<string, unknown>
  rowId: string
  rowIndex: number
}

export type CellRenderer = (props: CellRenderProps) => React.ReactNode

export interface CellRendererRegistry {
  get: (type: ColumnType) => CellRenderer | undefined
  set: (type: ColumnType, renderer: CellRenderer) => void
  has: (type: ColumnType) => boolean
}

// ============================================================================
// Context
// ============================================================================

export const ListContext = createContext<ListContextValue | null>(null)

// ============================================================================
// Hooks
// ============================================================================

export function useListContext(): ListContextValue {
  const context = useContext(ListContext)
  if (!context) {
    throw new Error('useListContext must be used within a ListRenderer')
  }
  return context
}

export function useListRuntimeContext(): UseListRuntimeReturn {
  return useListContext().runtime
}

export function useListSchema(): ListViewSchema {
  return useListContext().schema
}

export function useListReadonly(): boolean {
  return useListContext().readonly
}

export function useListIdField(): string {
  return useListContext().idField
}
