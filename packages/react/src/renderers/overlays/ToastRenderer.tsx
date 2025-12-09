/**
 * ToastRenderer
 *
 * Toast 오버레이 인스턴스를 렌더링하는 Overlay Renderer
 */

import React from 'react'
import type { OverlayInstance } from '@manifesto-ai/view-snapshot'
import type { OverlayRenderer, RenderContext } from '../../types/renderer'
import type { ToastVariant } from '../../types/primitives'

// ============================================================================
// ToastRenderer Implementation
// ============================================================================

/**
 * Toast 렌더 함수
 */
const renderToast = (instance: OverlayInstance, context: RenderContext): React.ReactNode => {
  const { primitives, dispatch } = context

  /**
   * 토스트 닫기 핸들러
   */
  const handleClose = () => {
    dispatch({
      type: 'dismissToast',
      instanceId: instance.instanceId,
    })
  }

  // 메시지 생성 (boundData로 템플릿 치환)
  let message = instance.message ?? ''

  // boundData의 값으로 템플릿 변수 치환
  if (instance.boundData) {
    Object.entries(instance.boundData).forEach(([key, value]) => {
      message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value))
    })
  }

  return (
    <primitives.Toast
      key={instance.instanceId}
      open={true}
      message={message}
      variant={(instance.variant as ToastVariant) ?? 'info'}
      onClose={handleClose}
    />
  )
}

// ============================================================================
// ToastRenderer Export
// ============================================================================

/**
 * ToastRenderer
 *
 * Toast 오버레이 → Toast UI 변환
 */
export const ToastRenderer: OverlayRenderer = {
  kind: 'toast',
  render: renderToast,
}

export default ToastRenderer
