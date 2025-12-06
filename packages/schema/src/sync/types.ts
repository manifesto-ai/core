/**
 * Sync Manager Types
 *
 * Entity 변경 감지 및 View 동기화를 위한 타입 정의
 */

import type {
  EntitySchema,
  EntityField,
  DataType,
  Constraint,
  EnumValue,
  FormViewSchema,
  ListViewSchema,
  ViewField,
  ListColumn,
  ComponentType,
  ColumnType,
} from '../types'

// ============================================================================
// Change Severity
// ============================================================================

export type ChangeSeverity = 'info' | 'warning' | 'critical'

// ============================================================================
// Entity Change Types (Discriminated Union)
// ============================================================================

export interface FieldRemovedChange {
  readonly _type: 'FIELD_REMOVED'
  readonly fieldId: string
  readonly field: EntityField
  readonly severity: 'critical'
}

export interface FieldAddedChange {
  readonly _type: 'FIELD_ADDED'
  readonly fieldId: string
  readonly field: EntityField
  readonly severity: 'info'
}

export interface FieldRenamedChange {
  readonly _type: 'FIELD_RENAMED'
  readonly oldId: string
  readonly newId: string
  readonly field: EntityField
  readonly confidence: number
  readonly severity: 'critical'
}

export interface FieldTypeChange {
  readonly _type: 'FIELD_TYPE_CHANGED'
  readonly fieldId: string
  readonly oldType: DataType
  readonly newType: DataType
  readonly compatibility: TypeCompatibility
  readonly severity: 'warning' | 'critical'
}

export interface FieldConstraintChange {
  readonly _type: 'FIELD_CONSTRAINT_CHANGED'
  readonly fieldId: string
  readonly oldConstraints: readonly Constraint[]
  readonly newConstraints: readonly Constraint[]
  readonly addedConstraints: readonly Constraint[]
  readonly removedConstraints: readonly Constraint[]
  readonly severity: 'info' | 'warning'
}

export interface FieldEnumChange {
  readonly _type: 'FIELD_ENUM_CHANGED'
  readonly fieldId: string
  readonly addedValues: readonly EnumValue[]
  readonly removedValues: readonly EnumValue[]
  readonly modifiedValues: readonly { old: EnumValue; new: EnumValue }[]
  readonly severity: 'warning'
}

export interface FieldLabelChange {
  readonly _type: 'FIELD_LABEL_CHANGED'
  readonly fieldId: string
  readonly oldLabel: string
  readonly newLabel: string
  readonly severity: 'info'
}

export interface FieldReferenceChange {
  readonly _type: 'FIELD_REFERENCE_CHANGED'
  readonly fieldId: string
  readonly oldEntity: string | undefined
  readonly newEntity: string | undefined
  readonly severity: 'critical'
}

export type EntityChange =
  | FieldRemovedChange
  | FieldAddedChange
  | FieldRenamedChange
  | FieldTypeChange
  | FieldConstraintChange
  | FieldEnumChange
  | FieldLabelChange
  | FieldReferenceChange

// ============================================================================
// Type Compatibility
// ============================================================================

export type CompatibilityLevel = 'compatible' | 'requires-component-change' | 'incompatible'

export interface TypeCompatibility {
  readonly level: CompatibilityLevel
  readonly suggestedComponent?: ComponentType
  readonly suggestedColumnType?: ColumnType
  readonly warning?: string
}

// ============================================================================
// Entity Change Summary
// ============================================================================

export interface EntityChangeSummary {
  readonly oldEntity: EntitySchema
  readonly newEntity: EntitySchema
  readonly changes: readonly EntityChange[]
  readonly hasBreakingChanges: boolean
  readonly hasCriticalChanges: boolean
  readonly affectedFieldIds: ReadonlySet<string>
  readonly renamedFields: ReadonlyMap<string, string> // oldId -> newId
}

// ============================================================================
// View Impact Analysis
// ============================================================================

export type ViewType = 'form' | 'list'

export interface AffectedElement {
  readonly elementType: 'field' | 'column' | 'filter' | 'sort' | 'reaction'
  readonly elementId: string
  readonly entityFieldId: string
  readonly change: EntityChange
  readonly impact: 'remove' | 'update' | 'warning'
}

export interface BrokenReference {
  readonly path: readonly string[]
  readonly referencedFieldId: string
  readonly context: string
}

export interface ViewImpactAnalysis {
  readonly viewId: string
  readonly viewType: ViewType
  readonly affectedElements: readonly AffectedElement[]
  readonly brokenReferences: readonly BrokenReference[]
  readonly suggestedActions: readonly SuggestedAction[]
  readonly requiresReview: boolean
}

// ============================================================================
// Suggested Actions
// ============================================================================

export interface RemoveFieldAction {
  readonly _type: 'REMOVE_FIELD'
  readonly targetPath: readonly string[]
  readonly fieldId: string
  readonly reason: string
}

export interface UpdateFieldIdAction {
  readonly _type: 'UPDATE_FIELD_ID'
  readonly targetPath: readonly string[]
  readonly oldFieldId: string
  readonly newFieldId: string
  readonly reason: string
}

export interface UpdateComponentAction {
  readonly _type: 'UPDATE_COMPONENT'
  readonly targetPath: readonly string[]
  readonly fieldId: string
  readonly oldComponent: ComponentType | ColumnType
  readonly newComponent: ComponentType | ColumnType
  readonly reason: string
}

export interface UpdateEnumOptionsAction {
  readonly _type: 'UPDATE_ENUM_OPTIONS'
  readonly targetPath: readonly string[]
  readonly fieldId: string
  readonly addedValues: readonly EnumValue[]
  readonly removedValues: readonly EnumValue[]
  readonly reason: string
}

