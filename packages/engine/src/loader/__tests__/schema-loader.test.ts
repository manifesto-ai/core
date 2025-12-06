import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  SchemaLoader,
  createSchemaLoader,
} from '../schema-loader'
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
  fields: [
    { id: 'name', label: 'Name', dataType: 'string' },
  ],
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
      fields: [
        {
          id: 'field1',
          entityFieldId: 'field1',
          component: 'text-input',
        },
      ],
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

describe('SchemaLoader', () => {
  let loader: SchemaLoader

  beforeEach(() => {
    loader = createSchemaLoader()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('createSchemaLoader()', () => {
    test('creates loader with default options', () => {
      const l = createSchemaLoader()
      expect(l).toBeInstanceOf(SchemaLoader)
    })

    test('creates loader with custom options', () => {
      const l = createSchemaLoader({
        cache: false,
        cacheTTL: 1000,
        basePath: '/api/schemas',
      })
      expect(l).toBeInstanceOf(SchemaLoader)
    })
  })

  describe('load()', () => {
    test('loads schema from URL', async () => {
      const schema = createMockEntitySchema()
      mockFetch.mockReturnValue(mockResponse(schema))

      const result = await loader.load('test-entity')

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.id).toBe('test-entity')
        expect(result.value._type).toBe('entity')
      }
      expect(mockFetch).toHaveBeenCalledWith('/schemas/test-entity.json')
    })

    test('uses custom base path', async () => {
      const customLoader = createSchemaLoader({ basePath: '/api/v1/schemas' })
      const schema = createMockEntitySchema()
      mockFetch.mockReturnValue(mockResponse(schema))

      await customLoader.load('my-schema')

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/schemas/my-schema.json')
    })

    test('handles leading slashes in schema ID', async () => {
      const schema = createMockEntitySchema()
      mockFetch.mockReturnValue(mockResponse(schema))

      await loader.load('/test-entity')

      expect(mockFetch).toHaveBeenCalledWith('/schemas/test-entity.json')
    })

    test('returns cached schema on subsequent loads', async () => {
      const schema = createMockEntitySchema()
      mockFetch.mockReturnValue(mockResponse(schema))

      await loader.load('cached-schema')
      await loader.load('cached-schema')

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    test('skips cache when disabled', async () => {
      const noCacheLoader = createSchemaLoader({ cache: false })
      const schema = createMockEntitySchema()
      mockFetch.mockReturnValue(mockResponse(schema))

      await noCacheLoader.load('no-cache-schema')
      await noCacheLoader.load('no-cache-schema')

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    test('returns NOT_FOUND error for 404 response', async () => {
      mockFetch.mockReturnValue(mockResponse({}, 404))

      const result = await loader.load('nonexistent')

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.type).toBe('NOT_FOUND')
        expect(result.error).toHaveProperty('schemaId', 'nonexistent')
      }
    })

    test('returns FETCH_ERROR for other HTTP errors', async () => {
      mockFetch.mockReturnValue(mockResponse({}, 500))

      const result = await loader.load('server-error')

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.type).toBe('FETCH_ERROR')
        expect(result.error).toHaveProperty('url')
      }
    })

    test('returns FETCH_ERROR for network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await loader.load('network-fail')

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.type).toBe('FETCH_ERROR')
        expect((result.error as any).message).toContain('Network error')
      }
    })

    test('returns VALIDATION_ERROR for invalid schema', async () => {
      const invalidSchema = { invalid: 'data' }
      mockFetch.mockReturnValue(mockResponse(invalidSchema))

      const result = await loader.load('invalid-schema')

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.type).toBe('VALIDATION_ERROR')
      }
    })
  })

  describe('loadFromData()', () => {
    test('loads schema from object data', () => {
      const schema = createMockEntitySchema('from-data')
      const result = loader.loadFromData('from-data', schema)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.id).toBe('from-data')
      }
    })

    test('loads schema from JSON string', () => {
      const schema = createMockEntitySchema('from-string')
      const result = loader.loadFromData('from-string', JSON.stringify(schema))

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.id).toBe('from-string')
      }
    })

    test('returns PARSE_ERROR for invalid JSON string', () => {
      const result = loader.loadFromData('bad-json', 'not valid json')

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.type).toBe('PARSE_ERROR')
      }
    })

    test('returns VALIDATION_ERROR for invalid schema data', () => {
      const result = loader.loadFromData('invalid', { foo: 'bar' })

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.type).toBe('VALIDATION_ERROR')
      }
    })

    test('caches loaded schema', () => {
      const schema = createMockEntitySchema('cached-data')
      loader.loadFromData('cached-data', schema)

      expect(loader.getCachedSchemas()).toContain('cached-data')
    })
  })

  describe('loadMany()', () => {
    test('loads multiple schemas', async () => {
      const entity1 = createMockEntitySchema('entity1')
      const entity2 = createMockEntitySchema('entity2')

      mockFetch
        .mockReturnValueOnce(mockResponse(entity1))
        .mockReturnValueOnce(mockResponse(entity2))

      const result = await loader.loadMany(['entity1', 'entity2'])

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.size).toBe(2)
        expect(result.value.get('entity1')?.id).toBe('entity1')
        expect(result.value.get('entity2')?.id).toBe('entity2')
      }
    })

    test('returns error if any schema fails to load', async () => {
      const entity = createMockEntitySchema('entity1')

      mockFetch
        .mockReturnValueOnce(mockResponse(entity))
        .mockReturnValueOnce(mockResponse({}, 404))

      const result = await loader.loadMany(['entity1', 'missing'])

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.type).toBe('NOT_FOUND')
      }
    })

    test('loads empty array successfully', async () => {
      const result = await loader.loadMany([])

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.size).toBe(0)
      }
    })
  })

  describe('loadEntity()', () => {
    test('loads entity schema', async () => {
      const entity = createMockEntitySchema()
      mockFetch.mockReturnValue(mockResponse(entity))

      const result = await loader.loadEntity('test-entity')

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value._type).toBe('entity')
      }
    })

    test('returns error for non-entity schema', async () => {
      const view = createMockViewSchema()
      mockFetch.mockReturnValue(mockResponse(view))

      const result = await loader.loadEntity('test-view')

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.type).toBe('VALIDATION_ERROR')
      }
    })
  })

  describe('loadView()', () => {
    test('loads view schema', async () => {
      const view = createMockViewSchema()
      mockFetch.mockReturnValue(mockResponse(view))

      const result = await loader.loadView('test-view')

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value._type).toBe('view')
      }
    })

    test('returns error for non-view schema', async () => {
      const entity = createMockEntitySchema()
      mockFetch.mockReturnValue(mockResponse(entity))

      const result = await loader.loadView('test-entity')

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.type).toBe('VALIDATION_ERROR')
      }
    })
  })

  describe('loadAction()', () => {
    test('loads action schema', async () => {
      const action = createMockActionSchema()
      mockFetch.mockReturnValue(mockResponse(action))

      const result = await loader.loadAction('test-action')

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value._type).toBe('action')
      }
    })

    test('returns error for non-action schema', async () => {
      const entity = createMockEntitySchema()
      mockFetch.mockReturnValue(mockResponse(entity))

      const result = await loader.loadAction('test-entity')

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.type).toBe('VALIDATION_ERROR')
      }
    })
  })

  describe('Cache Management', () => {
    test('invalidate() removes schema from cache', async () => {
      const schema = createMockEntitySchema('to-invalidate')
      mockFetch.mockReturnValue(mockResponse(schema))

      await loader.load('to-invalidate')
      expect(loader.getCachedSchemas()).toContain('to-invalidate')

      loader.invalidate('to-invalidate')
      expect(loader.getCachedSchemas()).not.toContain('to-invalidate')
    })

    test('clearCache() removes all schemas', async () => {
      const schema1 = createMockEntitySchema('schema1')
      const schema2 = createMockEntitySchema('schema2')

      mockFetch
        .mockReturnValueOnce(mockResponse(schema1))
        .mockReturnValueOnce(mockResponse(schema2))

      await loader.load('schema1')
      await loader.load('schema2')
      expect(loader.getCachedSchemas().length).toBe(2)

      loader.clearCache()
      expect(loader.getCachedSchemas().length).toBe(0)
    })

    test('getCachedSchemas() returns list of cached schema IDs', async () => {
      const schema = createMockEntitySchema()
      mockFetch.mockReturnValue(mockResponse(schema))

      await loader.load('cached1')

      mockFetch.mockReturnValue(mockResponse(createMockViewSchema('cached2')))
      await loader.load('cached2')

      const cached = loader.getCachedSchemas()
      expect(cached).toContain('cached1')
      expect(cached).toContain('cached2')
    })

    test('cache expires after TTL', async () => {
      const shortTTLLoader = createSchemaLoader({ cacheTTL: 100 }) // 100ms TTL
      const schema = createMockEntitySchema('ttl-test')
      mockFetch.mockReturnValue(mockResponse(schema))

      await shortTTLLoader.load('ttl-test')

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150))

      await shortTTLLoader.load('ttl-test')

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('URL Composition', () => {
    test('handles trailing slashes in base path', async () => {
      const loaderWithSlash = createSchemaLoader({ basePath: '/schemas/' })
      const schema = createMockEntitySchema()
      mockFetch.mockReturnValue(mockResponse(schema))

      await loaderWithSlash.load('test')

      expect(mockFetch).toHaveBeenCalledWith('/schemas/test.json')
    })

    test('builds correct URL with nested path', async () => {
      const schema = createMockEntitySchema()
      mockFetch.mockReturnValue(mockResponse(schema))

      await loader.load('entities/user')

      expect(mockFetch).toHaveBeenCalledWith('/schemas/entities/user.json')
    })
  })
})
