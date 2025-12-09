/**
 * ActionBar Primitive
 *
 * ViewAction 목록을 터미널 단축키 힌트로 렌더링
 * 예: [S]ubmit  [C]ancel  [R]eset
 */

import React from 'react'
import { Box, Text, useInput } from 'ink'
import type { ViewAction } from '@manifesto-ai/view-snapshot'

// ============================================================================
// Props
// ============================================================================

export interface ActionBarProps {
  /** 액션 목록 */
  actions: readonly ViewAction[]
  /** 액션 실행 핸들러 */
  onAction?: (action: ViewAction) => void
  /** 포커스 여부 */
  isFocused?: boolean
  /** 선택된 행 수 (조건부 액션용) */
  selectedCount?: number
}

// ============================================================================
// ActionBar Component
// ============================================================================

export const ActionBar: React.FC<ActionBarProps> = ({
  actions,
  onAction,
  isFocused = false,
  selectedCount = 0,
}) => {
  // 단축키 매핑 생성
  const actionKeyMap = new Map<string, ViewAction>()
  const displayActions: { action: ViewAction; shortcut: string }[] = []

  for (const action of actions) {
    // 조건 체크
    if (action.condition?.requiresSelection && selectedCount === 0) {
      continue
    }
    if (action.condition?.minSelection && selectedCount < action.condition.minSelection) {
      continue
    }
    if (action.condition?.maxSelection && selectedCount > action.condition.maxSelection) {
      continue
    }

    // 단축키 추출 (라벨의 첫 글자 또는 타입의 첫 글자)
    const label = action.label || action.type
    const shortcut = label.charAt(0).toLowerCase()

    if (!actionKeyMap.has(shortcut)) {
      actionKeyMap.set(shortcut, action)
      displayActions.push({ action, shortcut })
    }
  }

  // 키보드 입력 처리
  useInput(
    (input) => {
      const action = actionKeyMap.get(input.toLowerCase())
      if (action) {
        onAction?.(action)
      }
    },
    { isActive: isFocused }
  )

  if (displayActions.length === 0) {
    return null
  }

  return (
    <Box marginTop={1} gap={2}>
      {displayActions.map(({ action, shortcut }) => (
        <ActionButton
          key={action.type}
          action={action}
          shortcut={shortcut}
          isFocused={isFocused}
        />
      ))}
    </Box>
  )
}

// ============================================================================
// ActionButton Component
// ============================================================================

interface ActionButtonProps {
  action: ViewAction
  shortcut: string
  isFocused?: boolean
}

const ActionButton: React.FC<ActionButtonProps> = ({ action, shortcut, isFocused }) => {
  const label = action.label || action.type
  const highlightedLabel = highlightShortcut(label, shortcut)

  // 액션 타입에 따른 색상
  const color = getActionColor(action.type)

  return (
    <Box>
      <Text color={isFocused ? color : 'gray'}>
        [{shortcut.toUpperCase()}]{highlightedLabel}
      </Text>
    </Box>
  )
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 단축키를 하이라이트한 라벨 생성
 */
function highlightShortcut(label: string, shortcut: string): string {
  const index = label.toLowerCase().indexOf(shortcut.toLowerCase())
  if (index === 0) {
    // 첫 글자면 나머지만 반환
    return label.slice(1)
  }
  return label
}

/**
 * 액션 타입에 따른 색상 반환
 */
function getActionColor(actionType: string): string {
  switch (actionType.toLowerCase()) {
    case 'submit':
    case 'save':
    case 'confirm':
      return 'green'
    case 'delete':
    case 'remove':
    case 'cancel':
      return 'red'
    case 'reset':
    case 'clear':
      return 'yellow'
    case 'search':
    case 'filter':
      return 'blue'
    case 'export':
    case 'download':
      return 'cyan'
    default:
      return 'white'
  }
}

export default ActionBar
