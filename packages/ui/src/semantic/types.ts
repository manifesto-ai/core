import type { FormState } from '@manifesto-ai/engine'
import type {
  EnumValue,
  ColumnType,
  ComponentType,
  Expression,
  FormViewSchema,
  LayoutConfig,
  ListColumn,
  ListViewSchema,
  ViewAction,
} from '@manifesto-ai/schema'

export type SemanticViewKind = 'form' | 'list' | 'detail'

export interface SemanticNodeBase {
  readonly id: string
  readonly kind: string
}

export interface ActionSemanticNode extends SemanticNodeBase {
  readonly kind: 'action'
  readonly actionId: string
  readonly label: string
  readonly variant?: ViewAction['variant']
  readonly disabled?: boolean
  readonly hidden?: boolean
  readonly icon?: string
  readonly intent?: ViewAction['action']['type']
  readonly handler?: unknown
}

export interface FieldSemanticState {
  readonly hidden: boolean
  readonly disabled: boolean
  readonly errors: readonly string[]
  readonly value?: unknown
  readonly props?: Readonly<Record<string, unknown>>
  readonly options?: readonly EnumValue[]
  readonly liveValidators?: readonly LightweightValidator[]
  readonly liveErrors?: readonly string[]
}

export interface FieldSemanticNode extends SemanticNodeBase {
  readonly kind: 'field'
  readonly fieldId: string
  readonly entityFieldId: string
  readonly componentType: ComponentType
  readonly label?: string
  readonly placeholder?: string
  readonly helpText?: string
  readonly order?: number
  readonly colSpan?: number
  readonly rowSpan?: number
  readonly state: FieldSemanticState
}

export interface SectionSemanticNode extends SemanticNodeBase {
  readonly kind: 'section'
  readonly title?: string
  readonly description?: string
  readonly layout: LayoutConfig
  readonly fields: readonly FieldSemanticNode[]
  readonly actions?: readonly ActionSemanticNode[]
  /** Section hidden state (derived from visible expression) */
  readonly hidden?: boolean
}

export interface FormSemanticNode extends SemanticNodeBase {
  readonly kind: 'form'
  readonly viewId: string
  readonly entityRef: string
  readonly mode: FormViewSchema['mode']
  readonly title?: string | Expression
  readonly subtitle?: string | Expression
  readonly sections: readonly SectionSemanticNode[]
  readonly headerActions?: readonly ActionSemanticNode[]
  readonly footerActions?: readonly ActionSemanticNode[]
  readonly uiStateHints?: Readonly<Record<string, unknown>>
}

export interface ListColumnSemanticNode extends SemanticNodeBase {
  readonly kind: 'column'
  readonly columnId: string
  readonly entityFieldId: string
  readonly type: ColumnType
  readonly label: string
  readonly hidden?: boolean
  readonly hiddenExpression?: ListColumn['hidden']
  readonly width?: string | number
  readonly align?: 'left' | 'center' | 'right'
  readonly actions?: readonly ActionSemanticNode[]
  readonly summary?: ListColumn['summary']
}

export interface ListSemanticNode extends SemanticNodeBase {
  readonly kind: 'list'
  readonly viewId: string
  readonly entityRef: string
  readonly columns: readonly ListColumnSemanticNode[]
  readonly headerActions?: readonly ActionSemanticNode[]
  readonly footerActions?: readonly ActionSemanticNode[]
  readonly bulkActions?: readonly ActionSemanticNode[]
  readonly emptyState?: ListViewSchema['emptyState']
  readonly uiStateHints?: Readonly<Record<string, unknown>>
  readonly rows?: readonly Record<string, unknown>[]
}

export interface DetailSemanticNode extends Omit<FormSemanticNode, 'kind'> {
  readonly kind: 'detail'
}

export type SemanticTree = FormSemanticNode | ListSemanticNode | DetailSemanticNode // future: DashboardSemanticNode and others

export interface FormSemanticContract {
  readonly kind: 'form'
  readonly view: FormViewSchema
  readonly state?: FormState
}

export interface ListSemanticContract {
  readonly kind: 'list'
  readonly view: ListViewSchema
  readonly rows?: readonly Record<string, unknown>[]
}

/**
 * Detail 뷰 스키마는 아직 엔진에 명시적으로 정의되어 있지 않으므로
 * 우선 FormViewSchema 기반으로 표현한다.
 */
export interface DetailSemanticContract {
  readonly kind: 'detail'
  readonly view: FormViewSchema
  readonly state?: FormState
}

export type SemanticContract = FormSemanticContract | ListSemanticContract | DetailSemanticContract

export interface SemanticBuildOptions {
  /** Include fields/columns even when hidden. Defaults to true for introspection. */
  readonly includeHidden?: boolean
  /** Lightweight validators to attach for real-time feedback (UI-only). */
  readonly liveValidators?: ReadonlyMap<string, readonly LightweightValidator[]>
  /** Optional UI state hints to expose (accordion open states, tab indices, etc.). */
  readonly uiState?: Readonly<Record<string, unknown>>
}

export type SemanticRenderer<TContract extends SemanticContract = SemanticContract> = (
  contract: TContract,
  options?: SemanticBuildOptions
) => SemanticTree

export interface LightweightValidator {
  readonly id: string
  readonly message: string
  readonly test: (value: unknown) => boolean
}
