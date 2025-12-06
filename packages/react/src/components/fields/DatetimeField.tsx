import React from 'react'
import type { FieldComponentProps } from '../../types'
import { FieldWrapper } from './FieldWrapper'

const DatetimeField: React.FC<FieldComponentProps> = ({
  field,
  value,
  onChange,
  disabled,
  readonly,
  errors,
}) => {
  const formatted = typeof value === 'string' ? value : ''
  return (
    <FieldWrapper field={field} value={value} onChange={onChange} disabled={disabled} readonly={readonly} errors={errors}>
      <input
        className="mfs-input"
        type="datetime-local"
        value={formatted}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        readOnly={readonly}
      />
    </FieldWrapper>
  )
}

export default DatetimeField
