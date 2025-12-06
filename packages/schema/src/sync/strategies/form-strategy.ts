/**
 * Form View Update Strategy
 *
 * Entity 변경에 따른 FormView 업데이트 전략
 */

import type {
  FormViewSchema,
  ViewField,
  ViewSection,
  Reaction,
  Expression,
} from '../../types'
import type {
  EntityChangeSummary,
  SuggestedAction,
  AffectedElement,
  ViewImpactAnalysis,
  SyncManagerConfig,
  AddFieldAction,
  FieldPlacement,
} from '../types'
import {
  isFieldRemoved,
  isFieldRenamed,
  isFieldTypeChanged,
  isFieldEnumChanged,
  isFieldAdded,
} from '../types'
import { getDefaultComponent } from '../diff/type-compatibility'

// ============================================================================
// Impact Analysis
// ============================================================================

/**
 * FormView에서 특정 entityFieldId를 참조하는 ViewField 찾기
 */
const findViewFieldsReferencing = (
  view: FormViewSchema,
  entityFieldId: string
): { sectionId: string; field: ViewField }[] => {
  const results: { sectionId: string; field: ViewField }[] = []

  for (const section of view.sections ?? []) {
    for (const field of section.fields ?? []) {
      if (field.entityFieldId === entityFieldId) {
        results.push({ sectionId: section.id, field })
      }
    }
  }

  return results
}

/**
 * Reaction 내 Expression에서 fieldId 참조 찾기
 */
const findFieldReferencesInExpression = (
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
      refs.push(...findFieldReferencesInExpression(item, prefix))
    }
  } else if (expr && typeof expr === 'object') {
    for (const value of Object.values(expr)) {
      refs.push(...findFieldReferencesInExpression(value, prefix))
    }
  }

  return refs
}

/**
 * Reaction에서 영향받는 fieldId 찾기
 */
const findReactionsReferencing = (
  view: FormViewSchema,
  entityFieldId: string
): { sectionId: string; fieldId: string; reaction: Reaction }[] => {
  const results: { sectionId: string; fieldId: string; reaction: Reaction }[] = []

  for (const section of view.sections ?? []) {
    for (const field of section.fields ?? []) {
      for (const reaction of field.reactions ?? []) {
        // Check if any action references the fieldId
        for (const action of reaction.actions ?? []) {
          // Check target (setValue, updateProp, setOptions have target)
          if ('target' in action && action.target === entityFieldId) {
            results.push({
              sectionId: section.id,
              fieldId: field.id,
              reaction,
            })
          }

          // Check expressions in action value (setValue, updateProp have value)
          if ('value' in action) {
            const refs = findFieldReferencesInExpression(action.value)
            if (refs.includes(entityFieldId)) {
              results.push({
                sectionId: section.id,
                fieldId: field.id,
                reaction,
              })
            }
          }
        }

        // Check condition expression
        if (reaction.condition) {
          const refs = findFieldReferencesInExpression(reaction.condition)
          if (refs.includes(entityFieldId)) {
            results.push({
              sectionId: section.id,
              fieldId: field.id,
              reaction,
            })
          }
        }
      }
    }
  }

  return results
}

/**
 * FormView 영향 분석
 */
