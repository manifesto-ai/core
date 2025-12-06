/**
 * Core Schema Types - 3-Layer Architecture
 *
 * Entity Layer: 데이터 구조 및 제약조건
 * View Layer: 화면 구성 및 반응성
 * Action Layer: 데이터 흐름 및 부수 효과
 */

import type { Expression } from './expression'

// ============================================================================
// Common Types
// ============================================================================

export type SchemaVersion = `${number}.${number}.${number}`

export interface SchemaMetadata {
  readonly id: string
  readonly version: SchemaVersion
  readonly name: string
  readonly description?: string
  readonly tags?: readonly string[]
  readonly createdAt?: string
  readonly updatedAt?: string
}

// ============================================================================
// Entity Layer - 데이터 구조 정의
// ============================================================================

export type DataType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'array'
  | 'object'
  | 'enum'
  | 'reference'

export interface Constraint {
  readonly type: 'required' | 'min' | 'max' | 'pattern' | 'custom'
  readonly value?: unknown
  readonly message?: string
  readonly expression?: Expression
}

export interface EntityField {
  readonly id: string
  readonly dataType: DataType
  readonly label: string
  readonly description?: string
  readonly defaultValue?: unknown
  readonly constraints?: readonly Constraint[]
  readonly enumValues?: readonly EnumValue[]
  readonly reference?: ReferenceConfig
  readonly arrayItemType?: DataType
  readonly objectFields?: readonly EntityField[]
}

export interface EnumValue {
  readonly value: string | number
  readonly label: string
  readonly description?: string
  readonly disabled?: boolean
}

export interface ReferenceConfig {
  readonly entity: string
  readonly displayField: string
  readonly valueField: string
  readonly cascade?: 'none' | 'delete' | 'nullify'
}

export interface Relation {
  readonly type: 'hasOne' | 'hasMany' | 'belongsTo' | 'manyToMany'
  readonly target: string
  readonly foreignKey?: string
  readonly through?: string
}

export interface EntitySchema extends SchemaMetadata {
  readonly _type: 'entity'
  readonly fields: readonly EntityField[]
  readonly relations?: readonly Relation[]
  readonly indexes?: readonly IndexConfig[]
}

export interface IndexConfig {
  readonly fields: readonly string[]
  readonly unique?: boolean
  readonly name?: string
}

// ============================================================================
// View Layer - 화면 구성 정의
// ============================================================================

export type LayoutType = 'form' | 'grid' | 'flex' | 'tabs' | 'accordion' | 'wizard'

export interface LayoutConfig {
  readonly type: LayoutType
  readonly columns?: number
  readonly gap?: string
  readonly direction?: 'row' | 'column'
}

export type ComponentType =
  | 'text-input'
  | 'number-input'
  | 'select'
  | 'multi-select'
  | 'checkbox'
  | 'radio'
  | 'date-picker'
  | 'datetime-picker'
  | 'textarea'
  | 'rich-editor'
  | 'file-upload'
  | 'image-upload'
  | 'autocomplete'
  | 'toggle'
  | 'slider'
  | 'color-picker'
  | 'custom'

export interface ViewField {
  readonly id: string
  readonly entityFieldId: string
  readonly component: ComponentType
  readonly label?: string
  readonly placeholder?: string
  readonly helpText?: string
  readonly props?: Record<string, unknown>
  readonly styles?: StyleConfig
  readonly reactions?: readonly Reaction[]
  readonly dependsOn?: readonly string[]
  readonly order?: number
  readonly colSpan?: number
  readonly rowSpan?: number
  /** 필드 숨김 여부 (boolean 또는 Expression) */
  readonly hidden?: boolean | Expression
  /** 필드 표시 여부 (boolean 또는 Expression) - hidden의 반대 */
  readonly visibility?: boolean | Expression
  /** 필드 비활성화 여부 (boolean 또는 Expression) */
  readonly disabled?: boolean | Expression
}

export interface StyleConfig {
  readonly className?: string
  readonly style?: Record<string, string | number>
  readonly variants?: Record<string, StyleConfig>
}

export interface Reaction {
  readonly trigger: 'change' | 'blur' | 'focus' | 'mount' | 'unmount'
  readonly condition?: Expression
  readonly actions: readonly ReactionAction[]
  readonly debounce?: number
  readonly throttle?: number
}

export type ReactionAction =
  | SetValueAction
  | SetOptionsAction
  | UpdatePropAction
  | ValidateAction
  | NavigateAction
  | EmitAction

export interface SetValueAction {
  readonly type: 'setValue'
  readonly target: string
  readonly value: Expression | unknown
}

export interface SetOptionsAction {
  readonly type: 'setOptions'
  readonly target: string
  readonly source: DataSource
}

export interface UpdatePropAction {
  readonly type: 'updateProp'
  readonly target: string
  readonly prop: string
  readonly value: Expression | unknown
}

export interface ValidateAction {
  readonly type: 'validate'
  readonly targets?: readonly string[]
  readonly mode?: 'silent' | 'visible'
}

