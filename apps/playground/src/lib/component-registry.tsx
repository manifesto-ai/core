'use client'

/**
 * Playground Component Registry
 *
 * Custom components using shadcn/ui for the playground
 */

import React from 'react'
import { createFieldRegistry, type FieldComponentProps } from '@manifesto-ai/react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const controlBase =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/50 shadow-[0_6px_26px_rgba(0,0,0,0.22)] transition focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60'

type ShellProps = FieldComponentProps & {
  children: React.ReactNode
  inlineLabel?: boolean
}

const FieldShell: React.FC<ShellProps> = ({ field, errors, children, inlineLabel }) => {
  const hasError = errors.length > 0
  const labelText = field.label ?? field.fieldId

  return (
    <div
      className={cn(
        'space-y-2 rounded-xl border border-white/10 bg-white/5 p-4 shadow-[0_10px_50px_rgba(0,0,0,0.24)]',
        hasError && 'border-destructive/50 bg-destructive/5'
      )}
    >
      {!inlineLabel && (
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={field.fieldId} className="text-sm font-semibold text-foreground">
            {labelText}
            {field.required ? <span className="ml-1 text-destructive">*</span> : null}
          </label>
          {field.state?.props?.hint ? (
            <span className="text-[11px] uppercase tracking-[0.2em] text-foreground/60">
              {String(field.state.props.hint)}
            </span>
          ) : null}
        </div>
      )}

      <div className="space-y-2">{children}</div>

      {field.helpText && (
        <p className="text-xs text-foreground/60">
          {field.helpText}
        </p>
      )}
      {hasError && (
        <div className="space-y-1 text-xs text-destructive">
          {errors.map((err, idx) => (
            <p key={idx}>{err}</p>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Text Input
// ============================================================================
const TextInput: React.FC<FieldComponentProps> = ({ field, value, onChange, disabled, errors }) => {
  const hasError = errors.length > 0
  return (
    <FieldShell field={field} errors={errors}>
      <Input
        id={field.fieldId}
        type="text"
        value={(value as string) ?? ''}
        disabled={disabled}
        placeholder={field.placeholder}
        className={cn(controlBase, hasError && 'border-destructive/70 text-destructive focus:border-destructive/70 focus:ring-destructive/40')}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldShell>
  )
}

// ============================================================================
// Number Input
// ============================================================================
const NumberInput: React.FC<FieldComponentProps> = ({ field, value, onChange, disabled, errors }) => {
  const hasError = errors.length > 0
  const fieldProps = field.state.props ?? {}
  return (
    <FieldShell field={field} errors={errors}>
      <Input
        id={field.fieldId}
        type="number"
        value={value !== null && value !== undefined ? String(value) : ''}
        disabled={disabled}
        placeholder={field.placeholder}
        className={cn(controlBase, hasError && 'border-destructive/70 text-destructive focus:border-destructive/70 focus:ring-destructive/40')}
        min={fieldProps.min as number | undefined}
        max={fieldProps.max as number | undefined}
        step={fieldProps.step as number | undefined}
        onChange={(e) => {
          const val = e.target.value
          onChange(val === '' ? null : Number(val))
        }}
      />
    </FieldShell>
  )
}

// ============================================================================
// Select Input
// ============================================================================
const SelectInput: React.FC<FieldComponentProps> = ({ field, value, onChange, disabled, errors }) => {
  const hasError = errors.length > 0
  const options = field.state.options ?? []
  return (
    <FieldShell field={field} errors={errors}>
      <select
        id={field.fieldId}
        value={value !== null && value !== undefined ? String(value) : ''}
        disabled={disabled}
        className={cn(
          'flex h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-foreground shadow-[0_6px_26px_rgba(0,0,0,0.22)] transition focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60',
          hasError && 'border-destructive/70 text-destructive focus:border-destructive/70 focus:ring-destructive/35'
        )}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

// ============================================================================
// Checkbox Input
// ============================================================================
const CheckboxInput: React.FC<FieldComponentProps> = ({ field, value, onChange, disabled, errors }) => {
  return (
    <FieldShell field={field} errors={errors} inlineLabel>
      <label className="flex items-center gap-3 text-sm text-foreground">
        <input
          id={field.fieldId}
          type="checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          className="h-4 w-4 rounded border-white/20 bg-background text-primary focus:ring-primary/40"
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="font-medium">{field.label ?? field.fieldId}</span>
      </label>
    </FieldShell>
  )
}

// ============================================================================
// Textarea Input
// ============================================================================
const TextareaInput: React.FC<FieldComponentProps> = ({ field, value, onChange, disabled, errors }) => {
  const hasError = errors.length > 0
  const fieldProps = field.state.props ?? {}
  return (
    <FieldShell field={field} errors={errors}>
      <textarea
        id={field.fieldId}
        value={(value as string) ?? ''}
        disabled={disabled}
        placeholder={field.placeholder}
        rows={(fieldProps.rows as number) ?? 3}
        className={cn(
          'flex w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground shadow-[0_6px_26px_rgba(0,0,0,0.22)] placeholder:text-foreground/50 transition focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60',
          hasError && 'border-destructive/70 text-destructive focus:border-destructive/70 focus:ring-destructive/35'
        )}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldShell>
  )
}

// ============================================================================
// Toggle/Switch Input
// ============================================================================
const ToggleInput: React.FC<FieldComponentProps> = ({ field, value, onChange, disabled, errors }) => {
  return (
    <FieldShell field={field} errors={errors} inlineLabel>
      <button
        id={field.fieldId}
        type="button"
        role="switch"
        aria-checked={Boolean(value)}
        disabled={disabled}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-white/15 bg-white/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60',
          value && 'bg-primary/80'
        )}
        onClick={() => onChange(!value)}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 translate-x-1 rounded-full bg-background shadow-lg transition-transform',
            value && 'translate-x-5'
          )}
        />
        <span className="sr-only">{field.label ?? field.fieldId}</span>
      </button>
      {field.label && <span className="text-sm font-medium text-foreground">{field.label}</span>}
    </FieldShell>
  )
}

// ============================================================================
// Radio Input
// ============================================================================
const RadioInput: React.FC<FieldComponentProps> = ({ field, value, onChange, disabled, errors }) => {
  const options = field.state.options ?? []
  return (
    <FieldShell field={field} errors={errors}>
      <div className="grid gap-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              'flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground transition',
              (value === opt.value) && 'border-primary/40 bg-primary/10',
              opt.disabled && 'opacity-50'
            )}
          >
            <input
              type="radio"
              name={field.fieldId}
              value={opt.value}
              checked={value === opt.value}
              disabled={disabled || opt.disabled}
              className="h-4 w-4 border-white/30 text-primary focus:ring-primary/40"
              onChange={() => onChange(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </FieldShell>
  )
}

// ============================================================================
// Date Picker (simple text input for now)
// ============================================================================
const DatePickerInput: React.FC<FieldComponentProps> = ({ field, value, onChange, disabled, errors }) => {
  const hasError = errors.length > 0
  return (
    <FieldShell field={field} errors={errors}>
      <Input
        id={field.fieldId}
        type="date"
        value={(value as string) ?? ''}
        disabled={disabled}
        placeholder={field.placeholder}
        className={cn(controlBase, hasError && 'border-destructive/70 text-destructive focus:border-destructive/70 focus:ring-destructive/40')}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldShell>
  )
}

// ============================================================================
// Create and export registry
// ============================================================================
export function createPlaygroundRegistry() {
  const registry = createFieldRegistry(false) // Don't include defaults

  registry.register('text-input', TextInput)
  registry.register('number-input', NumberInput)
  registry.register('select', SelectInput)
  registry.register('checkbox', CheckboxInput)
  registry.register('textarea', TextareaInput)
  registry.register('toggle', ToggleInput)
  registry.register('radio', RadioInput)
  registry.register('date-picker', DatePickerInput)
  registry.register('datetime-picker', DatePickerInput) // Fallback to date

  return registry
}

// Singleton instance
let _playgroundRegistry: ReturnType<typeof createPlaygroundRegistry> | null = null

export function getPlaygroundRegistry() {
  if (!_playgroundRegistry) {
    _playgroundRegistry = createPlaygroundRegistry()
  }
  return _playgroundRegistry
}
