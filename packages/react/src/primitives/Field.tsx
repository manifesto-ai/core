/**
 * Field Primitive
 *
 * Molecular 수준의 필드 컴포넌트 (Label + Input + Error 조합)
 * FieldSnapshot을 받아 적절한 입력 컴포넌트를 렌더링합니다.
 */

import React from 'react'
import type { FieldPrimitiveProps } from '../types/primitives'
import type { FieldSnapshot, FieldType } from '@manifesto-ai/view-snapshot'

// ============================================================================
// Field Input Components
// ============================================================================

/**
 * 텍스트 입력
 */
const TextInput: React.FC<{
  field: FieldSnapshot
  onChange: (value: unknown) => void
  readonly?: boolean
}> = ({ field, onChange, readonly }) => (
  <input
    type="text"
    id={field.id}
    value={String(field.value ?? '')}
    onChange={(e) => onChange(e.target.value)}
    disabled={field.disabled}
    readOnly={readonly}
    required={field.required}
    className="mfs-field-input mfs-field-input--text"
  />
)

/**
 * 숫자 입력
 */
const NumberInput: React.FC<{
  field: FieldSnapshot
  onChange: (value: unknown) => void
  readonly?: boolean
}> = ({ field, onChange, readonly }) => (
  <input
    type="number"
    id={field.id}
    value={field.value !== null && field.value !== undefined ? Number(field.value) : ''}
    onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    disabled={field.disabled}
    readOnly={readonly}
    required={field.required}
    className="mfs-field-input mfs-field-input--number"
  />
)

/**
 * 텍스트 영역
 */
const TextareaInput: React.FC<{
  field: FieldSnapshot
  onChange: (value: unknown) => void
  readonly?: boolean
}> = ({ field, onChange, readonly }) => (
  <textarea
    id={field.id}
    value={String(field.value ?? '')}
    onChange={(e) => onChange(e.target.value)}
    disabled={field.disabled}
    readOnly={readonly}
    required={field.required}
    className="mfs-field-input mfs-field-input--textarea"
    rows={4}
  />
)

/**
 * 체크박스
 */
const CheckboxInput: React.FC<{
  field: FieldSnapshot
  onChange: (value: unknown) => void
  readonly?: boolean
}> = ({ field, onChange, readonly }) => (
  <input
    type="checkbox"
    id={field.id}
    checked={Boolean(field.value)}
    onChange={(e) => onChange(e.target.checked)}
    disabled={field.disabled || readonly}
    className="mfs-field-input mfs-field-input--checkbox"
  />
)

/**
 * 라디오 버튼 그룹
 */
const RadioInput: React.FC<{
  field: FieldSnapshot
  onChange: (value: unknown) => void
  readonly?: boolean
}> = ({ field, onChange, readonly }) => (
  <div className="mfs-field-input mfs-field-input--radio-group">
    {field.options?.map((option) => (
      <label key={String(option.value)} className="mfs-radio-option">
        <input
          type="radio"
          name={field.id}
          value={String(option.value)}
          checked={field.value === option.value}
          onChange={() => onChange(option.value)}
          disabled={field.disabled || option.disabled || readonly}
        />
        <span>{option.label}</span>
      </label>
    ))}
  </div>
)

/**
 * 단일 선택 (Select)
 */
const SelectInput: React.FC<{
  field: FieldSnapshot
  onChange: (value: unknown) => void
  readonly?: boolean
}> = ({ field, onChange, readonly }) => {
  // value를 문자열로 변환 (null/undefined는 빈 문자열)
  const currentValue = field.value !== null && field.value !== undefined ? String(field.value) : ''

  // 디버깅: 렌더링 시 받은 값 확인
  console.log('[SelectInput] render', {
    fieldId: field.id,
    fieldValue: field.value,
    currentValue,
    optionValues: field.options?.map(o => o.value),
  })

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value
    const selectedOption = e.target.options[e.target.selectedIndex]
    console.log('[SelectInput] onChange', {
      fieldId: field.id,
      currentValue,
      newValue,
      selectedText: selectedOption?.text,
      selectedIndex: e.target.selectedIndex,
    })
    // 빈 문자열은 그대로 빈 문자열로 전달 (null로 변환하지 않음)
    onChange(newValue)
  }

  // 옵션이 있으면 placeholder 옵션 불필요
  const hasOptions = field.options && field.options.length > 0

  return (
    <select
      id={field.id}
      value={currentValue}
      onChange={handleChange}
      disabled={field.disabled || readonly}
      required={field.required}
      className="mfs-field-input mfs-field-input--select"
    >
      {!hasOptions && <option value="">선택하세요</option>}
      {field.options?.map((option) => (
        <option
          key={String(option.value)}
          value={String(option.value)}
          disabled={option.disabled}
        >
          {option.label}
        </option>
      ))}
    </select>
  )
}

/**
 * 다중 선택
 */
