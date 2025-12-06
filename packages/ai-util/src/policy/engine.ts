/**
 * AI Interaction Policy Engine
 *
 * 정책에 따라 AI 에이전트의 액션을 평가하고 결정
 */

import type { Expression } from '@manifesto-ai/schema'
import type { EvaluationContext } from '@manifesto-ai/engine'
import type {
  AgentAction,
  AgentActionError,
  SemanticSnapshot,
  InteractionPolicy,
  FieldPolicyConfig,
  PendingUpdate,
  VisibilityMeta,
} from '../types'
import { analyzeVisibility } from '../visibility'
import { PendingUpdateManager } from './pending-manager'

// ============================================================================
// Types
// ============================================================================

export type PolicyDecision =
  | { readonly type: 'allow' }
  | { readonly type: 'deny'; readonly error: AgentActionError }
  | { readonly type: 'defer'; readonly pendingUpdate: PendingUpdate }
  | { readonly type: 'guide'; readonly error: AgentActionError; readonly visibilityMeta: VisibilityMeta }

export interface PolicyEngineOptions {
  readonly defaultPolicy: InteractionPolicy
  readonly fieldPolicies: ReadonlyMap<string, InteractionPolicy>
}

export interface PolicyEvaluationContext {
  readonly snapshot: SemanticSnapshot
  readonly evaluationContext: EvaluationContext
  readonly visibilityExpressions: ReadonlyMap<string, Expression>
}

// ============================================================================
// Policy Engine
// ============================================================================

export class PolicyEngine {
  private readonly options: PolicyEngineOptions
  private readonly pendingManager: PendingUpdateManager

  constructor(
    options: Partial<PolicyEngineOptions> = {},
    pendingManager?: PendingUpdateManager
  ) {
    this.options = {
      defaultPolicy: options.defaultPolicy ?? 'strict',
      fieldPolicies: options.fieldPolicies ?? new Map(),
    }
    this.pendingManager = pendingManager ?? new PendingUpdateManager()
  }

  /**
   * 필드에 적용되는 정책 결정
   */
  getFieldPolicy(fieldId: string): InteractionPolicy {
    return this.options.fieldPolicies.get(fieldId) ?? this.options.defaultPolicy
  }

  /**
   * 액션에 대한 정책 판정
   */
  evaluate(
    action: AgentAction,
    context: PolicyEvaluationContext
  ): PolicyDecision {
    // updateField 액션만 정책 적용
    if (action.type !== 'updateField') {
      return { type: 'allow' }
    }

    const { snapshot, evaluationContext, visibilityExpressions } = context
    const fieldId = action.fieldId
    const field = snapshot.state.fields[fieldId]

    if (!field) {
      return {
        type: 'deny',
        error: { type: 'FIELD_NOT_FOUND', fieldId },
      }
    }

    // 필드가 visible하면 허용
    if (!field.meta.hidden && !field.meta.disabled) {
      return { type: 'allow' }
    }

    // disabled 필드는 항상 거부
    if (field.meta.disabled) {
      return {
        type: 'deny',
        error: {
          type: 'FIELD_FORBIDDEN',
          fieldId,
          reason: 'DISABLED',
          policy: this.getFieldPolicy(fieldId),
        },
      }
    }

    // hidden 필드: 정책에 따라 처리
    const policy = this.getFieldPolicy(fieldId)
    const visibilityExpr = visibilityExpressions.get(fieldId)

    switch (policy) {
      case 'strict':
        return this.handleStrict(fieldId, visibilityExpr, evaluationContext)

      case 'deferred':
        return this.handleDeferred(fieldId, action.value, visibilityExpr, evaluationContext)

      case 'guided':
        return this.handleGuided(fieldId, visibilityExpr, evaluationContext)

      default:
        return this.handleStrict(fieldId, visibilityExpr, evaluationContext)
    }
  }

