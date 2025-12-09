/**
 * useFormState
 *
 * 특정 폼의 상태를 구독하는 Hook
 */

import { useMemo } from 'react'
import type { FormSnapshot } from '@manifesto-ai/view-snapshot'
import { useSnapshot } from '../composition/ManifestoContext'

// ============================================================================
// Hook
// ============================================================================

/**
 * useFormState
 *
 * 특정 폼 노드의 상태를 가져옵니다.
 *
 * @param nodeId - 폼 노드 ID
 * @returns 폼 스냅샷 또는 null (폼이 없는 경우)
 *
 * @example
 * ```tsx
 * function OrderFilterSummary() {
 *   const formState = useFormState('order-filter')
 *
 *   if (!formState) return null
 *
 *   return (
 *     <div>
 *       <p>유효함: {formState.isValid ? '예' : '아니오'}</p>
 *       <p>변경됨: {formState.isDirty ? '예' : '아니오'}</p>
 *       <p>필드 수: {formState.fields.length}</p>
 *     </div>
 *   )
 * }
 * ```
 */
export const useFormState = (nodeId: string): FormSnapshot | null => {
  const snapshot = useSnapshot()

  const formSnapshot = useMemo(() => {
    const node = snapshot.children.find(
      (child) => child.nodeId === nodeId && child.kind === 'form'
    )
    return node as FormSnapshot | undefined ?? null
  }, [snapshot, nodeId])

  return formSnapshot
}

/**
 * useFormValues
 *
 * 특정 폼의 현재 값들을 가져옵니다.
 *
 * @param nodeId - 폼 노드 ID
 * @returns 필드 ID -> 값 맵
 */
export const useFormValues = (nodeId: string): Record<string, unknown> => {
  const formSnapshot = useFormState(nodeId)

  return useMemo(() => {
    if (!formSnapshot) return {}

    return formSnapshot.fields.reduce((acc, field) => {
      acc[field.id] = field.value
      return acc
    }, {} as Record<string, unknown>)
  }, [formSnapshot])
}

/**
 * useFormErrors
 *
 * 특정 폼의 에러를 가져옵니다.
 *
 * @param nodeId - 폼 노드 ID
 * @returns 필드 ID -> 에러 메시지 배열 맵
 */
export const useFormErrors = (nodeId: string): Record<string, readonly string[]> => {
  const formSnapshot = useFormState(nodeId)

  return useMemo(() => {
    if (!formSnapshot) return {}

    return formSnapshot.fields.reduce((acc, field) => {
      if (field.errors && field.errors.length > 0) {
        acc[field.id] = field.errors
      }
      return acc
    }, {} as Record<string, readonly string[]>)
  }, [formSnapshot])
}

export default useFormState
