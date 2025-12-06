import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ListViewSchema } from '@manifesto-ai/schema'
import { ListRenderer } from '../components/list/ListRenderer'

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

describe('ListRenderer (React)', () => {
  describe('Basic Rendering', () => {
    it('renders column headers', () => {
      render(<ListRenderer schema={simpleListView} rows={[{ name: 'Pen', price: 3 }]} />)

      expect(screen.getByText('Name')).toBeTruthy()
      expect(screen.getByText('Price')).toBeTruthy()
    })

    it('renders a single row', () => {
      render(<ListRenderer schema={simpleListView} rows={[{ name: 'Pen', price: 3 }]} />)

      expect(screen.getByText('Pen')).toBeTruthy()
      expect(screen.getByText('3')).toBeTruthy()
    })

    it('renders multiple rows', () => {
      const rows = [
        { name: 'Pen', price: 3 },
        { name: 'Notebook', price: 10 },
        { name: 'Eraser', price: 1 },
      ]
      render(<ListRenderer schema={simpleListView} rows={rows} />)

      expect(screen.getByText('Pen')).toBeTruthy()
      expect(screen.getByText('Notebook')).toBeTruthy()
      expect(screen.getByText('Eraser')).toBeTruthy()
    })

    it('renders table element', () => {
      const { container } = render(
        <ListRenderer schema={simpleListView} rows={[{ name: 'Pen', price: 3 }]} />
      )

      expect(container.querySelector('table')).toBeTruthy()
      expect(container.querySelector('thead')).toBeTruthy()
      expect(container.querySelector('tbody')).toBeTruthy()
    })
  })

  describe('Empty State', () => {
    it('shows default empty message when no rows', () => {
      render(<ListRenderer schema={simpleListView} rows={[]} />)

      expect(screen.getByText('No data')).toBeTruthy()
    })

    it('shows custom empty state message', () => {
      render(<ListRenderer schema={listWithEmptyState} rows={[]} />)

      expect(screen.getByText('No tasks found')).toBeTruthy()
    })

    it('applies empty state CSS class', () => {
      const { container } = render(<ListRenderer schema={simpleListView} rows={[]} />)

      expect(container.querySelector('.mfs-list--empty')).toBeTruthy()
    })
  })

  describe('Hidden Columns', () => {
    it('hides columns with hiddenExpression by default', () => {
      render(
        <ListRenderer
          schema={listWithHiddenColumn}
          rows={[{ name: 'John', email: 'john@test.com', secretKey: 'abc123' }]}
        />
      )

      expect(screen.getByText('Name')).toBeTruthy()
      expect(screen.getByText('Email')).toBeTruthy()
      expect(screen.queryByText('Secret')).toBeNull()
      expect(screen.queryByText('abc123')).toBeNull()
    })

    it('shows hidden columns when includeHiddenColumns=true', () => {
      render(
        <ListRenderer
          schema={listWithHiddenColumn}
          rows={[{ name: 'John', email: 'john@test.com', secretKey: 'abc123' }]}
          includeHiddenColumns={true}
        />
      )

      expect(screen.getByText('Name')).toBeTruthy()
      expect(screen.getByText('Secret')).toBeTruthy()
      expect(screen.getByText('abc123')).toBeTruthy()
    })
  })

  describe('Column Alignment', () => {
    it('applies text alignment styles to headers', () => {
      const { container } = render(
        <ListRenderer
          schema={listWithAlignment}
          rows={[{ id: 'INV-001', amount: 100, status: 'Paid' }]}
        />
      )

      const headers = container.querySelectorAll('th')
      expect(headers[0].style.textAlign).toBe('left')
      expect(headers[1].style.textAlign).toBe('right')
      expect(headers[2].style.textAlign).toBe('center')
    })
  })

  describe('Custom Cell Rendering', () => {
    it('uses renderCell prop for custom rendering', () => {
      const renderCell = vi.fn(({ columnId, value }) => {
        if (columnId === 'price') {
          return <span data-testid="custom-price">${value}</span>
        }
        return value
      })

      render(
        <ListRenderer
          schema={simpleListView}
          rows={[{ name: 'Pen', price: 3 }]}
          renderCell={renderCell}
        />
      )

      expect(renderCell).toHaveBeenCalled()
      expect(screen.getByTestId('custom-price')).toBeTruthy()
      expect(screen.getByText('$3')).toBeTruthy()
    })

    it('passes correct params to renderCell', () => {
      const renderCell = vi.fn(({ value }) => value)

      render(
        <ListRenderer
          schema={simpleListView}
          rows={[{ name: 'Pen', price: 3 }]}
          renderCell={renderCell}
        />
      )

      // Should be called for each cell (2 columns x 1 row = 2 calls)
      expect(renderCell).toHaveBeenCalledTimes(2)

      // Check first call (name column)
      expect(renderCell).toHaveBeenCalledWith(
        expect.objectContaining({
          columnId: 'name',
          rowIndex: 0,
          row: { name: 'Pen', price: 3 },
          value: 'Pen',
        })
      )
    })
  })

  describe('Data Types', () => {
    it('renders null values as empty', () => {
      render(
        <ListRenderer
          schema={simpleListView}
          rows={[{ name: 'Pen', price: null }]}
        />
      )

      expect(screen.getByText('Pen')).toBeTruthy()
      // null should render as empty (no text content)
    })

    it('renders undefined values as empty', () => {
      render(
        <ListRenderer
          schema={simpleListView}
          rows={[{ name: 'Pen' }]} // price is undefined
        />
      )

      expect(screen.getByText('Pen')).toBeTruthy()
    })

    it('renders number zero correctly', () => {
      render(
        <ListRenderer
          schema={simpleListView}
          rows={[{ name: 'Free Item', price: 0 }]}
        />
      )

      expect(screen.getByText('Free Item')).toBeTruthy()
      expect(screen.getByText('0')).toBeTruthy()
    })
  })
})
