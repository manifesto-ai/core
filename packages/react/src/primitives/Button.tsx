/**
 * Button Primitive
 *
 * 기본 버튼 컴포넌트
 */

import React from 'react'
import type { ButtonPrimitiveProps } from '../types/primitives'

// ============================================================================
// Button Primitive Component
// ============================================================================

/**
 * Button Primitive
 */
export const Button: React.FC<ButtonPrimitiveProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  type = 'button',
  className,
}) => {
  const classNames = [
    'mfs-button',
    `mfs-button--${variant}`,
    `mfs-button--${size}`,
    loading && 'mfs-button--loading',
    disabled && 'mfs-button--disabled',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={classNames}
    >
      {loading && <span className="mfs-button-spinner" aria-hidden="true" />}
      <span className="mfs-button-content">{children}</span>
    </button>
  )
}

export default Button
