/**
 * Table Primitive
 *
 * TableSnapshot을 터미널 테이블로 렌더링
 * - Box drawing 문자로 테이블 그리기
 * - 컬럼 너비 자동 계산
 * - 행 선택 하이라이트
 * - 페이지네이션 표시
 */

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type {
  ColumnDefinition,
  TableRow,
  TableSelection,
  TablePagination,
  TableSorting,
} from '@manifesto-ai/view-snapshot'

// ============================================================================
// Box Drawing Characters
// ============================================================================

const BOX = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  leftT: '├',
  rightT: '┤',
  topT: '┬',
  bottomT: '┴',
  cross: '┼',
} as const

// ============================================================================
// Props
// ============================================================================

export interface TableProps {
  /** 컬럼 정의 */
  columns: readonly ColumnDefinition[]
  /** 행 데이터 */
  rows: readonly TableRow[]
  /** 선택 상태 */
  selection?: TableSelection
  /** 페이지네이션 */
  pagination?: TablePagination
  /** 정렬 상태 */
  sorting?: TableSorting
  /** 행 선택 핸들러 */
  onSelectRow?: (rowId: string) => void
  /** 정렬 변경 핸들러 */
  onSort?: (columnId: string) => void
  /** 페이지 변경 핸들러 */
  onPageChange?: (page: number) => void
  /** 포커스 여부 */
  isFocused?: boolean
  /** 터미널 너비 */
  terminalWidth?: number
}

// ============================================================================
// Table Component
// ============================================================================

