import type { EvaluationContext, FormState } from '@manifesto-ai/engine'
import type { EntitySchema, Expression, FormViewSchema, ViewField, EntityField } from '@manifesto-ai/schema'

import type {
  FieldConstraint,
  FieldStateAtom,
  InteractionAtom,
  SchemaTopology,
  SemanticSnapshot,
  VisibilityMeta,
} from './types'
import { areValuesEqual } from './utils'
import { analyzeVisibility } from './visibility'

interface BuildSnapshotParams {
  readonly viewSchema: FormViewSchema
  readonly state: FormState
  readonly baselineValues: Readonly<Record<string, unknown>>
  readonly entitySchema?: EntitySchema
  /** Visibility expressions keyed by fieldId (optional - enables proactive visibilityMeta) */
  readonly visibilityExpressions?: ReadonlyMap<string, Expression>
  /** Evaluation context for analyzing visibility (optional - required with visibilityExpressions) */
  readonly evaluationContext?: EvaluationContext
}

export const buildSemanticSnapshot = ({
  viewSchema,
  state,
  baselineValues,
  entitySchema,
  visibilityExpressions,
  evaluationContext,
}: BuildSnapshotParams): SemanticSnapshot => {
  const fieldIndex = indexFields(viewSchema.sections.flatMap((section) => section.fields))
  const entityFieldIndex = entitySchema
    ? indexEntityFields(entitySchema.fields)
    : new Map<string, EntityField>()

  const topology: SchemaTopology = {
    viewId: viewSchema.id,
    entityRef: viewSchema.entityRef,
    mode: viewSchema.mode,
    sections: viewSchema.sections.map((section) => ({
      id: section.id,
      title: section.title,
      fields: section.fields.map((field) => field.id),
    })),
  }

  const fields: Record<string, FieldStateAtom> = {}
  const constraints: Record<string, FieldConstraint> = {}
  const interactions: InteractionAtom[] = []

  for (const [fieldId, meta] of state.fields) {
    const definition = fieldIndex.get(fieldId)
    const entityField = entityFieldIndex.get(meta.entityFieldId)
    const value = state.values[fieldId]
    const baselineValue = baselineValues[fieldId]
    const errors = meta.errors ?? []

    fields[fieldId] = {
      id: fieldId,
      entityFieldId: meta.entityFieldId,
      label: definition?.label,
      dataType: entityField?.dataType,
      value,
      enumValues: entityField?.enumValues,
      meta: {
        valid: errors.length === 0,
        dirty: !areValuesEqual(value, baselineValue),
        touched: false,
        hidden: meta.hidden,
        disabled: meta.disabled,
        errors,
      },
    }

    // Build visibility meta for hidden fields (proactive reasoning)
    let visibilityMeta: VisibilityMeta | undefined
    if (meta.hidden && visibilityExpressions && evaluationContext) {
      const expression = visibilityExpressions.get(fieldId)
      if (expression) {
        const analysisResult = analyzeVisibility(expression, evaluationContext, {
          computeSatisfactionPath: true,
        })
        if (analysisResult._tag === 'Ok') {
          visibilityMeta = analysisResult.value
        }
      }
    }

    constraints[fieldId] = {
      hidden: meta.hidden,
      disabled: meta.disabled,
      reason: meta.hidden ? 'hidden' : meta.disabled ? 'disabled' : undefined,
      ...(visibilityMeta ? { visibilityMeta } : {}),
    }

    interactions.push({
      id: `updateField:${fieldId}`,
      intent: 'updateField',
      target: fieldId,
      available: !meta.hidden && !meta.disabled,
      reason: meta.hidden ? 'field is hidden' : meta.disabled ? 'field is disabled' : undefined,
    })
  }

  interactions.push(
    {
      id: 'submit',
      intent: 'submit',
      available: state.isValid,
      reason: state.isValid ? undefined : 'form is invalid',
    },
    { id: 'reset', intent: 'reset', available: true },
    { id: 'validate', intent: 'validate', available: true }
  )

  return {
    topology,
    state: {
      form: {
        isValid: state.isValid,
        isDirty: state.isDirty,
        isSubmitting: state.isSubmitting,
      },
      fields,
      values: { ...state.values },
    },
    constraints,
    interactions,
  }
}

const indexFields = (fields: readonly ViewField[]): Map<string, ViewField> => {
  const map = new Map<string, ViewField>()
  for (const field of fields) {
    map.set(field.id, field)
  }
  return map
}

const indexEntityFields = (fields: readonly EntityField[]): Map<string, EntityField> => {
  const map = new Map<string, EntityField>()
  for (const field of fields) {
    map.set(field.id, field)
  }
  return map
}
