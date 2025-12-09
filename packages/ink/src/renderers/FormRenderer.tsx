/**
 * FormRenderer
 *
 * FormSnapshot을 Ink UI로 렌더링
 */

import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import type { FormSnapshot } from '@manifesto-ai/view-snapshot'
import type { InkNodeRenderer, InkRenderContext } from '../types/renderer'

// ============================================================================
// FormRenderer
// ============================================================================

export const FormRenderer: InkNodeRenderer<FormSnapshot> = {
  kind: 'form',
  render: (node, context) => {
    return <FormComponent node={node} context={context} />
  },
}

// ============================================================================
// FormComponent
// ============================================================================

interface FormComponentProps {
  node: FormSnapshot
  context: InkRenderContext
}

const FormComponent: React.FC<FormComponentProps> = ({ node, context }) => {
  const { primitives, dispatch, isInteractive } = context
  const { Field, ActionBar } = primitives

  // 현재 포커스된 필드 인덱스
  const [focusIndex, setFocusIndex] = useState(0)

  // 보이는 필드만 필터링
  const visibleFields = node.fields.filter((f) => !f.hidden)

  // 키보드 네비게이션
  useInput(
    (_input, key) => {
      if (!isInteractive) return

      if (key.tab || key.downArrow) {
        setFocusIndex((prev) => Math.min(visibleFields.length, prev + 1))
      } else if (key.upArrow || (key.tab && key.shift)) {
        setFocusIndex((prev) => Math.max(0, prev - 1))
      }
    },
    { isActive: isInteractive }
  )

  // 필드 값 변경 핸들러
  const handleFieldChange = useCallback(
    (fieldId: string) => (value: unknown) => {
      dispatch({
        type: 'setFieldValue',
        nodeId: node.nodeId,
        fieldId,
        value,
      })
    },
    [dispatch, node.nodeId]
  )

  // 액션 핸들러
  const handleAction = useCallback(
    (action: { type: string }) => {
      if (action.type === 'submit') {
        dispatch({
          type: 'submit',
          nodeId: node.nodeId,
        })
      } else if (action.type === 'reset') {
        dispatch({
          type: 'reset',
          nodeId: node.nodeId,
        })
      } else {
        // 커스텀 액션
        dispatch({
          type: 'triggerAction',
          nodeId: node.nodeId,
          actionType: action.type,
        })
      }
    },
    [dispatch, node.nodeId]
  )

  // 액션바가 포커스되어 있는지
  const isActionBarFocused = focusIndex >= visibleFields.length

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      {/* 폼 라벨 */}
      {node.label && (
        <Box marginBottom={1}>
          <Text bold color="cyan">
            {node.label}
          </Text>
          {node.isDirty && <Text color="yellow"> (수정됨)</Text>}
          {node.isSubmitting && <Text color="blue"> (제출 중...)</Text>}
        </Box>
      )}

      {/* 필드들 */}
      {visibleFields.map((field, index) => (
        <Field
          key={field.id}
          field={field}
          onChange={handleFieldChange(field.id)}
          isFocused={focusIndex === index && isInteractive}
        />
      ))}

      {/* 유효성 상태 */}
      {!node.isValid && (
        <Box marginTop={1}>
          <Text color="red">폼에 오류가 있습니다.</Text>
        </Box>
      )}

      {/* 액션바 */}
      {node.actions.length > 0 && (
        <ActionBar
          actions={node.actions}
          onAction={handleAction}
          isFocused={isActionBarFocused && isInteractive}
        />
      )}
    </Box>
  )
}

export default FormRenderer
