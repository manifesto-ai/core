import type { FieldComponentProps } from '@manifesto-ai/react'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export default function TextareaInput({
  field,
  value,
  onChange,
  disabled,
  readonly,
  errors,
}: FieldComponentProps) {
  const hasError = errors.length > 0
  const props = field.state.props ?? {}
  const rows = (props.rows as number) ?? 4

  return (
    <Textarea
      id={field.fieldId}
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      readOnly={readonly}
      placeholder={field.placeholder}
      rows={rows}
      aria-invalid={hasError}
      className={cn(hasError && 'border-destructive')}
    />
  )
}