export const analyzeFormViewImpact = (
  view: FormViewSchema,
  changes: EntityChangeSummary
): ViewImpactAnalysis => {
  const affectedElements: AffectedElement[] = []
  const suggestedActions: SuggestedAction[] = []

  for (const change of changes.changes) {
    // 1. Field Removed
    if (isFieldRemoved(change)) {
      const refs = findViewFieldsReferencing(view, change.fieldId)
      for (const ref of refs) {
        affectedElements.push({
          elementType: 'field',
          elementId: ref.field.id,
          entityFieldId: change.fieldId,
          change,
          impact: 'remove',
        })

        suggestedActions.push({
          _type: 'REMOVE_FIELD',
          targetPath: ['sections', ref.sectionId, 'fields', ref.field.id],
          fieldId: change.fieldId,
          reason: `Field '${change.fieldId}' was removed from entity`,
        })
      }

      // Check reactions
      const reactionRefs = findReactionsReferencing(view, change.fieldId)
      for (const ref of reactionRefs) {
        affectedElements.push({
          elementType: 'reaction',
          elementId: `${ref.fieldId}:reaction`,
          entityFieldId: change.fieldId,
          change,
          impact: 'warning',
        })
      }
    }

    // 2. Field Renamed
    if (isFieldRenamed(change)) {
      const refs = findViewFieldsReferencing(view, change.oldId)
      for (const ref of refs) {
        affectedElements.push({
          elementType: 'field',
          elementId: ref.field.id,
          entityFieldId: change.oldId,
          change,
          impact: 'update',
        })

        suggestedActions.push({
          _type: 'UPDATE_FIELD_ID',
          targetPath: ['sections', ref.sectionId, 'fields', ref.field.id],
          oldFieldId: change.oldId,
          newFieldId: change.newId,
          reason: `Field renamed from '${change.oldId}' to '${change.newId}'`,
        })
      }

      // Also update reactions
      const reactionRefs = findReactionsReferencing(view, change.oldId)
      for (const ref of reactionRefs) {
        affectedElements.push({
          elementType: 'reaction',
          elementId: `${ref.fieldId}:reaction`,
          entityFieldId: change.oldId,
          change,
          impact: 'update',
        })
      }
    }

    // 3. Field Type Changed
    if (isFieldTypeChanged(change)) {
      const refs = findViewFieldsReferencing(view, change.fieldId)
      for (const ref of refs) {
        if (change.compatibility.level !== 'compatible') {
          affectedElements.push({
            elementType: 'field',
            elementId: ref.field.id,
            entityFieldId: change.fieldId,
            change,
            impact: change.compatibility.level === 'incompatible' ? 'warning' : 'update',
          })

          if (change.compatibility.suggestedComponent) {
            suggestedActions.push({
              _type: 'UPDATE_COMPONENT',
              targetPath: ['sections', ref.sectionId, 'fields', ref.field.id],
              fieldId: change.fieldId,
              oldComponent: ref.field.component,
              newComponent: change.compatibility.suggestedComponent,
              reason: `Type changed from '${change.oldType}' to '${change.newType}'`,
            })
          }
        }
      }
    }

    // 4. Enum Changed
    if (isFieldEnumChanged(change)) {
      const refs = findViewFieldsReferencing(view, change.fieldId)
      for (const ref of refs) {
        affectedElements.push({
          elementType: 'field',
          elementId: ref.field.id,
          entityFieldId: change.fieldId,
          change,
          impact: 'update',
        })

        if (change.addedValues.length > 0 || change.removedValues.length > 0) {
          suggestedActions.push({
            _type: 'UPDATE_ENUM_OPTIONS',
            targetPath: ['sections', ref.sectionId, 'fields', ref.field.id],
            fieldId: change.fieldId,
            addedValues: change.addedValues,
            removedValues: change.removedValues,
            reason: 'Enum values changed',
          })
        }
      }
    }

    // 5. Field Added (optional auto-add)
    if (isFieldAdded(change)) {
      // Will be handled based on config.includeNewFields
      affectedElements.push({
        elementType: 'field',
        elementId: change.fieldId,
        entityFieldId: change.fieldId,
        change,
        impact: 'update', // Potential addition
      })
    }
  }

  const requiresReview =
    affectedElements.some(e => e.impact === 'remove') ||
    changes.hasBreakingChanges

  return {
    viewId: view.id,
    viewType: 'form',
    affectedElements,
    brokenReferences: [], // Will be populated by more thorough analysis
    suggestedActions,
    requiresReview,
  }
}

// ============================================================================
// View Update
// ============================================================================

/**
 * ViewField 제거
 */
const removeViewField = (
  view: FormViewSchema,
  sectionId: string,
  fieldId: string
): FormViewSchema => {
  const newSections = (view.sections ?? []).map(section => {
    if (section.id !== sectionId) return section
    return {
      ...section,
      fields: (section.fields ?? []).filter(f => f.id !== fieldId),
    }
  })

  return { ...view, sections: newSections }
}

/**
 * ViewField의 entityFieldId 업데이트
 */
const updateFieldId = (
  view: FormViewSchema,
  sectionId: string,
  viewFieldId: string,
  newEntityFieldId: string
): FormViewSchema => {
  const newSections = (view.sections ?? []).map(section => {
    if (section.id !== sectionId) return section
    return {
      ...section,
      fields: (section.fields ?? []).map(f => {
        if (f.id !== viewFieldId) return f
        return { ...f, entityFieldId: newEntityFieldId }
      }),
    }
  })

  return { ...view, sections: newSections }
}

