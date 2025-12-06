/**
 * MultiSelectInput - Multiple select component
 */

import React from 'react'
import type { InputComponentProps } from '../../types/component'

export const MultiSelectInput: React.FC<InputComponentProps> = ({
  fieldId,
  value,
  onChange,
  disabled = false,
  readonly = false,
  placeholder,
  componentProps = {},
  hasError = false,
  options = [],
  onFocus,
  onBlur,
}) => {
  const selectedValues = Array.isArray(value) ? value : []

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, (option) => option.value)
    onChange(selectedOptions)
  }

  return (
    <select
      id={fieldId}
      multiple
      value={selectedValues}
      disabled={disabled || readonly}
      className={`input-multi-select ${hasError ? 'input-multi-select--error' : ''} ${disabled ? 'input-multi-select--disabled' : ''}`}
      onChange={handleChange}
      onFocus={onFocus}
      onBlur={onBlur}
      {...componentProps}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export default MultiSelectInput
