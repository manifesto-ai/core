import type { FieldComponentProps } from '@manifesto-ai/react'
import { Slider } from '@/components/ui/slider'

export default function SliderInput({
  field,
  value,
  onChange,
  disabled,
}: FieldComponentProps) {
  const props = field.state.props ?? {}
  const min = (props.min as number) ?? 0
  const max = (props.max as number) ?? 100
  const step = (props.step as number) ?? 1

  return (
    <div className="flex items-center gap-4">
      <Slider
        id={field.fieldId}
        value={[value != null ? (value as number) : min]}
        onValueChange={([val]) => onChange(val)}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        className="flex-1"
      />
      <span className="w-12 text-right text-sm text-muted-foreground">
        {value != null ? String(value) : String(min)}
      </span>
    </div>
  )
}
