/**
 * IntentDispatcher
 *
 * ViewIntent를 해당 Runtime으로 디스패치
 */

import type {
  ViewIntent,
  IntentResult,
  SetFieldValueIntent,
  SubmitFormIntent,
  ResetFormIntent,
  SelectRowIntent,
  SelectAllRowsIntent,
  DeselectAllRowsIntent,
  ChangePageIntent,
  SortColumnIntent,
  SwitchTabIntent,
  OpenOverlayIntent,
  SubmitOverlayIntent,
  CloseOverlayIntent,
  ConfirmDialogIntent,
  DismissToastIntent,
  TriggerActionIntent,
} from '../types'
import type { INodeRegistry } from './NodeRegistry'
import type { IOverlayManager, OpenOverlayOptions } from './OverlayManager'
import {
  isFormIntent,
  isTableIntent,
  isTabsIntent,
  isOverlayIntent,
  isTriggerActionIntent,
} from '../guards'

// ============================================================================
// Types
// ============================================================================

/**
 * Intent 디스패처 인터페이스
 */
export interface IIntentDispatcher {
  dispatch(intent: ViewIntent): Promise<IntentResult>
}

/**
 * Intent 디스패처 옵션
 */
export interface IntentDispatcherOptions {
  /** 디버그 모드 */
  debug?: boolean
  /** 탭 상태 변경 핸들러 */
  onTabChange?: (nodeId: string, tabId: string) => void
  /** 액션 트리거 핸들러 */
  onActionTrigger?: (nodeId: string, actionType: string) => Promise<void>
}

// ============================================================================
// IntentDispatcher
// ============================================================================

/**
 * Intent 디스패처 구현
 */
export class IntentDispatcher implements IIntentDispatcher {
  constructor(
    private nodeRegistry: INodeRegistry,
    private overlayManager: IOverlayManager,
    private options: IntentDispatcherOptions = {}
  ) {}

