/**
 * ListTable - Table container component
 */

import React from 'react'
import type { ListColumn, SelectionConfig } from '@manifesto-ai/schema'
import type { ColumnMeta } from '@manifesto-ai/engine'
import { ListHeaderRow } from './ListHeaderRow'
import { ListRow } from './ListRow'
import { EmptyState } from './EmptyState'
import type { EmptyStateConfig } from '@manifesto-ai/schema'

export interface ListTableProps {
  rows: readonly Record<string, unknown>[]
  columns: readonly ListColumn[]
  columnMetaMap: ReadonlyMap<string, ColumnMeta>
  idField: string
  selection?: SelectionConfig
  selectedIds: ReadonlySet<string>
  isAllSelected: boolean
  isIndeterminate: boolean
  sortField: string | null
  sortDirection: 'asc' | 'desc' | null
  emptyState?: EmptyStateConfig
  isRowSelected: (rowId: string) => boolean
  onToggleRow: (rowId: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onToggleSort: (field: string) => void
  onRowClick: (rowId: string, row: Record<string, unknown>) => void
  onRowAction: (rowId: string, actionId: string, row: Record<string, unknown>) => void
  renderCell?: (
    column: ColumnMeta,
    value: unknown,
    row: Record<string, unknown>
  ) => React.ReactNode
  renderRowActions?: (row: Record<string, unknown>) => React.ReactNode
  renderEmptyState?: () => React.ReactNode
}

export const ListTable: React.FC<ListTableProps> = ({
  rows,
  columns,
  columnMetaMap,
  idField,
  selection,
  isAllSelected,
  isIndeterminate,
  sortField,
  sortDirection,
  emptyState,
  isRowSelected,
  onToggleRow,
  onSelectAll,
  onDeselectAll,
  onToggleSort,
  onRowClick,
  onRowAction,
  renderCell,
  renderRowActions,
  renderEmptyState,
}) => {
  // Check if empty
  if (rows.length === 0) {
    return (
      <div className="list-table list-table--empty">
        {renderEmptyState ? renderEmptyState() : <EmptyState config={emptyState} />}
      </div>
    )
  }

  return (
    <div className="list-table">
      <table className="list-table__table">
        <thead className="list-table__header">
          <ListHeaderRow
            columns={columns}
            columnMetaMap={columnMetaMap}
            selection={selection}
            isAllSelected={isAllSelected}
            isIndeterminate={isIndeterminate}
            sortField={sortField}
            sortDirection={sortDirection}
            onSelectAll={onSelectAll}
            onDeselectAll={onDeselectAll}
            onToggleSort={onToggleSort}
          />
        </thead>
        <tbody className="list-table__body">
          {rows.map((row, index) => {
            const rowId = String(row[idField] ?? index)
            return (
              <ListRow
                key={rowId}
                rowId={rowId}
                row={row as Record<string, unknown>}
                rowIndex={index}
                columns={columns}
                columnMetaMap={columnMetaMap}
                selection={selection}
                isSelected={isRowSelected(rowId)}
                onToggleRow={onToggleRow}
                onRowClick={onRowClick}
                onRowAction={onRowAction}
                renderCell={renderCell}
                renderRowActions={renderRowActions}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default ListTable
