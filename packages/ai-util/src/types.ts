import type {
  ActionSchema,
  DataType,
  EntitySchema,
  EnumValue,
  Expression,
  FormViewSchema,
  Result,
} from '@manifesto-ai/schema'
import type { FormRuntime } from '@manifesto-ai/engine'

// ============================================================================
// Visibility Reasoning Types
// ============================================================================

/**
 * 조건 충족에 실패한 의존성 정보
 */
export interface FailedDependency {
  readonly field: string
  readonly currentValue: unknown
  readonly operator: string
  readonly expectedValue: unknown
  readonly description: string
}

/**
 * 조건 충족을 위한 단계
 */
export interface SatisfactionStep {
  readonly field: string
  readonly action: 'set' | 'clear'
  readonly targetValue: unknown
  readonly order: number
}

/**
 * Visibility 조건 분석 결과
 */
export interface VisibilityMeta {
  readonly conditionType: 'simple' | 'compound'
  readonly satisfied: boolean
  readonly expression?: Expression
  readonly failedDependencies: readonly FailedDependency[]
  readonly satisfactionPath?: readonly SatisfactionStep[]
}

// ============================================================================
// AI Interaction Policy Types
// ============================================================================

/**
 * AI 상호작용 정책
 * - strict: hidden 필드 접근 시 즉시 거부
 * - deferred: 값을 보류 후 조건 충족 시 적용
 * - guided: 조건 충족 경로를 제시
 */
export type InteractionPolicy = 'strict' | 'deferred' | 'guided'

/**
 * Pending Update (deferred 모드용)
 */
export interface PendingUpdate {
  readonly fieldId: string
  readonly value: unknown
  readonly blockedBy: readonly string[]
  readonly createdAt: number
}

export interface SchemaTopology {
  readonly viewId: string
  readonly entityRef: string
  readonly mode: 'create' | 'edit' | 'view'
  readonly sections: readonly {
    readonly id: string
    readonly title?: string
    readonly fields: readonly string[]
  }[]
}

export interface FieldConstraint {
  readonly hidden: boolean
  readonly disabled: boolean
  readonly reason?: string
  readonly visibilityMeta?: VisibilityMeta
  readonly policy?: InteractionPolicy
}

export interface FieldStateAtom {
  readonly id: string
  readonly entityFieldId: string
  readonly label?: string
  readonly dataType?: DataType
  readonly value: unknown
  readonly enumValues?: readonly EnumValue[]
  readonly meta: {
    readonly valid: boolean
    readonly dirty: boolean
    readonly touched: boolean
    readonly hidden: boolean
    readonly disabled: boolean
    readonly errors: readonly string[]
  }
}

export type InteractionAtom =
  | {
      readonly id: `updateField:${string}`
      readonly intent: 'updateField'
      readonly target: string
      readonly available: boolean
      readonly reason?: string
    }
  | {
      readonly id: 'submit' | 'reset' | 'validate'
      readonly intent: 'submit' | 'reset' | 'validate'
      readonly available: boolean
      readonly reason?: string
    }

export interface SemanticSnapshot {
  readonly topology: SchemaTopology
  readonly state: {
    readonly form: {
      readonly isValid: boolean
      readonly isDirty: boolean
      readonly isSubmitting: boolean
    }
    readonly fields: Readonly<Record<string, FieldStateAtom>>
    readonly values: Readonly<Record<string, unknown>>
  }
  readonly constraints: Readonly<Record<string, FieldConstraint>>
  readonly interactions: readonly InteractionAtom[]
  readonly pendingUpdates?: Readonly<Record<string, PendingUpdate>>
}

export interface SemanticDelta {
  readonly form?: Partial<SemanticSnapshot['state']['form']>
  readonly fields?: Readonly<
    Record<
      string,
      Partial<{
        value: unknown
        valid: boolean
        dirty: boolean
        touched: boolean
        hidden: boolean
        disabled: boolean
        errors: readonly string[]
      }>
    >
  >
  readonly interactions?: Readonly<Record<string, Partial<Pick<InteractionAtom, 'available' | 'reason'>>>>
}

export type AgentAction =
  | { readonly type: 'updateField'; readonly fieldId: string; readonly value: unknown }
  | { readonly type: 'submit' }
  | { readonly type: 'reset' }
  | { readonly type: 'validate'; readonly fieldIds?: readonly string[] }

export interface AgentActionResult {
  readonly snapshot: SemanticSnapshot
  readonly delta: SemanticDelta
  /** Fields that had pending updates auto-applied (deferred mode) */
  readonly appliedPendingUpdates?: readonly string[]
}

export type AgentActionError =
  | { readonly type: 'FIELD_NOT_FOUND'; readonly fieldId: string }
  | {
      readonly type: 'FIELD_FORBIDDEN'
      readonly fieldId: string
      readonly reason: 'HIDDEN' | 'DISABLED'
      readonly policy?: InteractionPolicy
      readonly visibilityMeta?: VisibilityMeta
    }
  | {
      readonly type: 'UPDATE_DEFERRED'
      readonly fieldId: string
      readonly pendingUpdate: PendingUpdate
    }
  | { readonly type: 'TYPE_MISMATCH'; readonly fieldId: string; readonly expectedType: DataType; readonly message: string }
  | { readonly type: 'INVALID_ENUM_VALUE'; readonly fieldId: string; readonly validValues: readonly (string | number)[] }
  | { readonly type: 'ACTION_REJECTED'; readonly reason: 'FORM_INVALID' | 'NOT_ALLOWED'; readonly message: string }
  | { readonly type: 'RUNTIME_ERROR'; readonly message: string }

export interface FieldPolicyConfig {
  readonly fieldId: string
  readonly policy: InteractionPolicy
}

export interface InteroperabilitySessionOptions {
  readonly runtime: FormRuntime
  readonly viewSchema: FormViewSchema
  readonly entitySchema?: EntitySchema
  readonly actions?: readonly ActionSchema[]
  readonly defaultPolicy?: InteractionPolicy
  readonly fieldPolicies?: readonly FieldPolicyConfig[]
}

export interface InteroperabilitySession {
  snapshot(): SemanticSnapshot
  dispatch(action: AgentAction): Result<AgentActionResult, AgentActionError>
}

// JSON Schema based tool definitions (OpenAI/Claude compatible)
export interface FunctionTool {
  readonly type: 'function'
  readonly function: {
    readonly name: string
    readonly description?: string
    readonly parameters: Record<string, unknown>
  }
}

export type ToolDefinition = FunctionTool
