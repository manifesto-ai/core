/**
 * FieldRenderer - Field renderer component
 *
 * Renders appropriate input component based on ComponentType
 * Looks up component from ComponentRegistry for dynamic rendering
 */

import React, { Suspense, useMemo, useCallback, memo } from 'react'
import type { ViewField } from '@manifesto-ai/schema'
import type { InputComponentProps } from '../../types/component'
import { useFormContext } from '../FormContext'
import FieldWrapper from './FieldWrapper'

export interface FieldRendererProps {
  /** Field definition */
  field: ViewField
}

const FieldRendererInner: React.FC<FieldRendererProps> = ({ field }) => {
  const { runtime, registry, readonly } = useFormContext()

  // Field meta information
  const fieldMeta = runtime.getField(field.id)

  // Current value
  const value = runtime.values[field.id]

  // Disabled state
  const isDisabled = fieldMeta?.disabled ?? false

  // Error list
  const errors = runtime.getFieldErrors(field.id)

  // Field options (for select, radio, etc.)
  const options = runtime.getFieldOptions(field.id)

  // Get component from registry
  const registration = registry.get(field.component)

  // Grid span style
  const spanStyle = useMemo((): React.CSSProperties => {
    const style: React.CSSProperties = {}
    if (field.colSpan) {
      style.gridColumn = `span ${field.colSpan}`
    }
    if (field.rowSpan) {
      style.gridRow = `span ${field.rowSpan}`
    }
    return style
  }, [field.colSpan, field.rowSpan])

  // Event handlers
  const handleChange = useCallback(
    (newValue: unknown) => {
      runtime.setFieldValue(field.id, newValue)
    },
    [runtime, field.id]
  )

  const handleFocus = useCallback(() => {
    runtime.focusField(field.id)
  }, [runtime, field.id])

  const handleBlur = useCallback(() => {
    runtime.blurField(field.id)
  }, [runtime, field.id])

  // Required field check (TODO: check from EntitySchema)
  const isRequired = field.label?.includes('*') ?? false

  // Render unknown component type
  if (!registration) {
    return (
      <FieldWrapper field={field} errors={errors} required={isRequired} style={spanStyle}>
        <div className="field-renderer__unknown">
          <span>Unknown component type: {field.component}</span>
        </div>
      </FieldWrapper>
    )
  }

  // Resolve component
  const InputComponent = useMemo((): React.ComponentType<InputComponentProps> => {
    if (typeof registration.component === 'function') {
      // Check if it's a React component or a dynamic import function
      // Dynamic imports return a Promise, React components don't
      const result = registration.component as unknown
      if (typeof result === 'function' && result.length === 0) {
        // Likely a dynamic import function
        const LazyComponent = React.lazy(registration.component as () => Promise<{ default: React.ComponentType<InputComponentProps> }>)
        return LazyComponent
      }
    }
    return registration.component as React.ComponentType<InputComponentProps>
  }, [registration])

  return (
    <FieldWrapper field={field} errors={errors} required={isRequired} style={spanStyle} className="field-renderer">
      <Suspense fallback={<div className="field-renderer__loading">Loading...</div>}>
        <InputComponent
          fieldId={field.id}
          value={value}
          onChange={handleChange}
          disabled={isDisabled}
          readonly={readonly}
          placeholder={field.placeholder}
          componentProps={field.props}
          hasError={errors.length > 0}
          options={options}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </Suspense>
    </FieldWrapper>
  )
}

// Memoize to prevent unnecessary re-renders
export const FieldRenderer = memo(FieldRendererInner)

export default FieldRenderer
