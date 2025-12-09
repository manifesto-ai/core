/**
 * TabsRenderer
 *
 * TabsSnapshot을 Tabs UI로 변환하는 Node Renderer
 *
 * 책임:
 * - 탭 네비게이션 UI 렌더링
 * - switchTab Intent 기반 탭 전환
 */

import React from 'react'
import type { TabsSnapshot } from '@manifesto-ai/view-snapshot'
import type { NodeRenderer, RenderContext } from '../types/renderer'

// ============================================================================
// TabsRenderer Implementation
// ============================================================================

/**
 * TabsSnapshot 렌더 함수
 */
const renderTabs = (node: TabsSnapshot, context: RenderContext): React.ReactNode => {
  const { primitives, dispatch } = context

  /**
   * 탭 변경 핸들러
   * switchTab Intent를 dispatch
   */
  const handleTabChange = (tabId: string) => {
    dispatch({
      type: 'switchTab',
      nodeId: node.nodeId,
      tabId,
    })
  }

  const tabsClassNames = ['mfs-tabs-renderer'].filter(Boolean).join(' ')

  return (
    <div
      className={tabsClassNames}
      data-node-id={node.nodeId}
      data-node-kind="tabs"
    >
      <primitives.Tabs
        tabs={node.tabs}
        activeTabId={node.activeTabId}
        onTabChange={handleTabChange}
      />
    </div>
  )
}

// ============================================================================
// TabsRenderer Export
// ============================================================================

/**
 * TabsRenderer
 *
 * TabsSnapshot → Tabs UI 변환
 */
export const TabsRenderer: NodeRenderer<TabsSnapshot> = {
  kind: 'tabs',
  render: renderTabs,
}

export default TabsRenderer
