/**
 * useListRuntime - List state management hook for React
 */

import { useState, useRef, useCallback, useLayoutEffect, useMemo } from 'react'
import type { ListViewSchema } from '@manifesto-ai/schema'
import { isOk } from '@manifesto-ai/schema'
import {
  ListRuntime,
  type ListState,
  type ListEvent,
  type ListRuntimeError,
  type ColumnMeta,
  type FetchHandler,
  type NavigateHandler,
  type EmitHandler,
  type ActionHandler,
  type EvaluationContext,
} from '@manifesto-ai/engine'

// ============================================================================
// Types
// ============================================================================

export interface UseListRuntimeOptions {
  /** App context */
  context?: Partial<EvaluationContext>
  /** Row ID field name (default: 'id') */
  idField?: string
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
}

export interface UseListRuntimeReturn {
  // Data
  /** Current page rows */
  rows: readonly Record<string, unknown>[]
  /** Total row count */
  totalCount: number

  // Pagination
  /** Current page number */
  currentPage: number
  /** Page size */
  pageSize: number
  /** Total pages */
  totalPages: number

  // Sorting
  /** Sort field */
  sortField: string | null
  /** Sort direction */
  sortDirection: 'asc' | 'desc' | null

  // Filtering
  /** Search term */
  searchTerm: string
  /** Filter values */
  filters: Readonly<Record<string, unknown>>

  // Selection
  /** Selected row IDs */
  selectedIds: ReadonlySet<string>
  /** Selected rows data */
  selectedRows: Record<string, unknown>[]
  /** All rows selected */
  isAllSelected: boolean
  /** Some rows selected (indeterminate) */
  isIndeterminate: boolean

  // Columns
  /** Column metadata */
  columns: ReadonlyMap<string, ColumnMeta>

  // Loading states
  /** Loading state */
  isLoading: boolean
  /** Refreshing state */
  isRefreshing: boolean
  /** Error */
  error: ListRuntimeError | null
  /** Initialized state */
  isInitialized: boolean

  // Pagination Actions
  /** Set page */
  setPage: (page: number) => void
  /** Set page size */
  setPageSize: (pageSize: number) => void

  // Sorting Actions
  /** Set sort */
  setSort: (field: string, direction: 'asc' | 'desc' | null) => void
  /** Toggle sort */
  toggleSort: (field: string) => void

  // Filtering Actions
  /** Set search term */
  setSearch: (term: string) => void
  /** Set filter */
  setFilter: (fieldId: string, value: unknown) => void
  /** Reset filters */
  resetFilters: () => void

  // Selection Actions
  /** Select row */
  selectRow: (rowId: string) => void
  /** Deselect row */
  deselectRow: (rowId: string) => void
  /** Toggle row selection */
  toggleRow: (rowId: string) => void
  /** Select all */
  selectAll: () => void
  /** Deselect all */
  deselectAll: () => void

  // Row Interaction Actions
  /** Row click */
  onRowClick: (rowId: string, row: Record<string, unknown>) => void
  /** Row action */
  onRowAction: (rowId: string, actionId: string, row: Record<string, unknown>) => void
  /** Bulk action */
  onBulkAction: (actionId: string) => void

  // Data Actions
  /** Load data */
  load: () => Promise<void>
  /** Refresh data */
  refresh: () => Promise<void>

  // Utility
  /** Get list state (for debug) */
  getState: () => ListState
  /** Get column metadata */
  getColumn: (columnId: string) => ColumnMeta | undefined
  /** Check if row is selected */
  isRowSelected: (rowId: string) => boolean
  /** Update context (re-evaluates hidden expressions) */
  setContext: (context: Partial<EvaluationContext>) => void
}

// ============================================================================
// Hook
// ============================================================================

const INITIAL_STATE: ListState = {
  rows: [],
  totalCount: 0,
  currentPage: 1,
  pageSize: 20,
  totalPages: 0,
  sortField: null,
  sortDirection: null,
  searchTerm: '',
  filters: {},
  selectedIds: new Set(),
  isAllSelected: false,
  isIndeterminate: false,
  isLoading: false,
  isRefreshing: false,
  error: null,
  columns: new Map(),
}

