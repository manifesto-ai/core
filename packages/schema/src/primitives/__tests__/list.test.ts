/**
 * List Primitives Tests
 */

import { describe, it, expect } from 'vitest'
import {
  // Column builders
  column,
  textColumn,
  numberColumn,
  dateColumn,
  datetimeColumn,
  booleanColumn,
  enumColumn,
  linkColumn,
  imageColumn,
  badgeColumn,
  actionsColumn,
  customColumn,
  // Summary builders
  sumSummary,
  avgSummary,
  countSummary,
  minSummary,
  maxSummary,
  // Row action builders
  rowAction,
  editAction,
  deleteAction,
  rowViewAction,
  // Bulk action builders
  bulkAction,
  bulkDeleteAction,
  // Config builders
  pagination,
  sorting,
  selection,
  filtering,
  filterField,
  // Data source builders
  apiDataSource,
  staticDataSource,
  // Empty state builder
  emptyState,
} from '../list'

describe('List Primitives', () => {
  describe('Column Builders', () => {
    it('column creates a basic column', () => {
      const col = column('name', 'name', 'text', '이름')

      expect(col.id).toBe('name')
      expect(col.entityFieldId).toBe('name')
      expect(col.type).toBe('text')
      expect(col.label).toBe('이름')
    })

    it('column accepts optional properties', () => {
      const col = column('name', 'name', 'text', '이름', {
        sortable: true,
        filterable: true,
        width: 200,
        align: 'center',
      })

      expect(col.sortable).toBe(true)
      expect(col.filterable).toBe(true)
      expect(col.width).toBe(200)
      expect(col.align).toBe('center')
    })

    it('textColumn creates text type column', () => {
      const col = textColumn('name', 'name', '이름')
      expect(col.type).toBe('text')
    })

    it('numberColumn creates number type column', () => {
      const col = numberColumn('price', 'price', '가격')
      expect(col.type).toBe('number')
    })

    it('dateColumn creates date type column', () => {
      const col = dateColumn('createdAt', 'createdAt', '생성일')
      expect(col.type).toBe('date')
    })

    it('datetimeColumn creates datetime type column', () => {
      const col = datetimeColumn('updatedAt', 'updatedAt', '수정일시')
      expect(col.type).toBe('datetime')
    })

    it('booleanColumn creates boolean type column', () => {
      const col = booleanColumn('isActive', 'isActive', '활성')
      expect(col.type).toBe('boolean')
    })

    it('enumColumn creates enum type column with enumMap', () => {
      const col = enumColumn('status', 'status', '상태', {
        ACTIVE: '활성',
        INACTIVE: '비활성',
      })

      expect(col.type).toBe('enum')
      expect(col.format?.enumMap).toEqual({
        ACTIVE: '활성',
        INACTIVE: '비활성',
      })
    })

    it('linkColumn creates link type column with template', () => {
      const col = linkColumn('id', 'id', 'ID', '/products/{id}')

      expect(col.type).toBe('link')
      expect(col.format?.linkTemplate).toBe('/products/{id}')
    })

    it('imageColumn creates image type column', () => {
      const col = imageColumn('thumbnail', 'thumbnail', '썸네일')
      expect(col.type).toBe('image')
    })

    it('badgeColumn creates badge type column', () => {
      const col = badgeColumn('status', 'status', '상태')
      expect(col.type).toBe('badge')
    })

    it('actionsColumn creates actions type column', () => {
      const col = actionsColumn('actions', [
        editAction(),
        deleteAction(),
      ])

      expect(col.type).toBe('actions')
      expect(col.entityFieldId).toBe('')
      expect(col.label).toBe('')
      expect(col.align).toBe('right')
      expect(col.actions).toHaveLength(2)
    })

    it('customColumn creates custom type column', () => {
      const col = customColumn('custom', 'custom', '커스텀')
      expect(col.type).toBe('custom')
    })
  })

  describe('Summary Builders', () => {
    it('sumSummary creates sum type summary', () => {
      const summary = sumSummary('합계: ')

      expect(summary.type).toBe('sum')
      expect(summary.label).toBe('합계: ')
    })

    it('avgSummary creates avg type summary', () => {
      const summary = avgSummary('평균: ')
      expect(summary.type).toBe('avg')
    })

    it('countSummary creates count type summary', () => {
      const summary = countSummary('총: ')
      expect(summary.type).toBe('count')
    })

    it('minSummary creates min type summary', () => {
      const summary = minSummary('최소: ')
      expect(summary.type).toBe('min')
    })

    it('maxSummary creates max type summary', () => {
      const summary = maxSummary('최대: ')
      expect(summary.type).toBe('max')
    })
  })

  describe('Row Action Builders', () => {
    it('rowAction creates a basic row action', () => {
      const action = rowAction('edit', '편집', { type: 'custom', actionId: 'edit' })

      expect(action.id).toBe('edit')
      expect(action.label).toBe('편집')
      expect(action.action.type).toBe('custom')
      expect(action.action.actionId).toBe('edit')
    })

    it('editAction creates a preset edit action', () => {
      const action = editAction()

      expect(action.id).toBe('edit')
      expect(action.label).toBe('편집')
      expect(action.icon).toBe('edit')
      expect(action.variant).toBe('ghost')
    })

    it('deleteAction creates a preset delete action with confirm', () => {
      const action = deleteAction()

      expect(action.id).toBe('delete')
      expect(action.label).toBe('삭제')
      expect(action.icon).toBe('delete')
      expect(action.variant).toBe('danger')
      expect(action.action.confirm).toBeDefined()
      expect(action.action.confirm?.title).toBe('삭제 확인')
    })

    it('rowViewAction creates a preset view action', () => {
      const action = rowViewAction()

      expect(action.id).toBe('view')
      expect(action.label).toBe('보기')
      expect(action.icon).toBe('visibility')
      expect(action.variant).toBe('ghost')
    })
  })

  describe('Bulk Action Builders', () => {
    it('bulkAction creates a bulk action with default minSelection', () => {
      const action = bulkAction('bulk-export', '내보내기', { type: 'custom', actionId: 'export' })

      expect(action.id).toBe('bulk-export')
      expect(action.label).toBe('내보내기')
      expect(action.minSelection).toBe(1)
    })

    it('bulkDeleteAction creates a preset bulk delete action', () => {
      const action = bulkDeleteAction()

      expect(action.id).toBe('bulk-delete')
      expect(action.label).toBe('선택 삭제')
      expect(action.variant).toBe('danger')
      expect(action.action.confirm).toBeDefined()
    })
  })

  describe('Config Builders', () => {
    it('pagination creates pagination config with defaults', () => {
      const config = pagination()

      expect(config.enabled).toBe(true)
      expect(config.pageSize).toBe(20)
      expect(config.pageSizeOptions).toEqual([10, 20, 50, 100])
      expect(config.showTotal).toBe(true)
      expect(config.showPageSize).toBe(true)
    })

    it('pagination accepts custom pageSize', () => {
      const config = pagination(50)
      expect(config.pageSize).toBe(50)
    })

    it('sorting creates sorting config', () => {
      const config = sorting('name', 'desc')

      expect(config.enabled).toBe(true)
      expect(config.defaultSort?.field).toBe('name')
      expect(config.defaultSort?.direction).toBe('desc')
    })

    it('sorting works without default sort', () => {
      const config = sorting()

      expect(config.enabled).toBe(true)
      expect(config.defaultSort).toBeUndefined()
    })

    it('selection creates selection config', () => {
      const config = selection('multiple')

      expect(config.enabled).toBe(true)
      expect(config.mode).toBe('multiple')
      expect(config.showSelectAll).toBe(true)
    })

    it('selection single mode has showSelectAll false', () => {
      const config = selection('single')

      expect(config.mode).toBe('single')
      expect(config.showSelectAll).toBe(false)
    })

    it('filtering creates filter config', () => {
      const config = filtering([
        filterField('name', 'name', '이름', 'text'),
      ])

      expect(config.enabled).toBe(true)
      expect(config.searchable).toBe(true)
      expect(config.fields).toHaveLength(1)
    })

    it('filterField creates a filter field definition', () => {
      const field = filterField('status', 'status', '상태', 'select', {
        options: [
          { value: 'ACTIVE', label: '활성' },
          { value: 'INACTIVE', label: '비활성' },
        ],
      })

      expect(field.id).toBe('status')
      expect(field.entityFieldId).toBe('status')
      expect(field.type).toBe('select')
      expect(field.options).toHaveLength(2)
    })
  })

  describe('Data Source Builders', () => {
    it('apiDataSource creates API data source', () => {
      const ds = apiDataSource('/api/products')

      expect(ds.type).toBe('api')
      expect(ds.api?.endpoint).toBe('/api/products')
      expect(ds.api?.method).toBe('GET')
    })

    it('apiDataSource accepts options', () => {
      const ds = apiDataSource('/api/products', {
        method: 'POST',
        params: { status: 'ACTIVE' },
      })

      expect(ds.api?.method).toBe('POST')
      expect(ds.api?.params).toEqual({ status: 'ACTIVE' })
    })

    it('staticDataSource creates static data source', () => {
      const data = [
        { id: 1, name: 'Product 1' },
        { id: 2, name: 'Product 2' },
      ]
      const ds = staticDataSource(data)

      expect(ds.type).toBe('static')
      expect(ds.static).toEqual(data)
    })
  })

  describe('Empty State Builder', () => {
    it('emptyState creates empty state config', () => {
      const state = emptyState('데이터가 없습니다', {
        description: '검색 결과가 없습니다.',
        icon: 'search',
      })

      expect(state.title).toBe('데이터가 없습니다')
      expect(state.description).toBe('검색 결과가 없습니다.')
      expect(state.icon).toBe('search')
    })
  })
})
