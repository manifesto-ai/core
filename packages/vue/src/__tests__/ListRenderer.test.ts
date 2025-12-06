import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ListViewSchema } from '@manifesto-ai/schema'
import ListRenderer from '../components/list/ListRenderer.vue'

// ============================================================================
// Test Schemas
// ============================================================================

const simpleListView: ListViewSchema = {
  _type: 'view',
  id: 'products',
  name: 'Products',
  version: '1.0.0',
  entityRef: 'product',
  mode: 'list',
  columns: [
    { id: 'name', entityFieldId: 'name', type: 'text', label: 'Name' },
    { id: 'price', entityFieldId: 'price', type: 'number', label: 'Price' },
  ],
  dataSource: { type: 'static', static: [] },
}

const listWithHiddenColumn: ListViewSchema = {
  _type: 'view',
  id: 'users',
  name: 'Users',
  version: '1.0.0',
  entityRef: 'user',
  mode: 'list',
  columns: [
    { id: 'name', entityFieldId: 'name', type: 'text', label: 'Name' },
    { id: 'email', entityFieldId: 'email', type: 'text', label: 'Email' },
    { id: 'secretKey', entityFieldId: 'secretKey', type: 'text', label: 'Secret', hidden: true },
  ],
  dataSource: { type: 'static', static: [] },
}

const listWithAlignment: ListViewSchema = {
  _type: 'view',
  id: 'invoices',
  name: 'Invoices',
  version: '1.0.0',
  entityRef: 'invoice',
  mode: 'list',
  columns: [
    { id: 'id', entityFieldId: 'id', type: 'text', label: 'ID', align: 'left' },
    { id: 'amount', entityFieldId: 'amount', type: 'number', label: 'Amount', align: 'right' },
    { id: 'status', entityFieldId: 'status', type: 'text', label: 'Status', align: 'center' },
  ],
  dataSource: { type: 'static', static: [] },
}

const listWithEmptyState: ListViewSchema = {
  _type: 'view',
  id: 'tasks',
  name: 'Tasks',
  version: '1.0.0',
  entityRef: 'task',
  mode: 'list',
  columns: [
    { id: 'title', entityFieldId: 'title', type: 'text', label: 'Title' },
  ],
  emptyState: {
    title: 'No tasks found',
    description: 'Create a new task to get started',
  },
  dataSource: { type: 'static', static: [] },
}

// ============================================================================
// Tests
// ============================================================================

