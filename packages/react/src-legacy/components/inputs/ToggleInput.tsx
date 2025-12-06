/**
 * ToggleInput - Toggle/switch input component
 */

import React from 'react'
import type { InputComponentProps } from '../../types/component'

export const ToggleInput: React.FC<InputComponentProps> = ({
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
  const handleChange = () => {
    if (!readonly && !disabled) {
      onChange(!value)
    }
  }

  const { label, ...restProps } = componentProps as { label?: string }

  return (
    <label
      className={`input-toggle ${hasError ? 'input-toggle--error' : ''} ${disabled ? 'input-toggle--disabled' : ''}`}
    >
      <button
        type="button"
        id={fieldId}
        role="switch"
        aria-checked={Boolean(value)}
        disabled={disabled}
        className={`input-toggle__switch ${value ? 'input-toggle__switch--on' : ''}`}
        onClick={handleChange}
        onFocus={onFocus}
        onBlur={onBlur}
        {...restProps}
      >
        <span className="input-toggle__thumb" />
      </button>
      {label && <span className="input-toggle__label">{label}</span>}
    </label>
  )
}

export default ToggleInput
