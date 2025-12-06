/**
 * useFormRuntime - 폼 상태 관리 및 반응형 업데이트
 */

import {
  ref,
  reactive,
  computed,
  watch,
  onUnmounted,
  getCurrentInstance,
  type Ref,
  type ComputedRef,
} from 'vue'
import type { FormViewSchema } from '@manifesto-ai/schema'
import { isOk } from '@manifesto-ai/schema'
import {
  createFormRuntime,
  type FormRuntime,
  type FormState,
  type FormEvent,
  type FormRuntimeError,
  type FieldMeta,
  type FetchHandler,
  type NavigateHandler,
  type EmitHandler,
} from '@manifesto-ai/engine'
import type { EvaluationContext } from '@manifesto-ai/engine'
import type { EntitySchema } from '@manifesto-ai/schema'

// ============================================================================
// Types
// ============================================================================

export interface UseFormRuntimeOptions {
  /** 초기값 */
  initialValues?: Record<string, unknown>
  /** 앱 컨텍스트 */
  context?: Partial<EvaluationContext>
  /** Entity 스키마 (검증용) */
  entitySchema?: EntitySchema
  /** API 호출 핸들러 (setOptions용) */
  fetchHandler?: FetchHandler
  /** Navigate 핸들러 (라우팅용) */
  navigateHandler?: NavigateHandler
  /** Emit 핸들러 (이벤트 발행용) */
  emitHandler?: EmitHandler
  /** 디버그 모드 */
  debug?: boolean
  /** 스키마 변경 시 자동 재초기화 */
  autoReinitialize?: boolean
}

export interface UseFormRuntimeReturn {
  /** 폼 값들 (반응형) */
  values: Record<string, unknown>
  /** 필드 메타 정보 */
  fields: Ref<ReadonlyMap<string, FieldMeta>>
  /** 필드 옵션 (select 등) */
  fieldOptions: ComputedRef<ReadonlyMap<string, readonly { value: string | number; label: string }[]>>
  /** 폼 유효 상태 */
  isValid: ComputedRef<boolean>
  /** 폼 변경 상태 */
  isDirty: ComputedRef<boolean>
  /** 제출 중 상태 */
  isSubmitting: ComputedRef<boolean>
  /** 초기화 상태 */
  isInitialized: Ref<boolean>
  /** 에러 */
  error: Ref<FormRuntimeError | null>
  /** 필드 값 설정 */
  setFieldValue: (fieldId: string, value: unknown) => void
  /** 여러 필드 값 설정 */
  setValues: (values: Record<string, unknown>) => void
  /** 필드 포커스 */
  focusField: (fieldId: string) => void
  /** 필드 블러 */
  blurField: (fieldId: string) => void
  /** 필드 검증 */
  validateField: (fieldId: string) => void
  /** 전체 검증 */
  validateAll: () => void
  /** 폼 제출 */
  submit: () => Promise<Record<string, unknown> | null>
  /** 폼 리셋 */
  reset: () => void
  /** 필드 가져오기 */
  getField: (fieldId: string) => FieldMeta | undefined
  /** 필드 옵션 가져오기 */
  getFieldOptions: (fieldId: string) => readonly { value: string | number; label: string }[]
  /** 필드 숨김 상태 */
  isFieldHidden: (fieldId: string) => boolean
  /** 필드 비활성화 상태 */
  isFieldDisabled: (fieldId: string) => boolean
  /** 필드 에러 */
  getFieldErrors: (fieldId: string) => readonly string[]
  /** 폼 상태 가져오기 (디버그용) */
  getState: () => FormState
}

// ============================================================================
// Composable
// ============================================================================

