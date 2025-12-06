/**
 * FieldWrapper - Field wrapper component
 *
 * Wraps input with Label, HelpText, and Errors
 * Headless design for external styling control
 */

import React from 'react'
import type { ViewField } from '@manifesto-ai/schema'

export interface FieldWrapperProps {
  /** Field definition */
  field: ViewField
  /** Error message list */
  errors: readonly string[]
  /** Required field indicator */
  required?: boolean
  /** Children (input component) */
  children: React.ReactNode
  /** Custom style */
  style?: React.CSSProperties
  /** Custom className */
  className?: string
}

export const FieldWrapper: React.FC<FieldWrapperProps> = ({
  field,
  errors,
  required = false,
  children,
  style,
  className = '',
}) => {
  const hasError = errors.length > 0

  return (
    <div
      className={`field-wrapper ${hasError ? 'field-wrapper--has-error' : ''} ${required ? 'field-wrapper--required' : ''} ${className}`}
      data-field-id={field.id}
      style={style}
    >
      {/* Label */}
      {field.label && (
        <label htmlFor={field.id} className="field-wrapper__label">
          {field.label}
          {required && <span className="field-wrapper__required">*</span>}
        </label>
      )}

      {/* Input (children) */}
      <div className="field-wrapper__input">{children}</div>

      {/* Help Text (only when no errors) */}
      {field.helpText && !hasError && (
        <p className="field-wrapper__help">{field.helpText}</p>
      )}

      {/* Errors */}
      {hasError && (
        <ul className="field-wrapper__errors">
          {errors.map((error, idx) => (
            <li key={idx} className="field-wrapper__error">
              {error}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default FieldWrapper
