/**
 * List Primitives - Atomic builders for List View elements
 *
 * Column builders, action builders, config builders for ListViewSchema
 */

import type {
  ListColumn,
  ColumnType,
  ColumnFormat,
  ColumnSummary,
  RowAction,
  BulkAction,
  ActionReference,
  PaginationConfig,
  SortingConfig,
  SelectionConfig,
  FilterConfig,
  FilterField,
  ListDataSource,
  EmptyStateConfig,
  ConfirmConfig,
} from '../types/schema'

// ============================================================================
// Column Builders
// ============================================================================

/**
 * 기본 컬럼 생성
 */
export const column = (
  id: string,
  entityFieldId: string,
  type: ColumnType,
  label: string,
  options?: Partial<Omit<ListColumn, 'id' | 'entityFieldId' | 'type' | 'label'>>
): ListColumn => ({
  id,
  entityFieldId,
  type,
  label,
  ...options,
})

/**
 * 텍스트 컬럼 (type: 'text')
 */
export const textColumn = (
  id: string,
  entityFieldId: string,
  label: string,
  options?: Partial<Omit<ListColumn, 'id' | 'entityFieldId' | 'type' | 'label'>>
): ListColumn => column(id, entityFieldId, 'text', label, options)

/**
 * 숫자 컬럼 (type: 'number')
 */
export const numberColumn = (
  id: string,
  entityFieldId: string,
  label: string,
  options?: Partial<Omit<ListColumn, 'id' | 'entityFieldId' | 'type' | 'label'>>
): ListColumn => column(id, entityFieldId, 'number', label, options)

/**
 * 날짜 컬럼 (type: 'date')
 */
export const dateColumn = (
  id: string,
  entityFieldId: string,
  label: string,
  options?: Partial<Omit<ListColumn, 'id' | 'entityFieldId' | 'type' | 'label'>>
): ListColumn => column(id, entityFieldId, 'date', label, options)

/**
 * 날짜시간 컬럼 (type: 'datetime')
 */
export const datetimeColumn = (
  id: string,
  entityFieldId: string,
  label: string,
  options?: Partial<Omit<ListColumn, 'id' | 'entityFieldId' | 'type' | 'label'>>
): ListColumn => column(id, entityFieldId, 'datetime', label, options)

/**
 * 불리언 컬럼 (type: 'boolean')
 */
export const booleanColumn = (
  id: string,
  entityFieldId: string,
  label: string,
  options?: Partial<Omit<ListColumn, 'id' | 'entityFieldId' | 'type' | 'label'>>
): ListColumn => column(id, entityFieldId, 'boolean', label, options)

/**
 * Enum 컬럼 (type: 'enum')
 */
export const enumColumn = (
  id: string,
  entityFieldId: string,
  label: string,
  enumMap: Record<string, string>,
  options?: Partial<Omit<ListColumn, 'id' | 'entityFieldId' | 'type' | 'label' | 'format'>>
): ListColumn => column(id, entityFieldId, 'enum', label, {
  format: { enumMap },
  ...options,
})

/**
 * 링크 컬럼 (type: 'link')
 */
export const linkColumn = (
  id: string,
  entityFieldId: string,
  label: string,
  linkTemplate: string,
  options?: Partial<Omit<ListColumn, 'id' | 'entityFieldId' | 'type' | 'label' | 'format'>>
): ListColumn => column(id, entityFieldId, 'link', label, {
  format: { linkTemplate },
  ...options,
})

/**
 * 이미지 컬럼 (type: 'image')
 */
export const imageColumn = (
  id: string,
  entityFieldId: string,
  label: string,
  options?: Partial<Omit<ListColumn, 'id' | 'entityFieldId' | 'type' | 'label'>>
): ListColumn => column(id, entityFieldId, 'image', label, options)

/**
 * 뱃지 컬럼 (type: 'badge')
 */
export const badgeColumn = (
  id: string,
  entityFieldId: string,
  label: string,
  options?: Partial<Omit<ListColumn, 'id' | 'entityFieldId' | 'type' | 'label'>>
): ListColumn => column(id, entityFieldId, 'badge', label, options)

/**
 * 액션 컬럼 (type: 'actions')
 */
export const actionsColumn = (
  id: string,
  actions: readonly RowAction[],
  options?: Partial<Omit<ListColumn, 'id' | 'entityFieldId' | 'type' | 'label' | 'actions'>>
): ListColumn => ({
  id,
  entityFieldId: '',
  type: 'actions',
  label: '',
  actions,
  align: 'right',
  ...options,
})

/**
 * 커스텀 컬럼 (type: 'custom')
 */
export const customColumn = (
  id: string,
  entityFieldId: string,
  label: string,
  options?: Partial<Omit<ListColumn, 'id' | 'entityFieldId' | 'type' | 'label'>>
): ListColumn => column(id, entityFieldId, 'custom', label, options)

// ============================================================================
// Summary Builders
// ============================================================================

/**
 * 합계 요약
 */
export const sumSummary = (label?: string, format?: ColumnFormat): ColumnSummary => ({
  type: 'sum',
  label,
  format,
})

/**
 * 평균 요약
 */
export const avgSummary = (label?: string, format?: ColumnFormat): ColumnSummary => ({
  type: 'avg',
  label,
  format,
})

/**
 * 개수 요약
 */
export const countSummary = (label?: string): ColumnSummary => ({
  type: 'count',
  label,
})

/**
 * 최솟값 요약
 */
export const minSummary = (label?: string, format?: ColumnFormat): ColumnSummary => ({
  type: 'min',
  label,
  format,
})

/**
 * 최댓값 요약
 */
