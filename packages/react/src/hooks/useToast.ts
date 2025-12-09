/**
 * useToast
 *
 * 토스트 알림 Hook
 * 성공, 에러, 경고, 정보 토스트를 표시하는 API를 제공합니다.
 */

import { useCallback } from 'react'
import { useManifestoContext } from '../composition/ManifestoContext'

// ============================================================================
// Types
// ============================================================================

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface ToastOptions {
  /** 메시지 */
  message: string
  /** 변형 (기본값: 'info') */
  variant?: ToastVariant
  /** 자동 닫기 시간 (ms, 기본값: 5000) */
  duration?: number
}

// ============================================================================
// Hook
// ============================================================================

/**
 * useToast
 *
 * 토스트 알림을 표시하는 API를 제공합니다.
 *
 * @example
 * ```tsx
 * function OrderForm() {
 *   const toast = useToast()
 *
 *   const handleSubmit = async () => {
 *     try {
 *       await saveOrder()
 *       toast.success('주문이 저장되었습니다.')
 *     } catch (error) {
 *       toast.error('주문 저장에 실패했습니다.')
 *     }
 *   }
 *
 *   return (...)
 * }
 * ```
 */
export const useToast = () => {
  const { dispatch } = useManifestoContext()

  /**
   * 토스트 표시 (일반)
   */
  const show = useCallback(
    (options: ToastOptions) => {
      return dispatch({
        type: 'openOverlay',
        template: `toast-${options.variant ?? 'info'}`,
        boundData: {
          message: options.message,
          variant: options.variant ?? 'info',
          duration: options.duration ?? 5000,
        },
      })
    },
    [dispatch]
  )

  /**
   * 성공 토스트
   */
  const success = useCallback(
    (message: string, duration?: number) => {
      return show({ message, variant: 'success', duration })
    },
    [show]
  )

  /**
   * 에러 토스트
   */
  const error = useCallback(
    (message: string, duration?: number) => {
      return show({ message, variant: 'error', duration })
    },
    [show]
  )

  /**
   * 경고 토스트
   */
  const warning = useCallback(
    (message: string, duration?: number) => {
      return show({ message, variant: 'warning', duration })
    },
    [show]
  )

  /**
   * 정보 토스트
   */
  const info = useCallback(
    (message: string, duration?: number) => {
      return show({ message, variant: 'info', duration })
    },
    [show]
  )

  /**
   * 토스트 닫기
   */
  const dismiss = useCallback(
    (instanceId: string) => {
      return dispatch({
        type: 'dismissToast',
        instanceId,
      })
    },
    [dispatch]
  )

  return {
    show,
    success,
    error,
    warning,
    info,
    dismiss,
  }
}

export default useToast
