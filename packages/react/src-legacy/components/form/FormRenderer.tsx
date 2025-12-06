/**
 * FormRenderer - Top-level form renderer component
 *
 * Receives ViewSchema and automatically renders form UI
 * Integrates with useFormRuntime for state management
 * Supports custom components via ComponentRegistry
 */

import React, { useMemo, useCallback, useEffect, useRef } from 'react'
import type { FormViewSchema, ViewField, EntitySchema } from '@manifesto-ai/schema'
import type { EvaluationContext, FormRuntimeError, FetchHandler, NavigateHandler, EmitHandler, FieldMeta, FormRuntime } from '@manifesto-ai/engine'
import { useFormRuntime as useFormRuntimeHook } from '../../hooks/useFormRuntime'
import { getDefaultRegistry } from '../registry/ComponentRegistry'
import { FormContext } from '../FormContext'
import type { IComponentRegistry } from '../../types/component'
import SectionRenderer from './SectionRenderer'
import DebugPanel from './DebugPanel'

/**
 * Footer render props
 */
export interface FormFooterProps {
  submit: () => void
  reset: () => void
  isValid: boolean
  isDirty: boolean
  isSubmitting: boolean
}

/**
 * Field render props
 */
export interface FieldRenderProps {
  field: ViewField
  meta: FieldMeta | undefined
  value: unknown
  setValue: (value: unknown) => void
  errors: readonly string[]
  disabled: boolean
  hidden: boolean
}

export interface FormRendererProps {
  /** View schema */
  schema: FormViewSchema
  /** Initial values */
  initialValues?: Record<string, unknown>
  /** Evaluation context */
  context?: Partial<EvaluationContext>
  /** Entity schema (for validation) */
  entitySchema?: EntitySchema
  /** Readonly mode */
  readonly?: boolean
  /** Custom component registry */
  componentRegistry?: IComponentRegistry
  /** Fetch handler (for API calls) */
  fetchHandler?: FetchHandler
  /** Navigate handler (for routing) */
  navigateHandler?: NavigateHandler
  /** Emit handler (for events) */
  emitHandler?: EmitHandler
  /** Debug mode */
  debug?: boolean
  /** Submit handler */
  onSubmit?: (data: Record<string, unknown>) => void
  /** Change handler */
  onChange?: (fieldId: string, value: unknown) => void
  /** Validate handler */
  onValidate?: (isValid: boolean) => void
  /** Error handler */
  onError?: (error: FormRuntimeError) => void
  /** Runtime ready callback (for AI integration) */
  onRuntimeReady?: (runtime: FormRuntime) => void
  /** Header render prop */
  renderHeader?: () => React.ReactNode
  /** Loading render prop */
  renderLoading?: () => React.ReactNode
  /** Error render prop */
  renderError?: (error: FormRuntimeError) => React.ReactNode
  /** Footer render prop */
  renderFooter?: (props: FormFooterProps) => React.ReactNode
  /** Section header render prop */
  renderSectionHeader?: (sectionId: string) => React.ReactNode
  /** Section footer render prop */
  renderSectionFooter?: (sectionId: string) => React.ReactNode
  /** Field render prop (override specific field) */
  renderField?: (fieldId: string, props: FieldRenderProps) => React.ReactNode | null
}