export const maxSummary = (label?: string, format?: ColumnFormat): ColumnSummary => ({
  type: 'max',
  label,
  format,
})

// ============================================================================
// Row Action Builders
// ============================================================================

/**
 * 행 액션 생성
 */
export const rowAction = (
  id: string,
  label: string,
  action: ActionReference,
  options?: Partial<Omit<RowAction, 'id' | 'label' | 'action'>>
): RowAction => ({
  id,
  label,
  action,
  ...options,
})

/**
 * 편집 액션 (프리셋)
 */
export const editAction = (
  actionId?: string,
  options?: Partial<Omit<RowAction, 'id' | 'label' | 'action'>>
): RowAction => rowAction(
  'edit',
  '편집',
  { type: 'custom', actionId: actionId ?? 'edit' },
  { icon: 'edit', variant: 'ghost', ...options }
)

/**
 * 삭제 액션 (프리셋)
 */
export const deleteAction = (
  actionId?: string,
  confirm?: ConfirmConfig,
  options?: Partial<Omit<RowAction, 'id' | 'label' | 'action' | 'confirm'>>
): RowAction => rowAction(
  'delete',
  '삭제',
  {
    type: 'custom',
    actionId: actionId ?? 'delete',
    confirm: confirm ?? {
      title: '삭제 확인',
      message: '정말 삭제하시겠습니까?',
      confirmLabel: '삭제',
      cancelLabel: '취소',
    },
  },
  { icon: 'delete', variant: 'danger', ...options }
)

/**
 * 보기 액션 (프리셋)
 * Note: rowViewAction으로 이름을 변경함 (viewAction은 combinators/view.ts에서 이미 사용 중)
 */
export const rowViewAction = (
  actionId?: string,
  options?: Partial<Omit<RowAction, 'id' | 'label' | 'action'>>
): RowAction => rowAction(
  'view',
  '보기',
  { type: 'custom', actionId: actionId ?? 'view' },
  { icon: 'visibility', variant: 'ghost', ...options }
)

// ============================================================================
// Bulk Action Builders
// ============================================================================

/**
 * 일괄 액션 생성
 */
export const bulkAction = (
  id: string,
  label: string,
  action: ActionReference,
  options?: Partial<Omit<BulkAction, 'id' | 'label' | 'action'>>
): BulkAction => ({
  id,
  label,
  action,
  minSelection: 1,
  ...options,
})

/**
 * 일괄 삭제 액션 (프리셋)
 */
export const bulkDeleteAction = (
  actionId?: string,
  options?: Partial<Omit<BulkAction, 'id' | 'label' | 'action'>>
): BulkAction => bulkAction(
  'bulk-delete',
  '선택 삭제',
  {
    type: 'custom',
    actionId: actionId ?? 'bulk-delete',
    confirm: {
      title: '일괄 삭제 확인',
      message: '선택한 항목들을 삭제하시겠습니까?',
      confirmLabel: '삭제',
      cancelLabel: '취소',
    },
  },
  { icon: 'delete', variant: 'danger', ...options }
)

// ============================================================================
// Config Builders
// ============================================================================

/**
 * 페이지네이션 설정
 */
export const pagination = (
  pageSize = 20,
  options?: Partial<Omit<PaginationConfig, 'enabled' | 'pageSize'>>
): PaginationConfig => ({
  enabled: true,
  pageSize,
  pageSizeOptions: [10, 20, 50, 100],
  showTotal: true,
  showPageSize: true,
  ...options,
})

/**
 * 정렬 설정
 */
export const sorting = (
  defaultField?: string,
  direction: 'asc' | 'desc' = 'asc',
  options?: Partial<Omit<SortingConfig, 'enabled'>>
): SortingConfig => ({
  enabled: true,
  defaultSort: defaultField ? { field: defaultField, direction } : undefined,
  ...options,
})

/**
 * 선택 설정
 */
export const selection = (
  mode: 'single' | 'multiple' = 'multiple',
  options?: Partial<Omit<SelectionConfig, 'enabled' | 'mode'>>
): SelectionConfig => ({
  enabled: true,
  mode,
  showSelectAll: mode === 'multiple',
  ...options,
})

/**
 * 필터 설정
 */
export const filtering = (
  fields?: readonly FilterField[],
  options?: Partial<Omit<FilterConfig, 'enabled' | 'fields'>>
): FilterConfig => ({
  enabled: true,
  fields,
  searchable: true,
  ...options,
})

/**
 * 필터 필드 생성
 */
export const filterField = (
  id: string,
  entityFieldId: string,
  label: string,
  type: FilterField['type'],
  options?: Partial<Omit<FilterField, 'id' | 'entityFieldId' | 'label' | 'type'>>
): FilterField => ({
  id,
  entityFieldId,
  label,
  type,
  ...options,
})

// ============================================================================
// Data Source Builders
// ============================================================================

/**
 * API 데이터 소스
 */
export const apiDataSource = (
  endpoint: string,
  options?: Partial<Omit<NonNullable<ListDataSource['api']>, 'endpoint'>>
): ListDataSource => ({
  type: 'api',
  api: {
    endpoint,
    method: 'GET',
    ...options,
  },
})

/**
 * 정적 데이터 소스
 */
export const staticDataSource = (
  data: readonly Record<string, unknown>[]
): ListDataSource => ({
  type: 'static',
  static: data,
})

// ============================================================================
// Empty State Builder
// ============================================================================

/**
 * 빈 상태 설정
 */
export const emptyState = (
  title: string,
  options?: Partial<Omit<EmptyStateConfig, 'title'>>
): EmptyStateConfig => ({
  title,
  ...options,
})
