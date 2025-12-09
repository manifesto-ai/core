/**
 * TabsHandler
 *
 * Tabs 관련 Intent를 처리하는 핸들러
 * - switchTab
 */

import type { IntentHandler, HandlerContext } from '../../types/dispatcher'
import type { IntentResult, SwitchTabIntent } from '../../types/intents'

// ============================================================================
// TabsHandler
// ============================================================================

export class TabsHandler implements IntentHandler<SwitchTabIntent> {
  readonly targets = ['switchTab'] as const

  async execute(intent: SwitchTabIntent, context: HandlerContext): Promise<IntentResult> {
    const { nodeRegistry, onTabChange } = context

    // NodeRegistry를 통해 활성 탭 변경
    const success = nodeRegistry.setActiveTab(intent.nodeId, intent.tabId)

    if (!success) {
      return {
        success: false,
        errorType: 'INVALID_OPERATION',
        message: `Cannot switch to tab "${intent.tabId}" on node "${intent.nodeId}"`,
      }
    }

    // 콜백 호출 (외부 연동용)
    if (onTabChange) {
      onTabChange(intent.nodeId, intent.tabId)
    }

    return { success: true }
  }
}

/**
 * TabsHandler 팩토리 함수
 */
export const createTabsHandler = (): IntentHandler<SwitchTabIntent> => {
  return new TabsHandler()
}
