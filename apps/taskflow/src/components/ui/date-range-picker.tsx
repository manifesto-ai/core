'use client';

import * as React from 'react';
import { CalendarIcon, X } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import type { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export type DateFilterField = 'dueDate' | 'createdAt';

export type DateFilterType = 'all' | 'today' | 'week' | 'month' | 'custom';

export interface DateFilter {
  field: DateFilterField;
  type: DateFilterType;
  startDate?: Date;
  endDate?: Date;
}

interface DateRangePickerProps {
  value?: DateFilter | null;
  onChange?: (filter: DateFilter | null) => void;
  className?: string;
  placeholder?: string;
}

const presets = [
  { label: 'Today', type: 'today' as const },
  { label: 'This week', type: 'week' as const },
  { label: 'This month', type: 'month' as const },
  { label: 'Custom range', type: 'custom' as const },
];

function getDateRangeFromType(type: DateFilterType): { startDate: Date; endDate: Date } | null {
  const now = new Date();
  switch (type) {
    case 'today':
      return { startDate: startOfDay(now), endDate: endOfDay(now) };
    case 'week':
      return { startDate: startOfWeek(now, { weekStartsOn: 0 }), endDate: endOfWeek(now, { weekStartsOn: 0 }) };
    case 'month':
      return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
    default:
      return null;
  }
}

export function DateRangePicker({
  value,
  onChange,
  className,
  placeholder = 'Filter by date',
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedField, setSelectedField] = React.useState<DateFilterField>(value?.field ?? 'createdAt');
  const [selectedType, setSelectedType] = React.useState<DateFilterType>(value?.type ?? 'all');
  const [customRange, setCustomRange] = React.useState<DateRange | undefined>(
    value?.type === 'custom' && value.startDate && value.endDate
      ? { from: value.startDate, to: value.endDate }
      : undefined
  );

  const handlePresetSelect = (type: DateFilterType) => {
    setSelectedType(type);
    if (type === 'custom') {
      // Don't close yet, let user select custom range
      return;
    }

    const range = getDateRangeFromType(type);
    if (range) {
      onChange?.({
        field: selectedField,
        type,
        startDate: range.startDate,
        endDate: range.endDate,
      });
    }
    setOpen(false);
  };

  const handleCustomRangeSelect = (range: DateRange | undefined) => {
    setCustomRange(range);
    if (range?.from && range?.to) {
      onChange?.({
        field: selectedField,
        type: 'custom',
        startDate: startOfDay(range.from),
        endDate: endOfDay(range.to),
      });
    }
  };

  const handleFieldChange = (field: DateFilterField) => {
    setSelectedField(field);
    if (value) {
      onChange?.({ ...value, field });
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.(null);
    setSelectedType('all');
    setCustomRange(undefined);
    setOpen(false);
  };

  const getDisplayText = () => {
    if (!value) return placeholder;

    const fieldLabel = value.field === 'dueDate' ? 'Due' : 'Created';

    switch (value.type) {
      case 'today':
        return `${fieldLabel}: Today`;
      case 'week':
        return `${fieldLabel}: This week`;
      case 'month':
        return `${fieldLabel}: This month`;
      case 'custom':
        if (value.startDate && value.endDate) {
          return `${fieldLabel}: ${format(value.startDate, 'MMM d')} - ${format(value.endDate, 'MMM d')}`;
        }
        return `${fieldLabel}: Custom`;
      default:
        return placeholder;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={value ? 'default' : 'outline'}
          size="sm"
          className={cn(
            'h-8 gap-2 rounded-md text-sm font-normal',
            value && 'bg-primary text-primary-foreground hover:bg-primary/90',
            className
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          <span>{getDisplayText()}</span>
          {value && (
            <span
              role="button"
              tabIndex={0}
              className="ml-1 rounded-sm hover:bg-background/20 p-0.5"
              onClick={handleClear}
              onKeyDown={(e) => e.key === 'Enter' && handleClear(e as unknown as React.MouseEvent)}
            >
              <X className="h-3.5 w-3.5 opacity-70 hover:opacity-100" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col">
          {/* Field selector */}
          <div className="flex border-b p-2 gap-1">
            <Button
              variant={selectedField === 'dueDate' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleFieldChange('dueDate')}
            >
              Due date
            </Button>
            <Button
              variant={selectedField === 'createdAt' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleFieldChange('createdAt')}
            >
              Created
            </Button>
          </div>

          {/* Presets */}
          <div className="flex flex-col gap-1 border-b p-2">
            {presets.map((preset) => (
              <Button
                key={preset.type}
                variant={selectedType === preset.type ? 'secondary' : 'ghost'}
                size="sm"
                className="justify-start h-8 text-sm"
                onClick={() => handlePresetSelect(preset.type)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Custom calendar (shown when custom is selected) */}
          {selectedType === 'custom' && (
            <div className="p-2">
              <Calendar
                mode="range"
                selected={customRange}
                onSelect={handleCustomRangeSelect}
                numberOfMonths={1}
                defaultMonth={customRange?.from ?? new Date()}
              />
              {customRange?.from && customRange?.to && (
                <div className="px-2 pb-2">
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => setOpen(false)}
                  >
                    Apply
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { getDateRangeFromType };
