/**
 * TableRenderer
 *
 * TableSnapshot을 Table UI로 변환하는 Node Renderer
 *
 * 책임:
 * - 파생 상태 계산 (isAllSelected, isIndeterminate 등)
 * - Intent 기반 행 선택, 정렬, 페이지네이션 핸들러 바인딩
 * - Table + Pagination Primitive로 렌더링
 */

import React from 'react'
import type { TableSnapshot, ViewAction } from '@manifesto-ai/view-snapshot'
import type { NodeRenderer, RenderContext } from '../types/renderer'

// ============================================================================
// TableRenderer Implementation
// ============================================================================

/**
 * TableSnapshot 렌더 함수
 */
const renderTable = (node: TableSnapshot, context: RenderContext): React.ReactNode => {
  const { primitives, dispatch } = context

  // ========================================================================
  // 파생 상태 계산
  // ========================================================================

  const selectedCount = node.selection.selectedRowIds.length
  const totalCount = node.rows.length
  const isAllSelected = totalCount > 0 && selectedCount === totalCount
  const isIndeterminate = selectedCount > 0 && selectedCount < totalCount

  // ========================================================================
  // 핸들러
  // ========================================================================

  /**
   * 행 선택 핸들러
   */
  const handleRowSelect = (rowId: string, append?: boolean) => {
    dispatch({
      type: 'selectRow',
      nodeId: node.nodeId,
      rowId,
      append: node.selection.mode === 'multiple' ? append : false,
    })
  }

  /**
   * 전체 선택 핸들러
   */
  const handleSelectAll = () => {
    dispatch({
      type: 'selectAll',
      nodeId: node.nodeId,
    })
  }

  /**
   * 전체 선택 해제 핸들러
   */
  const handleDeselectAll = () => {
    dispatch({
      type: 'deselectAll',
      nodeId: node.nodeId,
    })
  }

  /**
   * 정렬 핸들러
   */
  const handleSort = (columnId: string) => {
    // 같은 컬럼이면 방향 토글, 다른 컬럼이면 asc로 시작
    const currentDirection = node.sorting?.columnId === columnId
      ? node.sorting.direction
      : undefined

    const newDirection = currentDirection === 'asc' ? 'desc' : 'asc'

    dispatch({
      type: 'sortColumn',
      nodeId: node.nodeId,
      columnId,
      direction: newDirection,
    })
  }

  /**
   * 페이지 변경 핸들러
   */
  const handlePageChange = (page: number) => {
    dispatch({
      type: 'changePage',
      nodeId: node.nodeId,
      page,
    })
  }

  /**
   * 행 액션 핸들러
   */
  const handleRowAction = (action: ViewAction, row: typeof node.rows[number]) => {
    // 행 선택 후 액션 실행
    handleRowSelect(row.id)

    dispatch({
      type: 'triggerAction',
      nodeId: node.nodeId,
      actionType: action.type,
    })
  }

  /**
   * 테이블 레벨 액션 핸들러
   */
  const handleTableAction = (action: ViewAction) => {
    dispatch({
      type: 'triggerAction',
      nodeId: node.nodeId,
      actionType: action.type,
    })
  }

  // ========================================================================
  // 렌더링
  // ========================================================================

  const tableClassNames = [
    'mfs-table-renderer',
    node.selection.mode !== 'none' && 'mfs-table-renderer--selectable',
    node.sorting && 'mfs-table-renderer--sortable',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={tableClassNames}
      data-node-id={node.nodeId}
      data-node-kind="table"
    >
      {/* 테이블 레벨 액션 바 */}
      {node.actions.length > 0 && (
        <div className="mfs-table-renderer-actions">
          <primitives.ActionBar
            actions={node.actions}
            onAction={handleTableAction}
          />
        </div>
      )}

      {/* 테이블 */}
      <primitives.Table
        columns={node.columns}
        rows={node.rows}
        selection={node.selection}
        sorting={node.sorting}
        isAllSelected={isAllSelected}
        isIndeterminate={isIndeterminate}
        onRowSelect={handleRowSelect}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onSort={handleSort}
        onRowAction={handleRowAction}
      />

      {/* 페이지네이션 */}
      <primitives.Pagination
        currentPage={node.pagination.currentPage}
        totalPages={node.pagination.totalPages}
        pageSize={node.pagination.pageSize}
        totalItems={node.pagination.totalItems}
        onPageChange={handlePageChange}
      />
    </div>
  )
}

// ============================================================================
// TableRenderer Export
// ============================================================================

/**
 * TableRenderer
 *
 * TableSnapshot → Table UI 변환
 */
export const TableRenderer: NodeRenderer<TableSnapshot> = {
  kind: 'table',
  render: renderTable,
}

export default TableRenderer
