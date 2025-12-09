/**
 * OverlayHandler
 *
 * Overlay 관련 Intent를 처리하는 핸들러
 * - openOverlay
 * - submitOverlay
 * - closeOverlay
 * - confirmDialog
 * - dismissToast
 */

import type { IntentHandler, HandlerContext } from '../../types/dispatcher'
import type {
  IntentResult,
  OpenOverlayIntent,
  SubmitOverlayIntent,
  CloseOverlayIntent,
  ConfirmDialogIntent,
  DismissToastIntent,
} from '../../types/intents'
import type { OpenOverlayOptions } from '../OverlayManager'

// ============================================================================
// Types
// ============================================================================

type OverlayIntent =
  | OpenOverlayIntent
  | SubmitOverlayIntent
  | CloseOverlayIntent
  | ConfirmDialogIntent
  | DismissToastIntent

// ============================================================================
// OverlayHandler
// ============================================================================

export class OverlayHandler implements IntentHandler<OverlayIntent> {
  readonly targets = [
    'openOverlay',
    'submitOverlay',
    'closeOverlay',
    'confirmDialog',
    'dismissToast',
  ] as const

  async execute(intent: OverlayIntent, context: HandlerContext): Promise<IntentResult> {
    const { overlayManager, nodeRegistry } = context

    switch (intent.type) {
      case 'openOverlay':
        return this.handleOpenOverlay(intent, overlayManager, nodeRegistry)

      case 'submitOverlay':
        return this.handleSubmitOverlay(intent, overlayManager)

      case 'closeOverlay':
        return this.handleCloseOverlay(intent, overlayManager)

      case 'confirmDialog':
        return this.handleConfirmDialog(intent, overlayManager)

      case 'dismissToast':
        return this.handleDismissToast(intent, overlayManager)
    }
  }

  private handleOpenOverlay(
    intent: OpenOverlayIntent,
    overlayManager: { openWithTemplate: (id: string, options?: OpenOverlayOptions) => unknown },
    nodeRegistry: { getListNode: (id: string) => { runtime: { getSelectedRows: () => unknown[] } } | undefined }
  ): IntentResult {
    const options: OpenOverlayOptions = {
      boundData: intent.boundData,
    }

    // dataSourceNodeId가 있으면 해당 노드에서 데이터 가져오기
    if (intent.dataSourceNodeId) {
      const listNode = nodeRegistry.getListNode(intent.dataSourceNodeId)
      if (listNode) {
        const selectedRows = listNode.runtime.getSelectedRows()
        options.boundData = {
          ...options.boundData,
          selectedRows,
          selectedRow: selectedRows[0],
          count: selectedRows.length,
        }
      }
    }

    const instance = overlayManager.openWithTemplate(intent.template, options)

    if (!instance) {
      return {
        success: false,
        errorType: 'TEMPLATE_NOT_FOUND',
        message: `Overlay template "${intent.template}" not found`,
      }
    }

    return { success: true }
  }

  private handleSubmitOverlay(
    intent: SubmitOverlayIntent,
    overlayManager: { submit: (id: string) => boolean }
  ): IntentResult {
    const success = overlayManager.submit(intent.instanceId)

    if (!success) {
      return {
        success: false,
        errorType: 'OVERLAY_NOT_FOUND',
        message: `Overlay "${intent.instanceId}" not found`,
      }
    }

    return { success: true }
  }

  private handleCloseOverlay(
    intent: CloseOverlayIntent,
    overlayManager: { close: (id: string) => boolean }
  ): IntentResult {
    const success = overlayManager.close(intent.instanceId)

    if (!success) {
      return {
        success: false,
        errorType: 'OVERLAY_NOT_FOUND',
        message: `Overlay "${intent.instanceId}" not found`,
      }
    }

    return { success: true }
  }

  private handleConfirmDialog(
    intent: ConfirmDialogIntent,
    overlayManager: { confirm: (id: string) => boolean }
  ): IntentResult {
    const success = overlayManager.confirm(intent.instanceId)

    if (!success) {
      return {
        success: false,
        errorType: 'OVERLAY_NOT_FOUND',
        message: `Dialog "${intent.instanceId}" not found`,
      }
    }

    return { success: true }
  }

  private handleDismissToast(
    intent: DismissToastIntent,
    overlayManager: { dismiss: (id: string) => boolean }
  ): IntentResult {
    const success = overlayManager.dismiss(intent.instanceId)

    if (!success) {
      return {
        success: false,
        errorType: 'OVERLAY_NOT_FOUND',
        message: `Toast "${intent.instanceId}" not found`,
      }
    }

    return { success: true }
  }
}

/**
 * OverlayHandler 팩토리 함수
 */
export const createOverlayHandler = (): IntentHandler<OverlayIntent> => {
  return new OverlayHandler()
}
