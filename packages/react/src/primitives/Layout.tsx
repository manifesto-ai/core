/**
 * Layout Primitives
 *
 * 레이아웃 관련 컴포넌트들
 * - Card: 카드 컨테이너
 * - Stack: 스택 레이아웃
 */

import React from 'react'
import type { CardPrimitiveProps, StackPrimitiveProps } from '../types/primitives'

// ============================================================================
// Card Primitive Component
// ============================================================================

/**
 * Card Primitive
 *
 * 콘텐츠를 감싸는 카드 컨테이너
 */
export const Card: React.FC<CardPrimitiveProps> = ({
  children,
  title,
  description,
  headerActions,
  footer,
  className,
}) => {
  const hasHeader = title || description || headerActions

  const classNames = ['mfs-card', className].filter(Boolean).join(' ')

  return (
    <div className={classNames}>
      {hasHeader && (
        <div className="mfs-card-header">
          <div className="mfs-card-header-content">
            {title && <h3 className="mfs-card-title">{title}</h3>}
            {description && <p className="mfs-card-description">{description}</p>}
          </div>
          {headerActions && <div className="mfs-card-header-actions">{headerActions}</div>}
        </div>
      )}
      <div className="mfs-card-body">{children}</div>
      {footer && <div className="mfs-card-footer">{footer}</div>}
    </div>
  )
}

// ============================================================================
// Stack Primitive Component
// ============================================================================

/**
 * Gap 값을 CSS로 변환
 */
const GAP_MAP = {
  none: '0',
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
} as const

/**
 * Stack Primitive
 *
 * 자식 요소들을 수직 또는 수평으로 배치
 */
export const Stack: React.FC<StackPrimitiveProps> = ({
  children,
  direction = 'vertical',
  align = 'stretch',
  gap = 'md',
  className,
}) => {
  const classNames = [
    'mfs-stack',
    `mfs-stack--${direction}`,
    `mfs-stack--align-${align}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const style: React.CSSProperties = {
    gap: GAP_MAP[gap],
  }

  return (
    <div className={classNames} style={style}>
      {children}
    </div>
  )
}

export default Card
