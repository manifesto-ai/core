/**
 * useListRuntime - 리스트 상태 관리 및 반응형 업데이트
 */

import {
  ref,
  computed,
  watch,
  onUnmounted,
  getCurrentInstance,
  type Ref,
  type ComputedRef,
} from 'vue'
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
} from '@manifesto-ai/engine'
import type { EvaluationContext } from '@manifesto-ai/engine'

// ============================================================================
// Types
// ============================================================================

export interface UseListRuntimeOptions {
  /** 앱 컨텍스트 */
  context?: Partial<EvaluationContext>
  /** Row ID 필드명 (기본값: 'id') */
  idField?: string
  /** API 호출 핸들러 */
  fetchHandler?: FetchHandler
  /** Navigate 핸들러 (라우팅용) */
  navigateHandler?: NavigateHandler
  /** Emit 핸들러 (이벤트 발행용) */
  emitHandler?: EmitHandler
  /** Action 핸들러 (커스텀 액션 실행용) */
  actionHandler?: ActionHandler
  /** 초기 데이터 (static 데이터 소스 오버라이드) */
  initialData?: readonly Record<string, unknown>[]
  /** 디버그 모드 */
  debug?: boolean
  /** 스키마 변경 시 자동 재초기화 */
  autoReinitialize?: boolean
}

export interface UseListRuntimeReturn {
  // Data
  /** 현재 페이지 데이터 (반응형) */
  rows: Ref<readonly Record<string, unknown>[]>
  /** 전체 데이터 수 */
  totalCount: Ref<number>

  // Pagination
  /** 현재 페이지 */
  currentPage: Ref<number>
  /** 페이지 크기 */
  pageSize: Ref<number>
  /** 전체 페이지 수 */
  totalPages: ComputedRef<number>

  // Sorting
  /** 정렬 필드 */
  sortField: Ref<string | null>
  /** 정렬 방향 */
  sortDirection: Ref<'asc' | 'desc' | null>

  // Filtering
  /** 검색어 */
  searchTerm: Ref<string>
  /** 필터 값 */
  filters: Ref<Readonly<Record<string, unknown>>>

  // Selection
  /** 선택된 행 ID */
  selectedIds: Ref<ReadonlySet<string>>
  /** 선택된 행 데이터 */
  selectedRows: ComputedRef<Record<string, unknown>[]>
  /** 전체 선택 상태 */
  isAllSelected: ComputedRef<boolean>
  /** 부분 선택 상태 */
  isIndeterminate: ComputedRef<boolean>

  // Columns
  /** 컬럼 메타데이터 */
  columns: Ref<ReadonlyMap<string, ColumnMeta>>

  // Loading states
  /** 로딩 상태 */
  isLoading: Ref<boolean>
  /** 새로고침 상태 */
  isRefreshing: Ref<boolean>
  /** 에러 */
  error: Ref<ListRuntimeError | null>
  /** 초기화 상태 */
  isInitialized: Ref<boolean>

  // Pagination Actions
  /** 페이지 변경 */
  setPage: (page: number) => void
  /** 페이지 크기 변경 */
  setPageSize: (pageSize: number) => void

  // Sorting Actions
  /** 정렬 설정 */
  setSort: (field: string, direction: 'asc' | 'desc' | null) => void
  /** 정렬 토글 */
  toggleSort: (field: string) => void

  // Filtering Actions
  /** 검색어 설정 */
  setSearch: (term: string) => void
  /** 필터 설정 */
  setFilter: (fieldId: string, value: unknown) => void
  /** 필터 리셋 */
  resetFilters: () => void

  // Selection Actions
  /** 행 선택 */
  selectRow: (rowId: string) => void
  /** 행 선택 해제 */
  deselectRow: (rowId: string) => void
  /** 행 선택 토글 */
  toggleRow: (rowId: string) => void
  /** 전체 선택 */
  selectAll: () => void
  /** 전체 선택 해제 */
  deselectAll: () => void

  // Row Interaction Actions
  /** 행 클릭 */
  onRowClick: (rowId: string, row: Record<string, unknown>) => void
  /** 행 액션 */
  onRowAction: (rowId: string, actionId: string, row: Record<string, unknown>) => void
  /** 일괄 액션 */
  onBulkAction: (actionId: string) => void

