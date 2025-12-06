/**
 * useFormRuntime - Form state management hook for React (semantic-first rebuild)
 */

import { useState, useRef, useCallback, useLayoutEffect, useMemo } from 'react'
import type { FormViewSchema, EntitySchema } from '@manifesto-ai/schema'
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
  type EvaluationContext,
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

export interface UseFormRuntimeReturn {
  values: Record<string, unknown>
  fields: ReadonlyMap<string, FieldMeta>
  fieldOptions: ReadonlyMap<string, readonly { value: string | number; label: string }[]>
  isValid: boolean
  isDirty: boolean
  isSubmitting: boolean
  isInitialized: boolean
  error: FormRuntimeError | null
  setFieldValue: (fieldId: string, value: unknown) => void
  setValues: (values: Record<string, unknown>) => void
  focusField: (fieldId: string) => void
  blurField: (fieldId: string) => void
  validateField: (fieldId: string) => void
  validateAll: () => void
  submit: () => Promise<Record<string, unknown> | null>
  reset: () => void
  getField: (fieldId: string) => FieldMeta | undefined
  getFieldOptions: (fieldId: string) => readonly { value: string | number; label: string }[]
  isFieldHidden: (fieldId: string) => boolean
  isFieldDisabled: (fieldId: string) => boolean
  getFieldErrors: (fieldId: string) => readonly string[]
  getState: () => FormState
  getRuntime: () => FormRuntime | null
}

const INITIAL_STATE: FormState = {
  values: {},
  fields: new Map(),
  sections: new Map(),
  fieldOptions: new Map(),
  isValid: true,
  isDirty: false,
  isSubmitting: false,
}

export function useFormRuntime(
  schema: FormViewSchema | null,
  options: UseFormRuntimeOptions = {}
): UseFormRuntimeReturn {
  const optionsRef = useRef(options)
  optionsRef.current = options

  const schemaId = useMemo(() => schema?.id ?? null, [schema?.id])

  const runtimeRef = useRef<FormRuntime | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const [formState, setFormState] = useState<FormState>(INITIAL_STATE)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<FormRuntimeError | null>(null)

  useLayoutEffect(() => {
    if (!schema) {
      setIsInitialized(false)
      return
    }

    const {
      initialValues = {},
      context = {},
      entitySchema,
      fetchHandler,
      navigateHandler,
      emitHandler,
      debug = false,
    } = optionsRef.current

    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }

    const runtime = createFormRuntime(schema, {
      initialValues,
      context,
      entitySchema,
      fetchHandler,
      navigateHandler,
      emitHandler,
      debug,
    })

    runtimeRef.current = runtime

    const result = runtime.initialize()

    if (debug) {
      console.log(
        '[useFormRuntime] Initialization result:',
        result._tag,
        result._tag === 'Err' ? result.error : 'success'
      )
    }

    if (isOk(result)) {
      setIsInitialized(true)
      setError(null)
      setFormState(runtime.getState())

      unsubscribeRef.current = runtime.subscribe((state) => {
        setFormState(state)
      })
    } else {
      console.error('[useFormRuntime] Initialization failed:', result.error)
      setError(result.error)
      setIsInitialized(false)
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      runtimeRef.current = null
    }
  }, [schema, schemaId])

  const dispatch = useCallback((event: FormEvent): void => {
    const runtime = runtimeRef.current
    if (!runtime) return

    const result = runtime.dispatch(event)
    if (result._tag === 'Err') {
      setError(result.error)
    }
  }, [])

  const setFieldValue = useCallback(
    (fieldId: string, value: unknown) => dispatch({ type: 'FIELD_CHANGE', fieldId, value }),
    [dispatch]
  )

  const setValues = useCallback(
    (values: Record<string, unknown>) => {
      for (const [fieldId, value] of Object.entries(values)) {
        dispatch({ type: 'FIELD_CHANGE', fieldId, value })
      }
    },
    [dispatch]
  )

  const focusField = useCallback((fieldId: string) => dispatch({ type: 'FIELD_FOCUS', fieldId }), [dispatch])
  const blurField = useCallback((fieldId: string) => dispatch({ type: 'FIELD_BLUR', fieldId }), [dispatch])
  const validateField = useCallback(
    (fieldId: string) => dispatch({ type: 'VALIDATE', fieldIds: [fieldId] }),
    [dispatch]
  )
  const validateAll = useCallback(() => dispatch({ type: 'VALIDATE' }), [dispatch])
  const submit = useCallback(async () => {
    const runtime = runtimeRef.current
    if (!runtime) return null

    const result = runtime.dispatch({ type: 'VALIDATE' })
    if (result._tag === 'Err') {
      setError(result.error)
      return null
    }

    const state = runtime.getState()
    setFormState(state)

    if (!state.isValid) {
      return null
    }

    // 엔진은 submit 메서드를 제공하지 않으므로, 숨겨지지 않은 필드만 모아 반환
    return runtime.getSubmitData()
  }, [])
  const reset = useCallback(() => dispatch({ type: 'RESET' }), [dispatch])

  const getField = useCallback((fieldId: string) => formState.fields.get(fieldId), [formState.fields])
  const getFieldOptions = useCallback(
    (fieldId: string) => formState.fieldOptions.get(fieldId) ?? [],
    [formState.fieldOptions]
  )
  const isFieldHidden = useCallback((fieldId: string) => formState.fields.get(fieldId)?.hidden ?? false, [formState.fields])
  const isFieldDisabled = useCallback((fieldId: string) => formState.fields.get(fieldId)?.disabled ?? false, [formState.fields])
  const getFieldErrors = useCallback((fieldId: string) => formState.fields.get(fieldId)?.errors ?? [], [formState.fields])
  const getState = useCallback(() => formState, [formState])
  const getRuntime = useCallback(() => runtimeRef.current, [])

  return {
    ...formState,
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
    getRuntime,
  }
}
