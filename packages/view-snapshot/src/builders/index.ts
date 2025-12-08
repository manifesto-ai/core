/**
 * ViewSnapshot Builders
 *
 * 스냅샷 빌더 함수 re-export
 */

// Form Snapshot Builder
export {
  mapComponentToFieldType,
  buildFormSnapshot,
  buildFormSnapshotFromState,
} from './FormSnapshotBuilder'
export type { FormSnapshotBuilderOptions } from './FormSnapshotBuilder'

// Table Snapshot Builder
export {
  mapSchemaColumnType,
  buildTableSnapshot,
  buildTableSnapshotFromState,
} from './TableSnapshotBuilder'
export type { TableSnapshotBuilderOptions } from './TableSnapshotBuilder'

// Page Snapshot Builder
export {
  buildPageSnapshot,
  addChildToPage,
  addOverlayToPage,
  removeOverlayFromPage,
  findNodeInPage,
  updateChildInPage,
} from './PageSnapshotBuilder'
export type { PageSnapshotBuilderOptions } from './PageSnapshotBuilder'
