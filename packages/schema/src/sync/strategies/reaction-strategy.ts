/**
 * Reaction/Expression Update Strategy
 *
 * Entity 변경에 따른 Expression 내 참조 업데이트
 */

import type { FormViewSchema, ListViewSchema, Expression, ViewSection, Reaction } from '../../types'
import type {
  EntityChangeSummary,
  BrokenReference,
  UpdateReactionAction,
  RemoveReactionAction,
} from '../types'

// ============================================================================
// Expression Analysis
// ============================================================================

/**
 * Expression에서 모든 $state.{fieldId} 참조 추출
 */
export const extractFieldReferences = (
  expr: unknown,
  prefix = '$state.'
): string[] => {
  const refs: string[] = []

  if (typeof expr === 'string') {
    if (expr.startsWith(prefix)) {
      refs.push(expr.slice(prefix.length))
    }
  } else if (Array.isArray(expr)) {
    for (const item of expr) {
      refs.push(...extractFieldReferences(item, prefix))
    }
  } else if (expr && typeof expr === 'object') {
    for (const value of Object.values(expr)) {
      refs.push(...extractFieldReferences(value, prefix))
    }
  }

  return [...new Set(refs)] // Deduplicate
}

/**
 * Expression에서 특정 fieldId 참조 업데이트
 */
export const updateFieldReference = (
  expr: unknown,
  oldFieldId: string,
  newFieldId: string,
  prefix = '$state.'
): unknown => {
  if (typeof expr === 'string') {
    if (expr === `${prefix}${oldFieldId}`) {
      return `${prefix}${newFieldId}`
    }
    return expr
  }

  if (Array.isArray(expr)) {
    return expr.map(item => updateFieldReference(item, oldFieldId, newFieldId, prefix))
  }

  if (expr && typeof expr === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(expr)) {
      result[key] = updateFieldReference(value, oldFieldId, newFieldId, prefix)
    }
    return result
  }

  return expr
}

/**
 * Expression에서 여러 fieldId 참조 일괄 업데이트
 */
export const updateFieldReferences = (
  expr: unknown,
  renamedFields: ReadonlyMap<string, string>,
  prefix = '$state.'
): unknown => {
  let result = expr
  for (const [oldId, newId] of renamedFields) {
    result = updateFieldReference(result, oldId, newId, prefix)
  }
  return result
}

// ============================================================================
// Broken Reference Detection
// ============================================================================

/**
 * FormView에서 깨진 참조 찾기
 */
export const findBrokenReferencesInForm = (
  view: FormViewSchema,
  removedFieldIds: ReadonlySet<string>
): BrokenReference[] => {
  const brokenRefs: BrokenReference[] = []

  for (const section of view.sections ?? []) {
    for (const field of section.fields ?? []) {
      for (const reaction of field.reactions ?? []) {
        // Check condition
        if (reaction.condition) {
          const refs = extractFieldReferences(reaction.condition)
          for (const ref of refs) {
            if (removedFieldIds.has(ref)) {
              brokenRefs.push({
                path: ['sections', section.id, 'fields', field.id, 'reactions'],
                referencedFieldId: ref,
                context: `Reaction condition in field '${field.id}'`,
              })
            }
          }
        }

        // Check action values - only for actions that have target/value
        for (const action of reaction.actions ?? []) {
          if ('target' in action && removedFieldIds.has(action.target)) {
            brokenRefs.push({
              path: ['sections', section.id, 'fields', field.id, 'reactions'],
              referencedFieldId: action.target,
              context: `Reaction action target in field '${field.id}'`,
            })
          }

          if ('value' in action) {
            const valueRefs = extractFieldReferences(action.value)
            for (const ref of valueRefs) {
              if (removedFieldIds.has(ref)) {
                brokenRefs.push({
                  path: ['sections', section.id, 'fields', field.id, 'reactions'],
                  referencedFieldId: ref,
                  context: `Reaction action value in field '${field.id}'`,
                })
              }
            }
          }
        }
      }
    }
  }

  return brokenRefs
}

/**
 * ListView에서 깨진 참조 찾기
 *
 * Note: ListView의 filtering/sorting config에서 fieldId 참조 확인
 */
export const findBrokenReferencesInList = (
  view: ListViewSchema,
  removedFieldIds: ReadonlySet<string>
): BrokenReference[] => {
  const brokenRefs: BrokenReference[] = []

  // Check columns for removed entityFieldId
  for (const column of view.columns ?? []) {
    if (removedFieldIds.has(column.entityFieldId)) {
      brokenRefs.push({
        path: ['columns', column.id],
        referencedFieldId: column.entityFieldId,
        context: `Column '${column.id}' references removed field`,
      })
    }
  }

  // Check filtering config if available
  if (view.filtering?.fields) {
    for (const filterField of view.filtering.fields) {
      if (removedFieldIds.has(filterField.entityFieldId)) {
        brokenRefs.push({
          path: ['filtering', 'fields', filterField.id],
          referencedFieldId: filterField.entityFieldId,
          context: `Filter field '${filterField.id}' references removed field`,
        })
      }
    }
  }

  // Check sorting config if available
  if (view.sorting?.defaultSort) {
    const sort = view.sorting.defaultSort
    if (removedFieldIds.has(sort.field)) {
      brokenRefs.push({
        path: ['sorting', 'defaultSort'],
        referencedFieldId: sort.field,
        context: `Default sort references removed field '${sort.field}'`,
      })
    }
  }

  return brokenRefs
}

// ============================================================================
// Reaction Cleanup
// ============================================================================

/**
 * 깨진 참조가 있는 Reaction 제거 또는 정리
 */
