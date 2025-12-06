import React from 'react'
import type { FieldComponentProps } from '../../types'
import { FieldWrapper } from './FieldWrapper'

const RadioField: React.FC<FieldComponentProps> = ({
  field,
  value,
  onChange,
  disabled,
  readonly,
  errors,
}) => {
  const options = field.state.options ?? []
  const current = value === undefined || value === null ? '' : String(value)

  return (
    <FieldWrapper field={field} value={value} onChange={onChange} disabled={disabled} readonly={readonly} errors={errors}>
      <div className="mfs-radio-group">
        {options.map((opt) => (
          <label key={opt.value} className="mfs-radio">
            <input
              type="radio"
              value={opt.value}
              checked={current === String(opt.value)}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled || readonly || opt.disabled}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </FieldWrapper>
  )
}

export default RadioField
