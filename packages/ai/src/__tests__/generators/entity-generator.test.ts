/**
 * Entity Generator Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ok, err } from '@manifesto-ai/schema'
import { entityGenerator, type EntityGeneratorInput } from '../../generators/entity'
import type { AIClient } from '../../core/client'
import type { GeneratorContext } from '../../types'
import type { GeneratedEntity } from '../../core/schemas'

// ============================================================================
// Mock Setup
// ============================================================================

const createMockClient = (response: GeneratedEntity): AIClient => ({
  provider: {
    config: { type: 'openai', model: 'gpt-4o-mini' },
    type: 'openai',
    getModel: vi.fn(),
  },
  generateObject: vi.fn().mockResolvedValue(
    ok({
      value: response,
      metadata: {
        model: 'gpt-4o-mini',
        provider: 'openai',
        tokensUsed: { prompt: 100, completion: 200, total: 300 },
        latencyMs: 1000,
        cached: false,
      },
    })
  ),
  generateText: vi.fn(),
  generateWithTools: vi.fn(),
})

const createMockErrorClient = (error: unknown): AIClient => ({
  provider: {
    config: { type: 'openai', model: 'gpt-4o-mini' },
    type: 'openai',
    getModel: vi.fn(),
  },
  generateObject: vi.fn().mockResolvedValue(
    err({
      _type: 'PROVIDER_ERROR',
      provider: 'openai',
      message: String(error),
    })
  ),
  generateText: vi.fn(),
  generateWithTools: vi.fn(),
})

// ============================================================================
// Test Data
// ============================================================================

const VALID_GENERATED_ENTITY: GeneratedEntity = {
  id: 'customer',
  name: 'Customer',
  description: 'E-commerce customer entity',
  fields: [
    { id: 'id', dataType: 'string', label: 'ID', required: true },
    { id: 'email', dataType: 'string', label: 'Email', required: true },
    { id: 'name', dataType: 'string', label: 'Full Name', required: true },
    { id: 'phone', dataType: 'string', label: 'Phone Number', required: false },
    {
      id: 'status',
      dataType: 'enum',
      label: 'Status',
      required: false,
      enumValues: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
    { id: 'createdAt', dataType: 'datetime', label: 'Created At', required: true },
    { id: 'updatedAt', dataType: 'datetime', label: 'Updated At', required: true },
  ],
  relations: [{ type: 'hasMany', target: 'order' }],
  tags: ['core', 'user'],
}

const INVALID_ENTITY_NO_ID: GeneratedEntity = {
  id: 'customer',
  name: 'Customer',
  fields: [
    { id: 'email', dataType: 'string', label: 'Email', required: true },
    { id: 'name', dataType: 'string', label: 'Full Name', required: true },
  ],
}

const INVALID_ENTITY_ENUM_NO_VALUES: GeneratedEntity = {
  id: 'customer',
  name: 'Customer',
  fields: [
    { id: 'id', dataType: 'string', label: 'ID', required: true },
    { id: 'status', dataType: 'enum', label: 'Status', required: false },
  ],
}

// ============================================================================
// Tests
// ============================================================================

describe('entityGenerator', () => {
  const defaultInput: EntityGeneratorInput = {
    domainDescription: 'A customer management system for e-commerce',
  }

  const defaultContext: GeneratorContext = {
    industry: { type: 'commerce' },
  }

  describe('successful generation', () => {
    it('should generate a valid EntitySchema', async () => {
      const client = createMockClient(VALID_GENERATED_ENTITY)

      const result = await entityGenerator.generate(defaultInput, defaultContext, client)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        const entity = result.value.value
        expect(entity._type).toBe('entity')
        expect(entity.id).toBe('customer')
        expect(entity.name).toBe('Customer')
        expect(entity.version).toBe('0.1.0')
        expect(entity.fields).toHaveLength(7)
      }
    })

    it('should map fields correctly', async () => {
      const client = createMockClient(VALID_GENERATED_ENTITY)

      const result = await entityGenerator.generate(defaultInput, defaultContext, client)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        const entity = result.value.value
        const emailField = entity.fields.find((f) => f.id === 'email')
        const statusField = entity.fields.find((f) => f.id === 'status')

        expect(emailField).toBeDefined()
        expect(emailField?.dataType).toBe('string')
        expect(emailField?.constraints).toContainEqual({
          type: 'required',
          message: 'Email is required',
        })

        expect(statusField).toBeDefined()
        expect(statusField?.dataType).toBe('enum')
        expect(statusField?.enumValues).toHaveLength(2)
      }
    })

    it('should map relations correctly', async () => {
      const client = createMockClient(VALID_GENERATED_ENTITY)

      const result = await entityGenerator.generate(defaultInput, defaultContext, client)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        const entity = result.value.value
        expect(entity.relations).toBeDefined()
        expect(entity.relations).toHaveLength(1)
        expect(entity.relations?.[0].type).toBe('hasMany')
        expect(entity.relations?.[0].target).toBe('order')
      }
    })

    it('should include metadata in result', async () => {
      const client = createMockClient(VALID_GENERATED_ENTITY)

      const result = await entityGenerator.generate(defaultInput, defaultContext, client)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.metadata.model).toBe('gpt-4o-mini')
        expect(result.value.metadata.provider).toBe('openai')
        expect(result.value.metadata.tokensUsed.total).toBe(300)
        expect(result.value.metadata.latencyMs).toBe(1000)
      }
    })
  })

  describe('validation', () => {
    it('should fail if entity has no id field', async () => {
      const client = createMockClient(INVALID_ENTITY_NO_ID)

      const result = await entityGenerator.generate(defaultInput, defaultContext, client)

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error._type).toBe('SCHEMA_VALIDATION_ERROR')
        if (result.error._type === 'SCHEMA_VALIDATION_ERROR') {
          expect(result.error.message).toContain('id')
        }
      }
    })

    it('should fail if enum field has no values', async () => {
      const client = createMockClient(INVALID_ENTITY_ENUM_NO_VALUES)

      const result = await entityGenerator.generate(defaultInput, defaultContext, client)

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error._type).toBe('SCHEMA_VALIDATION_ERROR')
        if (result.error._type === 'SCHEMA_VALIDATION_ERROR') {
          expect(result.error.message).toContain('enumValues')
        }
      }
    })

    it('should skip validation when disabled', async () => {
      const client = createMockClient(INVALID_ENTITY_NO_ID)

      const generator = entityGenerator.withOptions({ validate: false })
      const result = await generator.generate(defaultInput, defaultContext, client)

      // Should succeed because validation is disabled
      expect(result._tag).toBe('Ok')
    })
  })

  describe('error handling', () => {
    it('should propagate provider errors', async () => {
      const client = createMockErrorClient('API error')

      const result = await entityGenerator.generate(defaultInput, defaultContext, client)

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error._type).toBe('PROVIDER_ERROR')
      }
    })
  })

  describe('monadic operations', () => {
    it('should support map transformation', async () => {
      const client = createMockClient(VALID_GENERATED_ENTITY)

      const countFieldsGenerator = entityGenerator.map((entity) => entity.fields.length)
      const result = await countFieldsGenerator.generate(defaultInput, defaultContext, client)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.value).toBe(7)
      }
    })

    it('should support withOptions', async () => {
      const client = createMockClient(VALID_GENERATED_ENTITY)

      const customGenerator = entityGenerator.withOptions({ temperature: 0.5 })
      const result = await customGenerator.generate(defaultInput, defaultContext, client)

      expect(result._tag).toBe('Ok')
      // Verify the options were applied (would need to check mock calls in real scenario)
    })

    it('should support withContext', async () => {
      const client = createMockClient(VALID_GENERATED_ENTITY)

      const contextGenerator = entityGenerator.withContext({
        industry: { type: 'finance' },
      })
      const result = await contextGenerator.generate(
        defaultInput,
        { industry: { type: 'commerce' } }, // This should be overridden
        client
      )

      expect(result._tag).toBe('Ok')
    })
  })
})
