import React from 'react'
import type { FieldComponentProps } from '../../types'
import { FieldWrapper } from './FieldWrapper'

const ToggleField: React.FC<FieldComponentProps> = (props) => {
  return <CheckboxField {...props} />
}

const CheckboxField: React.FC<FieldComponentProps> = ({
  field,
  value,
  onChange,
  disabled,
  readonly,
  errors,
}) => {
  const checked = Boolean(value)
  return (
    <FieldWrapper field={field} value={value} onChange={onChange} disabled={disabled} readonly={readonly} errors={errors}>
      <label className="mfs-toggle">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled || readonly}
        />
        <span className="mfs-toggle__track">
          <span className="mfs-toggle__thumb" />
        </span>
        <span className="mfs-toggle__label">{field.label}</span>
      </label>
    </FieldWrapper>
  )
}

export default ToggleField