export const FormRenderer: React.FC<FormRendererProps> = ({
  schema,
  initialValues = {},
  context,
  entitySchema,
  readonly = false,
  componentRegistry,
  fetchHandler,
  navigateHandler,
  emitHandler,
  debug = false,
  onSubmit,
  onChange,
  onValidate,
  onError,
  onRuntimeReady,
  renderHeader,
  renderLoading,
  renderError,
  renderFooter,
  renderSectionHeader,
  renderSectionFooter,
  renderField,
}) => {
  // Initialize runtime
  const runtime = useFormRuntimeHook(schema, {
    initialValues,
    context,
    entitySchema,
    fetchHandler,
    navigateHandler,
    emitHandler,
    debug,
  })

  // Determine registry (prop priority, then default)
  const registry = useMemo(
    () => componentRegistry ?? getDefaultRegistry(),
    [componentRegistry]
  )

  // Section list
  const sections = useMemo(() => schema.sections ?? [], [schema.sections])

  // Submit handler
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()

      runtime.validateAll()
      onValidate?.(runtime.isValid)

      if (!runtime.isValid) {
        return
      }

      const data = await runtime.submit()
      if (data) {
        onSubmit?.(data)
      }
    },
    [runtime, onSubmit, onValidate]
  )

  // Reset handler
  const handleReset = useCallback(() => {
    runtime.reset()
  }, [runtime])

  // Error detection and callback
  useEffect(() => {
    if (runtime.error) {
      onError?.(runtime.error)
    }
  }, [runtime.error, onError])

  // Runtime ready callback (for AI integration)
  // Use ref to avoid re-running effect when runtime object changes
  const runtimeRef = useRef(runtime)
  runtimeRef.current = runtime
  const runtimeReadyCalledRef = useRef(false)

  useEffect(() => {
    // Only call once when initialized
    if (runtime.isInitialized && onRuntimeReady && !runtimeReadyCalledRef.current) {
      const internalRuntime = runtimeRef.current.getRuntime()
      if (internalRuntime) {
        runtimeReadyCalledRef.current = true
        onRuntimeReady(internalRuntime)
      }
    }
  }, [runtime.isInitialized, onRuntimeReady])

  // Value change detection and callback
  const prevValues = React.useRef<Record<string, unknown>>(runtime.values)
  useEffect(() => {
    if (!onChange) return

    const currentValues = runtime.values
    const prev = prevValues.current

    for (const key of Object.keys(currentValues)) {
      if (currentValues[key] !== prev[key]) {
        onChange(key, currentValues[key])
      }
    }

    prevValues.current = { ...currentValues }
  }, [runtime.values, onChange])

  // Context value
  const contextValue = useMemo(
    () => ({
      runtime,
      registry,
      readonly,
    }),
    [runtime, registry, readonly]
  )

  // Form class names
  const formClassName = useMemo(() => {
    const classes = ['form-renderer']
    if (readonly) classes.push('form-renderer--readonly')
    if (!runtime.isInitialized) classes.push('form-renderer--loading')
    if (runtime.error) classes.push('form-renderer--error')
    return classes.join(' ')
  }, [readonly, runtime.isInitialized, runtime.error])

  return (
    <FormContext.Provider value={contextValue}>
      <form className={formClassName} onSubmit={handleSubmit}>
        {/* Header */}
        {renderHeader && <header className="form-renderer__header">{renderHeader()}</header>}

        {/* Loading State */}
        {!runtime.isInitialized && (
          <div className="form-renderer__loading">
            {renderLoading ? renderLoading() : <span>Loading...</span>}
          </div>
        )}

        {/* Error State */}
        {runtime.isInitialized && runtime.error && (
          <div className="form-renderer__error">
            {renderError ? (
              renderError(runtime.error)
            ) : (
              <span className="form-renderer__error-message">
                {'message' in runtime.error ? runtime.error.message : runtime.error.type}
              </span>
            )}
          </div>
        )}

        {/* Form Content */}
        {runtime.isInitialized && !runtime.error && (
          <div className="form-renderer__content">
            {sections.map((section) => (
              <SectionRenderer
                key={section.id}
                section={section}
                renderHeader={
                  renderSectionHeader ? () => renderSectionHeader(section.id) : undefined
                }
                renderFooter={
                  renderSectionFooter ? () => renderSectionFooter(section.id) : undefined
                }
                renderField={
                  renderField
                    ? (fieldId) => {
                        const field = section.fields.find((f) => f.id === fieldId)
                        if (!field) return null
                        return renderField(fieldId, {
                          field,
                          meta: runtime.getField(fieldId),
                          value: runtime.values[fieldId],
                          setValue: (v) => runtime.setFieldValue(fieldId, v),
                          errors: runtime.getFieldErrors(fieldId),
                          disabled: runtime.isFieldDisabled(fieldId),
                          hidden: runtime.isFieldHidden(fieldId),
                        })
                      }
                    : undefined
                }
              />
            ))}
          </div>
        )}

        {/* Footer */}
        {renderFooter && (
          <footer className="form-renderer__footer">
            {renderFooter({
              submit: handleSubmit,
              reset: handleReset,
              isValid: runtime.isValid,
              isDirty: runtime.isDirty,
              isSubmitting: runtime.isSubmitting,
            })}
          </footer>
        )}

        {/* Debug Panel */}
        {debug && runtime.isInitialized && <DebugPanel runtime={runtime} schema={schema} />}
      </form>
    </FormContext.Provider>
  )
}

export default FormRenderer
