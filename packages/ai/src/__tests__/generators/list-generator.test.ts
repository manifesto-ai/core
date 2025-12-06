/**
 * List Generator Tests
 */

import { describe, it, expect, vi } from 'vitest'
import type { EntitySchema } from '@manifesto-ai/schema'
import { listGenerator, type ListGeneratorInput } from '../../generators/list'
import type { AIClient } from '../../core/client'
import type { GeneratorContext } from '../../types'

// Mock EntitySchema
const mockEntity: EntitySchema = {
  _type: 'entity',
  id: 'product',
  name: 'Product',
  version: '0.1.0',
  fields: [
    { id: 'id', type: 'uuid', label: 'ID', required: true },
    { id: 'name', type: 'string', label: 'Name', required: true },
    { id: 'price', type: 'number', label: 'Price', required: true },
    {
      id: 'status',
      type: 'enum',
      label: 'Status',
      required: true,
      enumValues: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
    { id: 'createdAt', type: 'datetime', label: 'Created At', required: true },
  ],
}

// Mock AI response
const mockListViewResponse = {
  id: 'product-list',
  name: 'Product List',
  description: 'List of all products',
  columns: [
    {
      id: 'col-name',
      entityFieldId: 'name',
      type: 'text',
      label: 'Name',
      sortable: true,
      filterable: true,
      priority: 1,
    },
    {
      id: 'col-price',
      entityFieldId: 'price',
      type: 'number',
      label: 'Price',
      sortable: true,
      priority: 2,
      align: 'right',
    },
    {
      id: 'col-status',
      entityFieldId: 'status',
      type: 'enum',
      label: 'Status',
      sortable: true,
      filterable: true,
      priority: 3,
    },
  ],
  filters: [
    {
      id: 'filter-status',
      entityFieldId: 'status',
      label: 'Status',
      type: 'select',
    },
  ],
  searchable: true,
  pageSize: 20,
  defaultSort: {
    field: 'name',
    direction: 'asc' as const,
  },
}

// Create mock client
const createMockClient = (response: unknown): AIClient => ({
  generateObject: vi.fn().mockResolvedValue({
    _tag: 'Ok',
    value: {
      value: response,
      metadata: {
        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        finishReason: 'stop' as const,
        durationMs: 1000,
      },
    },
  }),
  generateText: vi.fn(),
  generateWithTools: vi.fn(),
})

describe('List Generator', () => {
  describe('listGenerator', () => {
    it('should have correct tag', () => {
      expect(listGenerator._tag).toBe('ListGenerator')
    })

    it('should generate ListView from EntitySchema', async () => {
      const client = createMockClient(mockListViewResponse)
      const context: GeneratorContext = {}

      const input: ListGeneratorInput = {
        entity: mockEntity,
        purpose: 'search',
      }

      const result = await listGenerator.generate(input, context, client)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        const listView = result.value.value
        expect(listView._type).toBe('view')
        expect(listView.mode).toBe('list')
        expect(listView.entityRef).toBe('product')
        expect(listView.columns.length).toBe(3)
        expect(listView.pagination?.enabled).toBe(true)
        expect(listView.sorting?.enabled).toBe(true)
      }
    })

    it('should include filters when configured', async () => {
      const client = createMockClient(mockListViewResponse)
      const context: GeneratorContext = {}

      const input: ListGeneratorInput = {
        entity: mockEntity,
        includeFilters: true,
      }

      const result = await listGenerator.generate(input, context, client)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        const listView = result.value.value
        expect(listView.filtering?.enabled).toBe(true)
        expect(listView.filtering?.fields?.length).toBeGreaterThan(0)
      }
    })

    it('should use custom API endpoint', async () => {
      const client = createMockClient(mockListViewResponse)
      const context: GeneratorContext = {}

      const input: ListGeneratorInput = {
        entity: mockEntity,
        apiEndpoint: '/api/custom/products',
      }

      const result = await listGenerator.generate(input, context, client)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        const listView = result.value.value
        expect(listView.dataSource.api?.endpoint).toBe('/api/custom/products')
      }
    })

    it('should return error for entity without fields', async () => {
      const client = createMockClient(mockListViewResponse)
      const context: GeneratorContext = {}

      const emptyEntity: EntitySchema = {
        _type: 'entity',
        id: 'empty',
        name: 'Empty',
        version: '0.1.0',
        fields: [],
      }

      const input: ListGeneratorInput = {
        entity: emptyEntity,
      }

      const result = await listGenerator.generate(input, context, client)

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error._type).toBe('INVALID_INPUT')
      }
    })

    it('should validate column entityFieldIds exist in entity', async () => {
      const invalidResponse = {
        ...mockListViewResponse,
        columns: [
          {
            id: 'col-invalid',
            entityFieldId: 'nonexistent',
            type: 'text',
            label: 'Invalid',
            priority: 1,
          },
        ],
      }

      const client = createMockClient(invalidResponse)
      const context: GeneratorContext = {}

      const input: ListGeneratorInput = {
        entity: mockEntity,
      }

      const result = await listGenerator.generate(input, context, client)

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error._type).toBe('SCHEMA_VALIDATION_ERROR')
      }
    })

    it('should validate filter entityFieldIds exist in entity', async () => {
      const invalidResponse = {
        ...mockListViewResponse,
        filters: [
          {
            id: 'filter-invalid',
            entityFieldId: 'nonexistent',
            label: 'Invalid',
            type: 'text',
          },
        ],
      }

      const client = createMockClient(invalidResponse)
      const context: GeneratorContext = {}

      const input: ListGeneratorInput = {
        entity: mockEntity,
      }

      const result = await listGenerator.generate(input, context, client)

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error._type).toBe('SCHEMA_VALIDATION_ERROR')
      }
    })

    it('should validate default sort field exists in entity', async () => {
      const invalidResponse = {
        ...mockListViewResponse,
        defaultSort: {
          field: 'nonexistent',
          direction: 'asc',
        },
      }

      const client = createMockClient(invalidResponse)
      const context: GeneratorContext = {}

      const input: ListGeneratorInput = {
        entity: mockEntity,
      }

      const result = await listGenerator.generate(input, context, client)

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error._type).toBe('SCHEMA_VALIDATION_ERROR')
      }
    })
  })

  describe('listGenerator monadic operations', () => {
    it('should map output', async () => {
      const client = createMockClient(mockListViewResponse)
      const context: GeneratorContext = {}

      const mappedGenerator = listGenerator.map((listView) => ({
        viewId: listView.id,
        columnCount: listView.columns.length,
      }))

      const input: ListGeneratorInput = {
        entity: mockEntity,
      }

      const result = await mappedGenerator.generate(input, context, client)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.value).toHaveProperty('viewId')
        expect(result.value.value).toHaveProperty('columnCount')
        expect(result.value.value.columnCount).toBe(3)
      }
    })

    it('should customize options with withOptions', async () => {
      const customGenerator = listGenerator.withOptions({
        temperature: 0.5,
        validate: false,
      })

      expect(customGenerator.options.temperature).toBe(0.5)
      expect(customGenerator.options.validate).toBe(false)
    })
  })
})
