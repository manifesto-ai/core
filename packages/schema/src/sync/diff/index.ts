/**
 * Diff Module
 *
 * Entity 변경 감지 관련 유틸리티
 */

export {
  diffEntities,
  filterChangesByType,
  filterChangesBySeverity,
  summarizeChanges,
  type DiffOptions,
} from './entity-diff'

export {
  detectRenames,
  stringSimilarity,
  filterByConfidence,
  type RenameCandidate,
} from './rename-detector'

export {
  getTypeCompatibility,
  getDefaultComponent,
  getDefaultColumnType,
  isTypeCompatible,
  requiresComponentChange,
} from './type-compatibility'
