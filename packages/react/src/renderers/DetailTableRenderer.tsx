/**
 * DetailTableRenderer
 *
 * DetailTableSnapshot을 DetailTable UI로 변환하는 Node Renderer
 *
 * 책임:
 * - 상세 정보를 key-value 형태로 표시
 * - 버튼 액션 Intent 바인딩
 */

import React from 'react'
import type { DetailTableSnapshot, ViewAction } from '@manifesto-ai/view-snapshot'
import type { NodeRenderer, RenderContext } from '../types/renderer'

// ============================================================================
// DetailTableRenderer Implementation
// ============================================================================

/**
 * DetailTableSnapshot 렌더 함수
 */
const renderDetailTable = (node: DetailTableSnapshot, context: RenderContext): React.ReactNode => {
  const { primitives, dispatch } = context

  /**
   * 행 액션 핸들러
   */
  const handleRowAction = (action: ViewAction) => {
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

  const detailTableClassNames = ['mfs-detail-table-renderer'].filter(Boolean).join(' ')

  return (
    <div
      className={detailTableClassNames}
      data-node-id={node.nodeId}
      data-node-kind="detailTable"
    >
      {/* 테이블 레벨 액션 바 */}
      {node.actions.length > 0 && (
        <div className="mfs-detail-table-renderer-actions">
          <primitives.ActionBar
            actions={node.actions}
            onAction={handleTableAction}
          />
        </div>
      )}

      {/* 상세 테이블 */}
      <primitives.DetailTable
        rows={node.rows}
        onRowAction={handleRowAction}
      />
    </div>
  )
}

// ============================================================================
// DetailTableRenderer Export
// ============================================================================

/**
 * DetailTableRenderer
 *
 * DetailTableSnapshot → DetailTable UI 변환
 */
export const DetailTableRenderer: NodeRenderer<DetailTableSnapshot> = {
  kind: 'detailTable',
  render: renderDetailTable,
}

export default DetailTableRenderer
