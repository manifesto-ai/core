/**
 * SliderInput - Slider/range input component
 */

import React from 'react'
import type { InputComponentProps } from '../../types/component'

export const SliderInput: React.FC<InputComponentProps> = ({
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
    onChange(Number(e.target.value))
  }

  const { min = 0, max = 100, step = 1, showValue = true, ...restProps } = componentProps as {
    min?: number
    max?: number
    step?: number
    showValue?: boolean
  }

  return (
    <div className={`input-slider ${hasError ? 'input-slider--error' : ''} ${disabled ? 'input-slider--disabled' : ''}`}>
      <input
        type="range"
        id={fieldId}
        value={(value as number) ?? min}
        disabled={disabled}
        readOnly={readonly}
        min={min}
        max={max}
        step={step}
        className="input-slider__input"
        onChange={handleChange}
        onFocus={onFocus}
        onBlur={onBlur}
        {...restProps}
      />
      {showValue && <span className="input-slider__value">{(value as number) ?? min}</span>}
    </div>
  )
}

export default SliderInput