  /**
   * Strict 모드: 즉시 거부
   */
  private handleStrict(
    fieldId: string,
    visibilityExpr: Expression | undefined,
    context: EvaluationContext
  ): PolicyDecision {
    let visibilityMeta: VisibilityMeta | undefined

    if (visibilityExpr) {
      const result = analyzeVisibility(visibilityExpr, context, {
        includeExpression: false,
        computeSatisfactionPath: false,
      })
      if (result._tag === 'Ok') {
        visibilityMeta = result.value
      }
    }

    return {
      type: 'deny',
      error: {
        type: 'FIELD_FORBIDDEN',
        fieldId,
        reason: 'HIDDEN',
        policy: 'strict',
        visibilityMeta,
      },
    }
  }

  /**
   * Deferred 모드: 값을 보류
   */
  private handleDeferred(
    fieldId: string,
    value: unknown,
    visibilityExpr: Expression | undefined,
    _context: EvaluationContext
  ): PolicyDecision {
    // Visibility expression에서 참조하는 모든 필드를 blockedBy로 추출
    // (hidden 조건이 변경되어 필드가 visible 되면 pending update 적용)
    const blockedBy: string[] = []

    if (visibilityExpr) {
      extractFieldReferences(visibilityExpr, blockedBy)
    }

    const pendingUpdate = this.pendingManager.create(fieldId, value, blockedBy)

    return {
      type: 'defer',
      pendingUpdate,
    }
  }

  /**
   * Guided 모드: 조건 충족 경로 제시
   */
  private handleGuided(
    fieldId: string,
    visibilityExpr: Expression | undefined,
    context: EvaluationContext
  ): PolicyDecision {
    let visibilityMeta: VisibilityMeta = {
      conditionType: 'simple',
      satisfied: false,
      failedDependencies: [],
    }

    if (visibilityExpr) {
      const result = analyzeVisibility(visibilityExpr, context, {
        includeExpression: true,
        computeSatisfactionPath: true,
      })
      if (result._tag === 'Ok') {
        visibilityMeta = result.value
      }
    }

    return {
      type: 'guide',
      error: {
        type: 'FIELD_FORBIDDEN',
        fieldId,
        reason: 'HIDDEN',
        policy: 'guided',
        visibilityMeta,
      },
      visibilityMeta,
    }
  }

  /**
   * Pending Manager 접근
   */
  getPendingManager(): PendingUpdateManager {
    return this.pendingManager
  }

  /**
   * 현재 pending updates
   */
  getPendingUpdates(): Readonly<Record<string, PendingUpdate>> {
    return this.pendingManager.getAll()
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Expression에서 $state.xxx 형태의 필드 참조를 추출
 */
const extractFieldReferences = (expr: Expression, refs: string[]): void => {
  if (typeof expr === 'string') {
    // $state.fieldId 형태의 참조 추출
    if (expr.startsWith('$state.')) {
      const fieldId = expr.slice(7) // '$state.'.length === 7
      if (fieldId && !refs.includes(fieldId)) {
        refs.push(fieldId)
      }
    }
    return
  }

  if (Array.isArray(expr)) {
    // 배열의 모든 요소를 재귀적으로 탐색
    for (const item of expr) {
      extractFieldReferences(item as Expression, refs)
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

export interface CreatePolicyEngineOptions {
  readonly defaultPolicy?: InteractionPolicy
  readonly fieldPolicies?: readonly FieldPolicyConfig[]
}

export const createPolicyEngine = (
  options: CreatePolicyEngineOptions = {}
): PolicyEngine => {
  const fieldPoliciesMap = new Map<string, InteractionPolicy>()

  if (options.fieldPolicies) {
    for (const config of options.fieldPolicies) {
      fieldPoliciesMap.set(config.fieldId, config.policy)
    }
  }

  return new PolicyEngine({
    defaultPolicy: options.defaultPolicy ?? 'strict',
    fieldPolicies: fieldPoliciesMap,
  })
}
