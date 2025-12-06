/**
 * List Combinators - ListViewSchema composition
 *
 * Combines primitives to create complete ListViewSchema
 */

import type {
  ListViewSchema,
  ListColumn,
  ListDataSource,
  PaginationConfig,
  SortingConfig,
  FilterConfig,
  SelectionConfig,
  BulkAction,
  ViewHeader,
  ViewFooter,
  EmptyStateConfig,
  ActionReference,
  SchemaVersion,
} from '../types/schema'

// ============================================================================
// List View Combinator
// ============================================================================

/**
 * ListViewSchema 옵션
 */
export interface ListViewOptions {
  readonly version?: SchemaVersion
  readonly name?: string
  readonly description?: string
  readonly tags?: readonly string[]
  readonly dataSource?: ListDataSource
  readonly pagination?: PaginationConfig
  readonly sorting?: SortingConfig
  readonly filtering?: FilterConfig
  readonly selection?: SelectionConfig
  readonly bulkActions?: readonly BulkAction[]
  readonly header?: ViewHeader
  readonly footer?: ViewFooter
  readonly emptyState?: EmptyStateConfig
  readonly rowClick?: ActionReference
}

/**
 * ListView 스키마 생성
 */
export const listView = (
  id: string,
  entityRef: string,
  columns: readonly ListColumn[],
  options?: ListViewOptions
): ListViewSchema => ({
  _type: 'view',
  id,
  version: options?.version ?? '1.0.0',
  name: options?.name ?? id,
  description: options?.description,
  tags: options?.tags,
  entityRef,
  mode: 'list',
  columns,
  dataSource: options?.dataSource ?? { type: 'static', static: [] },
  pagination: options?.pagination,
  sorting: options?.sorting,
  filtering: options?.filtering,
  selection: options?.selection,
  bulkActions: options?.bulkActions,
  header: options?.header,
  footer: options?.footer,
  emptyState: options?.emptyState,
  rowClick: options?.rowClick,
})

/**
 * EntitySchema에서 기본 ListView 생성
 * - Entity의 모든 필드를 텍스트 컬럼으로 생성
 */
export const listViewFromEntity = (
  id: string,
  entityRef: string,
  fieldConfigs: readonly {
    readonly fieldId: string
    readonly column: ListColumn
  }[],
  options?: ListViewOptions
): ListViewSchema => {
  const columns = fieldConfigs.map(({ column }) => column)
  return listView(id, entityRef, columns, options)
}

/**
 * ListView에 컬럼 추가
 */
export const withColumns = (
  schema: ListViewSchema,
  columns: readonly ListColumn[]
): ListViewSchema => ({
  ...schema,
  columns: [...schema.columns, ...columns],
})

/**
 * ListView에 페이지네이션 설정
 */
export const withPagination = (
  schema: ListViewSchema,
  pagination: PaginationConfig
): ListViewSchema => ({
  ...schema,
  pagination,
})

/**
 * ListView에 정렬 설정
 */
export const withSorting = (
  schema: ListViewSchema,
  sorting: SortingConfig
): ListViewSchema => ({
  ...schema,
  sorting,
})

/**
 * ListView에 필터 설정
 */
export const withFiltering = (
  schema: ListViewSchema,
  filtering: FilterConfig
): ListViewSchema => ({
  ...schema,
  filtering,
})

/**
 * ListView에 선택 설정
 */
export const withSelection = (
  schema: ListViewSchema,
  selection: SelectionConfig
): ListViewSchema => ({
  ...schema,
  selection,
})

/**
 * ListView에 일괄 액션 추가
 */
export const withBulkActions = (
  schema: ListViewSchema,
  bulkActions: readonly BulkAction[]
): ListViewSchema => ({
  ...schema,
  bulkActions: [...(schema.bulkActions ?? []), ...bulkActions],
})

/**
 * ListView에 데이터 소스 설정
 */
export const withDataSource = (
  schema: ListViewSchema,
  dataSource: ListDataSource
): ListViewSchema => ({
  ...schema,
  dataSource,
})

/**
 * ListView에 빈 상태 설정
 */
export const withEmptyState = (
  schema: ListViewSchema,
  emptyState: EmptyStateConfig
): ListViewSchema => ({
  ...schema,
  emptyState,
})

/**
 * ListView에 행 클릭 액션 설정
 */
export const withRowClick = (
  schema: ListViewSchema,
  rowClick: ActionReference
): ListViewSchema => ({
  ...schema,
  rowClick,
})

/**
 * ListView에 헤더 설정
 */
export const withHeader = (
  schema: ListViewSchema,
  header: ViewHeader
): ListViewSchema => ({
  ...schema,
  header,
})

/**
 * ListView에 푸터 설정
 */
export const withFooter = (
  schema: ListViewSchema,
  footer: ViewFooter
): ListViewSchema => ({
  ...schema,
  footer,
})
