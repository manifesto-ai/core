import type { FieldComponentProps } from '@manifesto-ai/react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

export default function ToggleInput({
  field,
  value,
  onChange,
  disabled,
}: FieldComponentProps) {
  const props = field.state.props ?? {}
  const label = (props.label as string) || field.label

  return (
    <div className="flex items-center gap-2">
      <Switch
        id={field.fieldId}
        checked={value as boolean}
        onCheckedChange={onChange}
        disabled={disabled}
      />
      {label && (
        <Label htmlFor={field.fieldId} className="cursor-pointer">
          {label}
        </Label>
      )}
    </div>
  )
}
