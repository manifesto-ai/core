import React from 'react'
import type { ResolvedFieldSemanticNode } from '@manifesto-ai/ui'
import type { FieldRendererComponent } from '../../types'
import { useHighlight } from '../../hooks/useHighlight'

interface FieldRendererProps {
  node: ResolvedFieldSemanticNode<FieldRendererComponent>
  readonly?: boolean
  onChange: (fieldId: string, value: unknown) => void
  liveValidators?: ReadonlyMap<string, readonly import('@manifesto-ai/ui').LightweightValidator[]>
}

const FieldRenderer: React.FC<FieldRendererProps> = ({ node, readonly, onChange, liveValidators }) => {
  // Note: Hidden filtering is done at SemanticTree level via includeHidden option.
  // If the node reaches here, it should be rendered (possibly with hidden styling).
  const Renderer = node.renderer ?? MissingRenderer
  const live = liveValidators?.get(node.fieldId) ?? node.state.liveValidators
  const liveErrors =
    live?.map((validator) => (validator.test(node.state.value) ? null : validator.message)).filter(
      (msg): msg is string => !!msg
    ) ?? []
  const errors = [...(node.state.errors ?? []), ...liveErrors]

  // Highlight support
  const { dataAttributes } = useHighlight(node.fieldId)

  const hiddenStyle = node.state.hidden ? { display: 'none' } : undefined

  return (
    <div
      className="mfs-field-row"
      data-field-id={node.fieldId}
      data-hidden={node.state.hidden ? 'true' : undefined}
      style={hiddenStyle}
      {...dataAttributes}
    >
      <Renderer
        field={node}
        value={node.state.value}
        disabled={node.state.disabled}
        readonly={readonly}
        errors={errors}
        liveErrors={liveErrors}
        onChange={(val) => onChange(node.fieldId, val)}
      />
    </div>
  )
}

const MissingRenderer: FieldRendererComponent = ({ field }) => (
  <div className="mfs-field mfs-field--missing">
    Missing renderer for type "{field.componentType}"
  </div>
)

export default FieldRenderer
