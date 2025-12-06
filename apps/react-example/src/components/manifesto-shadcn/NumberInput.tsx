import type { FieldComponentProps } from '@manifesto-ai/react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export default function NumberInput({
  field,
  value,
  onChange,
  disabled,
  readonly,
  errors,
}: FieldComponentProps) {
  const hasError = errors.length > 0
  const props = field.state.props ?? {}
  const min = props.min as number | undefined
  const max = props.max as number | undefined
  const step = props.step as number | undefined

  return (
    <Input
      type="number"
      id={field.fieldId}
      value={value != null ? String(value) : ''}
      onChange={(e) => {
        const val = e.target.value
        onChange(val === '' ? null : Number(val))
      }}
      disabled={disabled}
      readOnly={readonly}
      placeholder={field.placeholder}
      min={min}
      max={max}
      step={step}
      aria-invalid={hasError}
      className={cn(hasError && 'border-destructive')}
    />
  )
}
