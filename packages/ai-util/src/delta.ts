import type { InteractionAtom, SemanticDelta, SemanticSnapshot } from './types'
import { areValuesEqual } from './utils'

export const diffSnapshots = (
  previous: SemanticSnapshot,
  next: SemanticSnapshot
): SemanticDelta => {
  const formDelta = diffForm(previous, next)
  const fieldDelta = diffFields(previous, next)
  const interactionDelta = diffInteractions(previous, next)

  return {
    ...(formDelta ? { form: formDelta } : {}),
    ...(fieldDelta ? { fields: fieldDelta } : {}),
    ...(interactionDelta ? { interactions: interactionDelta } : {}),
  }
}

const diffForm = (
  previous: SemanticSnapshot,
  next: SemanticSnapshot
): SemanticDelta['form'] => {
  const changes: { isValid?: boolean; isDirty?: boolean; isSubmitting?: boolean } = {}

  if (previous.state.form.isValid !== next.state.form.isValid) {
    changes.isValid = next.state.form.isValid
  }
  if (previous.state.form.isDirty !== next.state.form.isDirty) {
    changes.isDirty = next.state.form.isDirty
  }
  if (previous.state.form.isSubmitting !== next.state.form.isSubmitting) {
    changes.isSubmitting = next.state.form.isSubmitting
  }

  return Object.keys(changes).length > 0 ? changes : undefined
}

const diffFields = (
  previous: SemanticSnapshot,
  next: SemanticSnapshot
): SemanticDelta['fields'] => {
  const changes: Record<
    string,
    Partial<{
      value: unknown
      valid: boolean
      dirty: boolean
      touched: boolean
      hidden: boolean
      disabled: boolean
      errors: readonly string[]
    }>
  > = {}

  for (const [fieldId, current] of Object.entries(next.state.fields)) {
    const before = previous.state.fields[fieldId]
    const fieldChanges: Record<string, unknown> = {}

    if (!before || !areValuesEqual(before.value, current.value)) {
      fieldChanges.value = current.value
    }
    if (!before || before.meta.valid !== current.meta.valid) {
      fieldChanges.valid = current.meta.valid
    }
    if (!before || before.meta.dirty !== current.meta.dirty) {
      fieldChanges.dirty = current.meta.dirty
    }
    if (!before || before.meta.touched !== current.meta.touched) {
      fieldChanges.touched = current.meta.touched
    }
    if (!before || before.meta.hidden !== current.meta.hidden) {
      fieldChanges.hidden = current.meta.hidden
    }
    if (!before || before.meta.disabled !== current.meta.disabled) {
      fieldChanges.disabled = current.meta.disabled
    }
    if (
      !before ||
      before.meta.errors.length !== current.meta.errors.length ||
      !arraysEqual(before.meta.errors, current.meta.errors)
    ) {
      fieldChanges.errors = current.meta.errors
    }

    if (Object.keys(fieldChanges).length > 0) {
      changes[fieldId] = fieldChanges
    }
  }

  return Object.keys(changes).length > 0 ? changes : undefined
}

const diffInteractions = (
  previous: SemanticSnapshot,
  next: SemanticSnapshot
): SemanticDelta['interactions'] => {
  const changes: Record<string, Partial<Pick<InteractionAtom, 'available' | 'reason'>>> = {}

  const previousMap = new Map(previous.interactions.map((interaction) => [interaction.id, interaction]))

  for (const interaction of next.interactions) {
    const before = previousMap.get(interaction.id)
    if (!before || before.available !== interaction.available || before.reason !== interaction.reason) {
      changes[interaction.id] = {
        available: interaction.available,
        reason: interaction.reason,
      }
    }
  }

  return Object.keys(changes).length > 0 ? changes : undefined
}

const arraysEqual = (a: readonly unknown[], b: readonly unknown[]): boolean => {
  if (a.length !== b.length) return false
  return a.every((value, index) => areValuesEqual(value, b[index]))
}