describe('ListRenderer (Vue)', () => {
  describe('Basic Rendering', () => {
    it('renders column headers', () => {
      const wrapper = mount(ListRenderer, {
        props: {
          schema: simpleListView,
          rows: [{ name: 'Pen', price: 3 }],
        },
      })

      expect(wrapper.text()).toContain('Name')
      expect(wrapper.text()).toContain('Price')
    })

    it('renders a single row', () => {
      const wrapper = mount(ListRenderer, {
        props: {
          schema: simpleListView,
          rows: [{ name: 'Pen', price: 3 }],
        },
      })

      expect(wrapper.text()).toContain('Pen')
      expect(wrapper.text()).toContain('3')
    })

    it('renders multiple rows', () => {
      const rows = [
        { name: 'Pen', price: 3 },
        { name: 'Notebook', price: 10 },
        { name: 'Eraser', price: 1 },
      ]
      const wrapper = mount(ListRenderer, {
        props: {
          schema: simpleListView,
          rows,
        },
      })

      expect(wrapper.text()).toContain('Pen')
      expect(wrapper.text()).toContain('Notebook')
      expect(wrapper.text()).toContain('Eraser')
    })

    it('renders table element', () => {
      const wrapper = mount(ListRenderer, {
        props: {
          schema: simpleListView,
          rows: [{ name: 'Pen', price: 3 }],
        },
      })

      expect(wrapper.find('table').exists()).toBe(true)
      expect(wrapper.find('thead').exists()).toBe(true)
      expect(wrapper.find('tbody').exists()).toBe(true)
    })
  })

  describe('Empty State', () => {
    it('shows default empty message when no rows', () => {
      const wrapper = mount(ListRenderer, {
        props: {
          schema: simpleListView,
          rows: [],
        },
      })

      expect(wrapper.text()).toContain('No data')
    })

    it('shows custom empty state message', () => {
      const wrapper = mount(ListRenderer, {
        props: {
          schema: listWithEmptyState,
          rows: [],
        },
      })

      expect(wrapper.text()).toContain('No tasks found')
    })

    it('applies empty state CSS class', () => {
      const wrapper = mount(ListRenderer, {
        props: {
          schema: simpleListView,
          rows: [],
        },
      })

      expect(wrapper.find('.mvs-list--empty').exists()).toBe(true)
    })
  })

  describe('Hidden Columns', () => {
    it('hides columns with hidden=true by default', () => {
      const wrapper = mount(ListRenderer, {
        props: {
          schema: listWithHiddenColumn,
          rows: [{ name: 'John', email: 'john@test.com', secretKey: 'abc123' }],
        },
      })

      expect(wrapper.text()).toContain('Name')
      expect(wrapper.text()).toContain('Email')
      expect(wrapper.text()).not.toContain('Secret')
      expect(wrapper.text()).not.toContain('abc123')
    })

    it('shows hidden columns when includeHiddenColumns=true', () => {
      const wrapper = mount(ListRenderer, {
        props: {
          schema: listWithHiddenColumn,
          rows: [{ name: 'John', email: 'john@test.com', secretKey: 'abc123' }],
          includeHiddenColumns: true,
        },
      })

      expect(wrapper.text()).toContain('Name')
      expect(wrapper.text()).toContain('Secret')
      expect(wrapper.text()).toContain('abc123')
    })
  })

  describe('Column Alignment', () => {
    it('applies text alignment styles to headers', () => {
      const wrapper = mount(ListRenderer, {
        props: {
          schema: listWithAlignment,
          rows: [{ id: 'INV-001', amount: 100, status: 'Paid' }],
        },
      })

      const headers = wrapper.findAll('th')
      expect(headers[0].attributes('style')).toContain('text-align: left')
      expect(headers[1].attributes('style')).toContain('text-align: right')
      expect(headers[2].attributes('style')).toContain('text-align: center')
    })
  })

  describe('Custom Cell Rendering (Slot)', () => {
    it('uses cell slot for custom rendering', () => {
      const wrapper = mount(ListRenderer, {
        props: {
          schema: simpleListView,
          rows: [{ name: 'Pen', price: 3 }],
        },
        slots: {
          cell: `
            <template #cell="{ columnId, value }">
              <span v-if="columnId === 'price'" data-testid="custom-price">\${{ value }}</span>
              <span v-else>{{ value }}</span>
            </template>
          `,
        },
      })

      expect(wrapper.find('[data-testid="custom-price"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('$3')
    })

    it('passes correct slot props', () => {
      const wrapper = mount(ListRenderer, {
        props: {
          schema: simpleListView,
          rows: [{ name: 'Pen', price: 3 }],
        },
        slots: {
          cell: `
            <template #cell="{ columnId, rowIndex, row, value }">
              <span :data-column="columnId" :data-row="rowIndex">{{ value }}</span>
            </template>
          `,
        },
      })

      const cells = wrapper.findAll('[data-column]')
      expect(cells.length).toBe(2) // 2 columns

      const nameCell = wrapper.find('[data-column="name"]')
      expect(nameCell.exists()).toBe(true)
      expect(nameCell.attributes('data-row')).toBe('0')
      expect(nameCell.text()).toBe('Pen')
    })
  })

  describe('Data Types', () => {
    it('renders null values as empty', () => {
      const wrapper = mount(ListRenderer, {
        props: {
          schema: simpleListView,
          rows: [{ name: 'Pen', price: null }],
        },
      })

      expect(wrapper.text()).toContain('Pen')
    })

    it('renders undefined values as empty', () => {
      const wrapper = mount(ListRenderer, {
        props: {
          schema: simpleListView,
          rows: [{ name: 'Pen' }], // price is undefined
        },
      })

      expect(wrapper.text()).toContain('Pen')
    })

    it('renders number zero correctly', () => {
      const wrapper = mount(ListRenderer, {
        props: {
          schema: simpleListView,
          rows: [{ name: 'Free Item', price: 0 }],
        },
      })

      expect(wrapper.text()).toContain('Free Item')
      expect(wrapper.text()).toContain('0')
    })
  })
})
