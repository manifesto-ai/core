/**
 * Overlay Primitives
 *
 * 오버레이 관련 컴포넌트들
 * - Modal: 모달 다이얼로그
 * - Dialog: 확인/취소 다이얼로그
 * - Toast: 토스트 알림
 */

import React, { useEffect, useRef } from 'react'
import type {
  ModalPrimitiveProps,
  DialogPrimitiveProps,
  ToastPrimitiveProps,
} from '../types/primitives'
import { Button } from './Button'

// ============================================================================
// Modal Primitive Component
// ============================================================================

/**
 * Modal Primitive
 *
 * 콘텐츠를 표시하는 모달 다이얼로그
 */
export const Modal: React.FC<ModalPrimitiveProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnOverlayClick = true,
  className,
}) => {
  const modalRef = useRef<HTMLDivElement>(null)

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // 열릴 때 포커스 트랩
  useEffect(() => {
    if (open && modalRef.current) {
      const previousActiveElement = document.activeElement as HTMLElement
      modalRef.current.focus()

      return () => {
        previousActiveElement?.focus()
      }
    }
  }, [open])

  // 스크롤 잠금
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [open])

  if (!open) return null

  const handleOverlayClick = (event: React.MouseEvent) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      onClose()
    }
  }

  const classNames = [
    'mfs-modal',
    `mfs-modal--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="mfs-modal-overlay" onClick={handleOverlayClick}>
      <div
        ref={modalRef}
        className={classNames}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex={-1}
      >
        {title && (
          <div className="mfs-modal-header">
            <h2 id="modal-title" className="mfs-modal-title">{title}</h2>
            <button
              type="button"
              className="mfs-modal-close"
              onClick={onClose}
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        )}
        <div className="mfs-modal-body">{children}</div>
        {footer && <div className="mfs-modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

// ============================================================================
// Dialog Primitive Component
// ============================================================================

/**
 * Dialog Primitive
 *
 * 확인/취소 다이얼로그
 */
export const Dialog: React.FC<DialogPrimitiveProps> = ({
  open,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  onConfirm,
  onCancel,
  variant = 'default',
  className,
}) => {
  // ESC 키로 취소
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  // 스크롤 잠금
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [open])

  if (!open) return null

  const classNames = [
    'mfs-dialog',
    `mfs-dialog--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="mfs-dialog-overlay">
      <div
        className={classNames}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={title ? 'dialog-title' : undefined}
        aria-describedby="dialog-message"
      >
        {title && <h2 id="dialog-title" className="mfs-dialog-title">{title}</h2>}
        <p id="dialog-message" className="mfs-dialog-message">{message}</p>
        <div className="mfs-dialog-actions">
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={variant === 'destructive' ? 'destructive' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Toast Primitive Component
// ============================================================================

/**
 * Toast 변형에 따른 아이콘
 */
const TOAST_ICONS = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
} as const

/**
 * Toast Primitive
 *
 * 토스트 알림
 */
export const Toast: React.FC<ToastPrimitiveProps> = ({
  open,
  message,
  variant = 'info',
  onClose,
  action,
  className,
}) => {
  if (!open) return null

  const classNames = [
    'mfs-toast',
    `mfs-toast--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classNames} role="alert" aria-live="polite">
      <span className="mfs-toast-icon">{TOAST_ICONS[variant]}</span>
      <span className="mfs-toast-message">{message}</span>
      {action && (
        <button
          type="button"
          className="mfs-toast-action"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        className="mfs-toast-close"
        onClick={onClose}
        aria-label="닫기"
      >
        ✕
      </button>
    </div>
  )
}

export default Modal
