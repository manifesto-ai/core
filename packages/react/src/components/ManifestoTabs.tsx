/**
 * ManifestoTabs
 *
 * 선언적 탭 등록 컴포넌트 (High-Level DX)
 *
 * ManifestoPage 내에서 사용하여 탭 네비게이션을 등록합니다.
 */

import React, { useEffect, useRef } from 'react'
import type { TabItem, TabsSnapshot } from '@manifesto-ai/view-snapshot'
import { useEngine, useSnapshot } from '../composition/ManifestoContext'

// ============================================================================
// Props
// ============================================================================

export interface TabConfig {
  /** 탭 ID */
  id: string
  /** 탭 라벨 */
  label: string
  /** 비활성화 여부 */
  disabled?: boolean
}

export interface ManifestoTabsProps {
  /** 노드 ID */
  nodeId: string
  /** 탭 라벨 (선택적) */
  label?: string
  /** 탭 목록 */
  tabs: TabConfig[]
  /** 초기 활성 탭 ID */
  defaultActiveTab?: string
  /** 탭 변경 핸들러 */
  onTabChange?: (tabId: string) => void
}

// ============================================================================
// ManifestoTabs Component
// ============================================================================

/**
 * ManifestoTabs
 *
 * ManifestoPage 내에서 사용하여 탭 네비게이션을 선언적으로 등록합니다.
 * 이 컴포넌트 자체는 아무것도 렌더링하지 않습니다.
 * 실제 렌더링은 PageRenderer가 담당합니다.
 *
 * @example
 * ```tsx
 * <ManifestoPage pageId="orders" title="주문 관리">
 *   <ManifestoTabs
 *     nodeId="order-tabs"
 *     tabs={[
 *       { id: 'all', label: '전체' },
 *       { id: 'pending', label: '대기 중' },
 *       { id: 'completed', label: '완료됨' },
 *     ]}
 *     defaultActiveTab="all"
 *     onTabChange={(tabId) => console.log('Tab changed:', tabId)}
 *   />
 * </ManifestoPage>
 * ```
 */
export const ManifestoTabs: React.FC<ManifestoTabsProps> = ({
  nodeId,
  label,
  tabs,
  defaultActiveTab,
  onTabChange,
}) => {
  const engine = useEngine()
  const snapshot = useSnapshot()

  // Stable refs for objects to avoid infinite loops
  const tabsRef = useRef(tabs)
  const labelRef = useRef(label)
  const defaultActiveTabRef = useRef(defaultActiveTab)

  useEffect(() => {
    tabsRef.current = tabs
    labelRef.current = label
    defaultActiveTabRef.current = defaultActiveTab
  })

  // ========================================================================
  // Registration
  // ========================================================================

  useEffect(() => {
    // TabConfig를 TabItem으로 변환
    const tabItems: TabItem[] = tabsRef.current.map((tab) => ({
      id: tab.id,
      label: tab.label,
      disabled: tab.disabled,
    }))

    // Engine에 Tabs 등록
    engine.registerTabs(nodeId, tabItems, {
      label: labelRef.current,
      activeTabId: defaultActiveTabRef.current,
    })

    return () => {
      // 언마운트 시 정리
      engine.unregisterTabs(nodeId)
    }
    // Only re-run when nodeId or engine changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, engine])

  // ========================================================================
  // Tab Change Detection
  // ========================================================================

  const prevActiveTabRef = useRef<string | null>(null)

  useEffect(() => {
    if (!onTabChange) return

    // 현재 스냅샷에서 tabs 노드 찾기
    const tabsNode = snapshot.children.find(
      (child) => child.kind === 'tabs' && child.nodeId === nodeId
    ) as TabsSnapshot | undefined

    if (tabsNode) {
      const currentActiveTab = tabsNode.activeTabId

      // 이전 값이 있고, 현재 값과 다르면 콜백 호출
      if (prevActiveTabRef.current !== null && prevActiveTabRef.current !== currentActiveTab) {
        onTabChange(currentActiveTab)
      }

      prevActiveTabRef.current = currentActiveTab
    }
  }, [snapshot, nodeId, onTabChange])

  // ========================================================================
  // Render
  // ========================================================================

  // 이 컴포넌트는 아무것도 렌더링하지 않음
  // 실제 탭 UI는 PageRenderer가 TabsRenderer를 통해 렌더링함
  return null
}

export default ManifestoTabs
