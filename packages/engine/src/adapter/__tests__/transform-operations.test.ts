/**
 * Transform Operations Tests
 */

import { describe, it, expect } from 'vitest'
import {
  executeTransformPipeline,
  getPath,
  setPath,
  type TransformStepConfig,
} from '../transform-operations'

describe('Transform Operations', () => {
  describe('getPath', () => {
    it('should get nested path value', () => {
      const obj = { a: { b: { c: 123 } } }
      expect(getPath(obj, 'a.b.c')).toBe(123)
    })

    it('should return undefined for non-existent path', () => {
      const obj = { a: { b: 1 } }
      expect(getPath(obj, 'a.c.d')).toBeUndefined()
    })

    it('should handle single-level path', () => {
      const obj = { name: 'test' }
      expect(getPath(obj, 'name')).toBe('test')
    })
  })

  describe('setPath', () => {
    it('should set nested path value', () => {
      const obj: Record<string, unknown> = {}
      setPath(obj, 'a.b.c', 123)
      expect(obj).toEqual({ a: { b: { c: 123 } } })
    })

    it('should override existing value', () => {
      const obj: Record<string, unknown> = { a: { b: 1 } }
      setPath(obj, 'a.b', 2)
      expect(obj).toEqual({ a: { b: 2 } })
    })
  })

  describe('map operation', () => {
    it('should map fields using array mappings', () => {
      const steps: TransformStepConfig[] = [
        {
          operation: 'map',
          config: {
            mappings: [
              { from: 'firstName', to: 'name.first' },
              { from: 'lastName', to: 'name.last' },
            ],
          },
        },
      ]

      const result = executeTransformPipeline(
        { firstName: 'John', lastName: 'Doe' },
        steps
      )

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({
          name: { first: 'John', last: 'Doe' },
        })
      }
    })

    it('should map fields using object mappings', () => {
      const steps: TransformStepConfig[] = [
        {
          operation: 'map',
          config: {
            mappings: {
              fullName: 'user.name',
              email: 'user.email',
            },
          },
        },
      ]

      const result = executeTransformPipeline(
        { user: { name: 'John', email: 'john@test.com' } },
        steps
      )

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({
          fullName: 'John',
          email: 'john@test.com',
        })
      }
    })
  })

  describe('pick operation', () => {
    it('should pick only specified keys', () => {
      const steps: TransformStepConfig[] = [
        {
          operation: 'pick',
          config: { keys: ['name', 'email'] },
        },
      ]

      const result = executeTransformPipeline(
        { name: 'John', email: 'john@test.com', age: 30, password: 'secret' },
        steps
      )

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({ name: 'John', email: 'john@test.com' })
      }
    })
  })

  describe('omit operation', () => {
    it('should omit specified keys', () => {
      const steps: TransformStepConfig[] = [
        {
          operation: 'omit',
          config: { keys: ['password', 'secret'] },
        },
      ]

      const result = executeTransformPipeline(
        { name: 'John', password: 'secret123', email: 'john@test.com', secret: 'key' },
        steps
      )

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({ name: 'John', email: 'john@test.com' })
      }
    })
  })

  describe('rename operation', () => {
    it('should rename fields', () => {
      const steps: TransformStepConfig[] = [
        {
          operation: 'rename',
          config: {
            renames: {
              old_name: 'newName',
              old_email: 'newEmail',
            },
          },
        },
      ]

      const result = executeTransformPipeline(
        { old_name: 'John', old_email: 'john@test.com', unchanged: 'value' },
        steps
      )

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({
          newName: 'John',
          newEmail: 'john@test.com',
          unchanged: 'value',
        })
      }
    })
  })

  describe('flatten operation', () => {
    it('should flatten nested object', () => {
      const steps: TransformStepConfig[] = [
        {
          operation: 'flatten',
          config: { delimiter: '.' },
        },
      ]

      const result = executeTransformPipeline(
        { user: { name: 'John', address: { city: 'Seoul' } } },
        steps
      )

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({
          'user.name': 'John',
          'user.address.city': 'Seoul',
        })
      }
    })

    it('should respect max depth', () => {
      const steps: TransformStepConfig[] = [
        {
          operation: 'flatten',
          config: { delimiter: '.', depth: 1 },
        },
      ]

      const result = executeTransformPipeline(
        { user: { name: 'John', address: { city: 'Seoul' } } },
        steps
      )

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({
          'user.name': 'John',
          'user.address': { city: 'Seoul' },
        })
      }
    })
  })

  describe('unflatten operation', () => {
    it('should unflatten to nested object', () => {
      const steps: TransformStepConfig[] = [
        {
          operation: 'unflatten',
          config: { delimiter: '.' },
        },
      ]

      const result = executeTransformPipeline(
        { 'user.name': 'John', 'user.address.city': 'Seoul' },
        steps
      )

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({
          user: { name: 'John', address: { city: 'Seoul' } },
        })
      }
    })
  })

  describe('cast operation', () => {
    it('should cast values to specified types', () => {
      const steps: TransformStepConfig[] = [
        {
          operation: 'cast',
          config: {
            casts: {
              age: 'number',
              active: 'boolean',
              score: 'string',
            },
          },
        },
      ]

      const result = executeTransformPipeline(
        { age: '30', active: 'true', score: 95 },
        steps
      )

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({
          age: 30,
          active: true,
          score: '95',
        })
      }
    })
  })

  describe('default operation', () => {
    it('should set default values for missing fields', () => {
      const steps: TransformStepConfig[] = [
        {
          operation: 'default',
          config: {
            defaults: {
              name: 'Unknown',
              age: 0,
              active: true,
            },
          },
        },
      ]

      const result = executeTransformPipeline({ name: 'John' }, steps)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({
          name: 'John',
          age: 0,
          active: true,
        })
      }
    })
  })

  describe('template operation', () => {
    it('should apply template string', () => {
      const steps: TransformStepConfig[] = [
        {
          operation: 'template',
          config: {
            template: {
              fullName: '${firstName} ${lastName}',
              greeting: 'Hello, ${firstName}!',
            },
          },
        },
      ]

      const result = executeTransformPipeline(
        { firstName: 'John', lastName: 'Doe' },
        steps
      )

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({
          firstName: 'John',
          lastName: 'Doe',
          fullName: 'John Doe',
          greeting: 'Hello, John!',
        })
      }
    })
  })

  describe('custom operation', () => {
    it('should execute custom transform function', () => {
      const steps: TransformStepConfig[] = [
        {
          operation: 'custom',
          config: {
            transform: (data: unknown) => {
              const d = data as { items: number[] }
              return { total: d.items.reduce((a, b) => a + b, 0) }
            },
          },
        },
      ]

      const result = executeTransformPipeline({ items: [1, 2, 3, 4, 5] }, steps)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({ total: 15 })
      }
    })

    it('should pass through data when transform is missing', () => {
      const steps: TransformStepConfig[] = [
        {
          operation: 'custom',
          config: {},
        },
      ]

      const input = { untouched: true }
      const result = executeTransformPipeline(input, steps)
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual(input)
      }
    })
  })

  describe('pipeline execution', () => {
    it('should execute multiple steps in order', () => {
      const steps: TransformStepConfig[] = [
        {
          operation: 'pick',
          config: { keys: ['user'] },
        },
        {
          operation: 'flatten',
          config: { delimiter: '_' },
        },
        {
          operation: 'rename',
          config: {
            renames: {
              user_name: 'userName',
              user_email: 'userEmail',
            },
          },
        },
      ]

      const result = executeTransformPipeline(
        { user: { name: 'John', email: 'john@test.com' }, extra: 'data' },
        steps
      )

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({
          userName: 'John',
          userEmail: 'john@test.com',
        })
      }
    })

    it('should handle errors gracefully', () => {
      const steps: TransformStepConfig[] = [
        {
          operation: 'unknown_operation' as any,
          config: {},
        },
      ]

      const result = executeTransformPipeline({ data: 'test' }, steps)

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.type).toBe('TRANSFORM_ERROR')
      }
    })

    it('should surface transform errors thrown by operations', () => {
      const steps: TransformStepConfig[] = [
        {
          operation: 'custom',
          config: {
            transform: () => {
              throw new Error('boom')
            },
          },
        },
      ]

      const result = executeTransformPipeline({ foo: 'bar' }, steps)
      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.operation).toBe('custom')
      }
    })
  })

  describe('additional operations coverage', () => {
    it('passes through non-object inputs for map/pick/omit/rename', () => {
      const steps: TransformStepConfig[] = [
        { operation: 'map', config: { mappings: { a: 'a' } } },
        { operation: 'pick', config: { keys: ['a'] } },
        { operation: 'omit', config: { keys: ['b'] } },
        { operation: 'rename', config: { renames: { c: 'd' } } },
      ]

      const result = executeTransformPipeline(123, steps)
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toBe(123)
      }
    })

    it('filters arrays with predicate and objects with keys', () => {
      const predicateStep: TransformStepConfig = {
        operation: 'filter',
        config: { predicate: (item: number) => item > 2 },
      }
      const objectStep: TransformStepConfig = {
        operation: 'filter',
        config: { keys: ['keep'] },
      }

      const arrayResult = executeTransformPipeline([1, 2, 3, 4], [predicateStep])
      expect(arrayResult._tag).toBe('Ok')
      if (arrayResult._tag === 'Ok') {
        expect(arrayResult.value).toEqual([3, 4])
      }

      const objectResult = executeTransformPipeline({ keep: 1, drop: 2 }, [objectStep])
      expect(objectResult._tag).toBe('Ok')
      if (objectResult._tag === 'Ok') {
        expect(objectResult.value).toEqual({ keep: 1 })
      }
    })

    it('returns original value when filter input is not array/object', () => {
      const steps: TransformStepConfig[] = [{ operation: 'filter', config: { keys: ['x'] } }]
      const result = executeTransformPipeline('noop', steps)
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toBe('noop')
      }
    })

    it('reduces arrays when reducer is provided', () => {
      const steps: TransformStepConfig[] = [
        {
          operation: 'reduce',
          config: { reducer: (acc: number, n: number) => acc + n, initial: 0 },
        },
      ]

      const result = executeTransformPipeline([1, 2, 3], steps)
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toBe(6)
      }
    })

    it('returns original value when reduce input is not an array', () => {
      const steps: TransformStepConfig[] = [
        { operation: 'reduce', config: { reducer: (a: number, b: number) => a + b, initial: 0 } },
      ]
      const result = executeTransformPipeline({ not: 'array' }, steps)
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({ not: 'array' })
      }
    })

    it('applies defaults when values are null or undefined', () => {
      const steps: TransformStepConfig[] = [
        {
          operation: 'default',
          config: { defaults: { name: 'Unknown', rating: 5 } },
        },
      ]

      const result = executeTransformPipeline({ name: null }, steps)
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({ name: 'Unknown', rating: 5 })
      }
    })

    it('returns defaults when input is not an object', () => {
      const steps: TransformStepConfig[] = [{ operation: 'default', config: { defaults: { foo: 'bar' } } }]
      const result = executeTransformPipeline(undefined, steps)
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({ foo: 'bar' })
      }
    })

    it('casts to date and array types and leaves unknown types intact', () => {
      const steps: TransformStepConfig[] = [
        {
          operation: 'cast',
          config: { casts: { createdAt: 'date', tags: 'array', passthrough: 'unknown' } },
        },
      ]

      const result = executeTransformPipeline(
        { createdAt: '2024-01-01', tags: 'tag', passthrough: 1, none: null },
        steps
      )

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.createdAt instanceof Date).toBe(true)
        expect(result.value.tags).toEqual(['tag'])
        expect(result.value.passthrough).toBe(1)
        expect(result.value.none).toBeNull()
      }
    })

    it('passes through data for template and cast when inputs are primitives', () => {
      const steps: TransformStepConfig[] = [
        { operation: 'template', config: { template: { label: '${missing}' } } },
        { operation: 'cast', config: { casts: { value: 'boolean' } } },
      ]

      const result = executeTransformPipeline('text', steps)
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toBe('text')
      }
    })
  })
})
