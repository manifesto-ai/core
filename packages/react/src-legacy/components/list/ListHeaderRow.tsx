/**
 * ListHeaderRow - Table header row with sorting and selection
 */

import React, { useCallback, useMemo } from 'react'
import type { ListColumn, SelectionConfig } from '@manifesto-ai/schema'
import type { ColumnMeta } from '@manifesto-ai/engine'

export interface ListHeaderRowProps {
  columns: readonly ListColumn[]
  columnMetaMap: ReadonlyMap<string, ColumnMeta>
  selection?: SelectionConfig
  isAllSelected: boolean
  isIndeterminate: boolean
  sortField: string | null
  sortDirection: 'asc' | 'desc' | null
  onSelectAll: () => void
  onDeselectAll: () => void
  onToggleSort: (field: string) => void
}

export const ListHeaderRow: React.FC<ListHeaderRowProps> = ({
  columns,
  columnMetaMap,
  selection,
  isAllSelected,
  isIndeterminate,
  sortField,
  sortDirection,
  onSelectAll,
  onDeselectAll,
  onToggleSort,
}) => {
  const handleSelectAllChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
        onSelectAll()
      } else {
        onDeselectAll()
      }
    },
    [onSelectAll, onDeselectAll]
  )

  const handleColumnClick = useCallback(
    (columnId: string, sortable?: boolean) => {
      if (sortable) {
        onToggleSort(columnId)
      }
    },
    [onToggleSort]
  )

  const hasActionsColumn = useMemo(
    () => columns.some((col) => col.type === 'actions'),
    [columns]
  )

  return (
    <tr className="list-header-row">
      {/* Select All checkbox */}
      {selection?.enabled !== false && (
        <th className="list-header-row__cell list-header-row__cell--checkbox">
          <input
            type="checkbox"
            checked={isAllSelected}
            ref={(el) => {
              if (el) el.indeterminate = isIndeterminate
            }}
            onChange={handleSelectAllChange}
            aria-label="Select all rows"
          />
        </th>
      )}

      {/* Column headers */}
      {columns.map((column) => {
        // Skip actions column (rendered separately)
        if (column.type === 'actions') {
          return null
        }

        // Skip hidden columns
        const columnMeta = columnMetaMap.get(column.id)
        if (columnMeta?.hidden) {
          return null
        }

        const isSorted = sortField === column.id
        const sortable = column.sortable !== false

        // Build class name without useMemo (hooks can't be inside map callback)
        const classes = ['list-header-row__cell']
        if (sortable) classes.push('list-header-row__cell--sortable')
        if (isSorted && sortDirection === 'asc') {
          classes.push('list-header-row__cell--sorted-asc')
        }
        if (isSorted && sortDirection === 'desc') {
          classes.push('list-header-row__cell--sorted-desc')
        }
        if (column.align) {
          classes.push(`list-header-row__cell--align-${column.align}`)
        }
        const cellClassName = classes.join(' ')

        const style: React.CSSProperties = {}
        if (column.width) {
          style.width = typeof column.width === 'number' ? `${column.width}px` : column.width
        }
        if (column.minWidth) style.minWidth = `${column.minWidth}px`
        if (column.maxWidth) style.maxWidth = `${column.maxWidth}px`

        return (
          <th
            key={column.id}
            className={cellClassName}
            style={style}
            data-column-id={column.id}
            onClick={() => handleColumnClick(column.id, sortable)}
            aria-sort={isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
          >
            <div className="list-header-row__content">
              <span className="list-header-row__label">{column.label}</span>
              {sortable && (
                <span className="list-header-row__sort-icon">
                  {isSorted ? (sortDirection === 'asc' ? '\u25B2' : '\u25BC') : '\u25B4\u25BE'}
                </span>
              )}
            </div>
          </th>
        )
      })}

      {/* Actions header */}
      {hasActionsColumn && (
        <th className="list-header-row__cell list-header-row__cell--actions">
          Actions
        </th>
      )}
    </tr>
  )
}

export default ListHeaderRow
