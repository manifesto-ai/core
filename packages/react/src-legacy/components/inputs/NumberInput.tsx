/**
 * NumberInput - Number input component
 */

import React from 'react'
import type { InputComponentProps } from '../../types/component'

export const NumberInput: React.FC<InputComponentProps> = ({
  fieldId,
  value,
  onChange,
  disabled = false,
  readonly = false,
  placeholder,
  componentProps = {},
  hasError = false,
  onFocus,
  onBlur,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onChange(val === '' ? null : Number(val))
  }

  // Convert value to string for input
  const inputValue = value != null ? String(value) : ''

  return (
    <input
      type="number"
      id={fieldId}
      value={inputValue}
      disabled={disabled}
      readOnly={readonly}
      placeholder={placeholder}
      className={`input-number ${hasError ? 'input-number--error' : ''} ${disabled ? 'input-number--disabled' : ''}`}
      onChange={handleChange}
      onFocus={onFocus}
      onBlur={onBlur}
      {...componentProps}
    />
  )
}

export default NumberInput
