/**
 * OverlayStack
 *
 * 오버레이 인스턴스들을 스택으로 렌더링
 *
 * 책임:
 * - PageSnapshot.overlays 순회
 * - 각 오버레이에 맞는 OverlayRenderer 조회 및 실행
 * - 토스트 컨테이너 분리 관리
 */

import React from 'react'
import type { OverlayInstance } from '@manifesto-ai/view-snapshot'
import type { RenderContext } from '../types/renderer'
import { useManifestoContext } from './ManifestoContext'

// ============================================================================
// Props
// ============================================================================

export interface OverlayStackProps {
  /** 추가 CSS 클래스 */
  className?: string
}

// ============================================================================
// OverlayStack Component
// ============================================================================

/**
 * OverlayStack
 *
 * PageSnapshot의 overlays를 렌더링합니다.
 * Modal, Dialog, Toast를 분리하여 적절한 위치에 렌더링합니다.
 *
 * @example
 * ```tsx
 * // PageRenderer 내부에서 자동으로 사용됨
 * <OverlayStack />
 * ```
 */
export const OverlayStack: React.FC<OverlayStackProps> = ({ className }) => {
  const { engine, snapshot, registry, primitives, dispatch } = useManifestoContext()

  // 오버레이를 타입별로 분류
  const modals = snapshot.overlays.filter((o) => o.kind === 'modal')
  const dialogs = snapshot.overlays.filter((o) => o.kind === 'dialog')
  const toasts = snapshot.overlays.filter((o) => o.kind === 'toast')

  /**
   * 노드 렌더링 헬퍼 (오버레이 content 렌더링용)
   */
  const renderNode = (node: import('@manifesto-ai/view-snapshot').ViewSnapshotNode): React.ReactNode => {
    const nodeRenderer = registry.nodes.get(node.kind)

    if (!nodeRenderer) {
      console.warn(`No renderer found for node kind: ${node.kind}`, node)
      return null
    }

    const nodeContext: RenderContext = {
      engine,
      primitives,
      registry,
      path: [snapshot.nodeId, node.nodeId],
      depth: 2,
      dispatch,
      renderNode,
    }

    return (
      <React.Fragment key={node.nodeId}>
        {nodeRenderer.render(node, nodeContext)}
      </React.Fragment>
    )
  }

  /**
   * 단일 오버레이 렌더링
   */
  const renderOverlay = (overlay: OverlayInstance) => {
    const renderer = registry.overlays.get(overlay.kind)

    if (!renderer) {
      console.warn(`No overlay renderer found for kind: ${overlay.kind}`, overlay)
      return null
    }

    // RenderContext 생성
    const context: RenderContext = {
      engine,
      primitives,
      registry,
      path: [snapshot.nodeId, overlay.instanceId],
      depth: 1,
      dispatch,
      renderNode,
    }

    return (
      <React.Fragment key={overlay.instanceId}>
        {renderer.render(overlay, context)}
      </React.Fragment>
    )
  }

  const stackClassNames = ['mfs-overlay-stack', className].filter(Boolean).join(' ')

  return (
    <>
      {/* Modal & Dialog 스택 */}
      {(modals.length > 0 || dialogs.length > 0) && (
        <div className={stackClassNames}>
          {/* Modals */}
          {modals.map(renderOverlay)}

          {/* Dialogs (Modal 위에 표시) */}
          {dialogs.map(renderOverlay)}
        </div>
      )}

      {/* Toast 컨테이너 (별도 위치) */}
      {toasts.length > 0 && (
        <div className="mfs-toast-container">
          {toasts.map(renderOverlay)}
        </div>
      )}
    </>
  )
}

export default OverlayStack