/**
 * ViewField의 component 업데이트
 */
const updateFieldComponent = (
  view: FormViewSchema,
  sectionId: string,
  viewFieldId: string,
  newComponent: ViewField['component']
): FormViewSchema => {
  const newSections = (view.sections ?? []).map(section => {
    if (section.id !== sectionId) return section
    return {
      ...section,
      fields: (section.fields ?? []).map(f => {
        if (f.id !== viewFieldId) return f
        return { ...f, component: newComponent }
      }),
    }
  })

  return { ...view, sections: newSections }
}

/**
 * Expression 내 fieldId 참조 업데이트
 */
const updateExpressionReferences = (
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
    return expr.map(item => updateExpressionReferences(item, oldFieldId, newFieldId, prefix))
  }

  if (expr && typeof expr === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(expr)) {
      result[key] = updateExpressionReferences(value, oldFieldId, newFieldId, prefix)
    }
    return result
  }

  return expr
}

/**
 * FormView 전체의 Reaction 내 참조 업데이트
 */
const updateReactionReferences = (
  view: FormViewSchema,
  oldFieldId: string,
  newFieldId: string
): FormViewSchema => {
  const newSections = (view.sections ?? []).map(section => ({
    ...section,
    fields: (section.fields ?? []).map(field => ({
      ...field,
      reactions: (field.reactions ?? []).map(reaction => ({
        ...reaction,
        condition: reaction.condition
          ? (updateExpressionReferences(reaction.condition, oldFieldId, newFieldId) as Expression)
          : undefined,
        actions: (reaction.actions ?? []).map(action => {
          // Only update target/value for action types that have them
          if ('target' in action && 'value' in action) {
            return {
              ...action,
              target: action.target === oldFieldId ? newFieldId : action.target,
              value: updateExpressionReferences(action.value, oldFieldId, newFieldId),
            }
          } else if ('target' in action) {
            return {
              ...action,
              target: action.target === oldFieldId ? newFieldId : action.target,
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
 * 새 필드 추가 (자동 배치)
 */
const addNewField = (
  view: FormViewSchema,
  action: AddFieldAction
): FormViewSchema => {
  const viewField = action.suggestedViewField as ViewField

  // 대상 섹션 결정
  const targetSectionId = action.placement.sectionId ?? view.sections?.[0]?.id

  if (!targetSectionId) {
    // 섹션이 없으면 추가하지 않음
    return view
  }

  const newSections = (view.sections ?? []).map(section => {
    if (section.id !== targetSectionId) return section

    const fields = [...(section.fields ?? [])]

    // 배치 위치 결정
    if (action.placement.afterFieldId) {
      const index = fields.findIndex(f => f.id === action.placement.afterFieldId)
      if (index >= 0) {
        fields.splice(index + 1, 0, viewField)
      } else {
        fields.push(viewField)
      }
    } else {
      // order 기반 삽입 또는 끝에 추가
      fields.push(viewField)
    }

    return { ...section, fields }
  })

  return { ...view, sections: newSections }
}

// ============================================================================
// Strategy Execution
// ============================================================================

export interface FormStrategyResult {
  readonly originalView: FormViewSchema
  readonly updatedView: FormViewSchema
  readonly appliedActions: readonly SuggestedAction[]
  readonly skippedActions: readonly { action: SuggestedAction; reason: string }[]
  readonly warnings: readonly string[]
}

/**
 * FormView 업데이트 실행
 */
export const applyFormStrategy = (
  view: FormViewSchema,
  impact: ViewImpactAnalysis,
  changes: EntityChangeSummary,
  config: SyncManagerConfig
): FormStrategyResult => {
  let updatedView = { ...view }
  const appliedActions: SuggestedAction[] = []
  const skippedActions: { action: SuggestedAction; reason: string }[] = []
  const warnings: string[] = []

  // 1. 제안된 액션 처리
  for (const action of impact.suggestedActions) {
    const shouldApply = shouldApplyAction(action, config)

    if (!shouldApply.apply) {
      skippedActions.push({ action, reason: shouldApply.reason ?? 'Skipped by config' })
      continue
    }

    try {
      updatedView = applyAction(updatedView, action)
      appliedActions.push(action)
    } catch (error) {
      warnings.push(`Failed to apply action: ${action._type} - ${(error as Error).message}`)
    }
  }

  // 2. 이름 변경 시 Reaction 참조도 업데이트
  for (const [oldId, newId] of changes.renamedFields) {
    updatedView = updateReactionReferences(updatedView, oldId, newId)
  }

  // 3. 새 필드 추가 (config에 따라)
  if (config.includeNewFields) {
    for (const change of changes.changes) {
      if (isFieldAdded(change)) {
        const newViewField = createDefaultViewField(change.field)
        const placement = suggestFieldPlacement(updatedView, change.field)

        const addAction: AddFieldAction = {
          _type: 'ADD_FIELD',
          entityField: change.field,
          suggestedViewField: newViewField,
          placement,
          reason: `New field '${change.fieldId}' added to entity`,
        }

        try {
          updatedView = addNewField(updatedView, addAction)
          appliedActions.push(addAction)
        } catch (error) {
          warnings.push(`Failed to add field: ${change.fieldId}`)
        }
      }
    }
  }

  return {
    originalView: view,
    updatedView,
    appliedActions,
    skippedActions,
    warnings,
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * config에 따라 액션 적용 여부 결정
 */
const shouldApplyAction = (
  action: SuggestedAction,
  config: SyncManagerConfig
): { apply: boolean; reason?: string } => {
  if (config.mode === 'manual') {
    return { apply: false, reason: 'Manual mode - requires user approval' }
  }

  if (config.mode === 'auto-safe') {
    // auto-safe: 안전한 변경만 자동 적용
    // - Field ID 업데이트: 안전
    // - Component 업데이트: 안전
    // - Enum 옵션 업데이트: 안전
    // - Field 제거: 위험 (사용자 승인 필요)
    if (action._type === 'REMOVE_FIELD') {
      return { apply: false, reason: 'Field removal requires user approval in auto-safe mode' }
    }
    return { apply: true }
  }

  // auto-all: 모든 변경 자동 적용
  return { apply: true }
}

/**
 * 단일 액션 적용
 */
const applyAction = (
  view: FormViewSchema,
  action: SuggestedAction
): FormViewSchema => {
  switch (action._type) {
    case 'REMOVE_FIELD': {
      const [, sectionId, , fieldId] = action.targetPath
      return removeViewField(view, sectionId as string, fieldId as string)
    }

    case 'UPDATE_FIELD_ID': {
      const [, sectionId] = action.targetPath
      // Find the view field that has the old entityFieldId
      const section = view.sections?.find(s => s.id === sectionId)
      const viewField = section?.fields?.find(f => f.entityFieldId === action.oldFieldId)
      if (viewField) {
        return updateFieldId(view, sectionId as string, viewField.id, action.newFieldId)
      }
      return view
    }

    case 'UPDATE_COMPONENT': {
      const [, sectionId] = action.targetPath
      const section = view.sections?.find(s => s.id === sectionId)
      const viewField = section?.fields?.find(f => f.entityFieldId === action.fieldId)
      if (viewField) {
        return updateFieldComponent(
          view,
          sectionId as string,
          viewField.id,
          action.newComponent as ViewField['component']
        )
      }
      return view
    }

    case 'ADD_FIELD':
      return addNewField(view, action)

    default:
      return view
  }
}

/**
 * EntityField에서 기본 ViewField 생성
 */
const createDefaultViewField = (field: {
  id: string
  dataType: string
  label: string
}): ViewField => ({
  id: field.id,
  entityFieldId: field.id,
  component: getDefaultComponent(field.dataType as any),
  label: field.label,
  colSpan: 1,
})

/**
 * 새 필드의 배치 위치 제안
 */
const suggestFieldPlacement = (
  view: FormViewSchema,
  _field: { id: string; dataType: string }
): FieldPlacement => {
  // 기본: 첫 번째 섹션의 마지막에 추가
  const firstSection = view.sections?.[0]

  return {
    sectionId: firstSection?.id,
    order: (firstSection?.fields?.length ?? 0) + 1,
    rationale: 'Added to end of first section',
  }
}