const MultiSelectInput: React.FC<{
  field: FieldSnapshot
  onChange: (value: unknown) => void
  readonly?: boolean
}> = ({ field, onChange, readonly }) => {
  const selectedValues = Array.isArray(field.value) ? field.value : []

  const handleChange = (optionValue: string | number, checked: boolean) => {
    if (checked) {
      onChange([...selectedValues, optionValue])
    } else {
      onChange(selectedValues.filter((v) => v !== optionValue))
    }
  }

  return (
    <div className="mfs-field-input mfs-field-input--multiselect">
      {field.options?.map((option) => (
        <label key={String(option.value)} className="mfs-multiselect-option">
          <input
            type="checkbox"
            checked={selectedValues.includes(option.value)}
            onChange={(e) => handleChange(option.value, e.target.checked)}
            disabled={field.disabled || option.disabled || readonly}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  )
}

/**
 * 날짜 선택
 */
const DateInput: React.FC<{
  field: FieldSnapshot
  onChange: (value: unknown) => void
  readonly?: boolean
}> = ({ field, onChange, readonly }) => (
  <input
    type="date"
    id={field.id}
    value={field.value ? String(field.value) : ''}
    onChange={(e) => onChange(e.target.value || null)}
    disabled={field.disabled}
    readOnly={readonly}
    required={field.required}
    className="mfs-field-input mfs-field-input--date"
  />
)

/**
 * 날짜 범위 선택
 */
const DateRangeInput: React.FC<{
  field: FieldSnapshot
  onChange: (value: unknown) => void
  readonly?: boolean
}> = ({ field, onChange, readonly }) => {
  const value = (field.value as { start?: string; end?: string }) ?? {}

  return (
    <div className="mfs-field-input mfs-field-input--daterange">
      <input
        type="date"
        value={value.start ?? ''}
        onChange={(e) => onChange({ ...value, start: e.target.value || undefined })}
        disabled={field.disabled}
        readOnly={readonly}
        className="mfs-daterange-start"
      />
      <span className="mfs-daterange-separator">~</span>
      <input
        type="date"
        value={value.end ?? ''}
        onChange={(e) => onChange({ ...value, end: e.target.value || undefined })}
        disabled={field.disabled}
        readOnly={readonly}
        className="mfs-daterange-end"
      />
    </div>
  )
}

/**
 * 파일 업로드
 */
const FileInput: React.FC<{
  field: FieldSnapshot
  onChange: (value: unknown) => void
  readonly?: boolean
}> = ({ field, onChange, readonly }) => (
  <input
    type="file"
    id={field.id}
    onChange={(e) => {
      const files = e.target.files
      onChange(files && files.length > 0 ? files[0] : null)
    }}
    disabled={field.disabled || readonly}
    className="mfs-field-input mfs-field-input--file"
  />
)

// ============================================================================
// Field Type to Component Mapping
// ============================================================================

const FIELD_COMPONENTS: Record<
  FieldType,
  React.FC<{
    field: FieldSnapshot
    onChange: (value: unknown) => void
    readonly?: boolean
  }>
> = {
  text: TextInput,
  number: NumberInput,
  textarea: TextareaInput,
  checkbox: CheckboxInput,
  radio: RadioInput,
  select: SelectInput,
  multiselect: MultiSelectInput,
  datepicker: DateInput,
  daterangepicker: DateRangeInput,
  file: FileInput,
}

// ============================================================================
// Field Primitive Component
// ============================================================================

/**
 * Field Primitive
 *
 * Molecular 수준의 필드 컴포넌트입니다.
 * Label + Input + Error를 조합하여 렌더링합니다.
 */
export const Field: React.FC<FieldPrimitiveProps> = ({
  field,
  onChange,
  layout = 'vertical',
  hideLabel = false,
  hideError = false,
  slots,
  readonly,
  className,
}) => {
  // 숨김 필드는 렌더링하지 않음
  if (field.hidden) {
    return null
  }

  const hasError = field.errors && field.errors.length > 0
  const InputComponent = FIELD_COMPONENTS[field.type] ?? TextInput

  // 슬롯 렌더링
  const renderLabel = () => {
    if (hideLabel) return null
    if (slots?.label) return slots.label({ field })

    return (
      <label htmlFor={field.id} className="mfs-field-label">
        {field.label}
        {field.required && <span className="mfs-field-required">*</span>}
      </label>
    )
  }

  const renderError = () => {
    if (hideError || !hasError) return null
    if (slots?.error) return slots.error({ errors: field.errors! })

    return (
      <div className="mfs-field-errors">
        {field.errors!.map((error, index) => (
          <span key={index} className="mfs-field-error">
            {error}
          </span>
        ))}
      </div>
    )
  }

  // 체크박스는 레이아웃이 다름
  const isInlineLabel = field.type === 'checkbox'

  const classNames = [
    'mfs-field',
    `mfs-field--${layout}`,
    `mfs-field--${field.type}`,
    hasError && 'mfs-field--error',
    field.disabled && 'mfs-field--disabled',
    readonly && 'mfs-field--readonly',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  if (isInlineLabel) {
    return (
      <div className={classNames}>
        <div className="mfs-field-inline">
          <InputComponent field={field} onChange={onChange} readonly={readonly} />
          {renderLabel()}
        </div>
        {renderError()}
      </div>
    )
  }

  return (
    <div className={classNames}>
      {renderLabel()}
      <InputComponent field={field} onChange={onChange} readonly={readonly} />
      {renderError()}
    </div>
  )
}

export default Field