  // Data Actions
  /** 데이터 로드 */
  load: () => Promise<void>
  /** 새로고침 */
  refresh: () => Promise<void>

  // Utility
  /** 리스트 상태 가져오기 (디버그용) */
  getState: () => ListState
  /** 컬럼 정보 가져오기 */
  getColumn: (columnId: string) => ColumnMeta | undefined
  /** 행이 선택되었는지 확인 */
  isRowSelected: (rowId: string) => boolean
  /** 컨텍스트 업데이트 (hidden expression 재평가) */
  setContext: (context: Partial<EvaluationContext>) => void
}

// ============================================================================
// Composable
// ============================================================================

export function useListRuntime(
  schema: Ref<ListViewSchema | null> | ListViewSchema,
  options: UseListRuntimeOptions = {}
): UseListRuntimeReturn {
  const {
    context = {},
    idField = 'id',
    fetchHandler,
    navigateHandler,
    emitHandler,
    actionHandler,
    initialData,
    debug = false,
    autoReinitialize = true,
  } = options

  // Internal state
  let runtime: ListRuntime | null = null
  const isInitialized = ref(false)
  const error = ref<ListRuntimeError | null>(null)

  // List state (refs for reactivity)
  const rows = ref<readonly Record<string, unknown>[]>([])
  const totalCount = ref(0)
  const currentPage = ref(1)
  const pageSize = ref(20)
  const sortField = ref<string | null>(null)
  const sortDirection = ref<'asc' | 'desc' | null>(null)
  const searchTerm = ref('')
  const filters = ref<Readonly<Record<string, unknown>>>({})
  const selectedIds = ref<ReadonlySet<string>>(new Set())
  const columns = ref<ReadonlyMap<string, ColumnMeta>>(new Map())
  const isLoading = ref(false)
  const isRefreshing = ref(false)
  const isAllSelectedInternal = ref(false)
  const isIndeterminateInternal = ref(false)

  // Computed
  const totalPages = computed(() => {
    if (totalCount.value === 0 || pageSize.value === 0) return 0
    return Math.ceil(totalCount.value / pageSize.value)
  })

  const isAllSelected = computed(() => isAllSelectedInternal.value)
  const isIndeterminate = computed(() => isIndeterminateInternal.value)

  const selectedRows = computed(() => {
    if (!runtime) return []
    return runtime.getSelectedRows()
  })

  // Initialize runtime
  const initialize = (viewSchema: ListViewSchema): void => {
    runtime = new ListRuntime(viewSchema, {
      context,
      idField,
      fetchHandler,
      navigateHandler,
      emitHandler,
      actionHandler,
      initialData,
      debug,
    })

    const result = runtime.initialize()

    if (isOk(result)) {
      isInitialized.value = true
      error.value = null
      syncState()

      // Subscribe to state changes
      runtime.subscribe((state) => {
        syncStateFromListState(state)
      })
    } else {
      error.value = result.error
      isInitialized.value = false
    }
  }

  // Sync runtime state to reactive state
  const syncState = (): void => {
    if (!runtime) return
    const state = runtime.getState()
    syncStateFromListState(state)
  }

  const syncStateFromListState = (state: ListState): void => {
    rows.value = state.rows
    totalCount.value = state.totalCount
    currentPage.value = state.currentPage
    pageSize.value = state.pageSize
    sortField.value = state.sortField
    sortDirection.value = state.sortDirection
    searchTerm.value = state.searchTerm
    filters.value = state.filters
    selectedIds.value = state.selectedIds
    columns.value = state.columns
    isLoading.value = state.isLoading
    isRefreshing.value = state.isRefreshing
    isAllSelectedInternal.value = state.isAllSelected
    isIndeterminateInternal.value = state.isIndeterminate
    if (state.error) {
      error.value = state.error
    }
  }

  // Dispatch event
  const dispatch = async (event: ListEvent): Promise<void> => {
    if (!runtime) return

    const result = await runtime.dispatch(event)
    if (result._tag === 'Err') {
      error.value = result.error
    }
  }

  // Pagination Actions
  const setPage = (page: number): void => {
    dispatch({ type: 'PAGE_CHANGE', page })
  }

  const setPageSize = (newPageSize: number): void => {
    dispatch({ type: 'PAGE_SIZE_CHANGE', pageSize: newPageSize })
  }

  // Sorting Actions
  const setSort = (field: string, direction: 'asc' | 'desc' | null): void => {
    dispatch({ type: 'SORT_CHANGE', field, direction })
  }

  const toggleSort = (field: string): void => {
    dispatch({ type: 'SORT_TOGGLE', field })
  }

  // Filtering Actions
  const setSearch = (term: string): void => {
    dispatch({ type: 'SEARCH_CHANGE', searchTerm: term })
  }

  const setFilter = (fieldId: string, value: unknown): void => {
    dispatch({ type: 'FILTER_CHANGE', fieldId, value })
  }

  const resetFilters = (): void => {
    dispatch({ type: 'FILTERS_RESET' })
  }

  // Selection Actions
  const selectRow = (rowId: string): void => {
    dispatch({ type: 'SELECT_ROW', rowId })
  }

  const deselectRow = (rowId: string): void => {
    dispatch({ type: 'DESELECT_ROW', rowId })
  }

  const toggleRow = (rowId: string): void => {
    dispatch({ type: 'TOGGLE_ROW', rowId })
  }

  const selectAll = (): void => {
    dispatch({ type: 'SELECT_ALL' })
  }

  const deselectAll = (): void => {
    dispatch({ type: 'DESELECT_ALL' })
  }

  // Row Interaction Actions
  const onRowClick = (rowId: string, row: Record<string, unknown>): void => {
    dispatch({ type: 'ROW_CLICK', rowId, row })
  }

  const onRowAction = (rowId: string, actionId: string, row: Record<string, unknown>): void => {
    dispatch({ type: 'ROW_ACTION', rowId, actionId, row })
  }

  const onBulkAction = (actionId: string): void => {
    dispatch({ type: 'BULK_ACTION', actionId, selectedIds: Array.from(selectedIds.value) })
  }

  // Data Actions
  const load = async (): Promise<void> => {
    await dispatch({ type: 'LOAD' })
  }

  const refresh = async (): Promise<void> => {
    await dispatch({ type: 'REFRESH' })
  }

  // Context
  const setContext = (context: Partial<EvaluationContext>): void => {
    if (runtime) {
      runtime.setContext(context)
      syncState()
    }
  }

  // Utility
  const getState = (): ListState => {
    if (!runtime) {
      return {
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
    }
    return runtime.getState()
  }

  const getColumn = (columnId: string): ColumnMeta | undefined => {
    return columns.value.get(columnId)
  }

  const isRowSelected = (rowId: string): boolean => {
    return selectedIds.value.has(rowId)
  }

  // Watch schema changes
  const isSchemaRef = (val: Ref<ListViewSchema | null> | ListViewSchema): val is Ref<ListViewSchema | null> => {
    return val !== null && typeof val === 'object' && 'value' in val
  }

  const schemaRef: Ref<ListViewSchema | null> = isSchemaRef(schema)
    ? schema
    : (ref(schema as ListViewSchema) as unknown as Ref<ListViewSchema | null>)

  watch(
    schemaRef,
    (newSchema) => {
      if (newSchema && autoReinitialize) {
        initialize(newSchema)
      }
    },
    { immediate: true }
  )

  // Cleanup - only register if inside a component
  if (getCurrentInstance()) {
    onUnmounted(() => {
      if (runtime) {
        runtime.dispose()
        runtime = null
      }
    })
  }

  return {
    // Data
    rows,
    totalCount,

    // Pagination
    currentPage,
    pageSize,
    totalPages,

    // Sorting
    sortField,
    sortDirection,

    // Filtering
    searchTerm,
    filters,

    // Selection
    selectedIds,
    selectedRows,
    isAllSelected,
    isIndeterminate,

    // Columns
    columns,

    // Loading states
    isLoading,
    isRefreshing,
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

    // Context
    setContext,

    // Utility
    getState,
    getColumn,
    isRowSelected,
  }
}
