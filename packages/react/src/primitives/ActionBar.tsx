/**
 * ActionBar Primitive
 *
 * 액션 버튼 그룹 컴포넌트
 */

import React from 'react'
import type { ActionBarPrimitiveProps, ButtonVariant } from '../types/primitives'
import type { ViewAction } from '@manifesto-ai/view-snapshot'
import { Button } from './Button'

// ============================================================================
// Action Type to Button Variant Mapping
// ============================================================================

const ACTION_TYPE_VARIANTS: Record<string, ButtonVariant> = {
  submit: 'primary',
  reset: 'outline',
  cancel: 'ghost',
  delete: 'destructive',
  confirm: 'primary',
  save: 'primary',
  create: 'primary',
  edit: 'secondary',
  view: 'outline',
}

/**
 * 액션 타입에서 버튼 변형 추론
 */
const getButtonVariant = (action: ViewAction): ButtonVariant => {
  return ACTION_TYPE_VARIANTS[action.type] ?? 'secondary'
}

// ============================================================================
// ActionBar Primitive Component
// ============================================================================

/**
 * ActionBar Primitive
 *
 * ViewAction 배열을 버튼 그룹으로 렌더링합니다.
 */
export const ActionBar: React.FC<ActionBarPrimitiveProps> = ({
  actions,
  onAction,
  align = 'right',
  className,
}) => {
  if (actions.length === 0) {
    return null
  }

  const classNames = [
    'mfs-action-bar',
    `mfs-action-bar--${align}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classNames}>
      {actions.map((action, index) => (
        <Button
          key={action.type + index}
          variant={getButtonVariant(action)}
          onClick={() => onAction(action)}
          type={action.type === 'submit' ? 'submit' : 'button'}
        >
          {action.label ?? action.type}
        </Button>
      ))}
    </div>
  )
}

export default ActionBar
