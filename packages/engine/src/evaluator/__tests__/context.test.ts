import { describe, test, expect } from 'vitest'
import {
  createEmptyContext,
  createContext,
  getByPath,
  resolveContextReference,
  type EvaluationContext,
} from '../context'

describe('Evaluation Context', () => {
  describe('createEmptyContext()', () => {
    test('creates context with all empty objects', () => {
      const ctx = createEmptyContext()
      expect(ctx.state).toEqual({})
      expect(ctx.context).toEqual({})
      expect(ctx.user).toEqual({})
      expect(ctx.params).toEqual({})
      expect(ctx.result).toEqual({})
      expect(ctx.env).toEqual({})
    })

    test('context properties are readonly', () => {
      const ctx = createEmptyContext()
      // TypeScript prevents direct modification but runtime object is mutable
      // This test ensures the interface contract
      expect(Object.keys(ctx)).toEqual(['state', 'context', 'user', 'params', 'result', 'env'])
    })
  })

  describe('createContext()', () => {
    test('creates context with partial values', () => {
      const ctx = createContext({
        state: { name: 'John' },
        user: { id: '123' },
      })
      expect(ctx.state).toEqual({ name: 'John' })
      expect(ctx.user).toEqual({ id: '123' })
      expect(ctx.context).toEqual({})
      expect(ctx.params).toEqual({})
      expect(ctx.result).toEqual({})
      expect(ctx.env).toEqual({})
    })

    test('creates context with all values', () => {
      const ctx = createContext({
        state: { name: 'John', age: 30 },
        context: { brandId: 'brand1' },
        user: { id: 'user1', role: 'admin' },
        params: { id: '123' },
        result: { data: [1, 2, 3] },
        env: { API_URL: 'https://api.example.com' },
      })
      expect(ctx.state.name).toBe('John')
      expect(ctx.context.brandId).toBe('brand1')
      expect(ctx.user.role).toBe('admin')
      expect(ctx.params.id).toBe('123')
      expect(ctx.result.data).toEqual([1, 2, 3])
      expect(ctx.env.API_URL).toBe('https://api.example.com')
    })

    test('creates context with empty partial', () => {
      const ctx = createContext({})
      expect(ctx).toEqual(createEmptyContext())
    })
  })

  describe('getByPath()', () => {
    test('gets top-level property', () => {
      const obj = { name: 'John', age: 30 }
      expect(getByPath(obj, 'name')).toBe('John')
      expect(getByPath(obj, 'age')).toBe(30)
    })

    test('gets nested property', () => {
      const obj = {
        user: {
          profile: {
            name: 'John',
            address: {
              city: 'Seoul',
            },
          },
        },
      }
      expect(getByPath(obj, 'user.profile.name')).toBe('John')
      expect(getByPath(obj, 'user.profile.address.city')).toBe('Seoul')
    })

    test('returns undefined for non-existent path', () => {
      const obj = { name: 'John' }
      expect(getByPath(obj, 'age')).toBeUndefined()
      expect(getByPath(obj, 'user.name')).toBeUndefined()
      expect(getByPath(obj, 'deeply.nested.path')).toBeUndefined()
    })

    test('returns undefined when intermediate value is null', () => {
      const obj = { user: null }
      expect(getByPath(obj, 'user.name')).toBeUndefined()
    })

    test('returns undefined when intermediate value is undefined', () => {
      const obj = { user: undefined }
      expect(getByPath(obj, 'user.name')).toBeUndefined()
    })

    test('returns undefined when intermediate value is not an object', () => {
      const obj = { count: 42 }
      expect(getByPath(obj, 'count.value')).toBeUndefined()
    })

    test('handles array access', () => {
      const obj = { items: ['a', 'b', 'c'] }
      expect(getByPath(obj, 'items.0')).toBe('a')
      expect(getByPath(obj, 'items.1')).toBe('b')
      expect(getByPath(obj, 'items.2')).toBe('c')
    })

    test('handles nested array access', () => {
      const obj = {
        data: {
          users: [
            { name: 'Alice' },
            { name: 'Bob' },
          ],
        },
      }
      expect(getByPath(obj, 'data.users.0.name')).toBe('Alice')
      expect(getByPath(obj, 'data.users.1.name')).toBe('Bob')
    })

    test('handles empty path', () => {
      const obj = { name: 'John' }
      // Empty path returns obj[''] which is undefined
      expect(getByPath(obj, '')).toBeUndefined()
    })
  })

  describe('resolveContextReference()', () => {
    const ctx: EvaluationContext = {
      state: { name: 'John', age: 30, user: { email: 'john@example.com' } },
      context: { brandId: 'brand1', settings: { theme: 'dark' } },
      user: { id: 'user1', role: 'admin', permissions: ['read', 'write'] },
      params: { id: '123', mode: 'edit' },
      result: { data: { items: [1, 2, 3] }, success: true },
      env: { API_URL: 'https://api.example.com' },
    }

    test('resolves $state reference', () => {
      expect(resolveContextReference(ctx, '$state.name')).toBe('John')
      expect(resolveContextReference(ctx, '$state.age')).toBe(30)
      expect(resolveContextReference(ctx, '$state.user.email')).toBe('john@example.com')
    })

    test('resolves $context reference', () => {
      expect(resolveContextReference(ctx, '$context.brandId')).toBe('brand1')
      expect(resolveContextReference(ctx, '$context.settings.theme')).toBe('dark')
    })

    test('resolves $user reference', () => {
      expect(resolveContextReference(ctx, '$user.id')).toBe('user1')
      expect(resolveContextReference(ctx, '$user.role')).toBe('admin')
      expect(resolveContextReference(ctx, '$user.permissions')).toEqual(['read', 'write'])
    })

    test('resolves $params reference', () => {
      expect(resolveContextReference(ctx, '$params.id')).toBe('123')
      expect(resolveContextReference(ctx, '$params.mode')).toBe('edit')
    })

    test('resolves $result reference', () => {
      expect(resolveContextReference(ctx, '$result.success')).toBe(true)
      expect(resolveContextReference(ctx, '$result.data.items')).toEqual([1, 2, 3])
    })

    test('resolves $env reference', () => {
      expect(resolveContextReference(ctx, '$env.API_URL')).toBe('https://api.example.com')
    })

    test('returns undefined for non-$ prefix', () => {
      expect(resolveContextReference(ctx, 'state.name')).toBeUndefined()
      expect(resolveContextReference(ctx, 'name')).toBeUndefined()
    })

    test('returns undefined for unknown namespace', () => {
      expect(resolveContextReference(ctx, '$unknown.value')).toBeUndefined()
      expect(resolveContextReference(ctx, '$foo.bar')).toBeUndefined()
    })

    test('returns undefined for non-existent path', () => {
      expect(resolveContextReference(ctx, '$state.nonexistent')).toBeUndefined()
      expect(resolveContextReference(ctx, '$user.deeply.nested.value')).toBeUndefined()
    })

    test('handles top-level namespace without path', () => {
      // $state without path should return empty string path lookup
      expect(resolveContextReference(ctx, '$state')).toBeUndefined()
    })
  })
})
