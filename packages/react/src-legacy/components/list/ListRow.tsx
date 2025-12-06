/**
 * ListRow - Single row rendering component
 */

import React, { useCallback, useMemo } from 'react'
import type { ListColumn, SelectionConfig } from '@manifesto-ai/schema'
import type { ColumnMeta } from '@manifesto-ai/engine'
import { DataCell } from './DataCell'
import { ActionCell } from './ActionCell'

export interface ListRowProps {
  rowId: string
  row: Record<string, unknown>
  rowIndex: number
  columns: readonly ListColumn[]
  columnMetaMap: ReadonlyMap<string, ColumnMeta>
  selection?: SelectionConfig
  isSelected: boolean
  onToggleRow: (rowId: string) => void
  onRowClick: (rowId: string, row: Record<string, unknown>) => void
  onRowAction: (rowId: string, actionId: string, row: Record<string, unknown>) => void
  renderCell?: (
    column: ColumnMeta,
    value: unknown,
    row: Record<string, unknown>
  ) => React.ReactNode
  renderRowActions?: (row: Record<string, unknown>) => React.ReactNode
}

export const ListRow: React.FC<ListRowProps> = ({
  rowId,
  row,
  rowIndex,
  columns,
  columnMetaMap,
  selection,
  isSelected,
  onToggleRow,
  onRowClick,
  onRowAction,
  renderCell,
  renderRowActions,
}) => {
  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation()
      onToggleRow(rowId)
    },
    [rowId, onToggleRow]
  )

  const handleRowClick = useCallback(
    (e: React.MouseEvent) => {
      // Don't trigger row click for checkbox or action cells
      const target = e.target as HTMLElement
      if (
        target.closest('.list-row__cell--checkbox') ||
        target.closest('.list-row__cell--actions')
      ) {
        return
      }
      onRowClick(rowId, row)
    },
    [rowId, row, onRowClick]
  )

  const rowClassName = useMemo(() => {
    const classes = ['list-row']
    if (isSelected) classes.push('list-row--selected')
    if (rowIndex % 2 === 1) classes.push('list-row--odd')
    return classes.join(' ')
  }, [isSelected, rowIndex])

  // Find actions column
  const actionsColumn = useMemo(
    () => columns.find((col) => col.type === 'actions'),
    [columns]
  )

  return (
    <tr className={rowClassName} onClick={handleRowClick} data-row-id={rowId}>
      {/* Selection checkbox */}
      {selection?.enabled !== false && (
        <td className="list-row__cell list-row__cell--checkbox">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            aria-label={`Select row ${rowIndex + 1}`}
          />
        </td>
      )}

      {/* Data cells */}
      {columns.map((columnSchema) => {
        // Skip actions column (rendered separately)
        if (columnSchema.type === 'actions') {
          return null
        }

        const columnMeta = columnMetaMap.get(columnSchema.id)
        if (!columnMeta) {
          return (
            <td key={columnSchema.id} className="list-row__cell">
              -
            </td>
          )
        }

        // Skip hidden columns
        if (columnMeta.hidden) {
          return null
        }

        const value = row[columnSchema.entityFieldId]

        return (
          <DataCell
            key={columnSchema.id}
            column={columnMeta}
            columnSchema={columnSchema}
            value={value}
            row={row}
            renderCell={renderCell}
          />
        )
      })}

      {/* Actions cell */}
      {actionsColumn && (
        <ActionCell
          rowId={rowId}
          row={row}
          actions={actionsColumn.actions ?? []}
          onAction={onRowAction}
          renderRowActions={renderRowActions}
        />
      )}
    </tr>
  )
}

export default ListRow
