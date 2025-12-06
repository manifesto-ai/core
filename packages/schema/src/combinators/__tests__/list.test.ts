/**
 * List Combinators Tests
 */

import { describe, it, expect } from 'vitest'
import {
  listView,
  withColumns,
  withPagination,
  withSorting,
  withFiltering,
  withSelection,
  withBulkActions,
  withDataSource,
  withEmptyState,
  withRowClick,
  withHeader,
  withFooter,
} from '../list'
import {
  textColumn,
  numberColumn,
  actionsColumn,
  editAction,
  deleteAction,
  bulkDeleteAction,
  pagination,
  sorting,
  selection,
  filtering,
  filterField,
  apiDataSource,
  emptyState,
} from '../../primitives/list'
import { isListViewSchema, isFormViewSchema } from '../../types/schema'

describe('List Combinators', () => {
  describe('listView', () => {
    it('creates a minimal ListViewSchema', () => {
      const schema = listView('product-list', 'product', [
        textColumn('name', 'name', '상품명'),
      ])

      expect(schema._type).toBe('view')
      expect(schema.mode).toBe('list')
      expect(schema.id).toBe('product-list')
      expect(schema.entityRef).toBe('product')
      expect(schema.columns).toHaveLength(1)
      expect(schema.dataSource.type).toBe('static')
    })

    it('creates ListViewSchema with all options', () => {
      const schema = listView('product-list', 'product', [
        textColumn('name', 'name', '상품명'),
        numberColumn('price', 'price', '가격'),
      ], {
        version: '2.0.0',
        name: '상품 목록',
        description: '전체 상품 목록',
        dataSource: apiDataSource('/api/products'),
        pagination: pagination(20),
        sorting: sorting('name', 'asc'),
        selection: selection('multiple'),
        bulkActions: [bulkDeleteAction()],
        emptyState: emptyState('상품이 없습니다'),
      })

      expect(schema.version).toBe('2.0.0')
      expect(schema.name).toBe('상품 목록')
      expect(schema.description).toBe('전체 상품 목록')
      expect(schema.dataSource.type).toBe('api')
      expect(schema.pagination?.pageSize).toBe(20)
      expect(schema.sorting?.defaultSort?.field).toBe('name')
      expect(schema.selection?.mode).toBe('multiple')
      expect(schema.bulkActions).toHaveLength(1)
      expect(schema.emptyState?.title).toBe('상품이 없습니다')
    })
  })

  describe('withColumns', () => {
    it('adds columns to existing schema', () => {
      const schema = listView('test', 'entity', [
        textColumn('name', 'name', '이름'),
      ])

      const updated = withColumns(schema, [
        numberColumn('price', 'price', '가격'),
      ])

      expect(updated.columns).toHaveLength(2)
      expect(updated.columns[1].id).toBe('price')
    })
  })

  describe('withPagination', () => {
    it('adds pagination to schema', () => {
      const schema = listView('test', 'entity', [])
      const updated = withPagination(schema, pagination(50))

      expect(updated.pagination?.pageSize).toBe(50)
    })
  })

  describe('withSorting', () => {
    it('adds sorting to schema', () => {
      const schema = listView('test', 'entity', [])
      const updated = withSorting(schema, sorting('name', 'desc'))

      expect(updated.sorting?.defaultSort?.field).toBe('name')
      expect(updated.sorting?.defaultSort?.direction).toBe('desc')
    })
  })

  describe('withFiltering', () => {
    it('adds filtering to schema', () => {
      const schema = listView('test', 'entity', [])
      const updated = withFiltering(schema, filtering([
        filterField('name', 'name', '이름', 'text'),
      ]))

      expect(updated.filtering?.enabled).toBe(true)
      expect(updated.filtering?.fields).toHaveLength(1)
    })
  })

  describe('withSelection', () => {
    it('adds selection to schema', () => {
      const schema = listView('test', 'entity', [])
      const updated = withSelection(schema, selection('single'))

      expect(updated.selection?.mode).toBe('single')
    })
  })

  describe('withBulkActions', () => {
    it('adds bulk actions to schema', () => {
      const schema = listView('test', 'entity', [])
      const updated = withBulkActions(schema, [bulkDeleteAction()])

      expect(updated.bulkActions).toHaveLength(1)
    })

    it('appends to existing bulk actions', () => {
      const schema = listView('test', 'entity', [], {
        bulkActions: [bulkDeleteAction()],
      })
      const updated = withBulkActions(schema, [
        { id: 'bulk-export', label: '내보내기', action: { type: 'custom', actionId: 'export' } },
      ])

      expect(updated.bulkActions).toHaveLength(2)
    })
  })

  describe('withDataSource', () => {
    it('sets data source', () => {
      const schema = listView('test', 'entity', [])
      const updated = withDataSource(schema, apiDataSource('/api/items'))

      expect(updated.dataSource.type).toBe('api')
      expect(updated.dataSource.api?.endpoint).toBe('/api/items')
    })
  })

  describe('withEmptyState', () => {
    it('sets empty state', () => {
      const schema = listView('test', 'entity', [])
      const updated = withEmptyState(schema, emptyState('데이터 없음', {
        description: '조건에 맞는 데이터가 없습니다',
      }))

      expect(updated.emptyState?.title).toBe('데이터 없음')
      expect(updated.emptyState?.description).toBe('조건에 맞는 데이터가 없습니다')
    })
  })

  describe('withRowClick', () => {
    it('sets row click action', () => {
      const schema = listView('test', 'entity', [])
      const updated = withRowClick(schema, { type: 'custom', actionId: 'view-detail' })

      expect(updated.rowClick?.actionId).toBe('view-detail')
    })
  })

  describe('withHeader', () => {
    it('sets header', () => {
      const schema = listView('test', 'entity', [])
      const updated = withHeader(schema, {
        title: '상품 목록',
        subtitle: '전체 상품을 관리합니다',
      })

      expect(updated.header?.title).toBe('상품 목록')
      expect(updated.header?.subtitle).toBe('전체 상품을 관리합니다')
    })
  })

  describe('withFooter', () => {
    it('sets footer', () => {
      const schema = listView('test', 'entity', [])
      const updated = withFooter(schema, {
        actions: [
          { id: 'create', label: '추가', action: { type: 'custom', actionId: 'create' } },
        ],
      })

      expect(updated.footer?.actions).toHaveLength(1)
    })
  })

  describe('Type Guards', () => {
    it('isListViewSchema returns true for ListViewSchema', () => {
      const schema = listView('test', 'entity', [])
      expect(isListViewSchema(schema)).toBe(true)
    })

    it('isFormViewSchema returns false for ListViewSchema', () => {
      const schema = listView('test', 'entity', [])
      expect(isFormViewSchema(schema)).toBe(false)
    })
  })

  describe('Real-world Example', () => {
    it('creates a complete product list schema', () => {
      const productListSchema = listView('product-list', 'product', [
        textColumn('name', 'name', '상품명', { sortable: true, filterable: true }),
        numberColumn('price', 'price', '가격', {
          sortable: true,
          format: {
            numberFormat: { style: 'currency', currency: 'KRW' },
          },
        }),
        textColumn('status', 'status', '상태'),
        actionsColumn('actions', [
          editAction(),
          deleteAction(),
        ]),
      ], {
        name: '상품 목록',
        description: '등록된 상품을 관리합니다',
        dataSource: apiDataSource('/api/products', {
          transform: { path: 'data', map: { value: 'id', label: 'name' } },
        }),
        pagination: pagination(20),
        sorting: sorting('name', 'asc'),
        filtering: filtering([
          filterField('name', 'name', '상품명', 'text'),
          filterField('status', 'status', '상태', 'select', {
            options: [
              { value: 'ACTIVE', label: '판매중' },
              { value: 'INACTIVE', label: '판매중지' },
            ],
          }),
        ]),
        selection: selection('multiple'),
        bulkActions: [bulkDeleteAction()],
        emptyState: emptyState('등록된 상품이 없습니다', {
          description: '새 상품을 등록해보세요',
          icon: 'inventory',
        }),
        rowClick: { type: 'custom', actionId: 'view-product' },
      })

      // Verify structure
      expect(productListSchema._type).toBe('view')
      expect(productListSchema.mode).toBe('list')
      expect(productListSchema.columns).toHaveLength(4)
      expect(productListSchema.dataSource.api?.endpoint).toBe('/api/products')
      expect(productListSchema.pagination?.pageSize).toBe(20)
      expect(productListSchema.sorting?.defaultSort?.field).toBe('name')
      expect(productListSchema.filtering?.fields).toHaveLength(2)
      expect(productListSchema.selection?.mode).toBe('multiple')
      expect(productListSchema.bulkActions).toHaveLength(1)
      expect(productListSchema.emptyState?.title).toBe('등록된 상품이 없습니다')
      expect(productListSchema.rowClick?.actionId).toBe('view-product')

      // Verify type guard
      expect(isListViewSchema(productListSchema)).toBe(true)
    })
  })
})
