import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  EvaluationContext,
  FetchHandler,
  NavigateHandler,
  EmitHandler,
  FormRuntime,
  FormRuntimeError,
} from '@manifesto-ai/engine'
import type { EntitySchema, FormViewSchema } from '@manifesto-ai/schema'
import {
  resolveFieldRenderers,
  type ResolvedFieldSemanticNode,
  type ResolvedFormSemanticNode,
  type ResolvedSectionSemanticNode,
  type LightweightValidator,
  type SemanticBuildOptions,
} from '@manifesto-ai/ui'
import type { FieldRendererRegistry, SemanticRendererRegistry, ActionHandlerRegistry } from '@manifesto-ai/ui'
import { getDefaultSemanticRegistry } from '@manifesto-ai/ui'
import { useFormRuntime } from '../../hooks/useFormRuntime'
import SectionRenderer from './SectionRenderer'
import type { FieldRendererComponent } from '../../types'
import { getDefaultFieldRegistry, getDefaultActionRegistry } from '../../registry'
import type { FormActionHandler } from '../../types'
import { ActionButtons } from '../actions/ActionButtons'

export interface FormRendererProps {
  schema: FormViewSchema
  initialValues?: Record<string, unknown>
  context?: Partial<EvaluationContext>
  entitySchema?: EntitySchema
  readonly?: boolean
  includeHiddenFields?: boolean
  fieldRegistry?: FieldRendererRegistry<FieldRendererComponent>
  semanticRegistry?: SemanticRendererRegistry
  actionRegistry?: ActionHandlerRegistry<FormActionHandler>
  liveValidators?: ReadonlyMap<string, readonly LightweightValidator[]>
  uiStateHints?: Readonly<Record<string, unknown>>
  fetchHandler?: FetchHandler
  navigateHandler?: NavigateHandler
  emitHandler?: EmitHandler
  debug?: boolean
  onSubmit?: (data: Record<string, unknown>) => void
  onChange?: (fieldId: string, value: unknown) => void
  onValidate?: (isValid: boolean) => void
  onError?: (error: FormRuntimeError) => void
  onRuntimeReady?: (runtime: FormRuntime) => void
  renderField?: (
    field: ResolvedFieldSemanticNode<FieldRendererComponent>
  ) => React.ReactNode
  renderSection?: (
    section: ResolvedSectionSemanticNode<FieldRendererComponent>,
    children: React.ReactNode
  ) => React.ReactNode
  renderHeader?: (tree: ResolvedFormSemanticNode<FieldRendererComponent>) => React.ReactNode
  renderFooter?: (tree: ResolvedFormSemanticNode<FieldRendererComponent>) => React.ReactNode
}

