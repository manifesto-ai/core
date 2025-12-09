/**
 * GuardrailMiddleware
 *
 * Intent 실행 전 유효성 검사를 수행하는 미들웨어
 * - 노드 존재 여부 확인
 * - Intent 타입별 사전 조건 검사
 * - 권한 검사 (확장 가능)
 */

import type { IntentMiddleware, HandlerContext } from '../../types/dispatcher'
import type { ViewIntent, IntentResult } from '../../types/intents'

// ============================================================================
// Types
// ============================================================================

export interface GuardrailOptions {
  /** 노드 존재 여부 검사 활성화 (기본: true) */
  checkNodeExists?: boolean
  /** 커스텀 가드 함수 */
  customGuards?: GuardFunction[]
}

/**
 * 가드 함수 타입
 * - null 반환: 통과
 * - IntentResult 반환: 실패 (해당 결과로 즉시 반환)
 */
export type GuardFunction = (
  intent: ViewIntent,
  context: HandlerContext
) => IntentResult | null

// ============================================================================
// Built-in Guards
// ============================================================================

/**
 * 노드 존재 여부 검사 가드
 */
const nodeExistsGuard: GuardFunction = (intent, context) => {
  // nodeId가 있는 intent만 검사
  if (!('nodeId' in intent)) {
    return null
  }

  const nodeId = (intent as { nodeId: string }).nodeId
  const { nodeRegistry } = context

  // Form 노드 검사
  const formIntentTypes = ['setFieldValue', 'submit', 'reset']
  if (formIntentTypes.includes(intent.type)) {
    const formNode = nodeRegistry.getFormNode(nodeId)
    if (!formNode) {
      return {
        success: false,
        errorType: 'NODE_NOT_FOUND',
        message: `Form node "${nodeId}" not found`,
      }
    }
    return null
  }

  // List/Table 노드 검사
  const listIntentTypes = ['selectRow', 'selectAll', 'deselectAll', 'changePage', 'sortColumn']
  if (listIntentTypes.includes(intent.type)) {
    const listNode = nodeRegistry.getListNode(nodeId)
    if (!listNode) {
      return {
        success: false,
        errorType: 'NODE_NOT_FOUND',
        message: `List node "${nodeId}" not found`,
      }
    }
    return null
  }

  // Tabs 노드 검사
  if (intent.type === 'switchTab') {
    const tabsNode = nodeRegistry.getTabsNode(nodeId)
    if (!tabsNode) {
      return {
        success: false,
        errorType: 'NODE_NOT_FOUND',
        message: `Tabs node "${nodeId}" not found`,
      }
    }
    return null
  }

  return null
}

// ============================================================================
// GuardrailMiddleware
// ============================================================================

/**
 * 가드레일 미들웨어 생성
 *
 * @param options 가드레일 옵션
 * @returns IntentMiddleware
 */
export const createGuardrailMiddleware = (options: GuardrailOptions = {}): IntentMiddleware => {
  const { checkNodeExists = true, customGuards = [] } = options

  // 활성화된 가드 목록 구성
  const guards: GuardFunction[] = []

  if (checkNodeExists) {
    guards.push(nodeExistsGuard)
  }

  guards.push(...customGuards)

  return async (intent, context, next) => {
    // 모든 가드 실행
    for (const guard of guards) {
      const result = guard(intent, context)
      if (result !== null) {
        // 가드 실패 시 즉시 반환
        return result
      }
    }

    // 모든 가드 통과 시 다음 미들웨어/핸들러로 진행
    return next()
  }
}
