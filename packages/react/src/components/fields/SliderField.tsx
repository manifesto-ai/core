import React from 'react'
import type { FieldComponentProps } from '../../types'
import { FieldWrapper } from './FieldWrapper'

const SliderField: React.FC<FieldComponentProps> = ({
  field,
  value,
  onChange,
  disabled,
  readonly,
  errors,
}) => {
  const numericValue = typeof value === 'number' ? value : 0
  const min = (field.state.props?.min as number | undefined) ?? 0
  const max = (field.state.props?.max as number | undefined) ?? 100
  const step = (field.state.props?.step as number | undefined) ?? 1

  return (
    <FieldWrapper field={field} value={value} onChange={onChange} disabled={disabled} readonly={readonly} errors={errors}>
      <input
        className="mfs-input mfs-input--slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={numericValue}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        readOnly={readonly}
      />
      <div className="mfs-slider__value">{numericValue}</div>
    </FieldWrapper>
  )
}

export default SliderField
