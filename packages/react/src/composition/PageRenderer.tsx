/**
 * PageRenderer
 *
 * PageSnapshot을 전체 UI 트리로 렌더링하는 최상위 렌더러
 *
 * 책임:
 * - PageSnapshot.children 순회
 * - 각 노드에 맞는 NodeRenderer 조회 및 실행
 * - RenderContext 생성 및 전파
 * - OverlayStack 렌더링
 */

import React, { useCallback } from 'react'
import type { ViewSnapshotNode } from '@manifesto-ai/view-snapshot'
import type { RenderContext } from '../types/renderer'
import { useManifestoContext } from './ManifestoContext'
import { OverlayStack } from './OverlayStack'

// ============================================================================
// Props
// ============================================================================

export interface PageRendererProps {
  /** 추가 CSS 클래스 */
  className?: string
}

// ============================================================================
// PageRenderer Component
// ============================================================================

/**
 * PageRenderer
 *
 * PageSnapshot의 children을 순회하며 각 노드를 렌더링합니다.
 * Registry에서 노드 종류에 맞는 렌더러를 조회하여 실행합니다.
 *
 * @example
 * ```tsx
 * <ManifestoProvider engine={engine}>
 *   <PageRenderer />
 * </ManifestoProvider>
 * ```
 */
export const PageRenderer: React.FC<PageRendererProps> = ({ className }) => {
  const { engine, snapshot, registry, primitives, dispatch } = useManifestoContext()

  // ========================================================================
  // Node Rendering
  // ========================================================================

  /**
   * 단일 노드 렌더링 (내부 구현)
   */
  const renderNodeInternal = useCallback(
    (node: ViewSnapshotNode, path: string[], depth: number, parent?: ViewSnapshotNode): React.ReactNode => {
      // Registry에서 렌더러 조회
      const renderer = registry.nodes.get(node.kind)

      if (!renderer) {
        // 렌더러가 없으면 경고 후 스킵
        console.warn(`No renderer found for node kind: ${node.kind}`, node)
        return null
      }

      // renderNode 헬퍼 함수 (context에서 사용)
      const renderChildNode = (childNode: ViewSnapshotNode): React.ReactNode => {
        return renderNodeInternal(
          childNode,
          [...path, node.nodeId],
          depth + 1,
          node
        )
      }

      // RenderContext 생성
      const context: RenderContext = {
        engine,
        primitives,
        registry,
        path: [...path, node.nodeId],
        depth: depth + 1,
        dispatch,
        parent,
        renderNode: renderChildNode,
      }

      // 렌더러 실행
      return (
        <React.Fragment key={node.nodeId}>
          {renderer.render(node, context)}
        </React.Fragment>
      )
    },
    [engine, primitives, dispatch, registry]
  )

  // ========================================================================
  // Render
  // ========================================================================

  const pageClassNames = [
    'mfs-page',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={pageClassNames}
      data-page-id={snapshot.nodeId}
      data-node-kind="page"
    >
      {/* 페이지 라벨 (선택적) */}
      {snapshot.label && (
        <header className="mfs-page-header">
          <h1 className="mfs-page-title">{snapshot.label}</h1>
        </header>
      )}

      {/* 자식 노드 렌더링 */}
      <main className="mfs-page-content">
        {snapshot.children.map((node) => renderNodeInternal(node, [], 0))}
      </main>

      {/* 오버레이 스택 */}
      <OverlayStack />
    </div>
  )
}

export default PageRenderer
