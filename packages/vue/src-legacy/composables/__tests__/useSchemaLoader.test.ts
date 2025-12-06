import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import {
  useSchemaLoader,
  useEntitySchema,
  useViewSchema,
  useActionSchema,
} from '../useSchemaLoader'
import type { EntitySchema, ViewSchema, ActionSchema } from '@manifesto-ai/schema'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Test fixtures
const createMockEntitySchema = (id: string = 'test-entity'): EntitySchema => ({
  _type: 'entity',
  id,
  name: 'Test Entity',
  version: '0.1.0',
  fields: [{ id: 'name', label: 'Name', dataType: 'string' }],
})

const createMockViewSchema = (id: string = 'test-view'): ViewSchema => ({
  _type: 'view',
  id,
  name: 'Test View',
  version: '0.1.0',
  entityRef: 'test-entity',
  mode: 'create',
  layout: { type: 'form' },
  sections: [
    {
      id: 'section1',
      title: 'Test Section',
      layout: { type: 'form' },
      fields: [{ id: 'field1', entityFieldId: 'field1', component: 'text-input' }],
    },
  ],
})

const createMockActionSchema = (id: string = 'test-action'): ActionSchema => ({
  _type: 'action',
  id,
  name: 'Test Action',
  version: '0.1.0',
  trigger: { type: 'manual' },
  steps: [],
})

const mockResponse = (data: unknown, status = 200) => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
  })
}

describe('useSchemaLoader', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    test('starts with null schema', () => {
      const { schema } = useSchemaLoader()
      expect(schema.value).toBe(null)
    })

    test('starts with not loading', () => {
      const { isLoading } = useSchemaLoader()
      expect(isLoading.value).toBe(false)
    })

    test('starts with no error', () => {
      const { error } = useSchemaLoader()
      expect(error.value).toBe(null)
    })
  })

  describe('load()', () => {
    test('loads schema successfully', async () => {
      const entitySchema = createMockEntitySchema()
      mockFetch.mockReturnValue(mockResponse(entitySchema))

      const { schema, load, isLoading, error } = useSchemaLoader()

      expect(isLoading.value).toBe(false)

      const loadPromise = load('test-entity')

      // Loading should be true during fetch
      expect(isLoading.value).toBe(true)

      await loadPromise

      expect(isLoading.value).toBe(false)
      expect(error.value).toBe(null)
      expect(schema.value).not.toBe(null)
      expect(schema.value?.id).toBe('test-entity')
    })

    test('sets error on load failure', async () => {
      mockFetch.mockReturnValue(mockResponse({}, 404))

      const { schema, error, load } = useSchemaLoader()

      await load('nonexistent')

      expect(schema.value).toBe(null)
      expect(error.value).not.toBe(null)
      expect(error.value?.type).toBe('NOT_FOUND')
    })

    test('handles network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const { schema, error, load } = useSchemaLoader()

      await load('network-fail')

      expect(schema.value).toBe(null)
      expect(error.value).not.toBe(null)
      expect(error.value?.type).toBe('FETCH_ERROR')
    })
  })

  describe('loadMany()', () => {
    test('loads first schema from multiple', async () => {
      const entity1 = createMockEntitySchema('entity1')
      const entity2 = createMockEntitySchema('entity2')

      mockFetch
        .mockReturnValueOnce(mockResponse(entity1))
        .mockReturnValueOnce(mockResponse(entity2))

      const { schema, loadMany } = useSchemaLoader()

      await loadMany(['entity1', 'entity2'])

      // loadMany stores first schema
      expect(schema.value).not.toBe(null)
      expect(schema.value?.id).toBe('entity1')
    })

    test('loads multiple schemas when all succeed', async () => {
      const entity1 = createMockEntitySchema('multi1')
      const entity2 = createMockEntitySchema('multi2')

      mockFetch
        .mockReturnValueOnce(mockResponse(entity1))
        .mockReturnValueOnce(mockResponse(entity2))

      const { schema, error, loadMany } = useSchemaLoader()

      await loadMany(['multi1', 'multi2'])

      // Successfully loaded
      expect(error.value).toBe(null)
      expect(schema.value).not.toBe(null)
    })
  })

  describe('Cache Management', () => {
    test('load caches schema', async () => {
      const entity = createMockEntitySchema('cache-test-1')
      mockFetch.mockReturnValue(mockResponse(entity))

      const { load, cachedSchemas } = useSchemaLoader()

      await load('cache-test-1')

      // Schema should be cached
      expect(cachedSchemas.value).toContain('cache-test-1')
    })

    test('invalidate and clearCache are callable', async () => {
      const entity = createMockEntitySchema('cache-test-2')
      mockFetch.mockReturnValue(mockResponse(entity))

      const { load, invalidate, clearCache, cachedSchemas } = useSchemaLoader()

      await load('cache-test-2')

      // Methods should be callable without error
      expect(() => invalidate('cache-test-2')).not.toThrow()
      expect(() => clearCache()).not.toThrow()
    })

    test('cachedSchemas returns array', async () => {
      const entity = createMockEntitySchema('cache-test-3')
      mockFetch.mockReturnValue(mockResponse(entity))

      const { load, cachedSchemas } = useSchemaLoader()

      await load('cache-test-3')

      expect(Array.isArray(cachedSchemas.value)).toBe(true)
    })
  })
})

describe('useEntitySchema', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  test('types schema as EntitySchema', async () => {
    const entity = createMockEntitySchema()
    mockFetch.mockReturnValue(mockResponse(entity))

    const { schema, load } = useEntitySchema()

    await load('test-entity')

    expect(schema.value?._type).toBe('entity')
    // TypeScript: schema.value is EntitySchema | null
  })
})

describe('useViewSchema', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  test('types schema as ViewSchema', async () => {
    const view = createMockViewSchema()
    mockFetch.mockReturnValue(mockResponse(view))

    const { schema, load } = useViewSchema()

    await load('test-view')

    expect(schema.value?._type).toBe('view')
  })
})

describe('useActionSchema', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  test('types schema as ActionSchema', async () => {
    const action = createMockActionSchema()
    mockFetch.mockReturnValue(mockResponse(action))

    const { schema, load } = useActionSchema()

    await load('test-action')

    expect(schema.value?._type).toBe('action')
  })
})
