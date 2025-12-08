import type { FormEvent, FormRuntime, FormRuntimeError } from '@manifesto-ai/engine'
import { err, ok } from '@manifesto-ai/schema'
import type { Result } from '@manifesto-ai/schema'

import { diffSnapshots } from './delta'
import { buildSemanticSnapshot } from './snapshot'
import { createPolicyEngine, type PolicyEngine } from './policy'
import type {
  AgentAction,
  AgentActionError,
  AgentActionResult,
  InteroperabilitySession,
  InteroperabilitySessionOptions,
  SemanticSnapshot,
} from './types'

/**
 * @deprecated Use `createViewSnapshotEngine` from `@manifesto-ai/view-snapshot` instead.
 *
 * Migration:
 * ```typescript
 * // Before
 * import { createInteroperabilitySession } from '@manifesto-ai/ai-util'
 * const session = createInteroperabilitySession({ runtime, viewSchema })
 * const snapshot = session.snapshot()
 * session.dispatch({ type: 'updateField', fieldId: 'name', value: 'John' })
 *
 * // After
 * import { createViewSnapshotEngine } from '@manifesto-ai/view-snapshot'
 * const engine = createViewSnapshotEngine({ pageId: 'my-page' })
 * engine.registerFormRuntime('form-1', runtime, viewSchema)
 * const snapshot = engine.getViewSnapshot()
 * await engine.dispatchIntent({ type: 'setFieldValue', nodeId: 'form-1', fieldId: 'name', value: 'John' })
 * ```
 */
export const createInteroperabilitySession = (
  options: InteroperabilitySessionOptions
): InteroperabilitySession => {
  const { runtime, viewSchema, entitySchema, defaultPolicy, fieldPolicies } = options

  // Baseline for dirty/touched tracking
  let baselineValues = { ...runtime.getState().values }
  let lastSnapshot: SemanticSnapshot | null = null

  // Policy Engine 생성
  const policyEngine: PolicyEngine = createPolicyEngine({
    defaultPolicy: defaultPolicy ?? 'strict',
    fieldPolicies,
  })

  const snapshot = (): SemanticSnapshot => {
    const state = runtime.getState()
    const pendingUpdates = policyEngine.getPendingUpdates()
    const hasPendings = Object.keys(pendingUpdates).length > 0

    // Visibility expressions와 context를 snapshot에 전달하여 proactive reasoning 활성화
    const visibilityExpressions = runtime.getVisibilityExpressions()
    const evaluationContext = runtime.getEvaluationContext()

    const currentSnapshot = buildSemanticSnapshot({
      viewSchema,
      state,
      baselineValues,
      entitySchema,
      visibilityExpressions,
      evaluationContext,
    })

    // Pending updates가 있으면 snapshot에 포함
    if (hasPendings) {
      return {
        ...currentSnapshot,
        pendingUpdates,
      }
    }

    lastSnapshot = currentSnapshot
    return currentSnapshot
  }

  const dispatch = (action: AgentAction): Result<AgentActionResult, AgentActionError> => {
    const before = lastSnapshot ?? snapshot()

    // 기본 가드 검증 (타입, enum 등)
    const basicGuard = guardBasicConstraints(action, before)
    if (basicGuard) {
      return err(basicGuard)
    }

    // Policy Engine으로 visibility 정책 평가
    if (action.type === 'updateField') {
      const field = before.state.fields[action.fieldId]
      if (field?.meta.hidden || field?.meta.disabled) {
        const visibilityExpressions = runtime.getVisibilityExpressions()
        const evaluationContext = runtime.getEvaluationContext()

        const decision = policyEngine.evaluate(action, {
          snapshot: before,
          evaluationContext,
          visibilityExpressions,
        })

        switch (decision.type) {
          case 'deny':
            return err(decision.error)
          case 'defer':
            // Deferred 모드: pending update 저장 후 새 snapshot 반환 (pending 포함)
            return ok({
              snapshot: snapshot(), // refresh to include the new pending update
              delta: {},
            })
          case 'guide':
            return err(decision.error)
          // 'allow'는 계속 진행
        }
      }
    }

    // 기존 interaction 가드 (submit 등)
    const interactionGuard = guardInteraction(action, before)
    if (interactionGuard) {
      return err(interactionGuard)
    }

    const runtimeResult = applyAction(runtime, action)
    if (runtimeResult._tag === 'Err') {
      return err({
        type: 'RUNTIME_ERROR',
        message: formatRuntimeError(runtimeResult.error),
      })
    }

    // Deferred 모드: updateField 성공 후 pending updates 자동 적용
    const appliedPendings: string[] = []
    if (action.type === 'updateField') {
      const pendingManager = policyEngine.getPendingManager()
      const currentState = runtime.getState()

      // 변경된 필드로 인해 적용 가능해진 pending updates 확인
      const isFieldVisible = (fieldId: string): boolean => {
        const fieldMeta = currentState.fields.get(fieldId)
        return fieldMeta ? !fieldMeta.hidden && !fieldMeta.disabled : false
      }

      const applicable = pendingManager.checkApplicable(action.fieldId, isFieldVisible)

      // 적용 가능한 pending updates 순차 적용
      for (const pending of applicable) {
        const applied = pendingManager.apply(pending.fieldId)
        if (applied) {
          const applyResult = runtime.dispatch({
            type: 'FIELD_CHANGE',
            fieldId: applied.fieldId,
            value: applied.value,
          } satisfies FormEvent)

          if (applyResult._tag === 'Ok') {
            appliedPendings.push(applied.fieldId)
          }
        }
      }
    }

    const after = snapshot()
    const delta = diffSnapshots(before, after)

    // 자동 적용된 pending updates 정보 포함
    if (appliedPendings.length > 0) {
      return ok({
        snapshot: after,
        delta,
        appliedPendingUpdates: appliedPendings,
      })
    }

    return ok({
      snapshot: after,
      delta,
    })
  }

  return {
    snapshot,
    dispatch,
  }
}

