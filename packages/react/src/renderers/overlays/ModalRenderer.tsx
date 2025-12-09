/**
 * ModalRenderer
 *
 * Modal 오버레이 인스턴스를 렌더링하는 Overlay Renderer
 */

import React from 'react'
import type { OverlayInstance } from '@manifesto-ai/view-snapshot'
import type { OverlayRenderer, RenderContext } from '../../types/renderer'

// ============================================================================
// ModalRenderer Implementation
// ============================================================================

/**
 * Modal 렌더 함수
 */
const renderModal = (instance: OverlayInstance, context: RenderContext): React.ReactNode => {
  const { primitives, dispatch, renderNode } = context

  /**
   * 모달 닫기 핸들러
   */
  const handleClose = () => {
    dispatch({
      type: 'closeOverlay',
      instanceId: instance.instanceId,
    })
  }

  /**
   * 모달 제출 핸들러
   */
  const handleSubmit = () => {
    dispatch({
      type: 'submitOverlay',
      instanceId: instance.instanceId,
    })
  }

  // boundData에서 안전하게 값 추출
  const boundData = instance.boundData ?? {}
  const boundTitle = typeof boundData.title === 'string' ? boundData.title : undefined
  const boundMessage = typeof boundData.message === 'string' ? boundData.message : undefined
  const boundConfirmLabel = typeof boundData.confirmLabel === 'string' ? boundData.confirmLabel : undefined
  const boundCancelLabel = typeof boundData.cancelLabel === 'string' ? boundData.cancelLabel : undefined

  // 모달 제목: boundData.title > template
  const title = boundTitle ?? instance.template

  // 기본 확인/취소 footer (awaitingResult일 때)
  const footer = instance.awaitingResult ? (
    <div className="mfs-modal-footer-actions">
      <primitives.Button variant="outline" onClick={handleClose}>
        {boundCancelLabel ?? '취소'}
      </primitives.Button>
      <primitives.Button variant="primary" onClick={handleSubmit}>
        {boundConfirmLabel ?? '확인'}
      </primitives.Button>
    </div>
  ) : undefined

  // 표시할 메시지 결정
  const displayMessage = instance.message ?? boundMessage

  return (
    <primitives.Modal
      key={instance.instanceId}
      open={true}
      onClose={handleClose}
      title={title}
      footer={footer}
    >
      {/* 메시지 렌더링 */}
      {displayMessage && <p className="mfs-modal-message">{displayMessage}</p>}

      {/* content 노드 렌더링 (존재 시) */}
      {instance.content && renderNode && renderNode(instance.content)}
    </primitives.Modal>
  )
}

// ============================================================================
// ModalRenderer Export
// ============================================================================

/**
 * ModalRenderer
 *
 * Modal 오버레이 → Modal UI 변환
 */
export const ModalRenderer: OverlayRenderer = {
  kind: 'modal',
  render: renderModal,
}

export default ModalRenderer
