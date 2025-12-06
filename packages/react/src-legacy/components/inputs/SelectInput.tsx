/**
 * SelectInput - Single select component
 */

import React from 'react'
import type { InputComponentProps } from '../../types/component'

export const SelectInput: React.FC<InputComponentProps> = ({
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
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    onChange(val === '' ? null : val)
  }

  return (
    <select
      id={fieldId}
      value={(value as string | number) ?? ''}
      disabled={disabled || readonly}
      className={`input-select ${hasError ? 'input-select--error' : ''} ${disabled ? 'input-select--disabled' : ''}`}
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

export default SelectInput
