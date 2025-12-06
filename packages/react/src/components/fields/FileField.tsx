import React from 'react'
import type { FieldComponentProps } from '../../types'
import { FieldWrapper } from './FieldWrapper'

const FileField: React.FC<FieldComponentProps> = ({
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

  return (
    <FieldWrapper field={field} value={value} onChange={onChange} disabled={disabled} readonly={readonly} errors={errors}>
      <input type="file" disabled={disabled || readonly} onChange={handleChange} />
      {typeof value === 'string' && <div className="mfs-file__name">{value}</div>}
    </FieldWrapper>
  )
}

export default FileField
