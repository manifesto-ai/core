/**
 * FormRenderer
 *
 * FormSnapshot을 Form UI로 변환하는 Node Renderer
 *
 * 책임:
 * - FormSnapshot의 fields를 순회하여 Field Primitive로 렌더링
 * - Intent 기반 값 변경 및 폼 제출 핸들러 바인딩
 * - 폼 상태 (isValid, isDirty, isSubmitting) 반영
 */

import React from 'react'
import type { FormSnapshot } from '@manifesto-ai/view-snapshot'
import type { NodeRenderer, RenderContext } from '../types/renderer'

// ============================================================================
// FormRenderer Implementation
// ============================================================================

/**
 * FormSnapshot 렌더 함수
 */
const renderForm = (node: FormSnapshot, context: RenderContext): React.ReactNode => {
  const { primitives, dispatch } = context

  /**
   * 필드 값 변경 핸들러
   * setFieldValue Intent를 dispatch
   */
  const handleFieldChange = (fieldId: string, value: unknown) => {
    console.log('[FormRenderer] handleFieldChange', fieldId, value)
    dispatch({
      type: 'setFieldValue',
      nodeId: node.nodeId,
      fieldId,
      value,
    }).then(() => {
      console.log('[FormRenderer] dispatch completed for', fieldId)
    })
  }

  /**
   * 폼 제출 핸들러
   * submit Intent를 dispatch
   */
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    if (!node.isValid) {
      return
    }

    dispatch({
      type: 'submit',
      nodeId: node.nodeId,
    })
  }

  /**
   * 폼 리셋 핸들러
   * reset Intent를 dispatch
   */
  const handleReset = () => {
    dispatch({
      type: 'reset',
      nodeId: node.nodeId,
    })
  }

  /**
   * 액션 핸들러
   */
  const handleAction = (action: typeof node.actions[number]) => {
    switch (action.type) {
      case 'submit':
        handleSubmit(new Event('submit') as unknown as React.FormEvent)
        break
      case 'reset':
        handleReset()
        break
      default:
        dispatch({
          type: 'triggerAction',
          nodeId: node.nodeId,
          actionType: action.type,
        })
    }
  }

  // 보이는 필드만 필터링
  const visibleFields = node.fields.filter((field) => !field.hidden)

  const formClassNames = [
    'mfs-form',
    node.isSubmitting && 'mfs-form--submitting',
    node.isDirty && 'mfs-form--dirty',
    !node.isValid && 'mfs-form--invalid',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <form
      className={formClassNames}
      onSubmit={handleSubmit}
      data-node-id={node.nodeId}
      data-node-kind="form"
    >
      {/* 필드 렌더링 */}
      <div className="mfs-form-fields">
        {visibleFields.map((field) => (
          <primitives.Field
            key={field.id}
            field={field}
            onChange={(value) => handleFieldChange(field.id, value)}
          />
        ))}
      </div>

      {/* 액션 바 */}
      {node.actions.length > 0 && (
        <div className="mfs-form-actions">
          <primitives.ActionBar
            actions={node.actions}
            onAction={handleAction}
          />
        </div>
      )}

      {/* 제출 중 오버레이 */}
      {node.isSubmitting && (
        <div className="mfs-form-submitting-overlay" aria-hidden="true">
          <span className="mfs-form-spinner" />
        </div>
      )}
    </form>
  )
}

// ============================================================================
// FormRenderer Export
// ============================================================================

/**
 * FormRenderer
 *
 * FormSnapshot → Form UI 변환
 */
export const FormRenderer: NodeRenderer<FormSnapshot> = {
  kind: 'form',
  render: renderForm,
}

export default FormRenderer
