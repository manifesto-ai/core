import React, { useEffect, useMemo, useState } from 'react'
import type { FormViewSchema } from '@manifesto-ai/schema'
import type {
  EvaluationContext,
  FetchHandler,
  NavigateHandler,
  EmitHandler,
  FormRuntime,
  FormRuntimeError,
} from '@manifesto-ai/engine'
import {
  resolveFieldRenderers,
  type ResolvedDetailSemanticNode,
  type ResolvedFieldSemanticNode,
  type ResolvedSectionSemanticNode,
  type SemanticRendererRegistry,
} from '@manifesto-ai/ui'
import { getDefaultSemanticRegistry } from '@manifesto-ai/ui'
import type { FieldRendererRegistry } from '@manifesto-ai/ui'
import { getDefaultFieldRegistry } from '../../registry'
import { useFormRuntime } from '../../hooks/useFormRuntime'
import SectionRenderer from '../form/SectionRenderer'
import type { FieldRendererComponent } from '../../types'

export interface DetailRendererProps {
  schema: FormViewSchema
  initialValues?: Record<string, unknown>
  context?: Partial<EvaluationContext>
  readonly?: boolean
  fieldRegistry?: FieldRendererRegistry<FieldRendererComponent>
  semanticRegistry?: SemanticRendererRegistry
  fetchHandler?: FetchHandler
  navigateHandler?: NavigateHandler
  emitHandler?: EmitHandler
  debug?: boolean
  onRuntimeReady?: (runtime: FormRuntime) => void
  onError?: (error: FormRuntimeError) => void
  renderField?: (field: ResolvedFieldSemanticNode<FieldRendererComponent>) => React.ReactNode
  renderSection?: (
    section: ResolvedSectionSemanticNode<FieldRendererComponent>,
    children: React.ReactNode
  ) => React.ReactNode
  renderHeader?: (tree: ResolvedDetailSemanticNode<FieldRendererComponent>) => React.ReactNode
  renderFooter?: (tree: ResolvedDetailSemanticNode<FieldRendererComponent>) => React.ReactNode
}

export const DetailRenderer: React.FC<DetailRendererProps> = ({
  schema,
  initialValues,
  context,
  readonly = true,
  fieldRegistry,
  semanticRegistry,
  fetchHandler,
  navigateHandler,
  emitHandler,
  debug = false,
  onRuntimeReady,
  onError,
  renderField,
  renderSection,
  renderHeader,
  renderFooter,
}) => {
  const runtime = useFormRuntime(schema, {
    initialValues,
    context,
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

  const [semanticTree, setSemanticTree] = useState<ResolvedDetailSemanticNode<FieldRendererComponent> | null>(null)
  const [missingRenderers, setMissingRenderers] = useState<readonly string[]>([])

  useEffect(() => {
    const contract = { kind: 'detail' as const, view: schema, state: runtime.getState() }
    const tree = semantic.build(contract, { includeHidden: true })
    resolveFieldRenderers(tree, registry).then(({ tree: resolved, missing }) => {
      setSemanticTree(resolved as ResolvedDetailSemanticNode<FieldRendererComponent>)
      setMissingRenderers(missing)
    })
  }, [schema, runtime.values, runtime.fields, runtime.isDirty, runtime.isValid, runtime.isSubmitting, runtime.isInitialized, semantic, registry])

  useEffect(() => {
    if (runtime.error) {
      onError?.(runtime.error)
    }
  }, [runtime.error, onError])

  useEffect(() => {
    const internal = runtime.getRuntime()
    if (internal) {
      onRuntimeReady?.(internal)
    }
  }, [runtime, onRuntimeReady])

  if (!semanticTree) return null

  const sections = semanticTree.sections.map((section) => {
    const sectionContent = (
      <SectionRenderer
        key={section.id}
        section={section}
        readonly={readonly}
        onChange={(fieldId, value) => runtime.setFieldValue(fieldId, value)}
        renderField={renderField}
      />
    )
    return renderSection ? renderSection(section, sectionContent) : sectionContent
  })

  return (
    <div className="mfs-detail">
      {renderHeader ? renderHeader(semanticTree) : null}
      {sections}
      {renderFooter ? renderFooter(semanticTree) : null}
      {missingRenderers.length > 0 && (
        <div className="mfs-warning">Missing renderers for: {missingRenderers.join(', ')}</div>
      )}
    </div>
  )
}

export default DetailRenderer
