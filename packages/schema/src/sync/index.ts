/**
 * Sync Module
 *
 * Entity 변경 감지 및 View 동기화
 */

// Main API
export {
  syncViews,
  syncFormView,
  syncListView,
  analyzeViewImpact,
  applySuggestedActions,
  summarizeSyncResults,
  getViewsRequiringReview,
  getAllSkippedActions,
} from './sync-manager'

// Types
export type {
  // Change severity
  ChangeSeverity,

  // Entity changes
  EntityChange,
  FieldRemovedChange,
  FieldAddedChange,
  FieldRenamedChange,
  FieldTypeChange,
  FieldConstraintChange,
  FieldEnumChange,
  FieldLabelChange,
  FieldReferenceChange,

  // Type compatibility
  CompatibilityLevel,
  TypeCompatibility,

  // Entity change summary
  EntityChangeSummary,

  // View impact
  ViewType,
  AffectedElement,
  BrokenReference,
  ViewImpactAnalysis,

  // Suggested actions
  SuggestedAction,
  RemoveFieldAction,
  UpdateFieldIdAction,
  UpdateComponentAction,
  UpdateEnumOptionsAction,
  AddFieldAction,
  UpdateReactionAction,
  RemoveReactionAction,
  RemoveFilterAction,
  UpdateFilterFieldIdAction,
  RemoveSortAction,
  UpdateSortFieldIdAction,
  FieldPlacement,

  // Config
  SyncMode,
  FieldMappingHint,
  SyncManagerConfig,

  // Result
  SyncResult,

  // I/O
  SyncManagerInput,
  SyncManagerOutput,
} from './types'

// Type guards
export {
  isFieldRemoved,
  isFieldAdded,
  isFieldRenamed,
  isFieldTypeChanged,
  isFieldConstraintChanged,
  isFieldEnumChanged,
  isFieldLabelChanged,
  isFieldReferenceChanged,
  isCriticalChange,
  isBreakingChange,
  isFormView,
  isListView,
  DEFAULT_SYNC_CONFIG,
} from './types'

// Diff utilities
export {
  diffEntities,
  filterChangesByType,
  filterChangesBySeverity,
  summarizeChanges,
  type DiffOptions,
} from './diff'

export {
  detectRenames,
  stringSimilarity,
  filterByConfidence,
  type RenameCandidate,
} from './diff'

export {
  getTypeCompatibility,
  getDefaultComponent,
  getDefaultColumnType,
  isTypeCompatible,
  requiresComponentChange,
} from './diff'

// Strategies
export {
  analyzeFormViewImpact,
  applyFormStrategy,
  type FormStrategyResult,
} from './strategies'

export {
  analyzeListViewImpact,
  applyListStrategy,
  type ListStrategyResult,
} from './strategies'

export {
  extractFieldReferences,
  updateFieldReference,
  updateFieldReferences,
  findBrokenReferencesInForm,
  findBrokenReferencesInList,
  cleanupBrokenReactions,
  updateFormReactionReferences,
  updateListReferences,
  suggestReactionUpdates,
} from './strategies'
