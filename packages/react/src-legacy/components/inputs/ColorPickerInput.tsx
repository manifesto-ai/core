/**
 * ColorPickerInput - Color picker component
 */

import React from 'react'
import type { InputComponentProps } from '../../types/component'

export const ColorPickerInput: React.FC<InputComponentProps> = ({
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
    onChange(e.target.value)
  }

  const { showHex = true, ...restProps } = componentProps as { showHex?: boolean }

  return (
    <div className={`input-color ${hasError ? 'input-color--error' : ''} ${disabled ? 'input-color--disabled' : ''}`}>
      <input
        type="color"
        id={fieldId}
        value={(value as string) ?? '#000000'}
        disabled={disabled}
        readOnly={readonly}
        className="input-color__input"
        onChange={handleChange}
        onFocus={onFocus}
        onBlur={onBlur}
        {...restProps}
      />
      {showHex && <span className="input-color__value">{(value as string) ?? '#000000'}</span>}
    </div>
  )
}

export default ColorPickerInput
