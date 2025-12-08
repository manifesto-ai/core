/**
 * TableSnapshotBuilder
 *
 * ListRuntime + ListViewSchema => TableSnapshot 변환
 */

import type { ListRuntime, ListState, ColumnMeta } from '@manifesto-ai/engine'
import type { ListViewSchema, ColumnType as SchemaColumnType } from '@manifesto-ai/schema'
import type {
  TableSnapshot,
  ColumnDefinition,
  ColumnType,
  TableRow,
  ViewAction,
  SelectionMode,
} from '../types'

// ============================================================================
// Type Mapping
// ============================================================================

/**
 * Schema ColumnType -> ViewSnapshot ColumnType 매핑
 */
const SCHEMA_COLUMN_TO_SNAPSHOT_COLUMN: Record<SchemaColumnType, ColumnType> = {
  'text': 'text',
  'number': 'number',
  'date': 'date',
  'datetime': 'date',
  'boolean': 'checkbox',
  'enum': 'status',
  'link': 'text',
  'image': 'text',
  'badge': 'status',
  'actions': 'actions',
  'custom': 'text',
}

/**
 * SchemaColumnType을 ViewSnapshot ColumnType으로 변환
 */
export const mapSchemaColumnType = (type: SchemaColumnType): ColumnType => {
  return SCHEMA_COLUMN_TO_SNAPSHOT_COLUMN[type] ?? 'text'
}

// ============================================================================
// Builder Options
// ============================================================================

export interface TableSnapshotBuilderOptions {
  /** 행 ID 필드명 (기본값: 'id') */
  idField?: string
  /** 추가 액션 */
  additionalActions?: readonly ViewAction[]
}

// ============================================================================
// Builder
// ============================================================================

/**
 * ColumnMeta에서 ColumnDefinition 생성
 */
const buildColumnDefinition = (meta: ColumnMeta): ColumnDefinition => {
  return {
    id: meta.id,
    label: meta.label,
    type: mapSchemaColumnType(meta.type),
    sortable: meta.sortable,
  }
}

/**
 * ListState rows에서 TableRow 목록 생성
 */
const buildTableRows = (
  rows: readonly Record<string, unknown>[],
  idField: string
): TableRow[] => {
  return rows.map(row => ({
    id: String(row[idField] ?? ''),
    data: { ...row },
  }))
}

/**
 * 테이블 액션 생성
 */
const buildTableActions = (schema: ListViewSchema): ViewAction[] => {
  const actions: ViewAction[] = []

  // 기본 테이블 액션
  actions.push({
    type: 'selectRow',
    label: '선택',
  })

  if (schema.selection?.mode === 'multiple') {
    actions.push({
      type: 'selectAll',
      label: '전체 선택',
    })

    actions.push({
      type: 'deselectAll',
      label: '전체 해제',
    })
  }

  actions.push({
    type: 'changePage',
    label: '페이지 이동',
  })

  if (schema.sorting?.enabled !== false) {
    actions.push({
      type: 'sortColumn',
      label: '정렬',
    })
  }

  // Bulk Actions
  if (schema.bulkActions) {
    for (const bulkAction of schema.bulkActions) {
      actions.push({
        type: bulkAction.id,
        label: bulkAction.label,
        condition: {
          requiresSelection: true,
          minSelection: bulkAction.minSelection ?? 1,
        },
      })
    }
  }

  // Header Actions
  if (schema.header?.actions) {
    for (const action of schema.header.actions) {
      actions.push({
        type: action.action.type,
        label: action.label,
      })
    }
  }

  return actions
}

/**
 * 선택 모드 결정
 */
const getSelectionMode = (schema: ListViewSchema): SelectionMode => {
  if (!schema.selection?.enabled) return 'none'
  return schema.selection.mode === 'single' ? 'single' : 'multiple'
}

/**
 * TableSnapshot 빌더
 */
export const buildTableSnapshot = (
  nodeId: string,
  runtime: ListRuntime,
  schema: ListViewSchema,
  options: TableSnapshotBuilderOptions = {}
): TableSnapshot => {
  const state = runtime.getState()
  return buildTableSnapshotFromState(nodeId, state, schema, options)
}

/**
 * ListState에서 직접 TableSnapshot 빌더 (Runtime 없이)
 */
export const buildTableSnapshotFromState = (
  nodeId: string,
  state: ListState,
  schema: ListViewSchema,
  options: TableSnapshotBuilderOptions = {}
): TableSnapshot => {
  const idField = options.idField ?? 'id'

  // 컬럼 정의 생성 (숨겨진 컬럼 제외)
  const columns: ColumnDefinition[] = []
  for (const [_columnId, meta] of state.columns) {
    if (!meta.hidden) {
      columns.push(buildColumnDefinition(meta))
    }
  }

  const rows = buildTableRows(state.rows, idField)
  const actions = buildTableActions(schema)

  if (options.additionalActions) {
    actions.push(...options.additionalActions)
  }

  return {
    nodeId,
    kind: 'table',
    label: schema.name,
    columns,
    rows,
    selection: {
      mode: getSelectionMode(schema),
      selectedRowIds: [...state.selectedIds],
    },
    pagination: {
      currentPage: state.currentPage,
      totalPages: state.totalPages,
      pageSize: state.pageSize,
      totalItems: state.totalCount,
    },
    sorting: state.sortField && state.sortDirection ? {
      columnId: state.sortField,
      direction: state.sortDirection,
    } : undefined,
    actions,
  }
}
