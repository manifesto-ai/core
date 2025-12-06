import React from 'react'
import type { FieldComponentProps } from '../../types'
import { FieldWrapper } from './FieldWrapper'

const MultiSelectField: React.FC<FieldComponentProps> = ({
  field,
  value,
  onChange,
  disabled,
  readonly,
  errors,
}) => {
  const options = field.state.options ?? []
  const selectedValues = Array.isArray(value) ? value.map(String) : []

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValues = Array.from(e.target.selectedOptions).map((opt) => opt.value)
    onChange(newValues)
  }

  return (
    <FieldWrapper field={field} value={value} onChange={onChange} disabled={disabled} readonly={readonly} errors={errors}>
      <select
        className="mfs-select"
        multiple
        value={selectedValues}
        onChange={handleChange}
        disabled={disabled}
        aria-readonly={readonly}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  )
}

export default MultiSelectField