export const Table: React.FC<TableProps> = ({
  columns,
  rows,
  selection,
  pagination,
  sorting,
  onSelectRow,
  onSort,
  onPageChange,
  isFocused = false,
  terminalWidth = 80,
}) => {
  const [cursorRow, setCursorRow] = useState(0)

  // 컬럼 너비 계산
  const columnWidths = calculateColumnWidths(columns, rows, terminalWidth)

  // 키보드 입력 처리
  useInput(
    (input, key) => {
      if (!isFocused) return

      if (key.upArrow) {
        setCursorRow((prev) => Math.max(0, prev - 1))
      } else if (key.downArrow) {
        setCursorRow((prev) => Math.min(rows.length - 1, prev + 1))
      } else if (input === ' ' || key.return) {
        const row = rows[cursorRow]
        if (row) {
          onSelectRow?.(row.id)
        }
      } else if (key.leftArrow && pagination) {
        if (pagination.currentPage > 1) {
          onPageChange?.(pagination.currentPage - 1)
        }
      } else if (key.rightArrow && pagination) {
        if (pagination.currentPage < pagination.totalPages) {
          onPageChange?.(pagination.currentPage + 1)
        }
      }
    },
    { isActive: isFocused }
  )

  if (rows.length === 0) {
    return (
      <Box flexDirection="column">
        <TableHeader columns={columns} widths={columnWidths} sorting={sorting} />
        <Text color="gray">데이터가 없습니다.</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {/* 상단 테두리 */}
      <Text color="gray">
        {BOX.topLeft}
        {columns.map((_, i) => BOX.horizontal.repeat((columnWidths[i] ?? 10) + 2)).join(BOX.topT)}
        {BOX.topRight}
      </Text>

      {/* 헤더 */}
      <TableHeader columns={columns} widths={columnWidths} sorting={sorting} onSort={onSort} />

      {/* 헤더-바디 구분선 */}
      <Text color="gray">
        {BOX.leftT}
        {columns.map((_, i) => BOX.horizontal.repeat((columnWidths[i] ?? 10) + 2)).join(BOX.cross)}
        {BOX.rightT}
      </Text>

      {/* 행들 */}
      {rows.map((row, rowIndex) => {
        const isSelected = selection?.selectedRowIds.includes(row.id)
        const isCursor = cursorRow === rowIndex && isFocused

        return (
          <TableRowComponent
            key={row.id}
            row={row}
            columns={columns}
            widths={columnWidths}
            isSelected={isSelected}
            isCursor={isCursor}
            selectionMode={selection?.mode}
          />
        )
      })}

      {/* 하단 테두리 */}
      <Text color="gray">
        {BOX.bottomLeft}
        {columns.map((_, i) => BOX.horizontal.repeat((columnWidths[i] ?? 10) + 2)).join(BOX.bottomT)}
        {BOX.bottomRight}
      </Text>

      {/* 페이지네이션 */}
      {pagination && (
        <Pagination
          pagination={pagination}
          onPageChange={onPageChange}
          isFocused={isFocused}
        />
      )}
    </Box>
  )
}

// ============================================================================
// Table Header
// ============================================================================

interface TableHeaderProps {
  columns: readonly ColumnDefinition[]
  widths: number[]
  sorting?: TableSorting
  onSort?: (columnId: string) => void
}

const TableHeader: React.FC<TableHeaderProps> = ({ columns, widths, sorting, onSort: _onSort }) => {
  return (
    <Box>
      <Text color="gray">{BOX.vertical}</Text>
      {columns.map((col, i) => {
        const sortIndicator =
          sorting?.columnId === col.id
            ? sorting.direction === 'asc'
              ? ' ▲'
              : ' ▼'
            : col.sortable
              ? '  '
              : ''

        const label = col.label + sortIndicator
        const width = widths[i] ?? 10
        const padded = label.padEnd(width)

        return (
          <React.Fragment key={col.id}>
            <Text color="cyan" bold>
              {' '}
              {padded}{' '}
            </Text>
            <Text color="gray">{BOX.vertical}</Text>
          </React.Fragment>
        )
      })}
    </Box>
  )
}

// ============================================================================
// Table Row Component
// ============================================================================

interface TableRowComponentProps {
  row: TableRow
  columns: readonly ColumnDefinition[]
  widths: number[]
  isSelected?: boolean
  isCursor?: boolean
  selectionMode?: 'none' | 'single' | 'multiple'
}

const TableRowComponent: React.FC<TableRowComponentProps> = ({
  row,
  columns,
  widths,
  isSelected,
  isCursor,
  selectionMode,
}) => {
  const bgColor = isCursor ? 'blue' : isSelected ? 'magenta' : undefined
  const textColor = isCursor || isSelected ? 'white' : undefined

  const selectionIndicator =
    selectionMode === 'multiple'
      ? isSelected
        ? '[x]'
        : '[ ]'
      : selectionMode === 'single'
        ? isSelected
          ? '●'
          : '○'
        : ''

  return (
    <Box>
      <Text color="gray">{BOX.vertical}</Text>
      {columns.map((col, i) => {
        const value = row.data[col.id]
        const displayValue = formatCellValue(value, col.type)
        const prefix = i === 0 && selectionIndicator ? selectionIndicator + ' ' : ''
        const cellContent = prefix + displayValue
        const width = widths[i] ?? 10
        const padded = cellContent.slice(0, width).padEnd(width)

        return (
          <React.Fragment key={col.id}>
            <Text color={textColor} backgroundColor={bgColor}>
              {' '}
              {padded}{' '}
            </Text>
            <Text color="gray">{BOX.vertical}</Text>
          </React.Fragment>
        )
      })}
    </Box>
  )
}

// ============================================================================
// Pagination
// ============================================================================

interface PaginationProps {
  pagination: TablePagination
  onPageChange?: (page: number) => void
  isFocused?: boolean
}

const Pagination: React.FC<PaginationProps> = ({ pagination, onPageChange: _onPageChange, isFocused }) => {
  const { currentPage, totalPages, totalItems, pageSize } = pagination

  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  return (
    <Box marginTop={1} justifyContent="space-between">
      <Text color="gray">
        {startItem}-{endItem} / {totalItems}개
      </Text>
      <Box>
        <Text color={currentPage > 1 && isFocused ? 'cyan' : 'gray'}>[←] </Text>
        <Text>
          {currentPage} / {totalPages}
        </Text>
        <Text color={currentPage < totalPages && isFocused ? 'cyan' : 'gray'}> [→]</Text>
      </Box>
    </Box>
  )
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 컬럼 너비 계산
 */
function calculateColumnWidths(
  columns: readonly ColumnDefinition[],
  rows: readonly TableRow[],
  terminalWidth: number
): number[] {
  const minWidth = 4
  const maxTotalWidth = terminalWidth - (columns.length * 3 + 2) // 테두리 고려

  // 각 컬럼의 최대 너비 계산
  const widths = columns.map((col) => {
    let maxWidth = col.label.length + 2 // 정렬 인디케이터 공간

    for (const row of rows) {
      const value = row.data[col.id]
      const displayValue = formatCellValue(value, col.type)
      maxWidth = Math.max(maxWidth, displayValue.length + 4) // 선택 인디케이터 공간
    }

    return Math.max(minWidth, Math.min(maxWidth, 30)) // 최대 30자
  })

  // 전체 너비가 터미널 너비를 초과하면 비례 축소
  const totalWidth = widths.reduce((a, b) => a + b, 0)
  if (totalWidth > maxTotalWidth) {
    const ratio = maxTotalWidth / totalWidth
    return widths.map((w) => Math.max(minWidth, Math.floor(w * ratio)))
  }

  return widths
}

/**
 * 셀 값 포맷팅
 */
function formatCellValue(value: unknown, type?: string): string {
  if (value === null || value === undefined) {
    return '-'
  }

  switch (type) {
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value)
    case 'date':
      return value instanceof Date
        ? value.toLocaleDateString()
        : typeof value === 'string'
          ? value
          : String(value)
    case 'status':
      return String(value)
    case 'checkbox':
      return value ? '[x]' : '[ ]'
    default:
      return String(value)
  }
}

export default Table