export function useFormRuntime(
  schema: Ref<FormViewSchema | null> | FormViewSchema,
  options: UseFormRuntimeOptions = {}
): UseFormRuntimeReturn {
  const {
    initialValues = {},
    context = {},
    entitySchema,
    fetchHandler,
    navigateHandler,
    emitHandler,
    debug = false,
    autoReinitialize = true,
  } = options

  // Internal state
  let runtime: FormRuntime | null = null
  const values = reactive<Record<string, unknown>>({})
  const fields = ref<ReadonlyMap<string, FieldMeta>>(new Map())
  const isInitialized = ref(false)
  const error = ref<FormRuntimeError | null>(null)

  // Form state
  const formState = ref<FormState>({
    values: {},
    fields: new Map(),
    fieldOptions: new Map(),
    isValid: true,
    isDirty: false,
    isSubmitting: false,
  })

  // Computed
  const isValid = computed(() => formState.value.isValid)
  const isDirty = computed(() => formState.value.isDirty)
  const isSubmitting = computed(() => formState.value.isSubmitting)

  // Initialize runtime
  const initialize = (viewSchema: FormViewSchema): void => {
    runtime = createFormRuntime(viewSchema, {
      initialValues,
      context,
      entitySchema,
      fetchHandler,
      navigateHandler,
      emitHandler,
      debug,
    })

    const result = runtime.initialize()

    if (isOk(result)) {
      isInitialized.value = true
      error.value = null
      syncState()

      // Subscribe to state changes
      runtime.subscribe((state) => {
        formState.value = state
        syncState()
      })
    } else {
      error.value = result.error
      isInitialized.value = false
    }
  }

  // Sync runtime state to reactive state
  const syncState = (): void => {
    if (!runtime) return

    const state = runtime.getState()

    // Sync values
    Object.keys(values).forEach((key) => {
      delete values[key]
    })
    Object.assign(values, state.values)

    // Sync fields
    fields.value = state.fields

    // Sync formState (includes fieldOptions)
    formState.value = state
  }

  // Dispatch event
  const dispatch = (event: FormEvent): void => {
    if (!runtime) return

    const result = runtime.dispatch(event)
    if (result._tag === 'Err') {
      error.value = result.error
    }
  }

  // Public methods
  const setFieldValue = (fieldId: string, value: unknown): void => {
    dispatch({ type: 'FIELD_CHANGE', fieldId, value })
  }

  const setValues = (newValues: Record<string, unknown>): void => {
    for (const [fieldId, value] of Object.entries(newValues)) {
      dispatch({ type: 'FIELD_CHANGE', fieldId, value })
    }
  }

  const focusField = (fieldId: string): void => {
    dispatch({ type: 'FIELD_FOCUS', fieldId })
  }

  const blurField = (fieldId: string): void => {
    dispatch({ type: 'FIELD_BLUR', fieldId })
  }

  const validateField = (fieldId: string): void => {
    dispatch({ type: 'VALIDATE', fieldIds: [fieldId] })
  }

  const validateAll = (): void => {
    dispatch({ type: 'VALIDATE' })
  }

  const submit = async (): Promise<Record<string, unknown> | null> => {
    if (!runtime) return null

    dispatch({ type: 'SUBMIT' })

    if (formState.value.isValid) {
      return runtime.getSubmitData()
    }

    return null
  }

  const reset = (): void => {
    dispatch({ type: 'RESET' })
  }

  const getField = (fieldId: string): FieldMeta | undefined => {
    return fields.value.get(fieldId)
  }

  const isFieldHidden = (fieldId: string): boolean => {
    return fields.value.get(fieldId)?.hidden ?? false
  }

  const isFieldDisabled = (fieldId: string): boolean => {
    return fields.value.get(fieldId)?.disabled ?? false
  }

  const getFieldErrors = (fieldId: string): readonly string[] => {
    return fields.value.get(fieldId)?.errors ?? []
  }

  // Field options computed
  const fieldOptions = computed(() => formState.value.fieldOptions)

  const getFieldOptions = (fieldId: string): readonly { value: string | number; label: string }[] => {
    return formState.value.fieldOptions.get(fieldId) ?? []
  }

  const getState = (): FormState => {
    return formState.value
  }

  // Watch schema changes
  const isSchemaRef = (val: Ref<FormViewSchema | null> | FormViewSchema): val is Ref<FormViewSchema | null> => {
    return val !== null && typeof val === 'object' && 'value' in val
  }

  const schemaRef: Ref<FormViewSchema | null> = isSchemaRef(schema)
    ? schema
    : (ref(schema as FormViewSchema) as unknown as Ref<FormViewSchema | null>)

  watch(
    schemaRef,
    (newSchema) => {
      if (newSchema && autoReinitialize) {
        initialize(newSchema)
      }
    },
    { immediate: true }
  )

  // Cleanup - only register if inside a component
  if (getCurrentInstance()) {
    onUnmounted(() => {
      runtime = null
    })
  }

  return {
    values,
    fields,
    fieldOptions,
    isValid,
    isDirty,
    isSubmitting,
    isInitialized,
    error,
    setFieldValue,
    setValues,
    focusField,
    blurField,
    validateField,
    validateAll,
    submit,
    reset,
    getField,
    getFieldOptions,
    isFieldHidden,
    isFieldDisabled,
    getFieldErrors,
    getState,
  }
}
