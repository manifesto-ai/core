/**
 * ListRenderer - Top-level list renderer component
 *
 * Receives ListViewSchema and automatically renders list/table UI
 * Integrates with useListRuntime for state management
 */

import React, { useMemo, useCallback, useEffect } from 'react'
import type { ListViewSchema } from '@manifesto-ai/schema'
import type {
  EvaluationContext,
  ListRuntimeError,
  FetchHandler,
  NavigateHandler,
  EmitHandler,
  ActionHandler,
  ColumnMeta,
} from '@manifesto-ai/engine'
import { useListRuntime } from '../../hooks/useListRuntime'
import { ListContext } from './ListContext'
import { ListToolbar } from './ListToolbar'
import { ListTable } from './ListTable'
import { ListPagination } from './ListPagination'

// ============================================================================
// Types
// ============================================================================

export interface ListRendererProps {
  /** List view schema */
  schema: ListViewSchema
  /** Evaluation context */
  context?: Partial<EvaluationContext>
  /** Row ID field name (default: 'id') */
  idField?: string
  /** Readonly mode */
  readonly?: boolean
  /** API fetch handler */
  fetchHandler?: FetchHandler
  /** Navigate handler */
  navigateHandler?: NavigateHandler
  /** Emit handler */
  emitHandler?: EmitHandler
  /** Action handler */
  actionHandler?: ActionHandler
  /** Initial data (override static data source) */
  initialData?: readonly Record<string, unknown>[]
  /** Debug mode */
  debug?: boolean
  /** Row click callback */
  onRowClick?: (rowId: string, row: Record<string, unknown>) => void
  /** Row action callback */
  onRowAction?: (rowId: string, actionId: string, row: Record<string, unknown>) => void
  /** Bulk action callback */
  onBulkAction?: (actionId: string, selectedIds: string[]) => void
  /** Selection change callback */
  onSelectionChange?: (selectedIds: Set<string>) => void
  /** Page change callback */
  onPageChange?: (page: number) => void
  /** Error callback */
  onError?: (error: ListRuntimeError) => void
  /** Toolbar render prop */
  renderToolbar?: () => React.ReactNode
  /** Empty state render prop */
  renderEmptyState?: () => React.ReactNode
  /** Cell render prop */
  renderCell?: (
    column: ColumnMeta,
    value: unknown,
    row: Record<string, unknown>
  ) => React.ReactNode
  /** Row actions render prop */
  renderRowActions?: (row: Record<string, unknown>) => React.ReactNode
  /** Header render prop */
  renderHeader?: () => React.ReactNode
  /** Loading render prop */
  renderLoading?: () => React.ReactNode
  /** Error render prop */
  renderError?: (error: ListRuntimeError) => React.ReactNode
}

// ============================================================================
// Component
// ============================================================================

