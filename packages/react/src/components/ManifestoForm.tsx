/**
 * ManifestoForm
 *
 * 선언적 폼 등록 컴포넌트 (High-Level DX)
 *
 * ManifestoPage 내에서 사용하여 FormRuntime을 자동으로 생성하고
 * Engine에 등록합니다.
 */

import React, { useEffect, useRef } from 'react'
import type { FormViewSchema, EntitySchema } from '@manifesto-ai/schema'
import { createFormRuntime, type FormRuntimeOptions, type FormRuntime } from '@manifesto-ai/engine'
import { useEngine } from '../composition/ManifestoContext'

// ============================================================================
// Props
// ============================================================================

export interface ManifestoFormProps {
  /** 노드 ID */
  nodeId: string
  /** 폼 스키마 */
  schema: FormViewSchema
  /** 엔티티 스키마 (선택적) */
  entitySchema?: EntitySchema
  /** 초기값 */
  initialValues?: Record<string, unknown>
  /** 평가 컨텍스트 (선택적) */
  context?: FormRuntimeOptions['context']
  /** 이 폼이 영향을 주는 다른 노드 ID 목록 */
  affects?: string[]
  /** 제출 핸들러 */
  onSubmit?: (data: Record<string, unknown>) => void | Promise<void>
  /** 값 변경 핸들러 */
  onChange?: (values: Record<string, unknown>) => void
  /** 에러 핸들러 */
  onError?: (error: unknown) => void
}

// ============================================================================
// ManifestoForm Component
// ============================================================================

/**
 * ManifestoForm
 *
 * ManifestoPage 내에서 사용하여 폼을 선언적으로 등록합니다.
 * 이 컴포넌트 자체는 아무것도 렌더링하지 않습니다.
 * 실제 렌더링은 PageRenderer가 담당합니다.
 *
 * @example
 * ```tsx
 * <ManifestoPage pageId="orders" title="주문 관리">
 *   <ManifestoForm
 *     nodeId="order-filter"
 *     schema={filterSchema}
 *     initialValues={{ status: 'all' }}
 *     affects={['order-table']}
 *     onSubmit={(data) => console.log('Filter:', data)}
 *   />
 * </ManifestoPage>
 * ```
 */
export const ManifestoForm: React.FC<ManifestoFormProps> = ({
  nodeId,
  schema,
  entitySchema,
  initialValues,
  context,
  affects: _affects,
  onSubmit,
  onChange,
  onError,
}) => {
  const engine = useEngine()
  const runtimeRef = useRef<FormRuntime | null>(null)
  const wasSubmittingRef = useRef(false)

  // Stable callback refs
  const onSubmitRef = useRef(onSubmit)
  const onChangeRef = useRef(onChange)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onSubmitRef.current = onSubmit
    onChangeRef.current = onChange
    onErrorRef.current = onError
  }, [onSubmit, onChange, onError])

  // Stable refs for objects to avoid infinite loops
  const schemaRef = useRef(schema)
  const entitySchemaRef = useRef(entitySchema)
  const initialValuesRef = useRef(initialValues)
  const contextRef = useRef(context)

  // Update refs when values change (but don't trigger effect re-run)
  useEffect(() => {
    schemaRef.current = schema
    entitySchemaRef.current = entitySchema
    initialValuesRef.current = initialValues
    contextRef.current = context
  })

  // ========================================================================
  // Runtime Registration & Event Handling
  // ========================================================================

  useEffect(() => {
    // FormRuntime 생성
    const runtime = createFormRuntime(schemaRef.current, {
      initialValues: initialValuesRef.current,
      context: contextRef.current,
      entitySchema: entitySchemaRef.current,
    })

    // Runtime 초기화 (필수!)
    const initResult = runtime.initialize()
    if (initResult._tag === 'Err') {
      console.error('[ManifestoForm] Runtime initialization failed:', initResult.error)
      onErrorRef.current?.(initResult.error)
      return
    }

    runtimeRef.current = runtime
    wasSubmittingRef.current = false

    // Engine에 등록
    engine.registerFormRuntime(nodeId, runtime, schemaRef.current, entitySchemaRef.current)

    // 상태 변경 구독 (onChange + onSubmit 감지)
    const unsubscribe = runtime.subscribe(() => {
      const state = runtime.getState()

      // onChange 호출
      onChangeRef.current?.(state.values)

      // Submit 감지: isSubmitting이 false → true로 변하면 onSubmit 호출
      if (state.isSubmitting && !wasSubmittingRef.current) {
        wasSubmittingRef.current = true

        // 비동기 onSubmit 처리
        const handleSubmit = async () => {
          try {
            await onSubmitRef.current?.(state.values)
          } catch (error) {
            onErrorRef.current?.(error)
          } finally {
            // Submit 완료 후 reset (runtime에서 처리해야 하지만 여기서도 추적)
            wasSubmittingRef.current = false
          }
        }

        handleSubmit()
      } else if (!state.isSubmitting) {
        wasSubmittingRef.current = false
      }
    })

    // Cleanup
    return () => {
      unsubscribe()
      engine.unregisterRuntime(nodeId)
      runtimeRef.current = null
    }
    // Only re-run when nodeId or engine changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, engine])

  // ========================================================================
  // Render
  // ========================================================================

  // 이 컴포넌트는 아무것도 렌더링하지 않음
  // 실제 폼 UI는 PageRenderer가 FormRenderer를 통해 렌더링함
  return null
}

export default ManifestoForm
