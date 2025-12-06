import React from 'react'
import type { FieldComponentProps } from '../../types'
import { FieldWrapper } from './FieldWrapper'

const TextField: React.FC<FieldComponentProps> = ({
  field,
  value,
  onChange,
  disabled,
  readonly,
  errors,
}) => {
  return (
    <FieldWrapper field={field} value={value} onChange={onChange} disabled={disabled} readonly={readonly} errors={errors}>
      <input
        className="mfs-input"
        type="text"
        value={value === undefined || value === null ? '' : String(value)}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        readOnly={readonly}
      />
    </FieldWrapper>
  )
}

export default TextField