export const cleanupBrokenReactions = (
  view: FormViewSchema,
  removedFieldIds: ReadonlySet<string>
): {
  updatedView: FormViewSchema
  removedReactions: RemoveReactionAction[]
} => {
  const removedReactions: RemoveReactionAction[] = []

  const newSections = (view.sections ?? []).map(section => ({
    ...section,
    fields: (section.fields ?? []).map(field => {
      const cleanedReactions: Reaction[] = []
      let hadBrokenReactions = false

      for (const reaction of field.reactions ?? []) {
        let isBroken = false

        // Check condition
        if (reaction.condition) {
          const refs = extractFieldReferences(reaction.condition)
          if (refs.some(ref => removedFieldIds.has(ref))) {
            isBroken = true
          }
        }

        // Check action targets and values
        for (const action of reaction.actions ?? []) {
          if ('target' in action && removedFieldIds.has(action.target)) {
            isBroken = true
          }
          if ('value' in action) {
            const valueRefs = extractFieldReferences(action.value)
            if (valueRefs.some(ref => removedFieldIds.has(ref))) {
              isBroken = true
            }
          }
        }

        if (isBroken) {
          hadBrokenReactions = true
        } else {
          cleanedReactions.push(reaction)
        }
      }

      // Record removed reactions
      if (hadBrokenReactions) {
        removedReactions.push({
          _type: 'REMOVE_REACTION',
          targetPath: ['sections', section.id, 'fields', field.id, 'reactions'],
          fieldId: field.id,
          reason: 'Reaction references removed field(s)',
        })
      }

      return {
        ...field,
        reactions: cleanedReactions.length > 0 ? cleanedReactions : undefined,
      }
    }),
  })) as readonly ViewSection[]

  return {
    updatedView: { ...view, sections: newSections },
    removedReactions,
  }
}

// ============================================================================
// Expression Update Strategy
// ============================================================================

/**
 * FormView의 모든 Reaction에서 이름 변경된 필드 참조 업데이트
 */
export const updateFormReactionReferences = (
  view: FormViewSchema,
  changes: EntityChangeSummary
): FormViewSchema => {
  if (changes.renamedFields.size === 0) {
    return view
  }

  const newSections = (view.sections ?? []).map(section => ({
    ...section,
    fields: (section.fields ?? []).map(field => ({
      ...field,
      reactions: (field.reactions ?? []).map(reaction => ({
        ...reaction,
        condition: reaction.condition
          ? (updateFieldReferences(reaction.condition, changes.renamedFields) as Expression)
          : undefined,
        actions: (reaction.actions ?? []).map(action => {
          // Only update target/value for action types that have them
          if ('target' in action && 'value' in action) {
            const newTarget = changes.renamedFields.has(action.target)
              ? changes.renamedFields.get(action.target)!
              : action.target
            return {
              ...action,
              target: newTarget,
              value: updateFieldReferences(action.value, changes.renamedFields),
            }
          } else if ('target' in action) {
            const newTarget = changes.renamedFields.has(action.target)
              ? changes.renamedFields.get(action.target)!
              : action.target
            return {
              ...action,
              target: newTarget,
            }
          }
          return action
        }),
      })),
    })),
  })) as readonly ViewSection[]

  return { ...view, sections: newSections }
}

/**
 * ListView의 entityFieldId 참조 업데이트
 *
 * Note: columns의 entityFieldId를 업데이트
 */
export const updateListReferences = (
  view: ListViewSchema,
  changes: EntityChangeSummary
): ListViewSchema => {
  if (changes.renamedFields.size === 0) {
    return view
  }

  return {
    ...view,
    columns: view.columns.map(col => ({
      ...col,
      entityFieldId: changes.renamedFields.get(col.entityFieldId) ?? col.entityFieldId,
    })),
  }
}

// ============================================================================
// Suggestion Generation
// ============================================================================

/**
 * Reaction 업데이트 제안 생성
 */
export const suggestReactionUpdates = (
  view: FormViewSchema,
  changes: EntityChangeSummary
): UpdateReactionAction[] => {
  const suggestions: UpdateReactionAction[] = []

  for (const section of view.sections ?? []) {
    for (const field of section.fields ?? []) {
      for (const reaction of field.reactions ?? []) {
        // Check if any renamed field is referenced
        const conditionRefs = reaction.condition
          ? extractFieldReferences(reaction.condition)
          : []
        const actionRefs = (reaction.actions ?? []).flatMap(action => {
          const refs: string[] = []
          if ('target' in action) {
            refs.push(action.target)
          }
          if ('value' in action) {
            refs.push(...extractFieldReferences(action.value))
          }
          return refs
        })

        const allRefs = [...conditionRefs, ...actionRefs]
        const affectedRenames = allRefs.filter(ref => changes.renamedFields.has(ref))

        if (affectedRenames.length > 0) {
          // Build updated expression
          const newCondition = reaction.condition
            ? updateFieldReferences(reaction.condition, changes.renamedFields)
            : undefined
          const newActions = (reaction.actions ?? []).map(action => {
            if ('target' in action && 'value' in action) {
              return {
                ...action,
                target: changes.renamedFields.get(action.target) ?? action.target,
                value: updateFieldReferences(action.value, changes.renamedFields),
              }
            } else if ('target' in action) {
              return {
                ...action,
                target: changes.renamedFields.get(action.target) ?? action.target,
              }
            }
            return action
          })

          suggestions.push({
            _type: 'UPDATE_REACTION',
            targetPath: ['sections', section.id, 'fields', field.id, 'reactions'],
            fieldId: field.id,
            oldExpression: reaction,
            newExpression: { ...reaction, condition: newCondition, actions: newActions },
            reason: `Update references: ${affectedRenames.join(', ')}`,
          })
        }
      }
    }
  }

  return suggestions
}
