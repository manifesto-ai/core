/**
 * DialogRenderer
 *
 * Dialog 오버레이 인스턴스를 렌더링하는 Overlay Renderer
 */

import React from 'react'
import type { OverlayInstance } from '@manifesto-ai/view-snapshot'
import type { OverlayRenderer, RenderContext } from '../../types/renderer'

// ============================================================================
// DialogRenderer Implementation
// ============================================================================

/**
 * Dialog 렌더 함수
 */
const renderDialog = (instance: OverlayInstance, context: RenderContext): React.ReactNode => {
  const { primitives, dispatch } = context

  /**
   * 확인 핸들러
   */
  const handleConfirm = () => {
    dispatch({
      type: 'confirmDialog',
      instanceId: instance.instanceId,
    })
  }

  /**
   * 취소 핸들러
   */
  const handleCancel = () => {
    dispatch({
      type: 'closeOverlay',
      instanceId: instance.instanceId,
    })
  }

  // 메시지 생성 (boundData로 템플릿 치환)
  let message = instance.message ?? (instance.boundData?.message as string) ?? ''

  // boundData의 값으로 템플릿 변수 치환
  if (instance.boundData) {
    Object.entries(instance.boundData).forEach(([key, value]) => {
      message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value))
    })
  }

  // 제목, 버튼 라벨 추출
  const title = (instance.boundData?.title as string) ?? instance.template
  const confirmLabel = (instance.boundData?.confirmLabel as string) ?? '확인'
  const cancelLabel = (instance.boundData?.cancelLabel as string) ?? '취소'

  return (
    <primitives.Dialog
      key={instance.instanceId}
      open={true}
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      variant="default"
    />
  )
}

// ============================================================================
// DialogRenderer Export
// ============================================================================

/**
 * DialogRenderer
 *
 * Dialog 오버레이 → Dialog UI 변환
 */
export const DialogRenderer: OverlayRenderer = {
  kind: 'dialog',
  render: renderDialog,
}

export default DialogRenderer
