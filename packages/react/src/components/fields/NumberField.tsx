import React from 'react'
import type { FieldComponentProps } from '../../types'
import { FieldWrapper } from './FieldWrapper'

const NumberField: React.FC<FieldComponentProps> = ({
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
        type="number"
        value={value === undefined || value === null ? '' : Number(value)}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        disabled={disabled}
        readOnly={readonly}
      />
    </FieldWrapper>
  )
}

export default NumberField
