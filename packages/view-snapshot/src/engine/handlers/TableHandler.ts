/**
 * TableHandler
 *
 * Table 관련 Intent를 처리하는 핸들러
 * - selectRow
 * - selectAll
 * - deselectAll
 * - changePage
 * - sortColumn
 */

import type { ListRuntime, ListRuntimeError } from '@manifesto-ai/engine'
import type { IntentHandler, HandlerContext } from '../../types/dispatcher'
import type {
  IntentResult,
  SelectRowIntent,
  SelectAllRowsIntent,
  DeselectAllRowsIntent,
  ChangePageIntent,
  SortColumnIntent,
} from '../../types/intents'

// ============================================================================
// Types
// ============================================================================

type TableIntent =
  | SelectRowIntent
  | SelectAllRowsIntent
  | DeselectAllRowsIntent
  | ChangePageIntent
  | SortColumnIntent

// ============================================================================
// TableHandler
// ============================================================================

export class TableHandler implements IntentHandler<TableIntent> {
  readonly targets = ['selectRow', 'selectAll', 'deselectAll', 'changePage', 'sortColumn'] as const

  async execute(intent: TableIntent, context: HandlerContext): Promise<IntentResult> {
    const { nodeRegistry } = context
    const nodeId = intent.nodeId
    const listNode = nodeRegistry.getListNode(nodeId)

    if (!listNode) {
      return {
        success: false,
        errorType: 'NODE_NOT_FOUND',
        message: `List node "${nodeId}" not found`,
      }
    }

    const { runtime } = listNode

    switch (intent.type) {
      case 'selectRow':
        return this.handleSelectRow(intent, runtime)

      case 'selectAll':
        return this.handleSelectAll(runtime)

      case 'deselectAll':
        return this.handleDeselectAll(runtime)

      case 'changePage':
        return this.handleChangePage(intent, runtime)

      case 'sortColumn':
        return this.handleSortColumn(intent, runtime)
    }
  }

  private async handleSelectRow(
    intent: SelectRowIntent,
    runtime: ListRuntime
  ): Promise<IntentResult> {
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
        message: this.formatListError(result.error),
      }
    }

    return { success: true }
  }

  private async handleSelectAll(runtime: ListRuntime): Promise<IntentResult> {
    const result = await runtime.dispatch({ type: 'SELECT_ALL' })

    if (result._tag === 'Err') {
      return {
        success: false,
        errorType: 'RUNTIME_ERROR',
        message: this.formatListError(result.error),
      }
    }

    return { success: true }
  }

  private async handleDeselectAll(runtime: ListRuntime): Promise<IntentResult> {
    const result = await runtime.dispatch({ type: 'DESELECT_ALL' })

    if (result._tag === 'Err') {
      return {
        success: false,
        errorType: 'RUNTIME_ERROR',
        message: this.formatListError(result.error),
      }
    }

    return { success: true }
  }

  private async handleChangePage(
    intent: ChangePageIntent,
    runtime: ListRuntime
  ): Promise<IntentResult> {
    const result = await runtime.dispatch({
      type: 'PAGE_CHANGE',
      page: intent.page,
    })

    if (result._tag === 'Err') {
      return {
        success: false,
        errorType: 'RUNTIME_ERROR',
        message: this.formatListError(result.error),
      }
    }

    return { success: true }
  }

  private async handleSortColumn(
    intent: SortColumnIntent,
    runtime: ListRuntime
  ): Promise<IntentResult> {
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
        message: this.formatListError(result.error),
      }
    }

    return { success: true }
  }

  private formatListError(error: ListRuntimeError): string {
    return error.message ?? `List error: ${error.type}`
  }
}

/**
 * TableHandler 팩토리 함수
 */
export const createTableHandler = (): IntentHandler<TableIntent> => {
  return new TableHandler()
}
