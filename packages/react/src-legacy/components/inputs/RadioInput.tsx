/**
 * RadioInput - Radio button group component
 */

import React from 'react'
import type { InputComponentProps } from '../../types/component'

export const RadioInput: React.FC<InputComponentProps> = ({
  fieldId,
  value,
  onChange,
  disabled = false,
  readonly = false,
  componentProps = {},
  hasError = false,
  options = [],
  onFocus,
  onBlur,
}) => {
  const handleChange = (optionValue: string | number) => {
    if (!readonly) {
      onChange(optionValue)
    }
  }

  const { direction = 'vertical', ...restProps } = componentProps as { direction?: 'horizontal' | 'vertical' }

  return (
    <div
      className={`input-radio ${direction === 'horizontal' ? 'input-radio--horizontal' : ''} ${hasError ? 'input-radio--error' : ''}`}
      role="radiogroup"
      {...restProps}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={`input-radio__option ${option.disabled || disabled ? 'input-radio__option--disabled' : ''}`}
        >
          <input
            type="radio"
            name={fieldId}
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled || disabled}
            className="input-radio__input"
            onChange={() => handleChange(option.value)}
            onFocus={onFocus}
            onBlur={onBlur}
          />
          <span className="input-radio__label">{option.label}</span>
        </label>
      ))}
    </div>
  )
}

export default RadioInput
