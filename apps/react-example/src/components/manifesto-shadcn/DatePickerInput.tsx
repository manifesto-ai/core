import type { FieldComponentProps } from '@manifesto-ai/react'
import { format, parseISO } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export default function DatePickerInput({
  field,
  value,
  onChange,
  disabled,
  errors,
}: FieldComponentProps) {
  const hasError = errors.length > 0
  const dateValue = value ? parseISO(value as string) : undefined

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={field.fieldId}
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            hasError && 'border-destructive'
          )}
          aria-invalid={hasError}
        >
          <CalendarIcon className="mr-2 size-4" />
          {dateValue ? format(dateValue, 'PPP') : field.placeholder ?? 'Pick a date'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={(date) => onChange(date?.toISOString().split('T')[0])}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