  async dispatch(intent: ViewIntent): Promise<IntentResult> {
    this.log('Dispatching intent:', intent.type)

    try {
      if (isFormIntent(intent)) {
        return await this.dispatchFormIntent(intent)
      }

      if (isTableIntent(intent)) {
        return await this.dispatchTableIntent(intent)
      }

      if (isTabsIntent(intent)) {
        return this.dispatchTabsIntent(intent)
      }

      if (isOverlayIntent(intent)) {
        return this.dispatchOverlayIntent(intent)
      }

      if (isTriggerActionIntent(intent)) {
        return await this.dispatchTriggerActionIntent(intent)
      }

      return {
        success: false,
        errorType: 'INVALID_OPERATION',
        message: `Unknown intent type: ${(intent as ViewIntent).type}`,
      }
    } catch (error) {
      return {
        success: false,
        errorType: 'RUNTIME_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // ============================================================================
  // Form Intents
  // ============================================================================

  private async dispatchFormIntent(
    intent: SetFieldValueIntent | SubmitFormIntent | ResetFormIntent
  ): Promise<IntentResult> {
    const nodeId = intent.nodeId
    const formNode = this.nodeRegistry.getFormNode(nodeId)

    if (!formNode) {
      return {
        success: false,
        errorType: 'NODE_NOT_FOUND',
        message: `Form node "${nodeId}" not found`,
      }
    }

    const { runtime } = formNode

    switch (intent.type) {
      case 'setFieldValue': {
        const result = runtime.dispatch({
          type: 'FIELD_CHANGE',
          fieldId: intent.fieldId,
          value: intent.value,
        })

        if (result._tag === 'Err') {
          return {
            success: false,
            errorType: 'RUNTIME_ERROR',
            message: this.formatFormError(result.error),
          }
        }

        return { success: true }
      }

      case 'submit': {
        const result = runtime.dispatch({ type: 'SUBMIT' })

        if (result._tag === 'Err') {
          return {
            success: false,
            errorType: 'RUNTIME_ERROR',
            message: this.formatFormError(result.error),
          }
        }

        return { success: true }
      }

      case 'reset': {
        const result = runtime.dispatch({ type: 'RESET' })

        if (result._tag === 'Err') {
          return {
            success: false,
            errorType: 'RUNTIME_ERROR',
            message: this.formatFormError(result.error),
          }
        }

        return { success: true }
      }
    }
  }

  // ============================================================================
  // Table Intents
  // ============================================================================

  private async dispatchTableIntent(
    intent: SelectRowIntent | SelectAllRowsIntent | DeselectAllRowsIntent | ChangePageIntent | SortColumnIntent
  ): Promise<IntentResult> {
    const nodeId = intent.nodeId
    const listNode = this.nodeRegistry.getListNode(nodeId)

    if (!listNode) {
      return {
        success: false,
        errorType: 'NODE_NOT_FOUND',
        message: `List node "${nodeId}" not found`,
      }
    }

    const { runtime } = listNode

    switch (intent.type) {
      case 'selectRow': {
        // append가 false이면 먼저 전체 해제
        if (!intent.append) {
          await runtime.dispatch({ type: 'DESELECT_ALL' })
        }

        const result = await runtime.dispatch({
          type: 'SELECT_ROW',
          rowId: intent.rowId,
        })

        if (result._tag === 'Err') {
          return {
            success: false,
            errorType: 'RUNTIME_ERROR',
            message: result.error.message,
          }
        }

        return { success: true }
      }

      case 'selectAll': {
        const result = await runtime.dispatch({ type: 'SELECT_ALL' })

        if (result._tag === 'Err') {
          return {
            success: false,
            errorType: 'RUNTIME_ERROR',
            message: result.error.message,
          }
        }

        return { success: true }
      }

      case 'deselectAll': {
        const result = await runtime.dispatch({ type: 'DESELECT_ALL' })

        if (result._tag === 'Err') {
          return {
            success: false,
            errorType: 'RUNTIME_ERROR',
            message: result.error.message,
          }
        }

        return { success: true }
      }

      case 'changePage': {
        const result = await runtime.dispatch({
          type: 'PAGE_CHANGE',
          page: intent.page,
        })

        if (result._tag === 'Err') {
          return {
            success: false,
            errorType: 'RUNTIME_ERROR',
            message: result.error.message,
          }
        }

        return { success: true }
      }

      case 'sortColumn': {
        const result = intent.direction
          ? await runtime.dispatch({
              type: 'SORT_CHANGE',
              field: intent.columnId,
              direction: intent.direction,
            })
          : await runtime.dispatch({
              type: 'SORT_TOGGLE',
              field: intent.columnId,
            })

        if (result._tag === 'Err') {
          return {
            success: false,
            errorType: 'RUNTIME_ERROR',
            message: result.error.message,
          }
        }

        return { success: true }
      }
    }
  }

  // ============================================================================
  // Tabs Intent
  // ============================================================================

  private dispatchTabsIntent(intent: SwitchTabIntent): IntentResult {
    // 탭 상태는 외부에서 관리 (React/Vue state 또는 커스텀 핸들러)
    if (this.options.onTabChange) {
      this.options.onTabChange(intent.nodeId, intent.tabId)
      return { success: true }
    }

    return {
      success: false,
      errorType: 'INVALID_OPERATION',
      message: 'Tab change handler not configured',
    }
  }

  // ============================================================================
  // Overlay Intents
  // ============================================================================

  private dispatchOverlayIntent(
    intent: OpenOverlayIntent | SubmitOverlayIntent | CloseOverlayIntent | ConfirmDialogIntent | DismissToastIntent
  ): IntentResult {
    switch (intent.type) {
      case 'openOverlay': {
        const options: OpenOverlayOptions = {
          boundData: intent.boundData,
        }

        // dataSourceNodeId가 있으면 해당 노드에서 데이터 가져오기
        if (intent.dataSourceNodeId) {
          const listNode = this.nodeRegistry.getListNode(intent.dataSourceNodeId)
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

        const instance = this.overlayManager.openWithTemplate(intent.template, options)

        if (!instance) {
          return {
            success: false,
            errorType: 'TEMPLATE_NOT_FOUND',
            message: `Overlay template "${intent.template}" not found`,
          }
        }

        return { success: true }
      }

      case 'submitOverlay': {
        const success = this.overlayManager.submit(intent.instanceId)

        if (!success) {
          return {
            success: false,
            errorType: 'OVERLAY_NOT_FOUND',
            message: `Overlay "${intent.instanceId}" not found`,
          }
        }

        return { success: true }
      }

      case 'closeOverlay': {
        const success = this.overlayManager.close(intent.instanceId)

        if (!success) {
          return {
            success: false,
            errorType: 'OVERLAY_NOT_FOUND',
            message: `Overlay "${intent.instanceId}" not found`,
          }
        }

        return { success: true }
      }

      case 'confirmDialog': {
        const success = this.overlayManager.confirm(intent.instanceId)

        if (!success) {
          return {
            success: false,
            errorType: 'OVERLAY_NOT_FOUND',
            message: `Dialog "${intent.instanceId}" not found`,
          }
        }

        return { success: true }
      }

      case 'dismissToast': {
        const success = this.overlayManager.dismiss(intent.instanceId)

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
  }

  // ============================================================================
  // Trigger Action Intent
  // ============================================================================

  private async dispatchTriggerActionIntent(intent: TriggerActionIntent): Promise<IntentResult> {
    if (this.options.onActionTrigger) {
      try {
        await this.options.onActionTrigger(intent.nodeId, intent.actionType)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          errorType: 'RUNTIME_ERROR',
          message: error instanceof Error ? error.message : 'Action trigger failed',
        }
      }
    }

    return {
      success: false,
      errorType: 'INVALID_OPERATION',
      message: 'Action trigger handler not configured',
    }
  }

  // ============================================================================
  // Private
  // ============================================================================

  private formatFormError(error: { type: string; message?: string; errors?: Record<string, string[]> }): string {
    if (error.message) {
      return error.message
    }
    if (error.errors) {
      const errorMessages = Object.entries(error.errors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ')
      return `Validation errors: ${errorMessages}`
    }
    return `Form error: ${error.type}`
  }

  private log(...args: unknown[]): void {
    if (this.options.debug) {
      console.log('[IntentDispatcher]', ...args)
    }
  }
}

/**
 * IntentDispatcher 팩토리 함수
 */
export const createIntentDispatcher = (
  nodeRegistry: INodeRegistry,
  overlayManager: IOverlayManager,
  options?: IntentDispatcherOptions
): IIntentDispatcher => {
  return new IntentDispatcher(nodeRegistry, overlayManager, options)
}

