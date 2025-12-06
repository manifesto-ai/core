/**
 * List Runtime
 *
 * 리스트 상태 관리 및 데이터 페칭 조율
 */

import type {
  ListViewSchema,
  ListColumn,
  Result,
  Expression,
  TransformConfig,
} from '@manifesto-ai/schema'
import { ok, err } from '@manifesto-ai/schema'
import { createEvaluator, type EvaluationContext, type ExpressionEvaluator } from '../evaluator'

import type {
  ListState,
  ListEvent,
  ListRuntimeError,
  ListRuntimeOptions,
  ListChangeListener,
  ColumnMeta,
  ListFetchResponse,
} from './list-types'

// ============================================================================
// List Runtime
// ============================================================================

export class ListRuntime {
  private schema: ListViewSchema
  private evaluator: ExpressionEvaluator

  // Data
  private rows: Record<string, unknown>[] = []
  private totalCount = 0

  // Pagination
  private currentPage = 1
  private pageSize = 20

  // Sorting
  private sortField: string | null = null
  private sortDirection: 'asc' | 'desc' | null = null

  // Filtering
  private searchTerm = ''
  private filters: Record<string, unknown> = {}

  // Selection
  private selectedIds: Set<string> = new Set()

  // Column metadata
  private columnMetas: Map<string, ColumnMeta> = new Map()

  // Loading states
  private isLoading = false
  private isRefreshing = false
  private error: ListRuntimeError | null = null

  // Listeners
  private listeners: Set<ListChangeListener> = new Set()

  // Options
  private options: ListRuntimeOptions & {
    idField: string
    debug: boolean
  }

  private baseContext: EvaluationContext

  constructor(schema: ListViewSchema, options: ListRuntimeOptions = {}) {
    this.schema = schema
    this.evaluator = createEvaluator({ debug: options.debug })

    this.options = {
      ...options,
      idField: options.idField ?? 'id',
      debug: options.debug ?? false,
    }

    this.baseContext = {
      state: {},
      context: options.context?.context ?? {},
      user: options.context?.user ?? {},
      params: options.context?.params ?? {},
      result: options.context?.result ?? {},
      env: options.context?.env ?? {},
    }

    // 페이지네이션 초기값 설정
    if (schema.pagination?.pageSize) {
      this.pageSize = schema.pagination.pageSize
    }

    // 정렬 초기값 설정
    if (schema.sorting?.defaultSort) {
      this.sortField = schema.sorting.defaultSort.field
      this.sortDirection = schema.sorting.defaultSort.direction
    }
  }

  /**
   * 런타임 초기화
   */
  initialize(): Result<void, ListRuntimeError> {
    this.log('Initializing ListRuntime', { schemaId: this.schema.id })

    // 컬럼 메타 초기화
    for (const column of this.schema.columns) {
      this.columnMetas.set(column.id, this.createColumnMeta(column))
    }

    // Static 데이터 소스인 경우 초기 데이터 설정
    if (this.schema.dataSource.type === 'static') {
      const staticData = this.options.initialData ?? this.schema.dataSource.static ?? []
      this.setStaticData(staticData as Record<string, unknown>[])
    }

    return ok(undefined)
  }

  /**
   * 런타임 정리
   */
  dispose(): void {
    this.listeners.clear()
    this.rows = []
    this.selectedIds.clear()
    this.columnMetas.clear()
  }

  /**
   * 이벤트 처리 (비동기)
   */
  async dispatch(event: ListEvent): Promise<Result<void, ListRuntimeError>> {
    try {
      switch (event.type) {
        // Pagination
        case 'PAGE_CHANGE':
          return await this.handlePageChange(event.page)

        case 'PAGE_SIZE_CHANGE':
          return await this.handlePageSizeChange(event.pageSize)

        // Sorting
        case 'SORT_CHANGE':
          return await this.handleSortChange(event.field, event.direction)

        case 'SORT_TOGGLE':
          return await this.handleSortToggle(event.field)

        // Filtering
        case 'SEARCH_CHANGE':
          return await this.handleSearchChange(event.searchTerm)

        case 'FILTER_CHANGE':
          return await this.handleFilterChange(event.fieldId, event.value)

        case 'FILTERS_RESET':
          return await this.handleFiltersReset()

        // Selection
        case 'SELECT_ROW':
          return this.handleSelectRow(event.rowId)

        case 'DESELECT_ROW':
          return this.handleDeselectRow(event.rowId)

        case 'TOGGLE_ROW':
          return this.handleToggleRow(event.rowId)

        case 'SELECT_ALL':
          return this.handleSelectAll()

        case 'DESELECT_ALL':
          return this.handleDeselectAll()

        // Row interactions
        case 'ROW_CLICK':
          return await this.handleRowClick(event.rowId, event.row)

        case 'ROW_ACTION':
          return await this.handleRowAction(event.rowId, event.actionId, event.row)

        // Bulk actions
        case 'BULK_ACTION':
          return await this.handleBulkAction(event.actionId, event.selectedIds)

        // Data operations
        case 'LOAD':
          return await this.handleLoad()

        case 'REFRESH':
          return await this.handleRefresh()

        default:
          return ok(undefined)
      }
    } catch (e) {
      const error: ListRuntimeError = {
        type: 'FETCH_ERROR',
        message: e instanceof Error ? e.message : 'Unknown error',
        cause: e,
      }
      this.error = error
      this.notifyListeners()
      return err(error)
    }
  }

