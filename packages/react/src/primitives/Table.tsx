/**
 * Table Primitives
 *
 * 테이블 관련 컴포넌트들
 * - Table: 메인 테이블 컴포넌트
 * - DetailTable: 상세 정보 테이블
 * - TableSkeleton: 로딩 스켈레톤
 * - TableEmpty: 빈 상태
 * - TableError: 에러 상태
 */

import React from 'react'
import type {
  TablePrimitiveProps,
  DetailTablePrimitiveProps,
  TableSkeletonProps,
  TableEmptyProps,
  TableErrorProps,
} from '../types/primitives'
import type { TableRow, ColumnDefinition } from '@manifesto-ai/view-snapshot'
import { Button } from './Button'

// ============================================================================
// Table Primitive Component
// ============================================================================

/**
 * Table Primitive
 */
export const Table: React.FC<TablePrimitiveProps> = ({
  columns,
  rows,
  selection,
  sorting,
  isAllSelected = false,
  isIndeterminate = false,
  onRowSelect,
  onSelectAll,
  onDeselectAll,
  onSort,
  onRowClick,
  onRowAction: _onRowAction,
  className,
}) => {
  const hasSelection = selection && selection.mode !== 'none'

  const handleHeaderCheckboxChange = () => {
    if (isAllSelected || isIndeterminate) {
      onDeselectAll?.()
    } else {
      onSelectAll?.()
    }
  }

  const handleRowCheckboxChange = (rowId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()
    onRowSelect?.(rowId, selection?.mode === 'multiple')
  }

  const handleSortClick = (column: ColumnDefinition) => {
    if (column.sortable && onSort) {
      onSort(column.id)
    }
  }

  const isRowSelected = (rowId: string): boolean => {
    return selection?.selectedRowIds.includes(rowId) ?? false
  }

  const renderSortIndicator = (column: ColumnDefinition) => {
    if (!column.sortable) return null

    const isActive = sorting?.columnId === column.id
    const direction = sorting?.direction

    return (
      <span className="mfs-table-sort-indicator">
        {isActive ? (direction === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    )
  }

  const renderCellValue = (column: ColumnDefinition, row: TableRow): React.ReactNode => {
    const value = row.data[column.id]

    switch (column.type) {
      case 'checkbox':
        return <input type="checkbox" checked={Boolean(value)} readOnly />
      case 'date':
        return value ? new Date(String(value)).toLocaleDateString() : '-'
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : String(value ?? '-')
      case 'status':
        return <span className={`mfs-table-status mfs-table-status--${value}`}>{String(value)}</span>
      case 'actions':
        return null // Actions are handled by row actions
      default:
        return value !== null && value !== undefined ? String(value) : '-'
    }
  }

  const classNames = ['mfs-table-container', className].filter(Boolean).join(' ')

  return (
    <div className={classNames}>
      <table className="mfs-table">
        <thead className="mfs-table-head">
          <tr>
            {hasSelection && (
              <th className="mfs-table-th mfs-table-th--checkbox">
                {selection.mode === 'multiple' && (
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isIndeterminate
                    }}
                    onChange={handleHeaderCheckboxChange}
                    className="mfs-table-checkbox"
                  />
                )}
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.id}
                className={[
                  'mfs-table-th',
                  column.sortable && 'mfs-table-th--sortable',
                  sorting?.columnId === column.id && 'mfs-table-th--sorted',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleSortClick(column)}
              >
                <span className="mfs-table-th-content">
                  {column.label}
                  {renderSortIndicator(column)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="mfs-table-body">
          {rows.map((row) => (
            <tr
              key={row.id}
              className={[
                'mfs-table-row',
                isRowSelected(row.id) && 'mfs-table-row--selected',
                onRowClick && 'mfs-table-row--clickable',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onRowClick?.(row)}
            >
              {hasSelection && (
                <td className="mfs-table-td mfs-table-td--checkbox">
                  <input
                    type={selection.mode === 'multiple' ? 'checkbox' : 'radio'}
                    name="table-selection"
                    checked={isRowSelected(row.id)}
                    onChange={(e) => handleRowCheckboxChange(row.id, e)}
                    onClick={(e) => e.stopPropagation()}
                    className="mfs-table-checkbox"
                  />
                </td>
              )}
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={`mfs-table-td mfs-table-td--${column.type ?? 'text'}`}
                >
                  {renderCellValue(column, row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================================
// DetailTable Primitive Component
// ============================================================================

/**
 * DetailTable Primitive
 *
 * 상세 정보를 key-value 형태로 표시하는 테이블
 */
export const DetailTable: React.FC<DetailTablePrimitiveProps> = ({
  rows,
  onRowAction,
  className,
}) => {
  const renderValue = (row: typeof rows[number]): React.ReactNode => {
    switch (row.type) {
      case 'link':
        return (
          <a href={row.href} className="mfs-detail-link" target="_blank" rel="noopener noreferrer">
            {String(row.value)}
          </a>
        )
      case 'image':
        return (
          <img
            src={String(row.value)}
            alt={row.label}
            className="mfs-detail-image"
          />
        )
      case 'button':
        return row.buttonAction ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRowAction?.(row.buttonAction!)}
          >
            {row.buttonAction.label ?? String(row.value)}
          </Button>
        ) : null
      case 'date':
        return row.value ? new Date(String(row.value)).toLocaleDateString() : '-'
      case 'number':
        return typeof row.value === 'number' ? row.value.toLocaleString() : String(row.value ?? '-')
      case 'status':
        return (
          <span className={`mfs-detail-status mfs-detail-status--${row.value}`}>
            {String(row.value)}
          </span>
        )
      default:
        return row.value !== null && row.value !== undefined ? String(row.value) : '-'
    }
  }

  const classNames = ['mfs-detail-table', className].filter(Boolean).join(' ')

  return (
    <table className={classNames}>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="mfs-detail-row">
            <th className="mfs-detail-label">{row.label}</th>
            <td className={`mfs-detail-value mfs-detail-value--${row.type}`}>
              {renderValue(row)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ============================================================================
// TableSkeleton Primitive Component
// ============================================================================

/**
 * TableSkeleton Primitive
 *
 * 테이블 로딩 스켈레톤
 */
export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  columnCount,
  rowCount = 5,
  className,
}) => {
  const classNames = ['mfs-table-skeleton', className].filter(Boolean).join(' ')

  return (
    <div className={classNames}>
      <table className="mfs-table mfs-table--skeleton">
        <thead className="mfs-table-head">
          <tr>
            {Array.from({ length: columnCount }).map((_, i) => (
              <th key={i} className="mfs-table-th">
                <div className="mfs-skeleton mfs-skeleton--header" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="mfs-table-body">
          {Array.from({ length: rowCount }).map((_, rowIndex) => (
            <tr key={rowIndex} className="mfs-table-row">
              {Array.from({ length: columnCount }).map((_, colIndex) => (
                <td key={colIndex} className="mfs-table-td">
                  <div className="mfs-skeleton mfs-skeleton--cell" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================================
// TableEmpty Primitive Component
// ============================================================================

/**
 * TableEmpty Primitive
 *
 * 테이블 빈 상태
 */
export const TableEmpty: React.FC<TableEmptyProps> = ({
  message = '데이터가 없습니다.',
  icon,
  className,
}) => {
  const classNames = ['mfs-table-empty', className].filter(Boolean).join(' ')

  return (
    <div className={classNames}>
      {icon && <div className="mfs-table-empty-icon">{icon}</div>}
      <p className="mfs-table-empty-message">{message}</p>
    </div>
  )
}

// ============================================================================
// TableError Primitive Component
// ============================================================================

/**
 * TableError Primitive
 *
 * 테이블 에러 상태
 */
export const TableError: React.FC<TableErrorProps> = ({
  error,
  onRetry,
  className,
}) => {
  const classNames = ['mfs-table-error', className].filter(Boolean).join(' ')

  return (
    <div className={classNames}>
      <div className="mfs-table-error-icon">⚠️</div>
      <p className="mfs-table-error-message">{error.message}</p>
      {error.type === 'network' && onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </div>
  )
}

export default Table