export interface NavigateAction {
  readonly type: 'navigate'
  readonly path: string
  readonly params?: Record<string, unknown>
}

export interface EmitAction {
  readonly type: 'emit'
  readonly event: string
  readonly payload?: Record<string, unknown>
}

export interface DataSource {
  readonly type: 'static' | 'api' | 'derived'
  readonly static?: readonly EnumValue[]
  readonly api?: ApiDataSource
  readonly derived?: Expression
}

export interface ApiDataSource {
  readonly endpoint: string
  readonly method?: 'GET' | 'POST'
  readonly params?: Record<string, Expression | unknown>
  readonly transform?: TransformConfig
}

export interface TransformConfig {
  readonly path?: string
  readonly map?: {
    readonly value: string
    readonly label: string
  }
}

export interface ViewSection {
  readonly id: string
  readonly title?: string
  readonly description?: string
  readonly layout: LayoutConfig
  readonly fields: readonly ViewField[]
  readonly visible?: Expression
  readonly collapsible?: boolean
  readonly collapsed?: boolean
}

/**
 * Form View 스키마 (mode: 'create' | 'edit' | 'view')
 */
export interface FormViewSchema extends SchemaMetadata {
  readonly _type: 'view'
  readonly entityRef: string
  readonly mode: 'create' | 'edit' | 'view'
  readonly layout: LayoutConfig
  readonly sections: readonly ViewSection[]
  readonly header?: ViewHeader
  readonly footer?: ViewFooter
}

// ============================================================================
// List View Layer - 목록 화면 정의
// ============================================================================

/**
 * 컬럼 타입 - 셀 렌더링 방식
 */
export type ColumnType =
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'enum'
  | 'link'
  | 'image'
  | 'badge'
  | 'actions'
  | 'custom'

/**
 * 숫자 포맷 설정
 */
export interface NumberFormat {
  readonly locale?: string
  readonly style?: 'decimal' | 'currency' | 'percent'
  readonly currency?: string
  readonly minimumFractionDigits?: number
  readonly maximumFractionDigits?: number
  readonly decimals?: number
  readonly prefix?: string
  readonly suffix?: string
}

/**
 * 뱃지 설정
 */
export interface BadgeConfig {
  readonly label: string
  readonly variant?: 'success' | 'warning' | 'error' | 'info' | 'default'
  readonly color?: string
  readonly bgColor?: string
}

/**
 * 컬럼 포맷 설정
 */
export interface ColumnFormat {
  readonly dateFormat?: string
  readonly numberFormat?: NumberFormat
  readonly enumMap?: Record<string, string>
  readonly badgeMap?: Record<string, BadgeConfig>
  readonly linkTemplate?: string
  readonly imageSize?: { readonly width: number; readonly height: number }
}

/**
 * 컬럼 요약 설정 (Summary Row)
 */
export interface ColumnSummary {
  readonly type: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'expression'
  readonly expression?: Expression
  readonly label?: string
  readonly format?: ColumnFormat
}

/**
 * 행 액션 (편집, 삭제 등)
 */
export interface RowAction {
  readonly id: string
  readonly label: string
  readonly icon?: string
  readonly variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  readonly visible?: Expression
  readonly disabled?: Expression
  readonly confirm?: ConfirmConfig
  readonly action: ActionReference
}

/**
 * 일괄 액션 (Bulk Actions)
 */
export interface BulkAction extends RowAction {
  readonly minSelection?: number
}

/**
 * 리스트 컬럼 정의
 */
export interface ListColumn {
  readonly id: string
  readonly entityFieldId: string
  readonly type: ColumnType
  readonly label: string
  readonly width?: string | number
  readonly minWidth?: number
  readonly maxWidth?: number
  readonly sortable?: boolean
  readonly filterable?: boolean
  readonly hidden?: Expression
  readonly align?: 'left' | 'center' | 'right'
  readonly format?: ColumnFormat
  readonly cellProps?: Record<string, unknown>
  readonly actions?: readonly RowAction[]
  readonly summary?: ColumnSummary
  readonly editable?: boolean
}

/**
 * 페이지네이션 설정
 */
export interface PaginationConfig {
  readonly enabled: boolean
  readonly pageSize: number
  readonly pageSizeOptions?: readonly number[]
  readonly showTotal?: boolean
  readonly showPageSize?: boolean
  readonly showQuickJumper?: boolean
}

/**
 * 정렬 설정
 */
export interface SortingConfig {
  readonly enabled: boolean
  readonly defaultSort?: {
    readonly field: string
    readonly direction: 'asc' | 'desc'
  }
  readonly multiSort?: boolean
}

/**
 * 필터 필드 정의
 */
export interface FilterField {
  readonly id: string
  readonly entityFieldId: string
  readonly label: string
  readonly type: 'text' | 'select' | 'date-range' | 'number-range'
  readonly options?: readonly EnumValue[]
}

/**
 * 필터 설정
 */