  /**
   * 현재 상태 반환
   */
  getState(): ListState {
    const totalPages = Math.ceil(this.totalCount / this.pageSize) || 1
    const rowIds = this.rows.map(row => this.getRowId(row))
    const selectedInCurrentPage = rowIds.filter(id => this.selectedIds.has(id))

    return {
      rows: [...this.rows],
      totalCount: this.totalCount,
      currentPage: this.currentPage,
      pageSize: this.pageSize,
      totalPages,
      sortField: this.sortField,
      sortDirection: this.sortDirection,
      searchTerm: this.searchTerm,
      filters: { ...this.filters },
      selectedIds: new Set(this.selectedIds),
      isAllSelected: rowIds.length > 0 && selectedInCurrentPage.length === rowIds.length,
      isIndeterminate: selectedInCurrentPage.length > 0 && selectedInCurrentPage.length < rowIds.length,
      isLoading: this.isLoading,
      isRefreshing: this.isRefreshing,
      error: this.error,
      columns: new Map(this.columnMetas),
    }
  }

  /**
   * 선택된 행 데이터 반환
   */
  getSelectedRows(): Record<string, unknown>[] {
    return this.rows.filter(row => this.selectedIds.has(this.getRowId(row)))
  }

  /**
   * 상태 변경 리스너 등록
   */
  subscribe(listener: ListChangeListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * 컨텍스트 업데이트 (hidden Expression 재평가)
   */
  setContext(context: Partial<EvaluationContext>): void {
    // baseContext를 새 객체로 재생성
    this.baseContext = {
      state: this.baseContext.state,
      context: context.context !== undefined
        ? { ...this.baseContext.context, ...context.context }
        : this.baseContext.context,
      user: context.user !== undefined
        ? { ...this.baseContext.user, ...context.user }
        : this.baseContext.user,
      params: context.params !== undefined
        ? { ...this.baseContext.params, ...context.params }
        : this.baseContext.params,
      result: this.baseContext.result,
      env: context.env !== undefined
        ? { ...this.baseContext.env, ...context.env }
        : this.baseContext.env,
    }

    // 컬럼 visibility 재평가
    this.updateColumnVisibility()
  }

  /**
   * 컬럼 visibility 업데이트 (hidden Expression 재평가)
   */
  private updateColumnVisibility(): void {
    for (const column of this.schema.columns) {
      const meta = this.createColumnMeta(column)
      this.columnMetas.set(column.id, meta)
    }
    this.notifyListeners()
  }

  // ============================================================================
  // Private - Event Handlers
  // ============================================================================

  private async handlePageChange(page: number): Promise<Result<void, ListRuntimeError>> {
    this.currentPage = page
    return await this.fetchData()
  }

  private async handlePageSizeChange(pageSize: number): Promise<Result<void, ListRuntimeError>> {
    this.pageSize = pageSize
    this.currentPage = 1 // 페이지 크기 변경 시 첫 페이지로
    return await this.fetchData()
  }

  private async handleSortChange(
    field: string,
    direction: 'asc' | 'desc' | null
  ): Promise<Result<void, ListRuntimeError>> {
    this.sortField = direction ? field : null
    this.sortDirection = direction
    this.currentPage = 1 // 정렬 변경 시 첫 페이지로
    return await this.fetchData()
  }

  private async handleSortToggle(field: string): Promise<Result<void, ListRuntimeError>> {
    if (this.sortField !== field) {
      // 다른 필드: asc로 시작
      this.sortField = field
      this.sortDirection = 'asc'
    } else if (this.sortDirection === 'asc') {
      // asc -> desc
      this.sortDirection = 'desc'
    } else if (this.sortDirection === 'desc') {
      // desc -> null (정렬 해제)
      this.sortField = null
      this.sortDirection = null
    } else {
      // null -> asc
      this.sortField = field
      this.sortDirection = 'asc'
    }

    this.currentPage = 1
    return await this.fetchData()
  }

  private async handleSearchChange(searchTerm: string): Promise<Result<void, ListRuntimeError>> {
    this.searchTerm = searchTerm
    this.currentPage = 1
    return await this.fetchData()
  }

  private async handleFilterChange(
    fieldId: string,
    value: unknown
  ): Promise<Result<void, ListRuntimeError>> {
    if (value === undefined || value === null || value === '') {
      delete this.filters[fieldId]
    } else {
      this.filters[fieldId] = value
    }
    this.currentPage = 1
    return await this.fetchData()
  }

  private async handleFiltersReset(): Promise<Result<void, ListRuntimeError>> {
    this.filters = {}
    this.searchTerm = ''
    this.currentPage = 1
    return await this.fetchData()
  }

  private handleSelectRow(rowId: string): Result<void, ListRuntimeError> {
    const mode = this.schema.selection?.mode ?? 'multiple'

    if (mode === 'single') {
      this.selectedIds.clear()
    }

    this.selectedIds.add(rowId)
    this.notifyListeners()
    return ok(undefined)
  }

  private handleDeselectRow(rowId: string): Result<void, ListRuntimeError> {
    this.selectedIds.delete(rowId)
    this.notifyListeners()
    return ok(undefined)
  }

  private handleToggleRow(rowId: string): Result<void, ListRuntimeError> {
    if (this.selectedIds.has(rowId)) {
      return this.handleDeselectRow(rowId)
    } else {
      return this.handleSelectRow(rowId)
    }
  }

  private handleSelectAll(): Result<void, ListRuntimeError> {
    for (const row of this.rows) {
      this.selectedIds.add(this.getRowId(row))
    }
    this.notifyListeners()
    return ok(undefined)
  }

  private handleDeselectAll(): Result<void, ListRuntimeError> {
    const currentRowIds = this.rows.map(row => this.getRowId(row))
    for (const id of currentRowIds) {
      this.selectedIds.delete(id)
    }
    this.notifyListeners()
    return ok(undefined)
  }

  private async handleRowClick(
    rowId: string,
    row: Record<string, unknown>
  ): Promise<Result<void, ListRuntimeError>> {
    const rowClickAction = this.schema.rowClick

    if (rowClickAction && this.options.actionHandler) {
      try {
        await this.options.actionHandler(rowClickAction.actionId ?? 'row-click', {
          row,
          selectedIds: [rowId],
        })
      } catch (e) {
        return err({
          type: 'ACTION_ERROR',
          message: e instanceof Error ? e.message : 'Row click action failed',
          actionId: rowClickAction.actionId ?? 'row-click',
          cause: e,
        })
      }
    }

    return ok(undefined)
  }

  private async handleRowAction(
    rowId: string,
    actionId: string,
    row: Record<string, unknown>
  ): Promise<Result<void, ListRuntimeError>> {
    if (this.options.actionHandler) {
      try {
        await this.options.actionHandler(actionId, {
          row,
          selectedIds: [rowId],
        })
      } catch (e) {
        return err({
          type: 'ACTION_ERROR',
          message: e instanceof Error ? e.message : 'Row action failed',
          actionId,
          cause: e,
        })
      }
    }

    return ok(undefined)
  }

  private async handleBulkAction(
    actionId: string,
    selectedIds: readonly string[]
  ): Promise<Result<void, ListRuntimeError>> {
    if (this.options.actionHandler) {
      const selectedRows = this.rows.filter(row =>
        selectedIds.includes(this.getRowId(row))
      )

      try {
        await this.options.actionHandler(actionId, {
          rows: selectedRows,
          selectedIds: [...selectedIds],
        })
      } catch (e) {
        return err({
          type: 'ACTION_ERROR',
          message: e instanceof Error ? e.message : 'Bulk action failed',
          actionId,
          cause: e,
        })
      }
    }

    return ok(undefined)
  }

  private async handleLoad(): Promise<Result<void, ListRuntimeError>> {
    this.isLoading = true
    this.error = null
    this.notifyListeners()

    const result = await this.fetchData()

    this.isLoading = false
    this.notifyListeners()

    return result
  }

  private async handleRefresh(): Promise<Result<void, ListRuntimeError>> {
    this.isRefreshing = true
    this.error = null
    this.notifyListeners()

    const result = await this.fetchData()

    this.isRefreshing = false
    this.notifyListeners()

    return result
  }

  // ============================================================================
  // Private - Data Fetching
  // ============================================================================

  private async fetchData(): Promise<Result<void, ListRuntimeError>> {
    if (this.schema.dataSource.type === 'api') {
      return await this.fetchApiData()
    } else {
      return this.processStaticData()
    }
  }

  private async fetchApiData(): Promise<Result<void, ListRuntimeError>> {
    const apiConfig = this.schema.dataSource.api

    if (!apiConfig) {
      return err({
        type: 'SCHEMA_ERROR',
        message: 'API configuration is missing',
      })
    }

    if (!this.options.fetchHandler) {
      return err({
        type: 'SCHEMA_ERROR',
        message: 'fetchHandler is required for API data source',
      })
    }

    try {
      // 요청 파라미터 구성
      const params: Record<string, unknown> = {
        page: this.currentPage,
        pageSize: this.pageSize,
      }

      if (this.sortField) {
        params.sortField = this.sortField
        params.sortDirection = this.sortDirection
      }

      if (this.searchTerm) {
        params.search = this.searchTerm
      }

      // 필터 추가
      Object.assign(params, this.filters)

      // 스키마 파라미터 평가 및 추가
      if (apiConfig.params) {
        for (const [key, value] of Object.entries(apiConfig.params)) {
          if (this.isExpression(value)) {
            const evalResult = this.evaluator.evaluate(value as Expression, this.createEvalContext())
            if (evalResult._tag === 'Ok') {
              params[key] = evalResult.value
            }
          } else {
            params[key] = value
          }
        }
      }

      // API 호출
      const method = apiConfig.method ?? 'GET'
      let endpoint = apiConfig.endpoint

      // GET 요청인 경우 쿼리스트링으로 변환
      const requestOptions: { method: string; body?: unknown } = { method }

      if (method === 'GET') {
        const queryString = new URLSearchParams(
          Object.entries(params).reduce((acc, [k, v]) => {
            if (v !== undefined && v !== null) {
              acc[k] = String(v)
            }
            return acc
          }, {} as Record<string, string>)
        ).toString()
        if (queryString) {
          endpoint = `${endpoint}?${queryString}`
        }
      } else {
        requestOptions.body = params
      }

      const response = await this.options.fetchHandler(endpoint, requestOptions)

      // Transform 적용
      const { rows, total } = this.transformResponse(response, apiConfig.transform)

      this.rows = rows
      this.totalCount = total
      this.error = null

      this.notifyListeners()
      return ok(undefined)
    } catch (e) {
      const error: ListRuntimeError = {
        type: 'FETCH_ERROR',
        message: e instanceof Error ? e.message : 'Failed to fetch data',
        cause: e,
      }
      this.error = error
      this.notifyListeners()
      return err(error)
    }
  }

  private processStaticData(): Result<void, ListRuntimeError> {
    let data = [...(this.options.initialData ?? this.schema.dataSource.static ?? [])] as Record<string, unknown>[]

    // 1. 검색 적용
    if (this.searchTerm) {
      data = this.applyClientSideSearch(data)
    }

    // 2. 필터 적용
    data = this.applyClientSideFilters(data)

    // 3. 정렬 적용
    if (this.sortField) {
      data = this.applyClientSideSort(data)
    }

    const total = data.length

    // 4. 페이지네이션 적용
    if (this.schema.pagination?.enabled !== false) {
      data = this.applyClientSidePagination(data)
    }

    this.rows = data
    this.totalCount = total
    this.error = null

    this.notifyListeners()
    return ok(undefined)
  }

  private setStaticData(_data: Record<string, unknown>[]): void {
    // 초기 데이터 설정 (페이지네이션/정렬/필터 적용)
    // _data는 initialData 또는 schema.dataSource.static에서 이미 설정되어 있음
    this.processStaticData()
  }

  // ============================================================================
  // Private - Client-side Operations
  // ============================================================================

  private applyClientSideSearch(data: Record<string, unknown>[]): Record<string, unknown>[] {
    const term = this.searchTerm.toLowerCase()

    // 검색 가능한 컬럼들 (text, enum 타입)
    const searchableColumns = this.schema.columns.filter(
      col => col.filterable !== false && ['text', 'enum', 'link'].includes(col.type)
    )

    return data.filter(row => {
      for (const col of searchableColumns) {
        const value = row[col.entityFieldId]
        if (value && String(value).toLowerCase().includes(term)) {
          return true
        }
      }
      return false
    })
  }

  private applyClientSideFilters(data: Record<string, unknown>[]): Record<string, unknown>[] {
    if (Object.keys(this.filters).length === 0) {
      return data
    }

    return data.filter(row => {
      for (const [fieldId, filterValue] of Object.entries(this.filters)) {
        const column = this.schema.columns.find(c => c.id === fieldId || c.entityFieldId === fieldId)
        if (!column) continue

        const rowValue = row[column.entityFieldId]

        // 배열 필터 (다중 선택)
        if (Array.isArray(filterValue)) {
          if (!filterValue.includes(rowValue)) {
            return false
          }
        }
        // 단일 값 필터
        else if (rowValue !== filterValue) {
          return false
        }
      }
      return true
    })
  }

  private applyClientSideSort(data: Record<string, unknown>[]): Record<string, unknown>[] {
    if (!this.sortField || !this.sortDirection) {
      return data
    }

    const column = this.schema.columns.find(
      c => c.id === this.sortField || c.entityFieldId === this.sortField
    )

    if (!column) {
      return data
    }

    const fieldId = column.entityFieldId
    const direction = this.sortDirection === 'asc' ? 1 : -1

    return [...data].sort((a, b) => {
      const aVal = a[fieldId]
      const bVal = b[fieldId]

      if (aVal === bVal) return 0
      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * direction
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * direction
      }

      // Date comparison
      if (aVal instanceof Date && bVal instanceof Date) {
        return (aVal.getTime() - bVal.getTime()) * direction
      }

      return String(aVal).localeCompare(String(bVal)) * direction
    })
  }

