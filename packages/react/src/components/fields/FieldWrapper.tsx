import React from 'react'
import type { FieldComponentProps } from '../../types'

interface FieldWrapperProps extends FieldComponentProps {
  children: React.ReactNode
}

export const FieldWrapper: React.FC<FieldWrapperProps> = ({
  field,
  errors,
  children,
}) => {
  return (
    <div className="mfs-field">
      {field.label && <div className="mfs-field__label">{field.label}</div>}
      {children}
      {field.helpText && <div className="mfs-field__help">{field.helpText}</div>}
      {errors.length > 0 && (
        <div className="mfs-field__errors">
          {errors.map((err, idx) => (
            <div key={idx} className="mfs-field__error">
              {err}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
