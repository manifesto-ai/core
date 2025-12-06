import type { FieldComponentProps } from '@manifesto-ai/react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export default function TextInput({
  field,
  value,
  onChange,
  disabled,
  readonly,
  errors,
}: FieldComponentProps) {
  const hasError = errors.length > 0
  return (
    <Input
      id={field.fieldId}
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      readOnly={readonly}
      placeholder={field.placeholder}
      aria-invalid={hasError}
      className={cn(hasError && 'border-destructive')}
    />
  )
}
