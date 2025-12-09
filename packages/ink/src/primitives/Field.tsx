/**
 * Field Primitive
 *
 * FieldSnapshot을 터미널 UI로 렌더링
 * - text → TextInput
 * - select → SelectInput
 * - checkbox → 토글 표시
 * - 기타 → 읽기 전용 텍스트
 */

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import SelectInput from 'ink-select-input'
import type { FieldSnapshot, FieldOption } from '@manifesto-ai/view-snapshot'

// ============================================================================
// Props
// ============================================================================

export interface FieldProps {
  /** 필드 스냅샷 */
  field: FieldSnapshot
  /** 값 변경 핸들러 */
  onChange?: (value: unknown) => void
  /** 포커스 여부 */
  isFocused?: boolean
}

// ============================================================================
// Field Component
// ============================================================================

export const Field: React.FC<FieldProps> = ({ field, onChange, isFocused = false }) => {
  if (field.hidden) {
    return null
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={field.disabled ? 'gray' : 'white'}>
          {field.label}
          {field.required && <Text color="red">*</Text>}
          {': '}
        </Text>
        <FieldInput field={field} onChange={onChange} isFocused={isFocused} />
      </Box>
      {field.errors && field.errors.length > 0 && (
        <Box marginLeft={2}>
          <Text color="red">{field.errors[0]}</Text>
        </Box>
      )}
    </Box>
  )
}

// ============================================================================
// FieldInput Component
// ============================================================================

interface FieldInputProps {
  field: FieldSnapshot
  onChange?: (value: unknown) => void
  isFocused?: boolean
}

const FieldInput: React.FC<FieldInputProps> = ({ field, onChange, isFocused }) => {
  switch (field.type) {
    case 'text':
    case 'textarea':
      return (
        <TextInputField
          value={String(field.value ?? '')}
          onChange={onChange}
          disabled={field.disabled}
          isFocused={isFocused}
        />
      )

    case 'number':
      return (
        <NumberInputField
          value={field.value as number | undefined}
          onChange={onChange}
          disabled={field.disabled}
          isFocused={isFocused}
        />
      )

    case 'select':
    case 'radio':
      return (
        <SelectField
          value={field.value as string | number | undefined}
          options={field.options ?? []}
          onChange={onChange}
          disabled={field.disabled}
          isFocused={isFocused}
        />
      )

    case 'multiselect':
      return (
        <MultiSelectField
          value={(field.value as (string | number)[]) ?? []}
          options={field.options ?? []}
          onChange={onChange}
          disabled={field.disabled}
          isFocused={isFocused}
        />
      )

    case 'checkbox':
      return (
        <CheckboxField
          value={Boolean(field.value)}
          onChange={onChange}
          disabled={field.disabled}
          isFocused={isFocused}
        />
      )

    case 'datepicker':
    case 'daterangepicker':
    case 'file':
    default:
      // 읽기 전용으로 표시
      return <Text color="gray">{String(field.value ?? '-')}</Text>
  }
}

// ============================================================================
// Text Input Field
// ============================================================================

interface TextInputFieldProps {
  value: string
  onChange?: (value: unknown) => void
  disabled?: boolean
  isFocused?: boolean
}

const TextInputField: React.FC<TextInputFieldProps> = ({
  value,
  onChange,
  disabled,
  isFocused,
}) => {
  const [localValue, setLocalValue] = useState(value)

  const handleChange = (newValue: string) => {
    setLocalValue(newValue)
    onChange?.(newValue)
  }

  if (disabled) {
    return <Text color="gray">{value || '-'}</Text>
  }

  return (
    <Box>
      <Text color="cyan">[</Text>
      <TextInput
        value={localValue}
        onChange={handleChange}
        focus={isFocused}
        placeholder="..."
      />
      <Text color="cyan">]</Text>
    </Box>
  )
}

// ============================================================================
// Number Input Field
// ============================================================================

interface NumberInputFieldProps {
  value: number | undefined
  onChange?: (value: unknown) => void
  disabled?: boolean
  isFocused?: boolean
}

