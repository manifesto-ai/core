/**
 * SectionRenderer - Section renderer component
 *
 * Renders ViewSection with grid layout
 * Handles visible/collapsible state
 */

import React, { useState, useMemo, useCallback } from 'react'
import type { ViewSection, Expression } from '@manifesto-ai/schema'
import { evaluate, createContext } from '@manifesto-ai/engine'
import { useFormContext } from '../FormContext'
import FieldRenderer from './FieldRenderer'

export interface SectionRendererProps {
  /** Section definition */
  section: ViewSection
  /** Header render prop */
  renderHeader?: () => React.ReactNode
  /** Footer render prop */
  renderFooter?: () => React.ReactNode
  /** Field override render prop */
  renderField?: (fieldId: string) => React.ReactNode | null
}

export const SectionRenderer: React.FC<SectionRendererProps> = ({
  section,
  renderHeader,
  renderFooter,
  renderField,
}) => {
  const { runtime } = useFormContext()

  // Collapse state (default: section.collapsed or false)
  const [isCollapsed, setIsCollapsed] = useState(
    (section as { collapsed?: boolean }).collapsed ?? false
  )

  const isCollapsible = (section as { collapsible?: boolean }).collapsible ?? false

  const toggleCollapse = useCallback(() => {
    if (isCollapsible) {
      setIsCollapsed((prev) => !prev)
    }
  }, [isCollapsible])

  // Grid style calculation
  const gridStyle = useMemo((): React.CSSProperties => {
    const layout = section.layout
    if (!layout) return {}

    const layoutType = (layout as { type?: string }).type
    if (layoutType !== 'grid' && layoutType !== 'form') return {}

    const columns = (layout as { columns?: number }).columns ?? 2
    const gap = (layout as { gap?: string }).gap ?? '1rem'

    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap,
    }
  }, [section.layout])

  // Visible fields (exclude hidden)
  const visibleFields = useMemo(() => {
    return section.fields.filter((field) => {
      return !runtime.isFieldHidden(field.id)
    })
  }, [section.fields, runtime])

  // Section visibility (Expression evaluation)
  const isVisible = useMemo(() => {
    const visibleExpr = section.visible

    // No visible expression means always visible
    if (!visibleExpr) {
      return true
    }

    // Create evaluation context (form values as state)
    const ctx = createContext({
      state: { ...runtime.values },
    })

    // Evaluate expression
    const result = evaluate(visibleExpr as Expression, ctx)

    if (result._tag === 'Err') {
      console.warn(`Section visibility evaluation error for ${section.id}:`, result.error)
      return true // Show on error
    }

    return Boolean(result.value)
  }, [section.id, section.visible, runtime.values])

  if (!isVisible) {
    return null
  }

  return (
    <section
      className={`section-renderer ${isCollapsed ? 'section-renderer--collapsed' : ''}`}
      data-section-id={section.id}
    >
      {/* Section Header */}
      {section.title && (
        <header
          className={`section-renderer__header ${isCollapsible ? 'section-renderer__header--collapsible' : ''}`}
          onClick={toggleCollapse}
        >
          {renderHeader ? (
            renderHeader()
          ) : (
            <div className="section-renderer__header-content">
              <h2 className="section-renderer__title">{section.title}</h2>
              {section.description && (
                <p className="section-renderer__description">{section.description}</p>
              )}
            </div>
          )}

          {isCollapsible && (
            <button
              type="button"
              className="section-renderer__toggle"
              aria-expanded={!isCollapsed}
            >
              <span className="section-renderer__toggle-icon">
                {isCollapsed ? '▼' : '▲'}
              </span>
            </button>
          )}
        </header>
      )}

      {/* Section Content */}
      {!isCollapsed && (
        <div className="section-renderer__content" style={gridStyle}>
          {visibleFields.map((field) => {
            // Check for field override
            const customRender = renderField?.(field.id)
            if (customRender !== undefined && customRender !== null) {
              return <React.Fragment key={field.id}>{customRender}</React.Fragment>
            }

            return <FieldRenderer key={field.id} field={field} />
          })}
        </div>
      )}

      {/* Section Footer */}
      {renderFooter && !isCollapsed && (
        <footer className="section-renderer__footer">{renderFooter()}</footer>
      )}
    </section>
  )
}

export default SectionRenderer
