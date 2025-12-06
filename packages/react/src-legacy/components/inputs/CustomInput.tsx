/**
 * CustomInput - Custom/fallback input component
 */

import React from 'react'
import type { InputComponentProps } from '../../types/component'

export const CustomInput: React.FC<InputComponentProps> = ({
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
  const { render, type = 'text', ...restProps } = componentProps as {
    render?: (props: InputComponentProps) => React.ReactNode
    type?: string
  }

  // If a custom render function is provided, use it
  if (render) {
    return (
      <>
        {render({
          fieldId,
          value,
          onChange,
          disabled,
          readonly,
          placeholder,
          componentProps,
          hasError,
          onFocus,
          onBlur,
        })}
      </>
    )
  }

  // Default to basic text input
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  return (
    <input
      type={type}
      id={fieldId}
      value={(value as string) ?? ''}
      disabled={disabled}
      readOnly={readonly}
      placeholder={placeholder}
      className={`input-custom ${hasError ? 'input-custom--error' : ''} ${disabled ? 'input-custom--disabled' : ''}`}
      onChange={handleChange}
      onFocus={onFocus}
      onBlur={onBlur}
      {...restProps}
    />
  )
}

export default CustomInput