  private applyClientSidePagination(data: Record<string, unknown>[]): Record<string, unknown>[] {
    const start = (this.currentPage - 1) * this.pageSize
    const end = start + this.pageSize
    return data.slice(start, end)
  }

  // ============================================================================
  // Private - Utilities
  // ============================================================================

  private createColumnMeta(column: ListColumn): ColumnMeta {
    // hidden Expression 평가
    let hidden = false
    if (column.hidden !== undefined) {
      if (typeof column.hidden === 'boolean') {
        hidden = column.hidden
      } else if (Array.isArray(column.hidden)) {
        // Expression 배열 평가
        const evalResult = this.evaluator.evaluate(column.hidden as Expression, this.createEvalContext())
        if (evalResult._tag === 'Ok') {
          hidden = Boolean(evalResult.value)
        }
      }
    }

    return {
      id: column.id,
      entityFieldId: column.entityFieldId,
      label: column.label,
      type: column.type,
      width: column.width,
      minWidth: column.minWidth,
      maxWidth: column.maxWidth,
      sortable: column.sortable ?? false,
      filterable: column.filterable ?? false,
      hidden,
      align: column.align ?? 'left',
    }
  }

  private getRowId(row: Record<string, unknown>): string {
    const id = row[this.options.idField]
    return String(id ?? '')
  }

