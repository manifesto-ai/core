/**
 * useTableState
 *
 * 특정 테이블의 상태를 구독하는 Hook
 */

import { useMemo } from 'react'
import type { TableSnapshot, TableRow } from '@manifesto-ai/view-snapshot'
import { useSnapshot } from '../composition/ManifestoContext'

// ============================================================================
// Hook
// ============================================================================

/**
 * useTableState
 *
 * 특정 테이블 노드의 상태를 가져옵니다.
 *
 * @param nodeId - 테이블 노드 ID
 * @returns 테이블 스냅샷 또는 null (테이블이 없는 경우)
 *
 * @example
 * ```tsx
 * function OrderTableSummary() {
 *   const tableState = useTableState('order-table')
 *
 *   if (!tableState) return null
 *
 *   return (
 *     <div>
 *       <p>선택됨: {tableState.selection.selectedRowIds.length}개</p>
 *       <p>페이지: {tableState.pagination.currentPage} / {tableState.pagination.totalPages}</p>
 *     </div>
 *   )
 * }
 * ```
 */
export const useTableState = (nodeId: string): TableSnapshot | null => {
  const snapshot = useSnapshot()

  const tableSnapshot = useMemo(() => {
    const node = snapshot.children.find(
      (child) => child.nodeId === nodeId && child.kind === 'table'
    )
    return node as TableSnapshot | undefined ?? null
  }, [snapshot, nodeId])

  return tableSnapshot
}

/**
 * useSelectedRows
 *
 * 특정 테이블의 선택된 행들을 가져옵니다.
 *
 * @param nodeId - 테이블 노드 ID
 * @returns 선택된 행 배열
 */
export const useSelectedRows = (nodeId: string): readonly TableRow[] => {
  const tableSnapshot = useTableState(nodeId)

  return useMemo(() => {
    if (!tableSnapshot) return []

    const selectedIds = new Set(tableSnapshot.selection.selectedRowIds)
    return tableSnapshot.rows.filter((row) => selectedIds.has(row.id))
  }, [tableSnapshot])
}

/**
 * useTablePagination
 *
 * 특정 테이블의 페이지네이션 상태를 가져옵니다.
 *
 * @param nodeId - 테이블 노드 ID
 */
export const useTablePagination = (nodeId: string) => {
  const tableSnapshot = useTableState(nodeId)

  return useMemo(() => {
    if (!tableSnapshot) {
      return {
        currentPage: 1,
        totalPages: 0,
        pageSize: 10,
        totalItems: 0,
      }
    }

    return tableSnapshot.pagination
  }, [tableSnapshot])
}

export default useTableState
