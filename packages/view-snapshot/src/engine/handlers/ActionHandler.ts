/**
 * ActionHandler
 *
 * 일반 액션 트리거 Intent를 처리하는 핸들러
 * - triggerAction
 */

import type { IntentHandler, HandlerContext } from '../../types/dispatcher'
import type { IntentResult, TriggerActionIntent } from '../../types/intents'

// ============================================================================
// ActionHandler
// ============================================================================

export class ActionHandler implements IntentHandler<TriggerActionIntent> {
  readonly targets = ['triggerAction'] as const

  async execute(intent: TriggerActionIntent, context: HandlerContext): Promise<IntentResult> {
    const { onActionTrigger } = context

    if (!onActionTrigger) {
      return {
        success: false,
        errorType: 'INVALID_OPERATION',
        message: 'Action trigger handler not configured',
      }
    }

    try {
      await onActionTrigger(intent.nodeId, intent.actionType)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        errorType: 'RUNTIME_ERROR',
        message: error instanceof Error ? error.message : 'Action trigger failed',
      }
    }
  }
}

/**
 * ActionHandler 팩토리 함수
 */
export const createActionHandler = (): IntentHandler<TriggerActionIntent> => {
  return new ActionHandler()
}
