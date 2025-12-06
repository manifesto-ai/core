/**
 * useFormRuntime - Form state management hook for React
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

// ============================================================================
// Types
// ============================================================================

export interface UseFormRuntimeOptions {
  /** Initial values */
  initialValues?: Record<string, unknown>
  /** App context */
  context?: Partial<EvaluationContext>
  /** Entity schema for validation */
  entitySchema?: EntitySchema
  /** API fetch handler */
  fetchHandler?: FetchHandler
  /** Navigate handler */
  navigateHandler?: NavigateHandler
  /** Emit handler */
  emitHandler?: EmitHandler
  /** Debug mode */
  debug?: boolean
}

export interface UseFormRuntimeReturn {
  /** Form values */
  values: Record<string, unknown>
  /** Field metadata */
  fields: ReadonlyMap<string, FieldMeta>
  /** Field options (for select, etc.) */
  fieldOptions: ReadonlyMap<string, readonly { value: string | number; label: string }[]>
  /** Form validity */
  isValid: boolean
  /** Form dirty state */
  isDirty: boolean
  /** Submitting state */
  isSubmitting: boolean
  /** Initialized state */
  isInitialized: boolean
  /** Error */
  error: FormRuntimeError | null
  /** Set single field value */
  setFieldValue: (fieldId: string, value: unknown) => void
  /** Set multiple values */
  setValues: (values: Record<string, unknown>) => void
  /** Focus field */
  focusField: (fieldId: string) => void
  /** Blur field */
  blurField: (fieldId: string) => void
  /** Validate single field */
  validateField: (fieldId: string) => void
  /** Validate all fields */
  validateAll: () => void
  /** Submit form */
  submit: () => Promise<Record<string, unknown> | null>
  /** Reset form */
  reset: () => void
  /** Get field metadata */
  getField: (fieldId: string) => FieldMeta | undefined
  /** Get field options */
  getFieldOptions: (fieldId: string) => readonly { value: string | number; label: string }[]
  /** Check if field is hidden */
  isFieldHidden: (fieldId: string) => boolean
  /** Check if field is disabled */
  isFieldDisabled: (fieldId: string) => boolean
  /** Get field errors */
  getFieldErrors: (fieldId: string) => readonly string[]
  /** Get form state (for debug) */
  getState: () => FormState
  /** Get internal runtime (for AI integration) */
  getRuntime: () => FormRuntime | null
}

// ============================================================================
// Hook
// ============================================================================

const INITIAL_STATE: FormState = {
  values: {},
  fields: new Map(),
  fieldOptions: new Map(),
  isValid: true,
  isDirty: false,
  isSubmitting: false,
}

export function useFormRuntime(
  schema: FormViewSchema | null,
  options: UseFormRuntimeOptions = {}
): UseFormRuntimeReturn {
  // Store options in ref to avoid dependency issues
  const optionsRef = useRef(options)
  optionsRef.current = options

  // Stable schema ID for dependency tracking (only re-init when schema actually changes)
  const schemaId = useMemo(() => schema?.id ?? null, [schema?.id])

  // Runtime ref (persists across renders)
  const runtimeRef = useRef<FormRuntime | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // State
  const [formState, setFormState] = useState<FormState>(INITIAL_STATE)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<FormRuntimeError | null>(null)

  // Initialize runtime - only when schema ID changes
  // useLayoutEffect ensures initialization happens before browser paint
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

    // Cleanup previous runtime
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }

    // Create new runtime
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
      console.log('[useFormRuntime] Initialization result:', result._tag, result._tag === 'Err' ? result.error : 'success')
    }

    if (isOk(result)) {
      setIsInitialized(true)
      setError(null)
      setFormState(runtime.getState())

      // Subscribe to state changes
      unsubscribeRef.current = runtime.subscribe((state) => {
        setFormState(state)
      })
    } else {
      console.error('[useFormRuntime] Initialization failed:', result.error)
      setError(result.error)
      setIsInitialized(false)
    }

    // Cleanup on unmount or schema change
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      runtimeRef.current = null
    }
  }, [schema, schemaId]) // Only re-run when schema object or its ID changes

  // Dispatch helper
  const dispatch = useCallback((event: FormEvent): void => {
    const runtime = runtimeRef.current
    if (!runtime) return

    const result = runtime.dispatch(event)
    if (result._tag === 'Err') {
      setError(result.error)
    }
  }, [])

  // Public methods
  const setFieldValue = useCallback((fieldId: string, value: unknown): void => {
    dispatch({ type: 'FIELD_CHANGE', fieldId, value })
  }, [dispatch])

  const setValues = useCallback((newValues: Record<string, unknown>): void => {
    for (const [fieldId, value] of Object.entries(newValues)) {
      dispatch({ type: 'FIELD_CHANGE', fieldId, value })
    }
  }, [dispatch])

  const focusField = useCallback((fieldId: string): void => {
    dispatch({ type: 'FIELD_FOCUS', fieldId })
  }, [dispatch])

  const blurField = useCallback((fieldId: string): void => {
    dispatch({ type: 'FIELD_BLUR', fieldId })
  }, [dispatch])

  const validateField = useCallback((fieldId: string): void => {
    dispatch({ type: 'VALIDATE', fieldIds: [fieldId] })
  }, [dispatch])

  const validateAll = useCallback((): void => {
    dispatch({ type: 'VALIDATE' })
  }, [dispatch])

  const submit = useCallback(async (): Promise<Record<string, unknown> | null> => {
    const runtime = runtimeRef.current
    if (!runtime) return null

    dispatch({ type: 'SUBMIT' })

    // Get fresh state after submit
    const state = runtime.getState()
    if (state.isValid) {
      return runtime.getSubmitData()
    }

    return null
  }, [dispatch])

  const reset = useCallback((): void => {
    dispatch({ type: 'RESET' })
  }, [dispatch])

  const getField = useCallback((fieldId: string): FieldMeta | undefined => {
    return formState.fields.get(fieldId)
  }, [formState.fields])

  const getFieldOptions = useCallback((fieldId: string): readonly { value: string | number; label: string }[] => {
    return formState.fieldOptions.get(fieldId) ?? []
  }, [formState.fieldOptions])

  const isFieldHidden = useCallback((fieldId: string): boolean => {
    return formState.fields.get(fieldId)?.hidden ?? false
  }, [formState.fields])

  const isFieldDisabled = useCallback((fieldId: string): boolean => {
    return formState.fields.get(fieldId)?.disabled ?? false
  }, [formState.fields])

  const getFieldErrors = useCallback((fieldId: string): readonly string[] => {
    return formState.fields.get(fieldId)?.errors ?? []
  }, [formState.fields])

  const getState = useCallback((): FormState => {
    return formState
  }, [formState])

  const getRuntime = useCallback((): FormRuntime | null => {
    return runtimeRef.current
  }, [])

  return {
    values: formState.values,
    fields: formState.fields,
    fieldOptions: formState.fieldOptions,
    isValid: formState.isValid,
    isDirty: formState.isDirty,
    isSubmitting: formState.isSubmitting,
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
