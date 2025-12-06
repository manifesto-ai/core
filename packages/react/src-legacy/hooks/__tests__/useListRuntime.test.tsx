import { describe, test, expect, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useListRuntime } from '../useListRuntime'
import type { ListViewSchema, ListColumn } from '@manifesto-ai/schema'

// Test fixtures
const createTestListSchema = (
  columns: ListColumn[],
  options: Partial<ListViewSchema> = {}
): ListViewSchema => ({
  _type: 'view',
  id: 'test-list',
  name: 'Test List',
  version: '0.1.0',
  entityRef: 'test-entity',
  mode: 'list',
  columns,
  dataSource: {
    type: 'static',
    static: [
      { id: '1', name: 'Item 1', status: 'active' },
      { id: '2', name: 'Item 2', status: 'inactive' },
      { id: '3', name: 'Item 3', status: 'active' },
    ],
  },
  pagination: {
    enabled: true,
    pageSize: 10,
    pageSizeOptions: [5, 10, 20],
  },
  selection: {
    enabled: true,
    mode: 'multiple',
  },
  ...options,
})

const createTestColumn = (
  id: string,
  options: Partial<ListColumn> = {}
): ListColumn => ({
  id,
  entityFieldId: id,
  header: id.charAt(0).toUpperCase() + id.slice(1),
  ...options,
})

