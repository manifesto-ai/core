/**
 * useOverlay
 *
 * 오버레이 관리 Hook
 * Modal, Dialog, Toast를 열고 닫는 API를 제공합니다.
 */

import { useCallback } from 'react'
import { useManifestoContext } from '../composition/ManifestoContext'

// ============================================================================
// Types
// ============================================================================

/**
 * 확인 다이얼로그 옵션
 */
export interface ConfirmOptions {
  /** 다이얼로그 제목 */
  title?: string
  /** 다이얼로그 메시지 */
  message: string
  /** 확인 버튼 라벨 (기본: '확인') */
  confirmLabel?: string
  /** 취소 버튼 라벨 (기본: '취소') */
  cancelLabel?: string
}

// ============================================================================
// Hook
// ============================================================================

/**
 * useOverlay
 *
 * 오버레이(Modal, Dialog)를 열고 닫는 API를 제공합니다.
 *
 * @example
 * ```tsx
 * function OrderListActions() {
 *   const overlay = useOverlay()
 *
 *   const handleViewDetail = (orderId: string) => {
 *     overlay.open('order-detail-modal', { orderId })
 *   }
 *
 *   const handleDelete = async (orderId: string) => {
 *     const confirmed = await overlay.confirm({
 *       title: '삭제 확인',
 *       message: '정말 삭제하시겠습니까?',
 *     })
 *
 *     if (confirmed) {
 *       // 삭제 처리
 *     }
 *   }
 *
 *   return (...)
 * }
 * ```
 */
export const useOverlay = () => {
  const { dispatch, engine } = useManifestoContext()

  /**
   * 오버레이 열기 (템플릿 기반)
   *
   * @param template - 오버레이 템플릿 ID
   * @param boundData - 템플릿에 바인딩할 데이터
   * @returns 열린 오버레이의 인스턴스 ID
   */
  const open = useCallback(
    async (template: string, boundData?: Record<string, unknown>): Promise<string | null> => {
      const overlayManager = engine.getOverlayManager()

      // 오버레이 열기
      const instance = overlayManager.openWithTemplate(template, {
        boundData,
      })

      if (!instance) {
        console.warn(`Template "${template}" not found`)
        return null
      }

      // 스냅샷 갱신을 위해 dispatch
      await dispatch({
        type: 'openOverlay',
        template,
        boundData,
      })

      return instance.instanceId
    },
    [dispatch, engine]
  )

  /**
   * 오버레이 닫기
   *
   * @param instanceId - 오버레이 인스턴스 ID
   */
  const close = useCallback(
    (instanceId: string) => {
      return dispatch({
        type: 'closeOverlay',
        instanceId,
      })
    },
    [dispatch]
  )

  /**
   * 오버레이 제출
   *
   * @param instanceId - 오버레이 인스턴스 ID
   */
  const submit = useCallback(
    (instanceId: string) => {
      return dispatch({
        type: 'submitOverlay',
        instanceId,
      })
    },
    [dispatch]
  )

  /**
   * 확인 다이얼로그 열기 (간편 API)
   *
   * @returns 사용자가 확인했는지 여부 (Promise)
   *
   * @example
   * ```tsx
   * const confirmed = await overlay.confirm({
   *   title: '삭제 확인',
   *   message: '정말 삭제하시겠습니까?',
   * })
   *
   * if (confirmed) {
   *   // 삭제 처리
   * }
   * ```
   */
  const confirm = useCallback(
    async (options: ConfirmOptions): Promise<boolean> => {
      const overlayManager = engine.getOverlayManager()

      // 확인 다이얼로그 열기
      const instance = overlayManager.openWithTemplate('confirm-dialog', {
        boundData: {
          title: options.title ?? '확인',
          message: options.message,
          confirmLabel: options.confirmLabel ?? '확인',
          cancelLabel: options.cancelLabel ?? '취소',
        },
      })

      if (!instance) {
        console.warn('confirm-dialog template not found')
        return false
      }

      // 사용자 응답 대기
      const result = await overlayManager.waitForResult(instance.instanceId)

      return result.type === 'confirmed'
    },
    [engine]
  )

  /**
   * 오버레이 결과 대기
   *
   * @param instanceId - 오버레이 인스턴스 ID
   * @returns 오버레이 결과
   */
  const waitForResult = useCallback(
    (instanceId: string) => {
      const overlayManager = engine.getOverlayManager()
      return overlayManager.waitForResult(instanceId)
    },
    [engine]
  )

  return {
    open,
    close,
    submit,
    confirm,
    waitForResult,
  }
}

export default useOverlay
