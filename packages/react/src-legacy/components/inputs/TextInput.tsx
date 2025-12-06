/**
 * TextInput - Text input component
 */

import React from 'react'
import type { InputComponentProps } from '../../types/component'

export const TextInput: React.FC<InputComponentProps> = ({
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
    onChange(e.target.value)
  }

  return (
    <input
      type="text"
      id={fieldId}
      value={(value as string) ?? ''}
      disabled={disabled}
      readOnly={readonly}
      placeholder={placeholder}
      className={`input-text ${hasError ? 'input-text--error' : ''} ${disabled ? 'input-text--disabled' : ''}`}
      onChange={handleChange}
      onFocus={onFocus}
      onBlur={onBlur}
      {...componentProps}
    />
  )
}

export default TextInput