export interface FilterConfig {
  readonly enabled: boolean
  readonly fields?: readonly FilterField[]
  readonly searchable?: boolean
  readonly searchPlaceholder?: string
}

/**
 * 선택 설정
 */
export interface SelectionConfig {
  readonly enabled: boolean
  readonly mode: 'single' | 'multiple'
  readonly showSelectAll?: boolean
}

/**
 * 데이터 소스 설정 (List용)
 */
export interface ListDataSource {
  readonly type: 'api' | 'static'
  readonly api?: {
    readonly endpoint: string
    readonly method?: 'GET' | 'POST'
    readonly params?: Record<string, Expression | unknown>
    readonly transform?: TransformConfig
  }
  readonly static?: readonly Record<string, unknown>[]
}

/**
 * 빈 상태 설정
 */
export interface EmptyStateConfig {
  readonly title: string
  readonly description?: string
  readonly icon?: string
  readonly action?: ViewAction
}

/**
 * List View 스키마 (mode: 'list')
 */
export interface ListViewSchema extends SchemaMetadata {
  readonly _type: 'view'
  readonly entityRef: string
  readonly mode: 'list'
  readonly columns: readonly ListColumn[]
  readonly dataSource: ListDataSource
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
 * View 스키마 (Form + List 통합)
 */
export type ViewSchema = FormViewSchema | ListViewSchema

export interface ViewHeader {
  readonly title: string | Expression
  readonly subtitle?: string | Expression
  readonly actions?: readonly ViewAction[]
}

export interface ViewFooter {
  readonly actions: readonly ViewAction[]
  readonly sticky?: boolean
}

export interface ViewAction {
  readonly id: string
  readonly label: string
  readonly variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  readonly icon?: string
  readonly disabled?: Expression
  readonly visible?: Expression
  readonly action: ActionReference
}

export interface ActionReference {
  readonly type: 'submit' | 'cancel' | 'custom'
  readonly actionId?: string
  readonly confirm?: ConfirmConfig
}

export interface ConfirmConfig {
  readonly title: string
  readonly message: string
  readonly confirmLabel?: string
  readonly cancelLabel?: string
}

// ============================================================================
// Action Layer - 데이터 흐름 정의
// ============================================================================

export interface ActionSchema extends SchemaMetadata {
  readonly _type: 'action'
  readonly trigger: ActionTrigger
  readonly steps: readonly ActionStep[]
  readonly rollback?: readonly ActionStep[]
  readonly timeout?: number
  readonly retries?: number
}

export interface ActionTrigger {
  readonly type: 'manual' | 'event' | 'schedule'
  readonly event?: string
  readonly cron?: string
}

export type ActionStep =
  | ApiCallStep
  | TransformStep
  | ConditionStep
  | ParallelStep
  | SetStateStep
  | NavigationStep

export interface ApiCallStep {
  readonly _step: 'apiCall'
  readonly id: string
  readonly endpoint: string
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  readonly headers?: Record<string, string | Expression>
  readonly body?: Record<string, unknown> | Expression
  readonly adapter?: AdapterConfig
  readonly outputKey?: string
}

export interface AdapterConfig {
  readonly type: 'legacy' | 'graphql' | 'soap'
  readonly requestTransform?: TransformPipeline
  readonly responseTransform?: TransformPipeline
}

export interface TransformPipeline {
  readonly steps: readonly TransformStep[]
}

export interface TransformStep {
  readonly _step: 'transform'
  readonly id: string
  readonly operation: 'map' | 'filter' | 'reduce' | 'pick' | 'omit' | 'rename' | 'custom'
  readonly config: Record<string, unknown>
  readonly outputKey?: string
}

export interface ConditionStep {
  readonly _step: 'condition'
  readonly id: string
  readonly condition: Expression
  readonly then: readonly ActionStep[]
  readonly else?: readonly ActionStep[]
}

export interface ParallelStep {
  readonly _step: 'parallel'
  readonly id: string
  readonly steps: readonly ActionStep[]
  readonly mode?: 'all' | 'race' | 'allSettled'
}

export interface SetStateStep {
  readonly _step: 'setState'
  readonly id: string
  readonly updates: Record<string, Expression | unknown>
}

export interface NavigationStep {
  readonly _step: 'navigation'
  readonly id: string
  readonly path: string
  readonly params?: Record<string, unknown>
  readonly replace?: boolean
}

// ============================================================================
// Unified Schema Type
// ============================================================================

export type Schema = EntitySchema | ViewSchema | ActionSchema

export type SchemaType = Schema['_type']

export const isEntitySchema = (schema: Schema): schema is EntitySchema =>
  schema._type === 'entity'

export const isViewSchema = (schema: Schema): schema is ViewSchema =>
  schema._type === 'view'

export const isActionSchema = (schema: Schema): schema is ActionSchema =>
  schema._type === 'action'

export const isFormViewSchema = (schema: ViewSchema): schema is FormViewSchema =>
  schema.mode !== 'list'

export const isListViewSchema = (schema: ViewSchema): schema is ListViewSchema =>
  schema.mode === 'list'
