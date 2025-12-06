/**
 * List Runtime Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ListRuntime } from '../list-runtime'
import type { ListViewSchema } from '@manifesto-ai/schema'
import type { ListState } from '../list-types'

// ============================================================================
// Test Fixtures
// ============================================================================

const createTestSchema = (overrides?: Partial<ListViewSchema>): ListViewSchema => ({
  _type: 'view',
  id: 'test-list',
  version: '0.1.0',
  name: 'Test List',
  entityRef: 'product',
  mode: 'list',
  columns: [
    { id: 'name', entityFieldId: 'name', type: 'text', label: '이름', sortable: true, filterable: true },
    { id: 'price', entityFieldId: 'price', type: 'number', label: '가격', sortable: true },
    { id: 'status', entityFieldId: 'status', type: 'enum', label: '상태' },
  ],
  dataSource: {
    type: 'static',
    static: [
      { id: '1', name: '상품 A', price: 1000, status: 'ACTIVE' },
      { id: '2', name: '상품 B', price: 2000, status: 'INACTIVE' },
      { id: '3', name: '상품 C', price: 3000, status: 'ACTIVE' },
      { id: '4', name: '상품 D', price: 4000, status: 'ACTIVE' },
      { id: '5', name: '상품 E', price: 5000, status: 'INACTIVE' },
    ],
  },
  pagination: {
    enabled: true,
    pageSize: 2,
    pageSizeOptions: [2, 5, 10],
    showTotal: true,
  },
  sorting: {
    enabled: true,
    defaultSort: { field: 'name', direction: 'asc' },
  },
  selection: {
    enabled: true,
    mode: 'multiple',
    showSelectAll: true,
  },
  ...overrides,
})

const createApiSchema = (overrides?: Partial<ListViewSchema>): ListViewSchema => ({
  ...createTestSchema(),
  dataSource: {
    type: 'api',
    api: {
      endpoint: '/api/products',
      method: 'GET',
    },
  },
  ...overrides,
})

// ============================================================================
// Tests
// ============================================================================

describe('ListRuntime', () => {
  describe('Initialization', () => {
    it('initializes with default state', () => {
      const schema = createTestSchema()
      const runtime = new ListRuntime(schema)
      const result = runtime.initialize()

      expect(result._tag).toBe('Ok')

      const state = runtime.getState()
      expect(state.currentPage).toBe(1)
      expect(state.pageSize).toBe(2)
      expect(state.sortField).toBe('name')
      expect(state.sortDirection).toBe('asc')
      expect(state.rows).toHaveLength(2) // 페이지네이션 적용
      expect(state.totalCount).toBe(5)
      expect(state.totalPages).toBe(3)
    })

    it('initializes column metadata', () => {
      const schema = createTestSchema()
      const runtime = new ListRuntime(schema)
      runtime.initialize()

      const state = runtime.getState()
      expect(state.columns.size).toBe(3)

      const nameColumn = state.columns.get('name')
      expect(nameColumn?.sortable).toBe(true)
      expect(nameColumn?.filterable).toBe(true)
      expect(nameColumn?.type).toBe('text')
    })

    it('uses custom pageSize from options', () => {
      const schema = createTestSchema({ pagination: { enabled: true, pageSize: 10 } })
      const runtime = new ListRuntime(schema)
      runtime.initialize()

      const state = runtime.getState()
      expect(state.pageSize).toBe(10)
    })
  })

  describe('Static Data Source', () => {
    describe('Pagination', () => {
      it('paginates data correctly', async () => {
        const schema = createTestSchema()
        const runtime = new ListRuntime(schema)
        runtime.initialize()

        let state = runtime.getState()
        expect(state.rows).toHaveLength(2)
        expect(state.currentPage).toBe(1)
        expect(state.totalPages).toBe(3)

        // 페이지 2로 이동
        await runtime.dispatch({ type: 'PAGE_CHANGE', page: 2 })

        state = runtime.getState()
        expect(state.currentPage).toBe(2)
        expect(state.rows).toHaveLength(2)
      })

      it('changes page size', async () => {
        const schema = createTestSchema()
        const runtime = new ListRuntime(schema)
        runtime.initialize()

        await runtime.dispatch({ type: 'PAGE_SIZE_CHANGE', pageSize: 5 })

        const state = runtime.getState()
        expect(state.pageSize).toBe(5)
        expect(state.currentPage).toBe(1) // 페이지 리셋
        expect(state.rows).toHaveLength(5)
        expect(state.totalPages).toBe(1)
      })
    })

    describe('Sorting', () => {
      it('sorts data ascending', async () => {
        const schema = createTestSchema()
        const runtime = new ListRuntime(schema)
        runtime.initialize()

        await runtime.dispatch({ type: 'SORT_CHANGE', field: 'price', direction: 'asc' })

        const state = runtime.getState()
        expect(state.sortField).toBe('price')
        expect(state.sortDirection).toBe('asc')
        expect((state.rows[0] as { price: number }).price).toBe(1000)
      })

      it('sorts data descending', async () => {
        const schema = createTestSchema()
        const runtime = new ListRuntime(schema)
        runtime.initialize()

        await runtime.dispatch({ type: 'SORT_CHANGE', field: 'price', direction: 'desc' })

        const state = runtime.getState()
        expect(state.sortDirection).toBe('desc')
        expect((state.rows[0] as { price: number }).price).toBe(5000)
      })

      it('toggles sort direction', async () => {
        const schema = createTestSchema()
        const runtime = new ListRuntime(schema)
        runtime.initialize()

        // 초기: name asc
        let state = runtime.getState()
        expect(state.sortField).toBe('name')
        expect(state.sortDirection).toBe('asc')

        // price로 변경 (asc)
        await runtime.dispatch({ type: 'SORT_TOGGLE', field: 'price' })
        state = runtime.getState()
        expect(state.sortField).toBe('price')
        expect(state.sortDirection).toBe('asc')

        // price 토글 (desc)
        await runtime.dispatch({ type: 'SORT_TOGGLE', field: 'price' })
        state = runtime.getState()
        expect(state.sortDirection).toBe('desc')

        // price 토글 (null - 정렬 해제)
        await runtime.dispatch({ type: 'SORT_TOGGLE', field: 'price' })
        state = runtime.getState()
        expect(state.sortField).toBeNull()
        expect(state.sortDirection).toBeNull()
      })
    })

    describe('Filtering', () => {
      it('filters by search term', async () => {
        const schema = createTestSchema()
        const runtime = new ListRuntime(schema)
        runtime.initialize()

        await runtime.dispatch({ type: 'SEARCH_CHANGE', searchTerm: '상품 A' })

        const state = runtime.getState()
        expect(state.searchTerm).toBe('상품 A')
        expect(state.totalCount).toBe(1)
        expect(state.rows).toHaveLength(1)
        expect((state.rows[0] as { name: string }).name).toBe('상품 A')
      })

      it('filters by field value', async () => {
        const schema = createTestSchema()
        const runtime = new ListRuntime(schema)
        runtime.initialize()

        await runtime.dispatch({ type: 'FILTER_CHANGE', fieldId: 'status', value: 'ACTIVE' })

        const state = runtime.getState()
        expect(state.totalCount).toBe(3)
        expect(state.rows.every(row => (row as { status: string }).status === 'ACTIVE')).toBe(true)
      })

      it('resets filters', async () => {
        const schema = createTestSchema()
        const runtime = new ListRuntime(schema)
        runtime.initialize()

        await runtime.dispatch({ type: 'SEARCH_CHANGE', searchTerm: '상품' })
        await runtime.dispatch({ type: 'FILTER_CHANGE', fieldId: 'status', value: 'ACTIVE' })

        let state = runtime.getState()
        expect(state.searchTerm).toBe('상품')
        expect(Object.keys(state.filters)).toHaveLength(1)

        await runtime.dispatch({ type: 'FILTERS_RESET' })

        state = runtime.getState()
        expect(state.searchTerm).toBe('')
        expect(Object.keys(state.filters)).toHaveLength(0)
        expect(state.totalCount).toBe(5)
      })
    })
  })

  describe('Selection', () => {
    it('selects a row', async () => {
      const schema = createTestSchema()
      const runtime = new ListRuntime(schema)
      runtime.initialize()

      await runtime.dispatch({ type: 'SELECT_ROW', rowId: '1' })

      const state = runtime.getState()
      expect(state.selectedIds.has('1')).toBe(true)
      expect(state.selectedIds.size).toBe(1)
    })

    it('deselects a row', async () => {
      const schema = createTestSchema()
      const runtime = new ListRuntime(schema)
      runtime.initialize()

      await runtime.dispatch({ type: 'SELECT_ROW', rowId: '1' })
      await runtime.dispatch({ type: 'DESELECT_ROW', rowId: '1' })

      const state = runtime.getState()
      expect(state.selectedIds.has('1')).toBe(false)
    })

    it('toggles row selection', async () => {
      const schema = createTestSchema()
      const runtime = new ListRuntime(schema)
      runtime.initialize()

      await runtime.dispatch({ type: 'TOGGLE_ROW', rowId: '1' })
      let state = runtime.getState()
      expect(state.selectedIds.has('1')).toBe(true)

      await runtime.dispatch({ type: 'TOGGLE_ROW', rowId: '1' })
      state = runtime.getState()
      expect(state.selectedIds.has('1')).toBe(false)
    })

    it('selects all rows on current page', async () => {
      const schema = createTestSchema()
      const runtime = new ListRuntime(schema)
      runtime.initialize()

      await runtime.dispatch({ type: 'SELECT_ALL' })

      const state = runtime.getState()
      expect(state.selectedIds.size).toBe(2) // pageSize = 2
      expect(state.isAllSelected).toBe(true)
    })

    it('deselects all rows', async () => {
      const schema = createTestSchema()
      const runtime = new ListRuntime(schema)
      runtime.initialize()

      await runtime.dispatch({ type: 'SELECT_ALL' })
      await runtime.dispatch({ type: 'DESELECT_ALL' })

      const state = runtime.getState()
      expect(state.selectedIds.size).toBe(0)
      expect(state.isAllSelected).toBe(false)
    })

    it('calculates isIndeterminate correctly', async () => {
      const schema = createTestSchema()
      const runtime = new ListRuntime(schema)
      runtime.initialize()

      await runtime.dispatch({ type: 'SELECT_ROW', rowId: '1' })

      const state = runtime.getState()
      expect(state.isIndeterminate).toBe(true)
      expect(state.isAllSelected).toBe(false)
    })

    it('single selection mode clears previous selection', async () => {
      const schema = createTestSchema({
        selection: { enabled: true, mode: 'single' },
      })
      const runtime = new ListRuntime(schema)
      runtime.initialize()

      await runtime.dispatch({ type: 'SELECT_ROW', rowId: '1' })
      await runtime.dispatch({ type: 'SELECT_ROW', rowId: '2' })

      const state = runtime.getState()
      expect(state.selectedIds.size).toBe(1)
      expect(state.selectedIds.has('2')).toBe(true)
      expect(state.selectedIds.has('1')).toBe(false)
    })

    it('getSelectedRows returns selected row data', async () => {
      const schema = createTestSchema()
      const runtime = new ListRuntime(schema)
      runtime.initialize()

      await runtime.dispatch({ type: 'SELECT_ROW', rowId: '1' })

      const selectedRows = runtime.getSelectedRows()
      expect(selectedRows).toHaveLength(1)
      expect((selectedRows[0] as { id: string }).id).toBe('1')
    })
  })

  describe('Actions', () => {
    it('handles row click action', async () => {
      const actionHandler = vi.fn()
      const schema = createTestSchema({
        rowClick: { type: 'custom', actionId: 'view' },
      })
      const runtime = new ListRuntime(schema, { actionHandler })
      runtime.initialize()

      const row = { id: '1', name: '상품 A', price: 1000 }
      await runtime.dispatch({ type: 'ROW_CLICK', rowId: '1', row })

      expect(actionHandler).toHaveBeenCalledWith('view', {
        row,
        selectedIds: ['1'],
      })
    })

    it('handles row action', async () => {
      const actionHandler = vi.fn()
      const schema = createTestSchema()
      const runtime = new ListRuntime(schema, { actionHandler })
      runtime.initialize()

      const row = { id: '1', name: '상품 A', price: 1000 }
      await runtime.dispatch({ type: 'ROW_ACTION', rowId: '1', actionId: 'edit', row })

      expect(actionHandler).toHaveBeenCalledWith('edit', {
        row,
        selectedIds: ['1'],
      })
    })

    it('handles bulk action', async () => {
      const actionHandler = vi.fn()
      const schema = createTestSchema()
      const runtime = new ListRuntime(schema, { actionHandler })
      runtime.initialize()

      await runtime.dispatch({ type: 'SELECT_ROW', rowId: '1' })
      await runtime.dispatch({ type: 'SELECT_ROW', rowId: '2' })
      await runtime.dispatch({ type: 'BULK_ACTION', actionId: 'delete', selectedIds: ['1', '2'] })

      expect(actionHandler).toHaveBeenCalledWith('delete', expect.objectContaining({
        selectedIds: ['1', '2'],
      }))
    })
  })

  describe('API Data Source', () => {
    it('requires fetchHandler for API data source', async () => {
      const schema = createApiSchema()
      const runtime = new ListRuntime(schema)
      runtime.initialize()

      const result = await runtime.dispatch({ type: 'LOAD' })

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.type).toBe('SCHEMA_ERROR')
      }
    })

    it('fetches data from API', async () => {
      const mockData = {
        data: [
          { id: '1', name: 'API Product 1', price: 100 },
          { id: '2', name: 'API Product 2', price: 200 },
        ],
        total: 10,
      }

      const fetchHandler = vi.fn().mockResolvedValue(mockData)
      const schema = createApiSchema()
      const runtime = new ListRuntime(schema, { fetchHandler })
      runtime.initialize()

      await runtime.dispatch({ type: 'LOAD' })

      const state = runtime.getState()
      expect(state.rows).toHaveLength(2)
      expect(state.totalCount).toBe(10)
      expect(fetchHandler).toHaveBeenCalled()
    })

    it('handles API error', async () => {
      const fetchHandler = vi.fn().mockRejectedValue(new Error('Network error'))
      const schema = createApiSchema()
      const runtime = new ListRuntime(schema, { fetchHandler })
      runtime.initialize()

      const result = await runtime.dispatch({ type: 'LOAD' })

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.type).toBe('FETCH_ERROR')
      }

      const state = runtime.getState()
      expect(state.error).not.toBeNull()
    })

    it('builds query params (including custom params) and applies transform path', async () => {
      const fetchHandler = vi.fn().mockResolvedValue({
        payload: { items: [{ id: '10', name: 'Query Product' }], total: 7 },
      })

      const schema = createApiSchema({
        pagination: { enabled: true, pageSize: 5 },
        sorting: { enabled: true, defaultSort: { field: 'price', direction: 'desc' } },
        dataSource: {
          type: 'api',
          api: {
            endpoint: '/api/products',
            method: 'GET',
            params: { tenant: 'acme', pageSize: 99 },
            transform: { path: 'payload' },
          },
        },
      })

      const runtime = new ListRuntime(schema, { fetchHandler })
      runtime.initialize()

      // set an extra filter to ensure it is propagated
      await runtime.dispatch({ type: 'FILTER_CHANGE', fieldId: 'status', value: 'ACTIVE' })
      await runtime.dispatch({ type: 'LOAD' })

      expect(fetchHandler).toHaveBeenCalled()
      const [endpoint, options] = fetchHandler.mock.calls[0]!
      expect(endpoint).toContain('page=1')
      expect(endpoint).toContain('pageSize=99') // overridden by api.params
      expect(endpoint).toContain('sortField=price')
      expect(endpoint).toContain('sortDirection=desc')
      expect(endpoint).toContain('tenant=acme')
      expect(endpoint).toContain('status=ACTIVE')
      expect(options.method).toBe('GET')

      const state = runtime.getState()
      expect(state.rows[0]).toMatchObject({ id: '10', name: 'Query Product' })
      expect(state.totalCount).toBe(7)
    })

    it('sends POST body and evaluates expression params when mocked', async () => {
      const fetchHandler = vi.fn().mockResolvedValue({ data: [{ id: 'p1' }], total: 1 })

      const schema = createApiSchema({
        dataSource: {
          type: 'api',
          api: {
            endpoint: '/api/products',
            method: 'POST',
            params: { org: { _expr: ['CONCAT', 'org-', '$context.orgId'] } as any },
          },
        },
      })

      const runtime = new ListRuntime(schema, { fetchHandler, context: { context: { orgId: '001' } } })
      runtime.initialize()

      // Force the expression branch without relying on evaluator details
      vi.spyOn(runtime as unknown as { isExpression: (v: unknown) => boolean }, 'isExpression').mockReturnValue(true)
      vi.spyOn((runtime as unknown as { evaluator: { evaluate: (...args: any[]) => any } }).evaluator, 'evaluate').mockReturnValue({
        _tag: 'Ok',
        value: 'org-001',
      })

      await runtime.dispatch({ type: 'LOAD' })

      const [endpoint, options] = fetchHandler.mock.calls[0]!
      expect(endpoint).toBe('/api/products')
      expect(options.method).toBe('POST')
      expect(options.body).toMatchObject({ org: 'org-001' })
    })

    it('returns SCHEMA_ERROR when api configuration is missing', async () => {
      const schema = createTestSchema({
        dataSource: {
          type: 'api',
          // intentionally omit api config
        } as any,
      })
      const runtime = new ListRuntime(schema, { fetchHandler: vi.fn() })
      runtime.initialize()

      const result = await runtime.dispatch({ type: 'LOAD' })
      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.type).toBe('SCHEMA_ERROR')
      }
    })
  })

  describe('State Subscription', () => {
    it('notifies listeners on state change', async () => {
      const listener = vi.fn()
      const schema = createTestSchema()
      const runtime = new ListRuntime(schema)
      runtime.initialize()

      runtime.subscribe(listener)

      await runtime.dispatch({ type: 'PAGE_CHANGE', page: 2 })

      expect(listener).toHaveBeenCalled()
      const lastCallState = listener.mock.calls[listener.mock.calls.length - 1][0] as ListState
      expect(lastCallState.currentPage).toBe(2)
    })

    it('unsubscribes listener', async () => {
      const listener = vi.fn()
      const schema = createTestSchema()
      const runtime = new ListRuntime(schema)
      runtime.initialize()

      const unsubscribe = runtime.subscribe(listener)
      unsubscribe()

      await runtime.dispatch({ type: 'PAGE_CHANGE', page: 2 })

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('Dispose', () => {
    it('clears state on dispose', () => {
      const schema = createTestSchema()
      const runtime = new ListRuntime(schema)
      runtime.initialize()

      runtime.dispose()

      const state = runtime.getState()
      expect(state.rows).toHaveLength(0)
      expect(state.columns.size).toBe(0)
      expect(state.selectedIds.size).toBe(0)
    })
  })

  describe('Edge cases', () => {
    it('re-evaluates column visibility when context changes', () => {
      const schema = createTestSchema({
        columns: [
          { id: 'name', entityFieldId: 'name', type: 'text', label: '이름', hidden: ['==', '$context.hideName', true] },
        ],
      })
      const runtime = new ListRuntime(schema, { context: { context: { hideName: true } } })
      runtime.initialize()

      let state = runtime.getState()
      expect(state.columns.get('name')?.hidden).toBe(true)

      runtime.setContext({ context: { hideName: false } })
      state = runtime.getState()
      expect(state.columns.get('name')?.hidden).toBe(false)
    })

    it('applies array filters and clears empty filter values', async () => {
      const runtime = new ListRuntime(createTestSchema())
      runtime.initialize()

      await runtime.dispatch({ type: 'FILTER_CHANGE', fieldId: 'status', value: ['ACTIVE'] })
      let state = runtime.getState()
      expect(state.totalCount).toBe(3)
      expect(state.filters['status']).toEqual(['ACTIVE'])

      await runtime.dispatch({ type: 'FILTER_CHANGE', fieldId: 'status', value: '' })
      state = runtime.getState()
      expect(state.filters['status']).toBeUndefined()
    })

    it('ignores filters for unknown fields', async () => {
      const runtime = new ListRuntime(createTestSchema())
      runtime.initialize()

      await runtime.dispatch({ type: 'FILTER_CHANGE', fieldId: 'missing', value: 'x' })
      const state = runtime.getState()
      expect(state.totalCount).toBe(5)
    })

    it('returns ACTION_ERROR when action handlers throw (row and bulk)', async () => {
      const actionHandler = vi.fn().mockRejectedValue(new Error('boom'))
      const runtime = new ListRuntime(createTestSchema(), { actionHandler })
      runtime.initialize()

      const rowResult = await runtime.dispatch({
        type: 'ROW_ACTION',
        rowId: '1',
        actionId: 'edit',
        row: { id: '1' },
      })
      expect(rowResult._tag).toBe('Err')
      if (rowResult._tag === 'Err') {
        expect(rowResult.error.type).toBe('ACTION_ERROR')
      }

      const bulkResult = await runtime.dispatch({
        type: 'BULK_ACTION',
        actionId: 'delete',
        selectedIds: ['1', '2'],
      })
      expect(bulkResult._tag).toBe('Err')
      if (bulkResult._tag === 'Err') {
        expect(bulkResult.error.type).toBe('ACTION_ERROR')
      }
    })

    it('recovers sort toggle when sortDirection is null', async () => {
      const runtime = new ListRuntime(createTestSchema())
      runtime.initialize()

      // force null sort state
      ;(runtime as unknown as { sortField: string | null }).sortField = 'price'
      ;(runtime as unknown as { sortDirection: 'asc' | 'desc' | null }).sortDirection = null

      await runtime.dispatch({ type: 'SORT_TOGGLE', field: 'price' })

      const state = runtime.getState()
      expect(state.sortField).toBe('price')
      expect(state.sortDirection).toBe('asc')
    })

    it('clears sort when SORT_CHANGE passes null direction', async () => {
      const runtime = new ListRuntime(createTestSchema())
      runtime.initialize()

      await runtime.dispatch({ type: 'SORT_CHANGE', field: 'price', direction: null })
      const state = runtime.getState()
      expect(state.sortField).toBeNull()
      expect(state.sortDirection).toBeNull()
    })

    it('captures unexpected errors during dispatch and updates error state', async () => {
      const runtime = new ListRuntime(createTestSchema())
      runtime.initialize()

      const listener = vi.fn()
      runtime.subscribe(listener)

      ;(runtime as unknown as { fetchData: () => Promise<unknown> }).fetchData = vi.fn(async () => {
        throw new Error('boom')
      })

      const result = await runtime.dispatch({ type: 'LOAD' })

      expect(result._tag).toBe('Err')
      const state = runtime.getState()
      expect(state.error?.type).toBe('FETCH_ERROR')
      expect(listener).toHaveBeenCalled()
    })

    it('skips row click when no action handler is provided', async () => {
      const schema = createTestSchema({ rowClick: { type: 'custom', actionId: 'noop' } })
      const runtime = new ListRuntime(schema)
      runtime.initialize()

      const result = await runtime.dispatch({ type: 'ROW_CLICK', rowId: '1', row: { id: '1' } })
      expect(result._tag).toBe('Ok')
    })

    it('merges context values in setContext and applies initialData override', () => {
      const schema = createTestSchema({
        dataSource: {
          type: 'static',
          static: [],
        },
      })
      const runtime = new ListRuntime(schema, {
        initialData: [{ id: 'init', name: '초기' }],
        context: { context: { foo: 'bar' } },
      })
      runtime.initialize()

      runtime.setContext({
        context: { foo: 'baz' },
        user: { id: 'u1' },
        params: { pid: 'p1' },
        env: { region: 'kr' },
      })

      const state = runtime.getState()
      expect(state.rows[0]).toMatchObject({ id: 'init' })
      expect((runtime as any).baseContext.context.foo).toBe('baz')
      expect((runtime as any).baseContext.user.id).toBe('u1')
      expect((runtime as any).baseContext.params.pid).toBe('p1')
      expect((runtime as any).baseContext.env.region).toBe('kr')
    })
  })
})
