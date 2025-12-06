/**
 * Entity Diff
 *
 * 두 EntitySchema 간의 변경 사항 감지
 */

import type { EntitySchema, EntityField, Constraint, EnumValue } from '../../types'
import type {
  EntityChange,
  EntityChangeSummary,
  FieldMappingHint,
} from '../types'
import { detectRenames } from './rename-detector'
import { getTypeCompatibility } from './type-compatibility'

// ============================================================================
// Field Map Utilities
// ============================================================================

type FieldMap = ReadonlyMap<string, EntityField>

/**
 * EntityField 배열을 ID 기반 Map으로 변환
 */
const buildFieldMap = (fields: readonly EntityField[]): FieldMap =>
  new Map(fields.map(f => [f.id, f]))

// ============================================================================
// Constraint Comparison
// ============================================================================

/**
 * Constraint 배열 비교
 */
const compareConstraints = (
  oldConstraints: readonly Constraint[] | undefined,
  newConstraints: readonly Constraint[] | undefined
): { added: Constraint[]; removed: Constraint[] } => {
  const old = oldConstraints ?? []
  const _new = newConstraints ?? []

  const oldTypes = new Set(old.map(c => c.type))
  const newTypes = new Set(_new.map(c => c.type))

  const added = _new.filter(c => !oldTypes.has(c.type))
  const removed = old.filter(c => !newTypes.has(c.type))

  return { added, removed }
}

// ============================================================================
// Enum Comparison
// ============================================================================

/**
 * EnumValue 배열 비교
 */
const compareEnumValues = (
  oldValues: readonly EnumValue[] | undefined,
  newValues: readonly EnumValue[] | undefined
): {
  added: EnumValue[]
  removed: EnumValue[]
  modified: { old: EnumValue; new: EnumValue }[]
} => {
  const old = oldValues ?? []
  const _new = newValues ?? []

  const oldMap = new Map(old.map(v => [v.value, v]))
  const newMap = new Map(_new.map(v => [v.value, v]))

  const added: EnumValue[] = []
  const removed: EnumValue[] = []
  const modified: { old: EnumValue; new: EnumValue }[] = []

  // Find removed and modified
  for (const oldVal of old) {
    const newVal = newMap.get(oldVal.value)
    if (!newVal) {
      removed.push(oldVal)
    } else if (oldVal.label !== newVal.label) {
      modified.push({ old: oldVal, new: newVal })
    }
  }

  // Find added
  for (const newVal of _new) {
    if (!oldMap.has(newVal.value)) {
      added.push(newVal)
    }
  }

  return { added, removed, modified }
}

// ============================================================================
// Field Change Detection
// ============================================================================

/**
 * 공통 필드의 속성 변경 감지
 */
const detectFieldPropertyChanges = (
  oldField: EntityField,
  newField: EntityField
): EntityChange[] => {
  const changes: EntityChange[] = []
  const fieldId = newField.id

  // 1. DataType 변경
  if (oldField.dataType !== newField.dataType) {
    const compatibility = getTypeCompatibility(oldField.dataType, newField.dataType)
    changes.push({
      _type: 'FIELD_TYPE_CHANGED',
      fieldId,
      oldType: oldField.dataType,
      newType: newField.dataType,
      compatibility,
      severity: compatibility.level === 'incompatible' ? 'critical' : 'warning',
    })
  }

  // 2. Label 변경
  if (oldField.label !== newField.label) {
    changes.push({
      _type: 'FIELD_LABEL_CHANGED',
      fieldId,
      oldLabel: oldField.label,
      newLabel: newField.label,
      severity: 'info',
    })
  }

  // 3. Constraint 변경
  const constraintDiff = compareConstraints(oldField.constraints, newField.constraints)
  if (constraintDiff.added.length > 0 || constraintDiff.removed.length > 0) {
    // 제약조건 추가는 warning (데이터 검증 실패 가능), 제거는 info
    const hasAdded = constraintDiff.added.length > 0
    changes.push({
      _type: 'FIELD_CONSTRAINT_CHANGED',
      fieldId,
      oldConstraints: oldField.constraints ?? [],
      newConstraints: newField.constraints ?? [],
      addedConstraints: constraintDiff.added,
      removedConstraints: constraintDiff.removed,
      severity: hasAdded ? 'warning' : 'info',
    })
  }

  // 4. Enum 값 변경 (enum 타입인 경우만)
  if (oldField.dataType === 'enum' && newField.dataType === 'enum') {
    const enumDiff = compareEnumValues(oldField.enumValues, newField.enumValues)
    if (
      enumDiff.added.length > 0 ||
      enumDiff.removed.length > 0 ||
      enumDiff.modified.length > 0
    ) {
      changes.push({
        _type: 'FIELD_ENUM_CHANGED',
        fieldId,
        addedValues: enumDiff.added,
        removedValues: enumDiff.removed,
        modifiedValues: enumDiff.modified,
        severity: 'warning',
      })
    }
  }

  // 5. Reference Entity 변경
  if (oldField.dataType === 'reference' || newField.dataType === 'reference') {
    const oldRefEntity = oldField.reference?.entity
    const newRefEntity = newField.reference?.entity
    if (oldRefEntity !== newRefEntity) {
      changes.push({
        _type: 'FIELD_REFERENCE_CHANGED',
        fieldId,
        oldEntity: oldRefEntity,
        newEntity: newRefEntity,
        severity: 'critical',
      })
    }
  }

  return changes
}

// ============================================================================
// Main Diff Algorithm
// ============================================================================

export interface DiffOptions {
  readonly fieldMappingHints?: readonly FieldMappingHint[]
  readonly renameThreshold?: number // 기본값 0.7
}

