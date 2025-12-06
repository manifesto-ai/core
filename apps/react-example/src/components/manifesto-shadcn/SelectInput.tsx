import type { FieldComponentProps } from '@manifesto-ai/react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export default function SelectInput({
  field,
  value,
  onChange,
  disabled,
  errors,
}: FieldComponentProps) {
  const hasError = errors.length > 0
  const options = field.state.options ?? []

  return (
    <Select
      value={value != null ? String(value) : undefined}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger
        id={field.fieldId}
        className={cn(hasError && 'border-destructive')}
        aria-invalid={hasError}
      >
        <SelectValue placeholder={field.placeholder ?? 'Select an option'} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt: { value: string | number; label: string; disabled?: boolean }) => (
          <SelectItem
            key={String(opt.value)}
            value={String(opt.value)}
            disabled={opt.disabled}
          >
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