  private createEvalContext(): EvaluationContext {
    return {
      ...this.baseContext,
      state: {
        rows: this.rows,
        totalCount: this.totalCount,
        currentPage: this.currentPage,
        pageSize: this.pageSize,
        sortField: this.sortField,
        sortDirection: this.sortDirection,
        searchTerm: this.searchTerm,
        filters: this.filters,
        selectedIds: Array.from(this.selectedIds),
      },
    }
  }

  private isExpression(value: unknown): value is Expression {
    return typeof value === 'object' && value !== null && '_expr' in value
  }

  private transformResponse(
    response: unknown,
    transform?: TransformConfig
  ): ListFetchResponse {
    if (!transform) {
      // 기본 변환: response가 배열이면 그대로 사용
      if (Array.isArray(response)) {
        return { rows: response, total: response.length }
      }

      // 기본 구조: { data: [], total: number }
      const res = response as Record<string, unknown>
      return {
        rows: (res.data ?? res.items ?? res.rows ?? []) as Record<string, unknown>[],
        total: (res.total ?? res.totalCount ?? res.count ?? 0) as number,
      }
    }

    // Transform path 적용
    let data = response as Record<string, unknown>

    if (transform.path) {
      const paths = transform.path.split('.')
      for (const p of paths) {
        data = data?.[p] as Record<string, unknown>
      }
    }

    if (Array.isArray(data)) {
      return { rows: data, total: data.length }
    }

    return {
      rows: (data?.items ?? data?.data ?? []) as Record<string, unknown>[],
      total: (data?.total ?? 0) as number,
    }
  }

  private notifyListeners(): void {
    const state = this.getState()
    for (const listener of this.listeners) {
      listener(state)
    }
  }

  // ============================================================================
  // Debug
  // ============================================================================

  private log(...args: unknown[]): void {
    if (this.options.debug) {
      console.log('[ListRuntime]', ...args)
    }
  }
}
