/**
 * TableRenderer
 *
 * TableSnapshot을 Ink UI로 렌더링
 */

import React, { useCallback } from 'react'
import { Box, Text } from 'ink'
import type { TableSnapshot } from '@manifesto-ai/view-snapshot'
import type { InkNodeRenderer, InkRenderContext } from '../types/renderer'

// ============================================================================
// TableRenderer
// ============================================================================

export const TableRenderer: InkNodeRenderer<TableSnapshot> = {
  kind: 'table',
  render: (node, context) => {
    return <TableComponent node={node} context={context} />
  },
}

// ============================================================================
// TableComponent
// ============================================================================

interface TableComponentProps {
  node: TableSnapshot
  context: InkRenderContext
}

const TableComponent: React.FC<TableComponentProps> = ({ node, context }) => {
  const { primitives, dispatch, isInteractive, terminalWidth } = context
  const { Table, ActionBar } = primitives

  // 행 선택 핸들러
  const handleSelectRow = useCallback(
    (rowId: string) => {
      dispatch({
        type: 'selectRow',
        nodeId: node.nodeId,
        rowId,
      })
    },
    [dispatch, node.nodeId]
  )

  // 정렬 변경 핸들러
  const handleSort = useCallback(
    (columnId: string) => {
      dispatch({
        type: 'sortColumn',
        nodeId: node.nodeId,
        columnId,
      })
    },
    [dispatch, node.nodeId]
  )

  // 페이지 변경 핸들러
  const handlePageChange = useCallback(
    (page: number) => {
      dispatch({
        type: 'changePage',
        nodeId: node.nodeId,
        page,
      })
    },
    [dispatch, node.nodeId]
  )

  // 액션 핸들러
  const handleAction = useCallback(
    (action: { type: string }) => {
      dispatch({
        type: 'triggerAction',
        nodeId: node.nodeId,
        actionType: action.type,
      })
    },
    [dispatch, node.nodeId]
  )

  return (
    <Box flexDirection="column">
      {/* 테이블 라벨 */}
      {node.label && (
        <Box marginBottom={1}>
          <Text bold color="cyan">
            {node.label}
          </Text>
          {node.selection.selectedRowIds.length > 0 && (
            <Text color="magenta">
              {' '}
              ({node.selection.selectedRowIds.length}개 선택됨)
            </Text>
          )}
        </Box>
      )}

      {/* 테이블 */}
      <Table
        columns={node.columns}
        rows={node.rows}
        selection={node.selection}
        pagination={node.pagination}
        sorting={node.sorting}
        onSelectRow={handleSelectRow}
        onSort={handleSort}
        onPageChange={handlePageChange}
        isFocused={isInteractive}
        terminalWidth={terminalWidth}
      />

      {/* 액션바 */}
      {node.actions.length > 0 && (
        <ActionBar
          actions={node.actions}
          onAction={handleAction}
          isFocused={isInteractive}
          selectedCount={node.selection.selectedRowIds.length}
        />
      )}
    </Box>
  )
}

export default TableRenderer
