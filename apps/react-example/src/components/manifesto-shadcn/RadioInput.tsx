import type { FieldComponentProps } from '@manifesto-ai/react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'

export default function RadioInput({
  field,
  value,
  onChange,
  disabled,
}: FieldComponentProps) {
  const options = field.state.options ?? []

  return (
    <RadioGroup
      value={value != null ? String(value) : undefined}
      onValueChange={onChange}
      disabled={disabled}
    >
      {options.map((opt: { value: string | number; label: string; disabled?: boolean }) => (
        <div key={String(opt.value)} className="flex items-center gap-2">
          <RadioGroupItem
            value={String(opt.value)}
            id={`${field.fieldId}-${opt.value}`}
            disabled={opt.disabled}
          />
          <Label
            htmlFor={`${field.fieldId}-${opt.value}`}
            className="cursor-pointer font-normal"
          >
            {opt.label}
          </Label>
        </div>
      ))}
    </RadioGroup>
  )
}
