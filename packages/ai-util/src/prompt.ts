/**
 * LLM Prompt Optimization Utilities
 *
 * AI 에이전트를 위한 프롬프트 생성 및 컨텍스트 압축 유틸리티
 */

import type { SemanticSnapshot, FieldStateAtom, FieldConstraint } from './types'

// ============================================================================
// Types
// ============================================================================

export interface PromptOptions {
  /** Include field values in prompt (default: true) */
  readonly includeValues?: boolean
  /** Include validation errors (default: true) */
  readonly includeErrors?: boolean
  /** Include visibility reasoning for hidden fields (default: true) */
  readonly includeVisibilityReasoning?: boolean
  /** Include pending updates info (default: true) */
  readonly includePendingUpdates?: boolean
  /** Maximum fields to show in detail (default: 20) */
  readonly maxDetailedFields?: number
  /** Compact mode for token efficiency (default: false) */
  readonly compact?: boolean
}

export interface CompressedSnapshot {
  readonly form: string
  readonly fields: readonly CompressedField[]
  readonly actions: readonly string[]
  readonly hidden?: readonly string[]
  readonly pending?: readonly string[]
}

export interface CompressedField {
  readonly id: string
  readonly value?: unknown
  readonly status: 'ok' | 'error' | 'hidden' | 'disabled'
  readonly errors?: readonly string[]
}

// ============================================================================
// System Prompt Generation
// ============================================================================

/**
 * 시스템 프롬프트 생성
 * LLM이 폼 컨텍스트를 이해하고 적절한 액션을 수행하도록 안내
 */
export const generateSystemPrompt = (
  snapshot: SemanticSnapshot,
  options: PromptOptions = {}
): string => {
  const {
    includeValues = true,
    includeErrors = true,
    includeVisibilityReasoning = true,
    includePendingUpdates = true,
    compact = false,
  } = options

  const lines: string[] = []

  // Header
  lines.push(`## Form Context: ${snapshot.topology.viewId}`)
  lines.push(`Mode: ${snapshot.topology.mode}`)
  lines.push('')

  // Form State Summary
  lines.push('### Form Status')
  lines.push(generateFormStatusLine(snapshot, compact))
  lines.push('')

  // Fields Summary
  lines.push('### Fields')
  if (compact) {
    lines.push(generateCompactFieldList(snapshot, includeValues))
  } else {
    lines.push(generateDetailedFieldList(snapshot, { includeValues, includeErrors }))
  }
  lines.push('')

  // Hidden Fields with Reasoning
  const hiddenFields = getHiddenFieldsWithReasoning(snapshot)
  if (hiddenFields.length > 0 && includeVisibilityReasoning) {
    lines.push('### Hidden Fields')
    for (const { fieldId, reasoning } of hiddenFields) {
      lines.push(`- **${fieldId}**: ${reasoning}`)
    }
    lines.push('')
  }

  // Pending Updates
  if (snapshot.pendingUpdates && includePendingUpdates) {
    const pendingCount = Object.keys(snapshot.pendingUpdates).length
    if (pendingCount > 0) {
      lines.push('### Pending Updates')
      for (const [fieldId, pending] of Object.entries(snapshot.pendingUpdates)) {
        lines.push(`- ${fieldId}: ${formatValue(pending.value)} (blocked by: ${pending.blockedBy.join(', ')})`)
      }
      lines.push('')
    }
  }

  // Available Actions
  lines.push('### Available Actions')
  lines.push(generateActionsSummary(snapshot, compact))

  return lines.join('\n')
}

// ============================================================================
// Snapshot Compression
// ============================================================================

/**
 * 스냅샷을 토큰 효율적인 형태로 압축
 */
