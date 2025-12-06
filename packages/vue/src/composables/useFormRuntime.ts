import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { FormViewSchema, EntitySchema } from '@manifesto-ai/schema'
import { isOk } from '@manifesto-ai/schema'
import {
  createFormRuntime,
  type FormRuntime,
  type FormRuntimeError,
  type FormState,
  type FetchHandler,
  type NavigateHandler,
  type EmitHandler,
  type EvaluationContext,
  type FieldMeta,
} from '@manifesto-ai/engine'

export interface UseFormRuntimeOptions {
  initialValues?: Record<string, unknown>
  context?: Partial<EvaluationContext>
  entitySchema?: EntitySchema
  fetchHandler?: FetchHandler
  navigateHandler?: NavigateHandler
  emitHandler?: EmitHandler
  debug?: boolean
}

export const useFormRuntime = (
  schema: FormViewSchema | null,
  options: UseFormRuntimeOptions = {}
) => {
  const runtimeRef = ref<FormRuntime | null>(null)
  const isInitialized = ref(false)
  const error = ref<FormRuntimeError | null>(null)
  const state = ref<FormState>({
    values: {},
    fields: new Map(),
    sections: new Map(),
    fieldOptions: new Map(),
    isValid: true,
    isDirty: false,
    isSubmitting: false,
  })

  const initialize = () => {
    if (!schema) {
      isInitialized.value = false
      return
    }

    const runtime = createFormRuntime(schema, {
      initialValues: options.initialValues,
      context: options.context,
      entitySchema: options.entitySchema,
      fetchHandler: options.fetchHandler,
      navigateHandler: options.navigateHandler,
      emitHandler: options.emitHandler,
      debug: options.debug,
    })

    runtimeRef.value = runtime
    const result = runtime.initialize()

    if (isOk(result)) {
      isInitialized.value = true
      error.value = null
      state.value = runtime.getState()
      const unsub = runtime.subscribe((newState) => {
        state.value = newState
      })
      onBeforeUnmount(() => {
        unsub()
      })
    } else {
      error.value = result.error
      isInitialized.value = false
    }
  }

  initialize()

  watch(
    () => schema?.id,
    () => initialize()
  )

  const dispatch = (event: Parameters<FormRuntime['dispatch']>[0]) => {
    if (!runtimeRef.value) return
    const result = runtimeRef.value.dispatch(event)
    if (result._tag === 'Err') {
      error.value = result.error
    }
  }

  const setFieldValue = (fieldId: string, value: unknown) => dispatch({ type: 'FIELD_CHANGE', fieldId, value })
  const setValues = (values: Record<string, unknown>) => {
    for (const [fieldId, value] of Object.entries(values)) {
      dispatch({ type: 'FIELD_CHANGE', fieldId, value })
    }
  }
  const focusField = (fieldId: string) => dispatch({ type: 'FIELD_FOCUS', fieldId })
  const blurField = (fieldId: string) => dispatch({ type: 'FIELD_BLUR', fieldId })
  const validateField = (fieldId: string) => dispatch({ type: 'VALIDATE', fieldIds: [fieldId] })
  const validateAll = () => dispatch({ type: 'VALIDATE' })
  const reset = () => dispatch({ type: 'RESET' })

  const getField = (fieldId: string): FieldMeta | undefined => state.value.fields.get(fieldId)
  const getFieldOptions = (fieldId: string) => state.value.fieldOptions.get(fieldId) ?? []
  const isFieldHidden = (fieldId: string) => state.value.fields.get(fieldId)?.hidden ?? false
  const isFieldDisabled = (fieldId: string) => state.value.fields.get(fieldId)?.disabled ?? false
  const getFieldErrors = (fieldId: string) => state.value.fields.get(fieldId)?.errors ?? []

  const submit = async () => {
    if (!runtimeRef.value) return null
    const result = runtimeRef.value.dispatch({ type: 'VALIDATE' })
    if (result._tag === 'Err') {
      error.value = result.error
      return null
    }
    state.value = runtimeRef.value.getState()
    if (!state.value.isValid) return null
    return runtimeRef.value.getSubmitData()
  }

  return {
    // state refs
    values: computed(() => state.value.values),
    fields: computed(() => state.value.fields),
    fieldOptions: computed(() => state.value.fieldOptions),
    isValid: computed(() => state.value.isValid),
    isDirty: computed(() => state.value.isDirty),
    isSubmitting: computed(() => state.value.isSubmitting),
    isInitialized,
    error,
    // methods
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
    getState: () => state.value,
    getRuntime: () => runtimeRef.value,
  }
}
