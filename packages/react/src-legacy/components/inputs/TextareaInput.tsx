/**
 * TextareaInput - Textarea input component
 */

import React from 'react'
import type { InputComponentProps } from '../../types/component'

export const TextareaInput: React.FC<InputComponentProps> = ({
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
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
  }

  const { rows = 4, ...restProps } = componentProps as { rows?: number }

  return (
    <textarea
      id={fieldId}
      value={(value as string) ?? ''}
      disabled={disabled}
      readOnly={readonly}
      placeholder={placeholder}
      rows={rows}
      className={`input-textarea ${hasError ? 'input-textarea--error' : ''} ${disabled ? 'input-textarea--disabled' : ''}`}
      onChange={handleChange}
      onFocus={onFocus}
      onBlur={onBlur}
      {...restProps}
    />
  )
}

export default TextareaInput