export function useListRuntime(
  schema: ListViewSchema | null,
  options: UseListRuntimeOptions = {}
): UseListRuntimeReturn {
  // Store options in ref to avoid dependency issues
  const optionsRef = useRef(options)
  optionsRef.current = options

  // Stable schema ID for dependency tracking
  const schemaId = useMemo(() => schema?.id ?? null, [schema?.id])

  // Runtime ref (persists across renders)
  const runtimeRef = useRef<ListRuntime | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // State
  const [listState, setListState] = useState<ListState>(INITIAL_STATE)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<ListRuntimeError | null>(null)

  // Initialize runtime - only when schema ID changes
  useLayoutEffect(() => {
    if (!schema) {
      setIsInitialized(false)
      return
    }

    const {
      context = {},
      idField = 'id',
      fetchHandler,
      navigateHandler,
      emitHandler,
      actionHandler,
      initialData,
      debug = false,
    } = optionsRef.current

    // Cleanup previous runtime
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
    if (runtimeRef.current) {
      runtimeRef.current.dispose()
    }

    // Create new runtime
    const runtime = new ListRuntime(schema, {
      context,
      idField,
      fetchHandler,
      navigateHandler,
      emitHandler,
      actionHandler,
      initialData,
      debug,
    })

    runtimeRef.current = runtime

    const result = runtime.initialize()

    if (debug) {
      console.log('[useListRuntime] Initialization result:', result._tag, result._tag === 'Err' ? result.error : 'success')
    }

    if (isOk(result)) {
      setIsInitialized(true)
      setError(null)
      setListState(runtime.getState())

      // Subscribe to state changes
      unsubscribeRef.current = runtime.subscribe((state) => {
        setListState(state)
      })
    } else {
      console.error('[useListRuntime] Initialization failed:', result.error)
      setError(result.error)
      setIsInitialized(false)
    }

    // Cleanup on unmount or schema change
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      if (runtimeRef.current) {
        runtimeRef.current.dispose()
        runtimeRef.current = null
      }
    }
  }, [schema, schemaId])

  // Dispatch helper
  const dispatch = useCallback(async (event: ListEvent): Promise<void> => {
    const runtime = runtimeRef.current
    if (!runtime) return

    const result = await runtime.dispatch(event)
    if (result._tag === 'Err') {
      setError(result.error)
    }
  }, [])

  // Pagination Actions
  const setPage = useCallback((page: number): void => {
    dispatch({ type: 'PAGE_CHANGE', page })
  }, [dispatch])

  const setPageSize = useCallback((newPageSize: number): void => {
    dispatch({ type: 'PAGE_SIZE_CHANGE', pageSize: newPageSize })
  }, [dispatch])

  // Sorting Actions
  const setSort = useCallback((field: string, direction: 'asc' | 'desc' | null): void => {
    dispatch({ type: 'SORT_CHANGE', field, direction })
  }, [dispatch])

  const toggleSort = useCallback((field: string): void => {
    dispatch({ type: 'SORT_TOGGLE', field })
  }, [dispatch])

  // Filtering Actions
  const setSearch = useCallback((term: string): void => {
    dispatch({ type: 'SEARCH_CHANGE', searchTerm: term })
  }, [dispatch])

  const setFilter = useCallback((fieldId: string, value: unknown): void => {
    dispatch({ type: 'FILTER_CHANGE', fieldId, value })
  }, [dispatch])

  const resetFilters = useCallback((): void => {
    dispatch({ type: 'FILTERS_RESET' })
  }, [dispatch])

  // Selection Actions
  const selectRow = useCallback((rowId: string): void => {
    dispatch({ type: 'SELECT_ROW', rowId })
  }, [dispatch])

  const deselectRow = useCallback((rowId: string): void => {
    dispatch({ type: 'DESELECT_ROW', rowId })
  }, [dispatch])

  const toggleRow = useCallback((rowId: string): void => {
    dispatch({ type: 'TOGGLE_ROW', rowId })
  }, [dispatch])

  const selectAll = useCallback((): void => {
    dispatch({ type: 'SELECT_ALL' })
  }, [dispatch])

  const deselectAll = useCallback((): void => {
    dispatch({ type: 'DESELECT_ALL' })
  }, [dispatch])

  // Row Interaction Actions
  const onRowClick = useCallback((rowId: string, row: Record<string, unknown>): void => {
    dispatch({ type: 'ROW_CLICK', rowId, row })
  }, [dispatch])

  const onRowAction = useCallback((rowId: string, actionId: string, row: Record<string, unknown>): void => {
    dispatch({ type: 'ROW_ACTION', rowId, actionId, row })
  }, [dispatch])

  const onBulkAction = useCallback((actionId: string): void => {
    dispatch({ type: 'BULK_ACTION', actionId, selectedIds: Array.from(listState.selectedIds) })
  }, [dispatch, listState.selectedIds])

  // Data Actions
  const load = useCallback(async (): Promise<void> => {
    await dispatch({ type: 'LOAD' })
  }, [dispatch])

  const refresh = useCallback(async (): Promise<void> => {
    await dispatch({ type: 'REFRESH' })
  }, [dispatch])

  // Utility
  const getState = useCallback((): ListState => {
    return listState
  }, [listState])

  const getColumn = useCallback((columnId: string): ColumnMeta | undefined => {
    return listState.columns.get(columnId)
  }, [listState.columns])

  const isRowSelected = useCallback((rowId: string): boolean => {
    return listState.selectedIds.has(rowId)
  }, [listState.selectedIds])

  const setContext = useCallback((context: Partial<EvaluationContext>): void => {
    const runtime = runtimeRef.current
    if (runtime) {
      runtime.setContext(context)
    }
  }, [])

  // Compute selectedRows
  const selectedRows = useMemo(() => {
    const runtime = runtimeRef.current
    if (!runtime) return []
    return runtime.getSelectedRows()
  }, [listState.selectedIds])

  return {
    // Data
    rows: listState.rows,
    totalCount: listState.totalCount,

    // Pagination
    currentPage: listState.currentPage,
    pageSize: listState.pageSize,
    totalPages: listState.totalPages,

    // Sorting
    sortField: listState.sortField,
    sortDirection: listState.sortDirection,

    // Filtering
    searchTerm: listState.searchTerm,
    filters: listState.filters,

    // Selection
    selectedIds: listState.selectedIds,
    selectedRows,
    isAllSelected: listState.isAllSelected,
    isIndeterminate: listState.isIndeterminate,

    // Columns
    columns: listState.columns,

    // Loading states
    isLoading: listState.isLoading,
    isRefreshing: listState.isRefreshing,
    error,
    isInitialized,

    // Pagination Actions
    setPage,
    setPageSize,

    // Sorting Actions
    setSort,
    toggleSort,

    // Filtering Actions
    setSearch,
    setFilter,
    resetFilters,

    // Selection Actions
    selectRow,
    deselectRow,
    toggleRow,
    selectAll,
    deselectAll,

    // Row Interaction Actions
    onRowClick,
    onRowAction,
    onBulkAction,

    // Data Actions
    load,
    refresh,

    // Utility
    getState,
    getColumn,
    isRowSelected,
    setContext,
  }
}