export const compressSnapshot = (snapshot: SemanticSnapshot): CompressedSnapshot => {
  const fields: CompressedField[] = []
  const hidden: string[] = []
  const pending: string[] = []

  for (const [fieldId, field] of Object.entries(snapshot.state.fields)) {
    const constraint = snapshot.constraints[fieldId]

    if (constraint?.hidden) {
      hidden.push(fieldId)
      continue
    }

    if (constraint?.disabled) {
      fields.push({ id: fieldId, status: 'disabled' })
      continue
    }

    const hasErrors = field.meta.errors.length > 0
    fields.push({
      id: fieldId,
      value: field.value,
      status: hasErrors ? 'error' : 'ok',
      ...(hasErrors ? { errors: field.meta.errors } : {}),
    })
  }

  if (snapshot.pendingUpdates) {
    pending.push(...Object.keys(snapshot.pendingUpdates))
  }

  const { isValid, isDirty } = snapshot.state.form
  const formStatus = isValid ? (isDirty ? 'valid+dirty' : 'valid') : (isDirty ? 'invalid+dirty' : 'invalid')

  return {
    form: formStatus,
    fields,
    actions: getAvailableActions(snapshot),
    ...(hidden.length > 0 ? { hidden } : {}),
    ...(pending.length > 0 ? { pending } : {}),
  }
}

/**
 * 압축된 스냅샷을 JSON 문자열로 직렬화
 */
export const serializeCompressed = (compressed: CompressedSnapshot): string => {
  return JSON.stringify(compressed)
}

// ============================================================================
// Field Summary
// ============================================================================

/**
 * 필드 상태 요약 생성
 */
export const generateFieldSummary = (
  fields: Readonly<Record<string, FieldStateAtom>>,
  constraints: Readonly<Record<string, FieldConstraint>>
): string => {
  const visible: string[] = []
  const hidden: string[] = []
  const disabled: string[] = []
  const withErrors: string[] = []

  for (const [fieldId, field] of Object.entries(fields)) {
    const constraint = constraints[fieldId]

    if (constraint?.hidden) {
      hidden.push(fieldId)
    } else if (constraint?.disabled) {
      disabled.push(fieldId)
    } else {
      visible.push(fieldId)
      if (field.meta.errors.length > 0) {
        withErrors.push(fieldId)
      }
    }
  }

  const parts: string[] = []
  parts.push(`Visible: ${visible.length}`)
  if (withErrors.length > 0) parts.push(`Errors: ${withErrors.length}`)
  if (hidden.length > 0) parts.push(`Hidden: ${hidden.length}`)
  if (disabled.length > 0) parts.push(`Disabled: ${disabled.length}`)

  return parts.join(' | ')
}

// ============================================================================
// Delta-based Context Update
// ============================================================================

/**
 * 델타 기반 컨텍스트 업데이트 생성
 * 멀티턴 대화에서 변경된 부분만 전달
 */
