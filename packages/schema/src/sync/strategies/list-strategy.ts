/**
 * List View Update Strategy
 *
 * Entity 변경에 따른 ListView 업데이트 전략
 */

import type {
  ListViewSchema,
  ListColumn,
  FilterField,
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
import { getDefaultColumnType } from '../diff/type-compatibility'

// ============================================================================
// Impact Analysis
// ============================================================================

/**
 * ListView에서 특정 entityFieldId를 참조하는 Column 찾기
 */
const findColumnsReferencing = (
  view: ListViewSchema,
  entityFieldId: string
): ListColumn[] =>
  (view.columns ?? []).filter(col => col.entityFieldId === entityFieldId)

/**
 * FilterField에서 특정 fieldId 참조 찾기
 */
const findFiltersReferencing = (
  view: ListViewSchema,
  entityFieldId: string
): FilterField[] =>
  (view.filtering?.fields ?? []).filter(f => f.entityFieldId === entityFieldId)

/**
 * Sort에서 특정 fieldId 참조 확인
 */
const hasSortReferencing = (
  view: ListViewSchema,
  entityFieldId: string
): boolean =>
  view.sorting?.defaultSort?.field === entityFieldId

/**
 * ListView 영향 분석
 */
export const analyzeListViewImpact = (
  view: ListViewSchema,
  changes: EntityChangeSummary
): ViewImpactAnalysis => {
  const affectedElements: AffectedElement[] = []
  const suggestedActions: SuggestedAction[] = []

  for (const change of changes.changes) {
    // 1. Field Removed
    if (isFieldRemoved(change)) {
      // Check columns
      const cols = findColumnsReferencing(view, change.fieldId)
      for (const col of cols) {
        affectedElements.push({
          elementType: 'column',
          elementId: col.id,
          entityFieldId: change.fieldId,
          change,
          impact: 'remove',
        })

        suggestedActions.push({
          _type: 'REMOVE_FIELD',
          targetPath: ['columns', col.id],
          fieldId: change.fieldId,
          reason: `Field '${change.fieldId}' was removed from entity`,
        })
      }

      // Check filters
      const filters = findFiltersReferencing(view, change.fieldId)
      for (const filter of filters) {
        affectedElements.push({
          elementType: 'filter',
          elementId: filter.id,
          entityFieldId: change.fieldId,
          change,
          impact: 'remove',
        })

        suggestedActions.push({
          _type: 'REMOVE_FILTER',
          filterId: filter.id,
          entityFieldId: change.fieldId,
          reason: `Field '${change.fieldId}' was removed from entity`,
        })
      }

      // Check sorts
      if (hasSortReferencing(view, change.fieldId)) {
        affectedElements.push({
          elementType: 'sort',
          elementId: change.fieldId,
          entityFieldId: change.fieldId,
          change,
          impact: 'remove',
        })

        suggestedActions.push({
          _type: 'REMOVE_SORT',
          entityFieldId: change.fieldId,
          reason: `Field '${change.fieldId}' was removed from entity`,
        })
      }
    }

    // 2. Field Renamed
    if (isFieldRenamed(change)) {
      const cols = findColumnsReferencing(view, change.oldId)
      for (const col of cols) {
        affectedElements.push({
          elementType: 'column',
          elementId: col.id,
          entityFieldId: change.oldId,
          change,
          impact: 'update',
        })

        suggestedActions.push({
          _type: 'UPDATE_FIELD_ID',
          targetPath: ['columns', col.id],
          oldFieldId: change.oldId,
          newFieldId: change.newId,
          reason: `Field renamed from '${change.oldId}' to '${change.newId}'`,
        })
      }

      // Check filters
      const filters = findFiltersReferencing(view, change.oldId)
      for (const filter of filters) {
        affectedElements.push({
          elementType: 'filter',
          elementId: filter.id,
          entityFieldId: change.oldId,
          change,
          impact: 'update',
        })

        suggestedActions.push({
          _type: 'UPDATE_FILTER_FIELD_ID',
          filterId: filter.id,
          oldFieldId: change.oldId,
          newFieldId: change.newId,
          reason: `Field renamed from '${change.oldId}' to '${change.newId}'`,
        })
      }

      // Check sorts
      if (hasSortReferencing(view, change.oldId)) {
        affectedElements.push({
          elementType: 'sort',
          elementId: change.oldId,
          entityFieldId: change.oldId,
          change,
          impact: 'update',
        })

        suggestedActions.push({
          _type: 'UPDATE_SORT_FIELD_ID',
          oldFieldId: change.oldId,
          newFieldId: change.newId,
          reason: `Field renamed from '${change.oldId}' to '${change.newId}'`,
        })
      }
    }

    // 3. Field Type Changed
    if (isFieldTypeChanged(change)) {
      const cols = findColumnsReferencing(view, change.fieldId)
      for (const col of cols) {
        if (change.compatibility.level !== 'compatible') {
          affectedElements.push({
            elementType: 'column',
            elementId: col.id,
            entityFieldId: change.fieldId,
            change,
            impact: change.compatibility.level === 'incompatible' ? 'warning' : 'update',
          })

          if (change.compatibility.suggestedColumnType) {
            suggestedActions.push({
              _type: 'UPDATE_COMPONENT',
              targetPath: ['columns', col.id],
              fieldId: change.fieldId,
              oldComponent: col.type,
              newComponent: change.compatibility.suggestedColumnType,
              reason: `Type changed from '${change.oldType}' to '${change.newType}'`,
            })
          }
        }
      }
    }

    // 4. Enum Changed
    if (isFieldEnumChanged(change)) {
      const cols = findColumnsReferencing(view, change.fieldId)
      for (const col of cols) {
        affectedElements.push({
          elementType: 'column',
          elementId: col.id,
          entityFieldId: change.fieldId,
          change,
          impact: 'update',
        })

        if (change.addedValues.length > 0 || change.removedValues.length > 0) {
          suggestedActions.push({
            _type: 'UPDATE_ENUM_OPTIONS',
            targetPath: ['columns', col.id],
            fieldId: change.fieldId,
            addedValues: change.addedValues,
            removedValues: change.removedValues,
            reason: 'Enum values changed',
          })
        }
      }
    }

    // 5. Field Added
    if (isFieldAdded(change)) {
      affectedElements.push({
        elementType: 'column',
        elementId: change.fieldId,
        entityFieldId: change.fieldId,
        change,
        impact: 'update',
      })
    }
  }

  const requiresReview =
    affectedElements.some(e => e.impact === 'remove') ||
    changes.hasBreakingChanges

  return {
    viewId: view.id,
    viewType: 'list',
    affectedElements,
    brokenReferences: [],
    suggestedActions,
    requiresReview,
  }
}

// ============================================================================
// View Update
// ============================================================================

/**
 * Column 제거
 */
const removeColumn = (
  view: ListViewSchema,
  columnId: string
): ListViewSchema => ({
  ...view,
  columns: (view.columns ?? []).filter(c => c.id !== columnId),
})

/**
 * Column의 entityFieldId 업데이트
 */
const updateColumnFieldId = (
  view: ListViewSchema,
  columnId: string,
  newEntityFieldId: string
): ListViewSchema => ({
  ...view,
  columns: (view.columns ?? []).map(c =>
    c.id === columnId ? { ...c, entityFieldId: newEntityFieldId } : c
  ),
})

/**
 * Column의 type 업데이트
 */
const updateColumnType = (
  view: ListViewSchema,
  columnId: string,
  newColumnType: ListColumn['type']
): ListViewSchema => ({
  ...view,
  columns: (view.columns ?? []).map(c =>
    c.id === columnId ? { ...c, type: newColumnType } : c
  ),
})

/**
 * 새 Column 추가
 */
const addColumn = (
  view: ListViewSchema,
  column: ListColumn,
  placement: FieldPlacement
): ListViewSchema => {
  const columns = [...(view.columns ?? [])]

  if (placement.afterFieldId) {
    const index = columns.findIndex(c => c.entityFieldId === placement.afterFieldId)
    if (index >= 0) {
      columns.splice(index + 1, 0, column)
    } else {
      columns.push(column)
    }
  } else {
    columns.push(column)
  }

  return { ...view, columns }
}

/**
 * Filter 제거
 */
const removeFilter = (
  view: ListViewSchema,
  filterId: string
): ListViewSchema => {
  if (!view.filtering?.fields) return view

  const newFields = view.filtering.fields.filter(f => f.id !== filterId)

  return {
    ...view,
    filtering: {
      ...view.filtering,
      fields: newFields.length > 0 ? newFields : undefined,
    },
  }
}

/**
 * Filter의 entityFieldId 업데이트
 */
const updateFilterFieldId = (
  view: ListViewSchema,
  filterId: string,
  newEntityFieldId: string
): ListViewSchema => {
  if (!view.filtering?.fields) return view

  return {
    ...view,
    filtering: {
      ...view.filtering,
      fields: view.filtering.fields.map(f =>
        f.id === filterId ? { ...f, entityFieldId: newEntityFieldId } : f
      ),
    },
  }
}

/**
 * Sort 제거 (defaultSort를 undefined로 설정)
 */
const removeSort = (
  view: ListViewSchema
): ListViewSchema => {
  if (!view.sorting) return view

  return {
    ...view,
    sorting: {
      ...view.sorting,
      defaultSort: undefined,
    },
  }
}

/**
 * Sort의 field 업데이트
 */
const updateSortFieldId = (
  view: ListViewSchema,
  newFieldId: string
): ListViewSchema => {
  if (!view.sorting?.defaultSort) return view

  return {
    ...view,
    sorting: {
      ...view.sorting,
      defaultSort: {
        ...view.sorting.defaultSort,
        field: newFieldId,
      },
    },
  }
}

// ============================================================================
// Strategy Execution
// ============================================================================

export interface ListStrategyResult {
  readonly originalView: ListViewSchema
  readonly updatedView: ListViewSchema
  readonly appliedActions: readonly SuggestedAction[]
  readonly skippedActions: readonly { action: SuggestedAction; reason: string }[]
  readonly warnings: readonly string[]
}

/**
 * ListView 업데이트 실행
 */
export const applyListStrategy = (
  view: ListViewSchema,
  impact: ViewImpactAnalysis,
  changes: EntityChangeSummary,
  config: SyncManagerConfig
): ListStrategyResult => {
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

  // 2. 이름 변경 시 columns 업데이트 (reaction-strategy에서 처리)
  // Note: list-strategy doesn't handle reactions, just columns

  // 3. 새 Column 추가 (config에 따라)
  if (config.includeNewFields) {
    for (const change of changes.changes) {
      if (isFieldAdded(change)) {
        const newColumn = createDefaultColumn(change.field)
        const placement = suggestColumnPlacement(updatedView, change.field)

        const addAction: AddFieldAction = {
          _type: 'ADD_FIELD',
          entityField: change.field,
          suggestedViewField: newColumn,
          placement,
          reason: `New field '${change.fieldId}' added to entity`,
        }

        try {
          updatedView = addColumn(updatedView, newColumn, placement)
          appliedActions.push(addAction)
        } catch (error) {
          warnings.push(`Failed to add column: ${change.fieldId}`)
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
    // Removal actions require user approval in auto-safe mode
    if (
      action._type === 'REMOVE_FIELD' ||
      action._type === 'REMOVE_FILTER' ||
      action._type === 'REMOVE_SORT'
    ) {
      return { apply: false, reason: 'Removal requires user approval in auto-safe mode' }
    }
    return { apply: true }
  }

  return { apply: true }
}

/**
 * 단일 액션 적용
 */
const applyAction = (
  view: ListViewSchema,
  action: SuggestedAction
): ListViewSchema => {
  switch (action._type) {
    case 'REMOVE_FIELD': {
      // Find column by entityFieldId
      const column = view.columns?.find(c => c.entityFieldId === action.fieldId)
      if (column) {
        return removeColumn(view, column.id)
      }
      return view
    }

    case 'UPDATE_FIELD_ID': {
      const column = view.columns?.find(c => c.entityFieldId === action.oldFieldId)
      if (column) {
        return updateColumnFieldId(view, column.id, action.newFieldId)
      }
      return view
    }

    case 'UPDATE_COMPONENT': {
      const column = view.columns?.find(c => c.entityFieldId === action.fieldId)
      if (column) {
        return updateColumnType(view, column.id, action.newComponent as ListColumn['type'])
      }
      return view
    }

    case 'REMOVE_FILTER': {
      return removeFilter(view, action.filterId)
    }

    case 'UPDATE_FILTER_FIELD_ID': {
      return updateFilterFieldId(view, action.filterId, action.newFieldId)
    }

    case 'REMOVE_SORT': {
      return removeSort(view)
    }

    case 'UPDATE_SORT_FIELD_ID': {
      return updateSortFieldId(view, action.newFieldId)
    }

    default:
      return view
  }
}

/**
 * EntityField에서 기본 ListColumn 생성
 */
const createDefaultColumn = (field: {
  id: string
  dataType: string
  label: string
}): ListColumn => ({
  id: field.id,
  entityFieldId: field.id,
  type: getDefaultColumnType(field.dataType as any),
  label: field.label,
  width: 'auto',
  sortable: true,
})

/**
 * 새 Column의 배치 위치 제안
 */
const suggestColumnPlacement = (
  view: ListViewSchema,
  _field: { id: string; dataType: string }
): FieldPlacement => ({
  order: (view.columns?.length ?? 0) + 1,
  rationale: 'Added to end of columns',
})
