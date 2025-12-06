/**
 * DatePickerInput - Date picker component
 */

import React from 'react'
import type { InputComponentProps } from '../../types/component'

export const DatePickerInput: React.FC<InputComponentProps> = ({
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
    onChange(e.target.value || null)
  }

  const { min, max, ...restProps } = componentProps as { min?: string; max?: string }

  return (
    <input
      type="date"
      id={fieldId}
      value={(value as string) ?? ''}
      disabled={disabled}
      readOnly={readonly}
      placeholder={placeholder}
      min={min}
      max={max}
      className={`input-date ${hasError ? 'input-date--error' : ''} ${disabled ? 'input-date--disabled' : ''}`}
      onChange={handleChange}
      onFocus={onFocus}
      onBlur={onBlur}
      {...restProps}
    />
  )
}

export default DatePickerInput