export const ListRenderer: React.FC<ListRendererProps> = ({
  schema,
  context,
  idField = 'id',
  readonly = false,
  fetchHandler,
  navigateHandler,
  emitHandler,
  actionHandler,
  initialData,
  debug = false,
  onRowClick,
  onRowAction,
  onBulkAction,
  onSelectionChange,
  onPageChange,
  onError,
  renderToolbar,
  renderEmptyState,
  renderCell,
  renderRowActions,
  renderHeader,
  renderLoading,
  renderError,
}) => {
  // Initialize runtime
  const runtime = useListRuntime(schema, {
    context,
    idField,
    fetchHandler,
    navigateHandler,
    emitHandler,
    actionHandler,
    initialData,
    debug,
  })

  // Sync context changes to runtime
  useEffect(() => {
    if (runtime.isInitialized && context) {
      runtime.setContext(context)
    }
  }, [context, runtime])

  // Error callback
  useEffect(() => {
    if (runtime.error && onError) {
      onError(runtime.error)
    }
  }, [runtime.error, onError])

  // Selection change callback
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(new Set(runtime.selectedIds))
    }
  }, [runtime.selectedIds, onSelectionChange])

  // Page change callback
  useEffect(() => {
    if (onPageChange) {
      onPageChange(runtime.currentPage)
    }
  }, [runtime.currentPage, onPageChange])

  // Row click handler
  const handleRowClick = useCallback(
    (rowId: string, row: Record<string, unknown>) => {
      runtime.onRowClick(rowId, row)
      onRowClick?.(rowId, row)
    },
    [runtime, onRowClick]
  )

  // Row action handler
  const handleRowAction = useCallback(
    (rowId: string, actionId: string, row: Record<string, unknown>) => {
      runtime.onRowAction(rowId, actionId, row)
      onRowAction?.(rowId, actionId, row)
    },
    [runtime, onRowAction]
  )

  // Bulk action handler
  const handleBulkAction = useCallback(
    (actionId: string) => {
      runtime.onBulkAction(actionId)
      onBulkAction?.(actionId, Array.from(runtime.selectedIds))
    },
    [runtime, onBulkAction]
  )

  // Context value
  const contextValue = useMemo(
    () => ({
      runtime,
      schema,
      readonly,
      idField,
    }),
    [runtime, schema, readonly, idField]
  )

  // Container class names
  const containerClassName = useMemo(() => {
    const classes = ['list-renderer']
    if (readonly) classes.push('list-renderer--readonly')
    if (!runtime.isInitialized) classes.push('list-renderer--loading')
    if (runtime.error) classes.push('list-renderer--error')
    if (runtime.rows.length === 0 && runtime.isInitialized) {
      classes.push('list-renderer--empty')
    }
    return classes.join(' ')
  }, [readonly, runtime.isInitialized, runtime.error, runtime.rows.length])

  return (
    <ListContext.Provider value={contextValue}>
      <div className={containerClassName}>
        {/* Header */}
        {renderHeader && (
          <header className="list-renderer__header">{renderHeader()}</header>
        )}

        {/* Loading State */}
        {!runtime.isInitialized && (
          <div className="list-renderer__loading">
            {renderLoading ? renderLoading() : <span>Loading...</span>}
          </div>
        )}

        {/* Error State */}
        {runtime.isInitialized && runtime.error && (
          <div className="list-renderer__error">
            {renderError ? (
              renderError(runtime.error)
            ) : (
              <span className="list-renderer__error-message">
                {runtime.error.message ?? runtime.error.type}
              </span>
            )}
          </div>
        )}

        {/* List Content */}
        {runtime.isInitialized && !runtime.error && (
          <>
            {/* Toolbar */}
            <ListToolbar
              searchTerm={runtime.searchTerm}
              filters={runtime.filters}
              filterConfig={schema.filtering}
              selectedCount={runtime.selectedIds.size}
              bulkActions={schema.bulkActions}
              onSearch={runtime.setSearch}
              onFilter={runtime.setFilter}
              onResetFilters={runtime.resetFilters}
              onBulkAction={handleBulkAction}
              renderToolbar={renderToolbar}
            />

            {/* Table */}
            <ListTable
              rows={runtime.rows}
              columns={schema.columns}
              columnMetaMap={runtime.columns}
              idField={idField}
              selection={schema.selection}
              selectedIds={runtime.selectedIds}
              isAllSelected={runtime.isAllSelected}
              isIndeterminate={runtime.isIndeterminate}
              sortField={runtime.sortField}
              sortDirection={runtime.sortDirection}
              emptyState={schema.emptyState}
              isRowSelected={runtime.isRowSelected}
              onToggleRow={runtime.toggleRow}
              onSelectAll={runtime.selectAll}
              onDeselectAll={runtime.deselectAll}
              onToggleSort={runtime.toggleSort}
              onRowClick={handleRowClick}
              onRowAction={handleRowAction}
              renderCell={renderCell}
              renderRowActions={renderRowActions}
              renderEmptyState={renderEmptyState}
            />

            {/* Pagination */}
            <ListPagination
              currentPage={runtime.currentPage}
              pageSize={runtime.pageSize}
              totalPages={runtime.totalPages}
              totalCount={runtime.totalCount}
              config={schema.pagination}
              onPageChange={runtime.setPage}
              onPageSizeChange={runtime.setPageSize}
            />
          </>
        )}

        {/* Debug info */}
        {debug && runtime.isInitialized && (
          <pre className="list-renderer__debug">
            {JSON.stringify(runtime.getState(), null, 2)}
          </pre>
        )}
      </div>
    </ListContext.Provider>
  )
}

export default ListRenderer