export const FormRenderer: React.FC<FormRendererProps> = ({
  schema,
  initialValues,
  context,
  entitySchema,
  readonly = false,
  includeHiddenFields = true,
  fieldRegistry,
  semanticRegistry,
  actionRegistry,
  liveValidators,
  uiStateHints,
  fetchHandler,
  navigateHandler,
  emitHandler,
  debug = false,
  onSubmit,
  onChange,
  onValidate,
  onError,
  onRuntimeReady,
  renderField,
  renderSection,
  renderHeader,
  renderFooter,
}) => {
  const runtime = useFormRuntime(schema, {
    initialValues,
    context,
    entitySchema,
    fetchHandler,
    navigateHandler,
    emitHandler,
    debug,
  })

  const registry = useMemo(
    () => fieldRegistry ?? getDefaultFieldRegistry(),
    [fieldRegistry]
  )
  const semantic = useMemo(
    () => semanticRegistry ?? getDefaultSemanticRegistry(),
    [semanticRegistry]
  )
  const actions = useMemo(
    () => actionRegistry ?? getDefaultActionRegistry(),
    [actionRegistry]
  )

  const [semanticTree, setSemanticTree] = useState<ResolvedFormSemanticNode<FieldRendererComponent> | null>(null)
  const [missingRenderers, setMissingRenderers] = useState<readonly string[]>([])

  // Build semantic tree whenever runtime state changes
  useEffect(() => {
    if (!runtime.isInitialized) return

    const contract = { kind: 'form' as const, view: schema, state: runtime.getState() }
    const options: SemanticBuildOptions = {
      includeHidden: includeHiddenFields,
      liveValidators,
      uiState: uiStateHints,
    }
    const tree = semantic.build(contract, options)

    resolveFieldRenderers(tree, registry).then(({ tree: resolved, missing }) => {
      setSemanticTree(resolved as ResolvedFormSemanticNode<FieldRendererComponent>)
      setMissingRenderers(missing)
    })
  }, [
    schema,
    runtime.values,
    runtime.fields,
    runtime.isDirty,
    runtime.isValid,
    runtime.isSubmitting,
    runtime.isInitialized,
    includeHiddenFields,
    semantic,
    registry,
  ])

  // Submit handler
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      const data = await runtime.submit()
      onValidate?.(runtime.isValid)
      if (!runtime.isValid || !data) return
      onSubmit?.(data)
    },
    [runtime, onSubmit, onValidate]
  )

  // Value change detection (propagate to onChange)
  const prevValues = useRef<Record<string, unknown>>(runtime.values)
  useEffect(() => {
    if (!onChange) return
    const current = runtime.values
    const prev = prevValues.current
    for (const key of Object.keys(current)) {
      if (current[key] !== prev[key]) {
        onChange(key, current[key])
      }
    }
    prevValues.current = { ...current }
  }, [runtime.values, onChange])

  // Error callback
  useEffect(() => {
    if (runtime.error) {
      onError?.(runtime.error)
    }
  }, [runtime.error, onError])

  // Runtime ready callback
  const runtimeReadyCalledRef = useRef(false)
  useEffect(() => {
    if (runtime.isInitialized && onRuntimeReady && !runtimeReadyCalledRef.current) {
      const internalRuntime = runtime.getRuntime()
      if (internalRuntime) {
        runtimeReadyCalledRef.current = true
        onRuntimeReady(internalRuntime)
      }
    }
  }, [runtime.isInitialized, onRuntimeReady, runtime])

  const content = useMemo(() => {
    if (!semanticTree) return null

    // const handleAction = (action: ActionSemanticNode) => {
    //   const handler = actions.get(action.actionId)
    //   if (handler) {
    //     handler({ actionId: action.actionId, runtime: runtime.getRuntime()!, node: action })
    //   }
    // }

    const sections = semanticTree.sections.map((section) => {
      const sectionContent = (
        <SectionRenderer
          key={section.id}
          section={section}
          readonly={readonly}
          onChange={(fieldId, value) => runtime.setFieldValue(fieldId, value)}
          renderField={renderField}
          liveValidators={liveValidators}
        />
      )
      return renderSection ? renderSection(section, sectionContent) : sectionContent
    })

    return (
      <>
        {renderHeader ? (
          renderHeader(semanticTree)
        ) : (
          semanticTree.headerActions && semanticTree.headerActions.length > 0 && runtime.getRuntime() && (
            <ActionButtons actions={semanticTree.headerActions} registry={actions} runtime={runtime.getRuntime()} />
          )
        )}
        {sections}
        {renderFooter ? (
          renderFooter(semanticTree)
        ) : (
          <footer className="mfs-form__footer">
            <button type="submit" className="mfs-button mfs-button--primary" disabled={!runtime.isValid || runtime.isSubmitting}>
              Submit
            </button>
            {semanticTree.footerActions && semanticTree.footerActions.length > 0 && runtime.getRuntime() && (
              <ActionButtons actions={semanticTree.footerActions} registry={actions} runtime={runtime.getRuntime()} />
            )}
          </footer>
        )}
        {missingRenderers.length > 0 && (
          <div className="mfs-warning">
            Missing renderers for: {missingRenderers.join(', ')}
          </div>
        )}
      </>
    )
  }, [semanticTree, renderHeader, renderFooter, renderSection, renderField, runtime, readonly, missingRenderers])

  return (
    <form className="mfs-form" onSubmit={handleSubmit}>
      {!runtime.isInitialized && <div className="mfs-form__loading">Loading...</div>}
      {runtime.error && <div className="mfs-form__error">{'message' in runtime.error ? runtime.error.message : runtime.error.type}</div>}
      {runtime.isInitialized && !runtime.error && content}
    </form>
  )
}

export default FormRenderer