describe('useListRuntime', () => {
  let schema: ListViewSchema

  beforeEach(() => {
    schema = createTestListSchema([
      createTestColumn('name'),
      createTestColumn('status'),
    ])
  })

  describe('Initialization', () => {
    test('initializes with schema', () => {
      const { result } = renderHook(() => useListRuntime(schema))

      expect(result.current.isInitialized).toBe(true)
      expect(result.current.error).toBe(null)
    })

    test('initializes with static data', () => {
      const { result } = renderHook(() => useListRuntime(schema))

      expect(result.current.rows.length).toBe(3)
      expect(result.current.totalCount).toBe(3)
    })

    test('initializes with null schema', () => {
      const { result } = renderHook(() => useListRuntime(null))

      expect(result.current.isInitialized).toBe(false)
      expect(result.current.rows.length).toBe(0)
    })

    test('provides column metadata', () => {
      const { result } = renderHook(() => useListRuntime(schema))

      expect(result.current.columns.size).toBe(2)
      expect(result.current.columns.has('name')).toBe(true)
      expect(result.current.columns.has('status')).toBe(true)
    })
  })

  describe('Pagination', () => {
    test('initializes with default page values', () => {
      const { result } = renderHook(() => useListRuntime(schema))

      expect(result.current.currentPage).toBe(1)
      expect(result.current.pageSize).toBe(10)
    })

    test('setPage changes current page', async () => {
      const schemaWithMoreData = createTestListSchema(
        [createTestColumn('name')],
        {
          dataSource: {
            type: 'static',
            static: Array.from({ length: 25 }, (_, i) => ({
              id: String(i + 1),
              name: `Item ${i + 1}`,
            })),
          },
        }
      )

      const { result } = renderHook(() => useListRuntime(schemaWithMoreData))

      expect(result.current.currentPage).toBe(1)

      await act(async () => {
        result.current.setPage(2)
      })

      await waitFor(() => {
        expect(result.current.currentPage).toBe(2)
      })
    })

    test('setPageSize changes page size', async () => {
      const { result } = renderHook(() => useListRuntime(schema))

      expect(result.current.pageSize).toBe(10)

      await act(async () => {
        result.current.setPageSize(20)
      })

      await waitFor(() => {
        expect(result.current.pageSize).toBe(20)
      })
    })

    test('totalPages computed correctly', () => {
      const schemaWithMoreData = createTestListSchema(
        [createTestColumn('name')],
        {
          dataSource: {
            type: 'static',
            static: Array.from({ length: 25 }, (_, i) => ({
              id: String(i + 1),
              name: `Item ${i + 1}`,
            })),
          },
        }
      )

      const { result } = renderHook(() => useListRuntime(schemaWithMoreData))

      expect(result.current.totalPages).toBe(3) // 25 items / 10 per page = 3 pages
    })
  })

  describe('Sorting', () => {
    test('initializes with no sorting', () => {
      const { result } = renderHook(() => useListRuntime(schema))

      expect(result.current.sortField).toBe(null)
      expect(result.current.sortDirection).toBe(null)
    })

    test('setSort sets sort field and direction', async () => {
      const { result } = renderHook(() => useListRuntime(schema))

      await act(async () => {
        result.current.setSort('name', 'asc')
      })

      await waitFor(() => {
        expect(result.current.sortField).toBe('name')
        expect(result.current.sortDirection).toBe('asc')
      })
    })

    test('toggleSort cycles through sort states', async () => {
      const { result } = renderHook(() => useListRuntime(schema))

      // First toggle: asc
      await act(async () => {
        result.current.toggleSort('name')
      })
      await waitFor(() => {
        expect(result.current.sortField).toBe('name')
        expect(result.current.sortDirection).toBe('asc')
      })

      // Second toggle: desc
      await act(async () => {
        result.current.toggleSort('name')
      })
      await waitFor(() => {
        expect(result.current.sortDirection).toBe('desc')
      })

      // Third toggle: null
      await act(async () => {
        result.current.toggleSort('name')
      })
      await waitFor(() => {
        expect(result.current.sortDirection).toBe(null)
      })
    })
  })

  describe('Filtering', () => {
    test('initializes with empty search and filters', () => {
      const { result } = renderHook(() => useListRuntime(schema))

      expect(result.current.searchTerm).toBe('')
      expect(Object.keys(result.current.filters).length).toBe(0)
    })

    test('setSearch sets search term', async () => {
      const { result } = renderHook(() => useListRuntime(schema))

      await act(async () => {
        result.current.setSearch('test')
      })

      await waitFor(() => {
        expect(result.current.searchTerm).toBe('test')
      })
    })

    test('setFilter sets filter value', async () => {
      const { result } = renderHook(() => useListRuntime(schema))

      await act(async () => {
        result.current.setFilter('status', 'active')
      })

      await waitFor(() => {
        expect(result.current.filters.status).toBe('active')
      })
    })

    test('resetFilters clears all filters', async () => {
      const { result } = renderHook(() => useListRuntime(schema))

      await act(async () => {
        result.current.setSearch('test')
        result.current.setFilter('status', 'active')
      })

      await waitFor(() => {
        expect(result.current.searchTerm).toBe('test')
        expect(result.current.filters.status).toBe('active')
      })

      await act(async () => {
        result.current.resetFilters()
      })

      await waitFor(() => {
        expect(result.current.searchTerm).toBe('')
        expect(Object.keys(result.current.filters).length).toBe(0)
      })
    })
  })

  describe('Selection', () => {
    test('initializes with no selection', () => {
      const { result } = renderHook(() => useListRuntime(schema))

      expect(result.current.selectedIds.size).toBe(0)
      expect(result.current.isAllSelected).toBe(false)
      expect(result.current.isIndeterminate).toBe(false)
    })

    test('selectRow selects a row', async () => {
      const { result } = renderHook(() => useListRuntime(schema))

      await act(async () => {
        result.current.selectRow('1')
      })

      await waitFor(() => {
        expect(result.current.selectedIds.has('1')).toBe(true)
      })
    })

    test('deselectRow deselects a row', async () => {
      const { result } = renderHook(() => useListRuntime(schema))

      await act(async () => {
        result.current.selectRow('1')
      })
      await waitFor(() => {
        expect(result.current.selectedIds.has('1')).toBe(true)
      })

      await act(async () => {
        result.current.deselectRow('1')
      })
      await waitFor(() => {
        expect(result.current.selectedIds.has('1')).toBe(false)
      })
    })

    test('toggleRow toggles row selection', async () => {
      const { result } = renderHook(() => useListRuntime(schema))

      await act(async () => {
        result.current.toggleRow('1')
      })
      await waitFor(() => {
        expect(result.current.selectedIds.has('1')).toBe(true)
      })

      await act(async () => {
        result.current.toggleRow('1')
      })
      await waitFor(() => {
        expect(result.current.selectedIds.has('1')).toBe(false)
      })
    })

    test('selectAll selects all rows', async () => {
      const { result } = renderHook(() => useListRuntime(schema))

      await act(async () => {
        result.current.selectAll()
      })

      await waitFor(() => {
        expect(result.current.selectedIds.size).toBe(3)
        expect(result.current.isAllSelected).toBe(true)
      })
    })

    test('deselectAll clears selection', async () => {
      const { result } = renderHook(() => useListRuntime(schema))

      await act(async () => {
        result.current.selectAll()
      })
      await waitFor(() => {
        expect(result.current.selectedIds.size).toBe(3)
      })

      await act(async () => {
        result.current.deselectAll()
      })
      await waitFor(() => {
        expect(result.current.selectedIds.size).toBe(0)
      })
    })

    test('isIndeterminate is true for partial selection', async () => {
      const { result } = renderHook(() => useListRuntime(schema))

      await act(async () => {
        result.current.selectRow('1')
      })

      await waitFor(() => {
        expect(result.current.isIndeterminate).toBe(true)
      })
    })

    test('isRowSelected helper works correctly', async () => {
      const { result } = renderHook(() => useListRuntime(schema))

      expect(result.current.isRowSelected('1')).toBe(false)

      await act(async () => {
        result.current.selectRow('1')
      })

      await waitFor(() => {
        expect(result.current.isRowSelected('1')).toBe(true)
        expect(result.current.isRowSelected('2')).toBe(false)
      })
    })

    test('selectedRows returns selected row data', async () => {
      const { result } = renderHook(() => useListRuntime(schema))

      await act(async () => {
        result.current.selectRow('1')
      })

      await waitFor(() => {
        expect(result.current.selectedRows.length).toBe(1)
        expect(result.current.selectedRows[0].id).toBe('1')
      })
    })
  })

  describe('Row Actions', () => {
    test('onRowClick dispatches ROW_CLICK event', async () => {
      const { result } = renderHook(() => useListRuntime(schema))

      expect(result.current.isInitialized).toBe(true)

      await act(async () => {
        result.current.onRowClick('1', { id: '1', name: 'Item 1' })
      })
      // No error thrown
    })

    test('onRowAction dispatches ROW_ACTION event', async () => {
      const { result } = renderHook(() => useListRuntime(schema))

      expect(result.current.isInitialized).toBe(true)

      await act(async () => {
        result.current.onRowAction('1', 'edit', { id: '1', name: 'Item 1' })
      })
      // No error thrown
    })

    test('onBulkAction dispatches BULK_ACTION event', async () => {
      const { result } = renderHook(() => useListRuntime(schema))

      await act(async () => {
        result.current.selectAll()
      })

      expect(result.current.isInitialized).toBe(true)

      await act(async () => {
        result.current.onBulkAction('delete')
      })
      // No error thrown
    })
  })

  describe('Data Loading', () => {
    test('load dispatches LOAD event', async () => {
      const { result } = renderHook(() => useListRuntime(schema))

      expect(result.current.isInitialized).toBe(true)

      await act(async () => {
        await result.current.load()
      })
      // No error thrown
    })

    test('refresh dispatches REFRESH event', async () => {
      const { result } = renderHook(() => useListRuntime(schema))

      expect(result.current.isInitialized).toBe(true)

      await act(async () => {
        await result.current.refresh()
      })
      // No error thrown
    })
  })

  describe('Utility Methods', () => {
    test('getState returns current state', () => {
      const { result } = renderHook(() => useListRuntime(schema))

      expect(result.current.isInitialized).toBe(true)

      const state = result.current.getState()

      expect(state.rows.length).toBe(3)
      expect(state.currentPage).toBe(1)
      expect(state.pageSize).toBe(10)
    })

    test('getColumn returns column metadata', () => {
      const { result } = renderHook(() => useListRuntime(schema))

      const nameColumn = result.current.getColumn('name')
      const unknownColumn = result.current.getColumn('unknown')

      expect(nameColumn).toBeDefined()
      expect(nameColumn?.id).toBe('name')
      expect(unknownColumn).toBeUndefined()
    })
  })

  describe('Options', () => {
    test('respects debug option', () => {
      const { result } = renderHook(() => useListRuntime(schema, { debug: true }))

      expect(result.current.isInitialized).toBe(true)
    })

    test('respects custom idField', async () => {
      const customSchema = createTestListSchema(
        [createTestColumn('name')],
        {
          dataSource: {
            type: 'static',
            static: [
              { customId: 'a', name: 'Item A' },
              { customId: 'b', name: 'Item B' },
            ],
          },
        }
      )

      const { result } = renderHook(() =>
        useListRuntime(customSchema, { idField: 'customId' })
      )

      await act(async () => {
        result.current.selectRow('a')
      })

      await waitFor(() => {
        expect(result.current.selectedIds.has('a')).toBe(true)
      })
    })

    test('respects initialData option', () => {
      const { result } = renderHook(() =>
        useListRuntime(schema, {
          initialData: [{ id: 'x', name: 'Custom Item' }],
        })
      )

      expect(result.current.rows.length).toBe(1)
      expect(result.current.rows[0].name).toBe('Custom Item')
    })
  })

  describe('Single Selection Mode', () => {
    test('single selection mode only allows one selection', async () => {
      const singleSelectSchema = createTestListSchema(
        [createTestColumn('name')],
        {
          selection: { mode: 'single' },
        }
      )

      const { result } = renderHook(() => useListRuntime(singleSelectSchema))

      await act(async () => {
        result.current.selectRow('1')
      })
      await waitFor(() => {
        expect(result.current.selectedIds.size).toBe(1)
        expect(result.current.selectedIds.has('1')).toBe(true)
      })

      await act(async () => {
        result.current.selectRow('2')
      })
      await waitFor(() => {
        expect(result.current.selectedIds.size).toBe(1)
        expect(result.current.selectedIds.has('2')).toBe(true)
        expect(result.current.selectedIds.has('1')).toBe(false)
      })
    })
  })

  describe('Schema Updates', () => {
    test('re-initializes when schema changes', async () => {
      const { result, rerender } = renderHook(
        ({ schema }) => useListRuntime(schema),
        { initialProps: { schema } }
      )

      expect(result.current.rows.length).toBe(3)

      const newSchema = createTestListSchema([createTestColumn('name')], {
        id: 'new-schema',
        dataSource: {
          type: 'static',
          static: [{ id: '1', name: 'New Item' }],
        },
      })

      rerender({ schema: newSchema })

      await waitFor(() => {
        expect(result.current.rows.length).toBe(1)
        expect(result.current.rows[0].name).toBe('New Item')
      })
    })
  })
})
