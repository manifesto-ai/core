import type { BulkAction, ListColumn, RowAction, ViewAction } from '@manifesto-ai/schema'
import {
  type ActionSemanticNode,
  type ListColumnSemanticNode,
  type ListSemanticContract,
  type ListSemanticNode,
  type SemanticBuildOptions,
} from '../types'

const toActionNode = (
  action: ViewAction | RowAction | BulkAction,
  prefix: string
): ActionSemanticNode => ({
  id: `${prefix}:${action.id}`,
  kind: 'action',
  actionId: action.id,
  label: action.label,
  variant: action.variant,
  icon: action.icon,
  intent: action.action.type,
})

const toColumnNode = (column: ListColumn): ListColumnSemanticNode => ({
  id: `column:${column.id}`,
  kind: 'column',
  columnId: column.id,
  entityFieldId: column.entityFieldId,
  type: column.type,
  label: column.label,
  hiddenExpression: column.hidden,
  width: column.width,
  align: column.align,
  actions: column.actions?.map((action) => toActionNode(action, `column:${column.id}`)),
  summary: column.summary,
})

export const buildListSemanticTree = (
  contract: ListSemanticContract,
  options?: SemanticBuildOptions
): ListSemanticNode => {
  const { view } = contract
  const includeHidden = options?.includeHidden ?? true

  const columns = view.columns
    .map(toColumnNode)
    .filter((column) => includeHidden || !column.hiddenExpression)

  return {
    id: view.id,
    kind: 'list',
    viewId: view.id,
    entityRef: view.entityRef,
    columns,
    headerActions: view.header?.actions?.map((action) => toActionNode(action, 'header')),
    footerActions: view.footer?.actions?.map((action) => toActionNode(action, 'footer')),
    bulkActions: view.bulkActions?.map((action) => toActionNode(action, 'bulk')),
    emptyState: view.emptyState,
    rows: contract.rows,
    uiStateHints: options?.uiState,
  }
}
