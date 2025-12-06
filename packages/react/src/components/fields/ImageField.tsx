import React from 'react'
import type { FieldComponentProps } from '../../types'
import { FieldWrapper } from './FieldWrapper'

const ImageField: React.FC<FieldComponentProps> = ({
  field,
  onChange,
  disabled,
  readonly,
  errors,
  value,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    onChange(file)
  }

  const src = typeof value === 'string' ? value : undefined

  return (
    <FieldWrapper field={field} value={value} onChange={onChange} disabled={disabled} readonly={readonly} errors={errors}>
      <input type="file" accept="image/*" disabled={disabled || readonly} onChange={handleChange} />
      {src && <img src={src} alt={field.label ?? field.id} className="mfs-image__preview" />}
    </FieldWrapper>
  )
}

export default ImageField