/**
 * 두 EntitySchema 간의 변경 사항 분석
 */
export const diffEntities = (
  oldEntity: EntitySchema,
  newEntity: EntitySchema,
  options?: DiffOptions
): EntityChangeSummary => {
  const oldFieldMap = buildFieldMap(oldEntity.fields)
  const newFieldMap = buildFieldMap(newEntity.fields)

  const oldIds = new Set(oldFieldMap.keys())
  const newIds = new Set(newFieldMap.keys())

  const changes: EntityChange[] = []
  const affectedFieldIds = new Set<string>()
  const renamedFields = new Map<string, string>()

  // 1. 제거된 필드 감지 (old에만 있음)
  const removedFields: EntityField[] = []
  for (const id of oldIds) {
    if (!newIds.has(id)) {
      removedFields.push(oldFieldMap.get(id)!)
    }
  }

  // 2. 추가된 필드 감지 (new에만 있음)
  const addedFields: EntityField[] = []
  for (const id of newIds) {
    if (!oldIds.has(id)) {
      addedFields.push(newFieldMap.get(id)!)
    }
  }

  // 3. 이름 변경 감지 (removed ↔ added 매칭)
  const renameCandidates = detectRenames(
    removedFields,
    addedFields,
    options?.fieldMappingHints
  )

  // 신뢰도 필터링 (기본 0.7)
  const threshold = options?.renameThreshold ?? 0.7
  const confirmedRenames = renameCandidates.filter(c => c.confidence >= threshold)

  const renamedOldIds = new Set(confirmedRenames.map(r => r.oldField.id))
  const renamedNewIds = new Set(confirmedRenames.map(r => r.newField.id))

  // 이름 변경으로 처리된 필드
  for (const rename of confirmedRenames) {
    changes.push({
      _type: 'FIELD_RENAMED',
      oldId: rename.oldField.id,
      newId: rename.newField.id,
      field: rename.newField,
      confidence: rename.confidence,
      severity: 'critical',
    })
    affectedFieldIds.add(rename.oldField.id)
    affectedFieldIds.add(rename.newField.id)
    renamedFields.set(rename.oldField.id, rename.newField.id)

    // 이름 변경과 함께 다른 속성도 변경되었을 수 있음
    const propertyChanges = detectFieldPropertyChanges(rename.oldField, rename.newField)
    for (const change of propertyChanges) {
      changes.push(change)
    }
  }

  // 4. 순수 제거 (이름 변경이 아닌 것)
  for (const field of removedFields) {
    if (!renamedOldIds.has(field.id)) {
      changes.push({
        _type: 'FIELD_REMOVED',
        fieldId: field.id,
        field,
        severity: 'critical',
      })
      affectedFieldIds.add(field.id)
    }
  }

  // 5. 순수 추가 (이름 변경이 아닌 것)
  for (const field of addedFields) {
    if (!renamedNewIds.has(field.id)) {
      changes.push({
        _type: 'FIELD_ADDED',
        fieldId: field.id,
        field,
        severity: 'info',
      })
      affectedFieldIds.add(field.id)
    }
  }

  // 6. 공통 필드의 속성 변경
  for (const id of oldIds) {
    if (newIds.has(id)) {
      const oldField = oldFieldMap.get(id)!
      const newField = newFieldMap.get(id)!
      const propertyChanges = detectFieldPropertyChanges(oldField, newField)

      for (const change of propertyChanges) {
        changes.push(change)
        affectedFieldIds.add(id)
      }
    }
  }

  // 결과 정리
  const hasBreakingChanges = changes.some(
    c =>
      c._type === 'FIELD_REMOVED' ||
      c._type === 'FIELD_RENAMED' ||
      (c._type === 'FIELD_TYPE_CHANGED' && c.compatibility.level === 'incompatible') ||
      c._type === 'FIELD_REFERENCE_CHANGED'
  )

  const hasCriticalChanges = changes.some(c => c.severity === 'critical')

  return {
    oldEntity,
    newEntity,
    changes,
    hasBreakingChanges,
    hasCriticalChanges,
    affectedFieldIds,
    renamedFields,
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 특정 타입의 변경만 필터링
 */
export const filterChangesByType = <T extends EntityChange['_type']>(
  changes: readonly EntityChange[],
  type: T
): Extract<EntityChange, { _type: T }>[] =>
  changes.filter((c): c is Extract<EntityChange, { _type: T }> => c._type === type)

/**
 * 특정 severity 이상의 변경만 필터링
 */
export const filterChangesBySeverity = (
  changes: readonly EntityChange[],
  minSeverity: 'info' | 'warning' | 'critical'
): EntityChange[] => {
  const severityOrder = { info: 0, warning: 1, critical: 2 }
  const minOrder = severityOrder[minSeverity]
  return changes.filter(c => severityOrder[c.severity] >= minOrder)
}

/**
 * 변경 사항 요약 텍스트 생성
 */
export const summarizeChanges = (summary: EntityChangeSummary): string => {
  const lines: string[] = [
    `Entity: ${summary.oldEntity.name} → ${summary.newEntity.name}`,
    `Total changes: ${summary.changes.length}`,
  ]

  if (summary.hasBreakingChanges) {
    lines.push('⚠️ Contains breaking changes')
  }

  const byType = new Map<string, number>()
  for (const change of summary.changes) {
    byType.set(change._type, (byType.get(change._type) ?? 0) + 1)
  }

  for (const [type, count] of byType) {
    lines.push(`  - ${type}: ${count}`)
  }

  return lines.join('\n')
}
