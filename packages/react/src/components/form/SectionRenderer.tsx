import React from 'react'
import type { ResolvedSectionSemanticNode } from '@manifesto-ai/ui'
import type { FieldRendererComponent } from '../../types'
import FieldRenderer from './FieldRenderer'
import { useHighlight } from '../../hooks/useHighlight'

interface SectionRendererProps {
  section: ResolvedSectionSemanticNode<FieldRendererComponent>
  readonly?: boolean
  onChange: (fieldId: string, value: unknown) => void
  renderField?: (field: ResolvedSectionSemanticNode<FieldRendererComponent>['fields'][number]) => React.ReactNode
  liveValidators?: ReadonlyMap<string, readonly import('@manifesto-ai/ui').LightweightValidator[]>
}

const SectionRenderer: React.FC<SectionRendererProps> = ({
  section,
  readonly,
  onChange,
  renderField,
  liveValidators,
}) => {
  // Highlight support for sections
  const { dataAttributes } = useHighlight(`section:${section.id}`)

  // Skip rendering if section is hidden
  if (section.hidden) return null
  if (!section.fields.length) return null

  return (
    <section className="mfs-section" data-section-id={section.id} {...dataAttributes}>
      {(section.title || section.description) && (
        <header className="mfs-section__header">
          {section.title && <h3 className="mfs-section__title">{section.title}</h3>}
          {section.description && <p className="mfs-section__description">{section.description}</p>}
        </header>
      )}

      <div className="mfs-section__fields">
        {section.fields.map((field) =>
          renderField ? (
            <React.Fragment key={field.id}>{renderField(field)}</React.Fragment>
          ) : (
            <FieldRenderer
              key={field.id}
              node={field}
              readonly={readonly}
              onChange={onChange}
              liveValidators={liveValidators}
            />
          )
        )}
      </div>
    </section>
  )
}

export default SectionRenderer