const formatRuntimeError = (error: FormRuntimeError): string => {
  switch (error.type) {
    case 'VALIDATION_ERROR':
      return 'Validation failed'
    default:
      return error.message
  }
}

/**
 * 기본 제약조건 검증 (타입, enum, 필드 존재 등)
 */
const guardBasicConstraints = (action: AgentAction, snapshot: SemanticSnapshot): AgentActionError | null => {
  if (action.type === 'updateField') {
    const field = snapshot.state.fields[action.fieldId]
    if (!field) {
      return { type: 'FIELD_NOT_FOUND', fieldId: action.fieldId }
    }

    // 타입 검증 (dataType이 있는 경우)
    if (field.dataType) {
      const typeError = validateValueType(action.value, field.dataType)
      if (typeError) {
        return {
          type: 'TYPE_MISMATCH',
          fieldId: action.fieldId,
          expectedType: field.dataType,
          message: typeError,
        }
      }
    }

    // enum 값 검증
    if (field.dataType === 'enum' && field.enumValues && field.enumValues.length > 0) {
      const validValues = field.enumValues.map((e) => e.value)
      const value = action.value
      if (value !== null && value !== undefined && value !== '' && !validValues.includes(value as string | number)) {
        return {
          type: 'INVALID_ENUM_VALUE',
          fieldId: action.fieldId,
          validValues,
        }
      }
    }
  }

  return null
}

/**
 * Interaction 가드 (submit, reset, validate 등)
 */
const guardInteraction = (action: AgentAction, snapshot: SemanticSnapshot): AgentActionError | null => {
  // updateField는 PolicyEngine에서 처리
  if (action.type === 'updateField') {
    return null
  }

  const interaction = snapshot.interactions.find((item) => item.id === action.type)

  if (interaction && !interaction.available) {
    return {
      type: 'ACTION_REJECTED',
      reason: action.type === 'submit' ? 'FORM_INVALID' : 'NOT_ALLOWED',
      message: interaction.reason ?? 'Action is not allowed in the current state',
    }
  }

  return null
}

/**
 * 값의 타입이 예상 타입과 호환되는지 검증
 */
const validateValueType = (value: unknown, dataType: string): string | null => {
  // 빈 값은 통과 (required는 별도 처리)
  if (value === null || value === undefined || value === '') {
    return null
  }

  switch (dataType) {
    case 'string':
      if (typeof value !== 'string') {
        return '문자열을 입력해야 합니다'
      }
      break

    case 'number':
      // 문자열 숫자는 coercion 가능하므로 허용
      if (typeof value === 'string') {
        const num = Number(value)
        if (isNaN(num)) {
          return '숫자를 입력해야 합니다'
        }
      } else if (typeof value !== 'number' || isNaN(value)) {
        return '숫자를 입력해야 합니다'
      }
      break

    case 'boolean':
      if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
        return 'true 또는 false를 입력해야 합니다'
      }
      break

    case 'date':
    case 'datetime':
      if (typeof value === 'string') {
        const date = new Date(value)
        if (isNaN(date.getTime())) {
          return '유효한 날짜 형식이 아닙니다'
        }
      } else if (!(value instanceof Date)) {
        return '유효한 날짜 형식이 아닙니다'
      }
      break

    case 'array':
      if (!Array.isArray(value)) {
        return '배열 형식이어야 합니다'
      }
      break

    case 'object':
      if (typeof value !== 'object' || Array.isArray(value)) {
        return '객체 형식이어야 합니다'
      }
      break
  }

  return null
}

const applyAction = (
  runtime: FormRuntime,
  action: AgentAction
): Result<void, FormRuntimeError> => {
  switch (action.type) {
    case 'updateField':
      return runtime.dispatch({
        type: 'FIELD_CHANGE',
        fieldId: action.fieldId,
        value: action.value,
      } satisfies FormEvent)

    case 'submit':
      return runtime.dispatch({ type: 'SUBMIT' } satisfies FormEvent)

    case 'reset':
      return runtime.dispatch({ type: 'RESET' } satisfies FormEvent)

    case 'validate':
      return runtime.dispatch({
        type: 'VALIDATE',
        fieldIds: action.fieldIds ? [...action.fieldIds] : undefined,
      } satisfies FormEvent)
  }
}