export const generateDeltaUpdate = (
  before: SemanticSnapshot,
  after: SemanticSnapshot
): string => {
  const changes: string[] = []

  // Form state changes
  if (before.state.form.isValid !== after.state.form.isValid) {
    changes.push(`Form validity: ${before.state.form.isValid} → ${after.state.form.isValid}`)
  }

  // Field changes
  for (const [fieldId, afterField] of Object.entries(after.state.fields)) {
    const beforeField = before.state.fields[fieldId]

    if (!beforeField) {
      changes.push(`+ ${fieldId}: ${formatValue(afterField.value)}`)
      continue
    }

    if (beforeField.value !== afterField.value) {
      changes.push(`~ ${fieldId}: ${formatValue(beforeField.value)} → ${formatValue(afterField.value)}`)
    }

    if (beforeField.meta.hidden !== afterField.meta.hidden) {
      changes.push(`~ ${fieldId}: ${afterField.meta.hidden ? 'now hidden' : 'now visible'}`)
    }

    const beforeErrors = beforeField.meta.errors.join(', ')
    const afterErrors = afterField.meta.errors.join(', ')
    if (beforeErrors !== afterErrors) {
      if (afterErrors) {
        changes.push(`! ${fieldId}: ${afterErrors}`)
      } else {
        changes.push(`✓ ${fieldId}: errors cleared`)
      }
    }
  }

  if (changes.length === 0) {
    return 'No changes'
  }

  return changes.join('\n')
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatValue = (value: unknown): string => {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (value === '') return '(empty)'
  if (typeof value === 'string') return `"${value}"`
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

const generateFormStatusLine = (snapshot: SemanticSnapshot, compact: boolean): string => {
  const { isValid, isDirty, isSubmitting } = snapshot.state.form
  const fieldCount = Object.keys(snapshot.state.fields).length
  const errorCount = Object.values(snapshot.state.fields)
    .reduce((sum, f) => sum + f.meta.errors.length, 0)

  if (compact) {
    const flags = [
      isValid ? '✓' : '✗',
      isDirty ? 'dirty' : 'clean',
      isSubmitting ? 'submitting' : '',
    ].filter(Boolean).join(' ')
    return `${flags} (${fieldCount} fields, ${errorCount} errors)`
  }

  return [
    `Valid: ${isValid ? 'Yes' : 'No'}`,
    `Dirty: ${isDirty ? 'Yes' : 'No'}`,
    `Submitting: ${isSubmitting ? 'Yes' : 'No'}`,
    `Fields: ${fieldCount}`,
    `Errors: ${errorCount}`,
  ].join(' | ')
}

const generateCompactFieldList = (
  snapshot: SemanticSnapshot,
  includeValues: boolean
): string => {
  const lines: string[] = []

  for (const [fieldId, field] of Object.entries(snapshot.state.fields)) {
    const constraint = snapshot.constraints[fieldId]
    if (constraint?.hidden) continue

    const status = constraint?.disabled ? '[disabled]' : ''
    const errors = field.meta.errors.length > 0 ? `[!${field.meta.errors.length}]` : ''
    const value = includeValues ? `: ${formatValue(field.value)}` : ''

    lines.push(`- ${fieldId}${value}${status}${errors}`)
  }

  return lines.join('\n')
}

const generateDetailedFieldList = (
  snapshot: SemanticSnapshot,
  options: { includeValues: boolean; includeErrors: boolean }
): string => {
  const lines: string[] = []

  for (const [fieldId, field] of Object.entries(snapshot.state.fields)) {
    const constraint = snapshot.constraints[fieldId]
    if (constraint?.hidden) continue

    const parts: string[] = [`**${fieldId}**`]

    if (field.label) {
      parts.push(`(${field.label})`)
    }

    if (constraint?.disabled) {
      parts.push('[disabled]')
    }

    if (options.includeValues) {
      parts.push(`= ${formatValue(field.value)}`)
    }

    lines.push(parts.join(' '))

    if (options.includeErrors && field.meta.errors.length > 0) {
      for (const error of field.meta.errors) {
        lines.push(`  ⚠ ${error}`)
      }
    }
  }

  return lines.join('\n')
}

const getHiddenFieldsWithReasoning = (
  snapshot: SemanticSnapshot
): { fieldId: string; reasoning: string }[] => {
  const result: { fieldId: string; reasoning: string }[] = []

  for (const [fieldId, constraint] of Object.entries(snapshot.constraints)) {
    if (!constraint.hidden) continue

    let reasoning = 'Hidden by condition'

    if (constraint.visibilityMeta) {
      const { failedDependencies, satisfactionPath } = constraint.visibilityMeta

      if (failedDependencies.length > 0) {
        const reasons = failedDependencies.map(d => d.description).join('; ')
        reasoning = reasons
      }

      if (satisfactionPath && satisfactionPath.length > 0) {
        const steps = satisfactionPath
          .map(s => `${s.action} ${s.field} to ${formatValue(s.targetValue)}`)
          .join(', then ')
        reasoning += ` (to show: ${steps})`
      }
    }

    result.push({ fieldId, reasoning })
  }

  return result
}

const generateActionsSummary = (snapshot: SemanticSnapshot, compact: boolean): string => {
  const available = snapshot.interactions.filter(i => i.available)
  const blocked = snapshot.interactions.filter(i => !i.available)

  if (compact) {
    const availableNames = available.map(i => i.id).join(', ')
    return availableNames || 'None available'
  }

  const lines: string[] = []

  if (available.length > 0) {
    lines.push('**Available:**')
    for (const action of available) {
      lines.push(`- ${action.id}`)
    }
  }

  if (blocked.length > 0) {
    lines.push('**Blocked:**')
    for (const action of blocked) {
      lines.push(`- ${action.id}: ${action.reason ?? 'not available'}`)
    }
  }

  return lines.join('\n')
}

const getAvailableActions = (snapshot: SemanticSnapshot): string[] => {
  return snapshot.interactions
    .filter(i => i.available)
    .map(i => i.id)
}
