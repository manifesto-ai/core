import React from 'react'
import type { FieldComponentProps } from '../../types'
import { FieldWrapper } from './FieldWrapper'

const CustomField: React.FC<FieldComponentProps> = ({
  field,
  value,
  onChange,
  disabled,
  readonly,
  errors,
}) => {
  return (
    <FieldWrapper field={field} value={value} onChange={onChange} disabled={disabled} readonly={readonly} errors={errors}>
      <div className="mfs-unsupported">
        Custom renderer for "{field.componentType}" is not provided. Override the field registry to supply one.
      </div>
      <input
        className="mfs-input"
        type="text"
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        readOnly={readonly}
      />
    </FieldWrapper>
  )
}

export default CustomField
