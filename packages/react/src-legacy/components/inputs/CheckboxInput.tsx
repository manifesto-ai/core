/**
 * CheckboxInput - Checkbox input component
 */

import React from 'react'
import type { InputComponentProps } from '../../types/component'

export const CheckboxInput: React.FC<InputComponentProps> = ({
  fieldId,
  value,
  onChange,
  disabled = false,
  readonly = false,
  componentProps = {},
  hasError = false,
  onFocus,
  onBlur,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!readonly) {
      onChange(e.target.checked)
    }
  }

  const { label, ...restProps } = componentProps as { label?: string }

  return (
    <label
      className={`input-checkbox ${hasError ? 'input-checkbox--error' : ''} ${disabled ? 'input-checkbox--disabled' : ''}`}
    >
      <input
        type="checkbox"
        id={fieldId}
        checked={Boolean(value)}
        disabled={disabled}
        className="input-checkbox__input"
        onChange={handleChange}
        onFocus={onFocus}
        onBlur={onBlur}
        {...restProps}
      />
      {label && <span className="input-checkbox__label">{label}</span>}
    </label>
  )
}

export default CheckboxInput
