import { describe, test, expect, beforeEach, vi } from 'vitest'
import { ref, nextTick } from 'vue'
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
      const { isInitialized, error } = useListRuntime(schema)

      expect(isInitialized.value).toBe(true)
      expect(error.value).toBe(null)
    })

    test('initializes with static data', () => {
      const { rows, totalCount } = useListRuntime(schema)

      expect(rows.value.length).toBe(3)
      expect(totalCount.value).toBe(3)
    })

    test('initializes with ref schema', async () => {
      const schemaRef = ref<ListViewSchema | null>(null)
      const { isInitialized } = useListRuntime(schemaRef)

      expect(isInitialized.value).toBe(false)

      schemaRef.value = schema
      await nextTick()

      expect(isInitialized.value).toBe(true)
    })

    test('provides column metadata', () => {
      const { columns } = useListRuntime(schema)

      expect(columns.value.size).toBe(2)
      expect(columns.value.has('name')).toBe(true)
      expect(columns.value.has('status')).toBe(true)
    })
  })

  describe('Pagination', () => {
    test('initializes with default page values', () => {
      const { currentPage, pageSize } = useListRuntime(schema)

      expect(currentPage.value).toBe(1)
      expect(pageSize.value).toBe(10)
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

      const { currentPage, setPage } = useListRuntime(schemaWithMoreData)

      expect(currentPage.value).toBe(1)

      setPage(2)
      await nextTick()

      expect(currentPage.value).toBe(2)
    })

    test('setPageSize changes page size', async () => {
      const { pageSize, setPageSize } = useListRuntime(schema)

      expect(pageSize.value).toBe(10)

      setPageSize(20)
      await nextTick()

      expect(pageSize.value).toBe(20)
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

      const { totalPages } = useListRuntime(schemaWithMoreData)

      expect(totalPages.value).toBe(3) // 25 items / 10 per page = 3 pages
    })
  })

  describe('Sorting', () => {
    test('initializes with no sorting', () => {
      const { sortField, sortDirection } = useListRuntime(schema)

      expect(sortField.value).toBe(null)
      expect(sortDirection.value).toBe(null)
    })

    test('setSort sets sort field and direction', async () => {
      const { sortField, sortDirection, setSort } = useListRuntime(schema)

      setSort('name', 'asc')
      await nextTick()

      expect(sortField.value).toBe('name')
      expect(sortDirection.value).toBe('asc')
    })

    test('toggleSort cycles through sort states', async () => {
      const { sortField, sortDirection, toggleSort } = useListRuntime(schema)

      // First toggle: asc
      toggleSort('name')
      await nextTick()
      expect(sortField.value).toBe('name')
      expect(sortDirection.value).toBe('asc')

      // Second toggle: desc
      toggleSort('name')
      await nextTick()
      expect(sortDirection.value).toBe('desc')

      // Third toggle: null
      toggleSort('name')
      await nextTick()
      expect(sortDirection.value).toBe(null)
    })
  })

  describe('Filtering', () => {
    test('initializes with empty search and filters', () => {
      const { searchTerm, filters } = useListRuntime(schema)

      expect(searchTerm.value).toBe('')
      expect(Object.keys(filters.value).length).toBe(0)
    })

    test('setSearch sets search term', async () => {
      const { searchTerm, setSearch } = useListRuntime(schema)

      setSearch('test')
      await nextTick()

      expect(searchTerm.value).toBe('test')
    })

    test('setFilter sets filter value', async () => {
      const { filters, setFilter } = useListRuntime(schema)

      setFilter('status', 'active')
      await nextTick()

      expect(filters.value.status).toBe('active')
    })

    test('resetFilters clears all filters', async () => {
      const { searchTerm, filters, setSearch, setFilter, resetFilters } = useListRuntime(schema)

      setSearch('test')
      setFilter('status', 'active')
      await nextTick()

      expect(searchTerm.value).toBe('test')
      expect(filters.value.status).toBe('active')

      resetFilters()
      await nextTick()

      expect(searchTerm.value).toBe('')
      expect(Object.keys(filters.value).length).toBe(0)
    })
  })

  describe('Selection', () => {
    test('initializes with no selection', () => {
      const { selectedIds, isAllSelected, isIndeterminate } = useListRuntime(schema)

      expect(selectedIds.value.size).toBe(0)
      expect(isAllSelected.value).toBe(false)
      expect(isIndeterminate.value).toBe(false)
    })

    test('selectRow selects a row', async () => {
      const { selectedIds, selectRow } = useListRuntime(schema)

      selectRow('1')
      await nextTick()

      expect(selectedIds.value.has('1')).toBe(true)
    })

    test('deselectRow deselects a row', async () => {
      const { selectedIds, selectRow, deselectRow } = useListRuntime(schema)

      selectRow('1')
      await nextTick()
      expect(selectedIds.value.has('1')).toBe(true)

      deselectRow('1')
      await nextTick()
      expect(selectedIds.value.has('1')).toBe(false)
    })

    test('toggleRow toggles row selection', async () => {
      const { selectedIds, toggleRow } = useListRuntime(schema)

      toggleRow('1')
      await nextTick()
      expect(selectedIds.value.has('1')).toBe(true)

      toggleRow('1')
      await nextTick()
      expect(selectedIds.value.has('1')).toBe(false)
    })

    test('selectAll selects all rows', async () => {
      const { selectedIds, isAllSelected, selectAll } = useListRuntime(schema)

      selectAll()
      await nextTick()

      expect(selectedIds.value.size).toBe(3)
      expect(isAllSelected.value).toBe(true)
    })

    test('deselectAll clears selection', async () => {
      const { selectedIds, selectAll, deselectAll } = useListRuntime(schema)

      selectAll()
      await nextTick()
      expect(selectedIds.value.size).toBe(3)

      deselectAll()
      await nextTick()
      expect(selectedIds.value.size).toBe(0)
    })

    test('isIndeterminate is true for partial selection', async () => {
      const { isIndeterminate, selectRow } = useListRuntime(schema)

      selectRow('1')
      await nextTick()

      expect(isIndeterminate.value).toBe(true)
    })

    test('isRowSelected helper works correctly', async () => {
      const { selectRow, isRowSelected } = useListRuntime(schema)

      expect(isRowSelected('1')).toBe(false)

      selectRow('1')
      await nextTick()

      expect(isRowSelected('1')).toBe(true)
      expect(isRowSelected('2')).toBe(false)
    })

    test('selectedRows returns selected row data', async () => {
      const { selectedRows, selectRow } = useListRuntime(schema)

      selectRow('1')
      await nextTick()

      expect(selectedRows.value.length).toBe(1)
      expect(selectedRows.value[0].id).toBe('1')
    })
  })

  describe('Row Actions', () => {
    test('onRowClick dispatches ROW_CLICK event', () => {
      const { onRowClick, isInitialized } = useListRuntime(schema)

      expect(isInitialized.value).toBe(true)
      expect(() => onRowClick('1', { id: '1', name: 'Item 1' })).not.toThrow()
    })

    test('onRowAction dispatches ROW_ACTION event', () => {
      const { onRowAction, isInitialized } = useListRuntime(schema)

      expect(isInitialized.value).toBe(true)
      expect(() => onRowAction('1', 'edit', { id: '1', name: 'Item 1' })).not.toThrow()
    })

    test('onBulkAction dispatches BULK_ACTION event', async () => {
      const { onBulkAction, selectAll, isInitialized } = useListRuntime(schema)

      selectAll()
      await nextTick()

      expect(isInitialized.value).toBe(true)
      expect(() => onBulkAction('delete')).not.toThrow()
    })
  })

  describe('Data Loading', () => {
    test('load dispatches LOAD event', async () => {
      const { load, isLoading, isInitialized } = useListRuntime(schema)

      expect(isInitialized.value).toBe(true)
      await expect(load()).resolves.not.toThrow()
    })

    test('refresh dispatches REFRESH event', async () => {
      const { refresh, isInitialized } = useListRuntime(schema)

      expect(isInitialized.value).toBe(true)
      await expect(refresh()).resolves.not.toThrow()
    })
  })

  describe('Utility Methods', () => {
    test('getState returns current state', () => {
      const { getState, isInitialized } = useListRuntime(schema)

      expect(isInitialized.value).toBe(true)

      const state = getState()

      expect(state.rows.length).toBe(3)
      expect(state.currentPage).toBe(1)
      expect(state.pageSize).toBe(10)
    })

    test('getColumn returns column metadata', () => {
      const { getColumn } = useListRuntime(schema)

      const nameColumn = getColumn('name')
      const unknownColumn = getColumn('unknown')

      expect(nameColumn).toBeDefined()
      expect(nameColumn?.id).toBe('name')
      expect(unknownColumn).toBeUndefined()
    })
  })

  describe('Options', () => {
    test('respects debug option', () => {
      const { isInitialized } = useListRuntime(schema, {
        debug: true,
      })

      expect(isInitialized.value).toBe(true)
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

      const { selectRow, selectedIds } = useListRuntime(customSchema, {
        idField: 'customId',
      })

      selectRow('a')
      await nextTick()

      expect(selectedIds.value.has('a')).toBe(true)
    })

    test('respects initialData option', () => {
      const { rows } = useListRuntime(schema, {
        initialData: [
          { id: 'x', name: 'Custom Item' },
        ],
      })

      expect(rows.value.length).toBe(1)
      expect(rows.value[0].name).toBe('Custom Item')
    })

    test('respects autoReinitialize option', async () => {
      const schemaRef = ref<ListViewSchema | null>(schema)
      const { isInitialized, rows } = useListRuntime(schemaRef, {
        autoReinitialize: true,
      })

      expect(isInitialized.value).toBe(true)
      expect(rows.value.length).toBe(3)

      // Change schema
      schemaRef.value = createTestListSchema(
        [createTestColumn('name')],
        {
          dataSource: {
            type: 'static',
            static: [{ id: '1', name: 'New Item' }],
          },
        }
      )

      await nextTick()

      expect(isInitialized.value).toBe(true)
      expect(rows.value.length).toBe(1)
    })

    test('autoReinitialize false skips initialization on watch', async () => {
      const schemaRef = ref<ListViewSchema | null>(schema)
      const { isInitialized } = useListRuntime(schemaRef, {
        autoReinitialize: false,
      })

      expect(isInitialized.value).toBe(false)
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

      const { selectedIds, selectRow } = useListRuntime(singleSelectSchema)

      selectRow('1')
      await nextTick()
      expect(selectedIds.value.size).toBe(1)
      expect(selectedIds.value.has('1')).toBe(true)

      selectRow('2')
      await nextTick()
      expect(selectedIds.value.size).toBe(1)
      expect(selectedIds.value.has('2')).toBe(true)
      expect(selectedIds.value.has('1')).toBe(false)
    })
  })
})