export interface AddFieldAction {
  readonly _type: 'ADD_FIELD'
  readonly entityField: EntityField
  readonly suggestedViewField: ViewField | ListColumn
  readonly placement: FieldPlacement
  readonly reason: string
}

export interface UpdateReactionAction {
  readonly _type: 'UPDATE_REACTION'
  readonly targetPath: readonly string[]
  readonly fieldId: string
  readonly oldExpression: unknown
  readonly newExpression: unknown
  readonly reason: string
}

export interface RemoveReactionAction {
  readonly _type: 'REMOVE_REACTION'
  readonly targetPath: readonly string[]
  readonly fieldId: string
  readonly reason: string
}

export interface RemoveFilterAction {
  readonly _type: 'REMOVE_FILTER'
  readonly filterId: string
  readonly entityFieldId: string
  readonly reason: string
}

export interface UpdateFilterFieldIdAction {
  readonly _type: 'UPDATE_FILTER_FIELD_ID'
  readonly filterId: string
  readonly oldFieldId: string
  readonly newFieldId: string
  readonly reason: string
}

export interface RemoveSortAction {
  readonly _type: 'REMOVE_SORT'
  readonly entityFieldId: string
  readonly reason: string
}

export interface UpdateSortFieldIdAction {
  readonly _type: 'UPDATE_SORT_FIELD_ID'
  readonly oldFieldId: string
  readonly newFieldId: string
  readonly reason: string
}

export type SuggestedAction =
  | RemoveFieldAction
  | UpdateFieldIdAction
  | UpdateComponentAction
  | UpdateEnumOptionsAction
  | AddFieldAction
  | UpdateReactionAction
  | RemoveReactionAction
  | RemoveFilterAction
  | UpdateFilterFieldIdAction
  | RemoveSortAction
  | UpdateSortFieldIdAction

export interface FieldPlacement {
  readonly sectionId?: string
  readonly afterFieldId?: string
  readonly order: number
  readonly rationale: string
}

// ============================================================================
// Sync Configuration
// ============================================================================

export type SyncMode = 'manual' | 'auto-safe' | 'auto-all'

export interface FieldMappingHint {
  readonly oldFieldId: string
  readonly newFieldId: string
}

export interface SyncManagerConfig {
  readonly mode: SyncMode
  readonly includeNewFields: boolean
  readonly preserveCustomizations: boolean
  readonly fieldMappingHints?: readonly FieldMappingHint[]
}

export const DEFAULT_SYNC_CONFIG: SyncManagerConfig = {
  mode: 'manual',
  includeNewFields: false,
  preserveCustomizations: true,
}

// ============================================================================
// Sync Result
// ============================================================================

export interface SyncResult {
  readonly viewId: string
  readonly viewType: ViewType
  readonly originalView: FormViewSchema | ListViewSchema
  readonly updatedView: FormViewSchema | ListViewSchema
  readonly appliedActions: readonly SuggestedAction[]
  readonly skippedActions: readonly { action: SuggestedAction; reason: string }[]
  readonly warnings: readonly string[]
  readonly requiresReview: boolean
}

// ============================================================================
// Sync Manager I/O
// ============================================================================

export interface SyncManagerInput {
  readonly oldEntity: EntitySchema
  readonly newEntity: EntitySchema
  readonly views: readonly (FormViewSchema | ListViewSchema)[]
  readonly config?: Partial<SyncManagerConfig>
}

export interface SyncManagerOutput {
  readonly changes: EntityChangeSummary
  readonly viewImpacts: readonly ViewImpactAnalysis[]
  readonly syncResults: readonly SyncResult[]
}

// ============================================================================
// Type Guards
// ============================================================================

export const isFieldRemoved = (c: EntityChange): c is FieldRemovedChange =>
  c._type === 'FIELD_REMOVED'

export const isFieldAdded = (c: EntityChange): c is FieldAddedChange =>
  c._type === 'FIELD_ADDED'

export const isFieldRenamed = (c: EntityChange): c is FieldRenamedChange =>
  c._type === 'FIELD_RENAMED'

export const isFieldTypeChanged = (c: EntityChange): c is FieldTypeChange =>
  c._type === 'FIELD_TYPE_CHANGED'

export const isFieldConstraintChanged = (c: EntityChange): c is FieldConstraintChange =>
  c._type === 'FIELD_CONSTRAINT_CHANGED'

export const isFieldEnumChanged = (c: EntityChange): c is FieldEnumChange =>
  c._type === 'FIELD_ENUM_CHANGED'

export const isFieldLabelChanged = (c: EntityChange): c is FieldLabelChange =>
  c._type === 'FIELD_LABEL_CHANGED'

export const isFieldReferenceChanged = (c: EntityChange): c is FieldReferenceChange =>
  c._type === 'FIELD_REFERENCE_CHANGED'

export const isCriticalChange = (c: EntityChange): boolean =>
  c.severity === 'critical'

export const isBreakingChange = (c: EntityChange): boolean =>
  c._type === 'FIELD_REMOVED' ||
  c._type === 'FIELD_RENAMED' ||
  (c._type === 'FIELD_TYPE_CHANGED' && c.compatibility.level === 'incompatible') ||
  c._type === 'FIELD_REFERENCE_CHANGED'

export const isFormView = (view: FormViewSchema | ListViewSchema): view is FormViewSchema =>
  'sections' in view

export const isListView = (view: FormViewSchema | ListViewSchema): view is ListViewSchema =>
  'columns' in view