const NumberInputField: React.FC<NumberInputFieldProps> = ({
  value,
  onChange,
  disabled,
  isFocused,
}) => {
  const [localValue, setLocalValue] = useState(String(value ?? ''))

  const handleChange = (newValue: string) => {
    // 숫자만 허용
    const numericValue = newValue.replace(/[^0-9.-]/g, '')
    setLocalValue(numericValue)
    const num = parseFloat(numericValue)
    if (!isNaN(num)) {
      onChange?.(num)
    }
  }

  if (disabled) {
    return <Text color="gray">{value ?? '-'}</Text>
  }

  return (
    <Box>
      <Text color="cyan">[</Text>
      <TextInput
        value={localValue}
        onChange={handleChange}
        focus={isFocused}
        placeholder="0"
      />
      <Text color="cyan">]</Text>
    </Box>
  )
}

// ============================================================================
// Select Field
// ============================================================================

interface SelectFieldProps {
  value: string | number | undefined
  options: readonly FieldOption[]
  onChange?: (value: unknown) => void
  disabled?: boolean
  isFocused?: boolean
}

const SelectField: React.FC<SelectFieldProps> = ({
  value,
  options,
  onChange,
  disabled,
  isFocused,
}) => {
  if (disabled) {
    const selected = options.find((opt) => opt.value === value)
    return <Text color="gray">{selected?.label ?? '-'}</Text>
  }

  const items = options.map((opt) => ({
    label: opt.label,
    value: String(opt.value),
  }))

  const handleSelect = (item: { label: string; value: string }) => {
    // 원래 타입으로 변환
    const original = options.find((opt) => String(opt.value) === item.value)
    onChange?.(original?.value ?? item.value)
  }

  if (!isFocused) {
    const selected = options.find((opt) => opt.value === value)
    return <Text color="yellow">{selected?.label ?? '선택하세요'}</Text>
  }

  return (
    <SelectInput
      items={items}
      initialIndex={options.findIndex((opt) => opt.value === value)}
      onSelect={handleSelect}
    />
  )
}

// ============================================================================
// Multi Select Field
// ============================================================================

interface MultiSelectFieldProps {
  value: (string | number)[]
  options: readonly FieldOption[]
  onChange?: (value: unknown) => void
  disabled?: boolean
  isFocused?: boolean
}

const MultiSelectField: React.FC<MultiSelectFieldProps> = ({
  value,
  options,
  onChange,
  disabled,
  isFocused,
}) => {
  const [selectedValues, setSelectedValues] = useState<Set<string | number>>(new Set(value))
  const [cursor, setCursor] = useState(0)

  useInput(
    (input, key) => {
      if (!isFocused || disabled) return

      if (key.upArrow) {
        setCursor((prev) => Math.max(0, prev - 1))
      } else if (key.downArrow) {
        setCursor((prev) => Math.min(options.length - 1, prev + 1))
      } else if (input === ' ' || key.return) {
        const option = options[cursor]
        if (option && !option.disabled) {
          const newSelected = new Set(selectedValues)
          if (newSelected.has(option.value)) {
            newSelected.delete(option.value)
          } else {
            newSelected.add(option.value)
          }
          setSelectedValues(newSelected)
          onChange?.(Array.from(newSelected))
        }
      }
    },
    { isActive: isFocused && !disabled }
  )

  if (disabled) {
    const labels = options
      .filter((opt) => value.includes(opt.value))
      .map((opt) => opt.label)
      .join(', ')
    return <Text color="gray">{labels || '-'}</Text>
  }

  return (
    <Box flexDirection="column">
      {options.map((opt, index) => {
        const isSelected = selectedValues.has(opt.value)
        const isCurrent = cursor === index && isFocused

        return (
          <Box key={String(opt.value)}>
            <Text
              color={opt.disabled ? 'gray' : isCurrent ? 'cyan' : 'white'}
              backgroundColor={isCurrent ? 'blue' : undefined}
            >
              {isSelected ? '[x]' : '[ ]'} {opt.label}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}

// ============================================================================
// Checkbox Field
// ============================================================================

interface CheckboxFieldProps {
  value: boolean
  onChange?: (value: unknown) => void
  disabled?: boolean
  isFocused?: boolean
}

const CheckboxField: React.FC<CheckboxFieldProps> = ({
  value,
  onChange,
  disabled,
  isFocused,
}) => {
  useInput(
    (input, key) => {
      if (disabled) return
      if (input === ' ' || key.return) {
        onChange?.(!value)
      }
    },
    { isActive: isFocused && !disabled }
  )

  const checkbox = value ? '[x]' : '[ ]'
  const color = disabled ? 'gray' : isFocused ? 'cyan' : 'green'

  return (
    <Text color={color} backgroundColor={isFocused ? 'blue' : undefined}>
      {checkbox}
    </Text>
  )
}

export default Field
