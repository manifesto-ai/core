/**
 * useFormRuntime Hook Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFormRuntime } from '../hooks/useFormRuntime'
import type { ViewSchema } from '@manifesto-ai/schema'

// Mock schema
const createMockSchema = (id: string = 'test-form'): ViewSchema => ({
  id,
  version: '1.0',
  sections: [
    {
      id: 'section-1',
      title: 'Test Section',
      fields: [
        {
          id: 'name',
          label: 'Name',
          component: 'text-input',
        },
        {
          id: 'age',
          label: 'Age',
          component: 'number-input',
        },
      ],
    },
  ],
})

describe('useFormRuntime', () => {
  it('should initialize with null schema', () => {
    const { result } = renderHook(() => useFormRuntime(null))

    expect(result.current.isInitialized).toBe(false)
    expect(result.current.values).toEqual({})
  })

  it('should initialize with valid schema', () => {
    const schema = createMockSchema()
    const { result } = renderHook(() => useFormRuntime(schema))

    expect(result.current.isInitialized).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('should set field value', () => {
    const schema = createMockSchema()
    const { result } = renderHook(() => useFormRuntime(schema))

    act(() => {
      result.current.setFieldValue('name', 'John')
    })

    expect(result.current.values.name).toBe('John')
  })

  it('should set multiple values', () => {
    const schema = createMockSchema()
    const { result } = renderHook(() => useFormRuntime(schema))

    act(() => {
      result.current.setValues({ name: 'John', age: 30 })
    })

    expect(result.current.values.name).toBe('John')
    expect(result.current.values.age).toBe(30)
  })

  it('should reset form', () => {
    const schema = createMockSchema()
    const { result } = renderHook(() =>
      useFormRuntime(schema, { initialValues: { name: 'Initial' } })
    )

    act(() => {
      result.current.setFieldValue('name', 'Changed')
    })

    expect(result.current.values.name).toBe('Changed')

    act(() => {
      result.current.reset()
    })

    expect(result.current.values.name).toBe('Initial')
  })

  it('should not cause infinite loop when options change', () => {
    const schema = createMockSchema()
    let renderCount = 0

    const { rerender } = renderHook(
      ({ options }) => {
        renderCount++
        return useFormRuntime(schema, options)
      },
      {
        initialProps: { options: { initialValues: { name: 'Test' } } },
      }
    )

    // Rerender with new object reference but same values
    rerender({ options: { initialValues: { name: 'Test' } } })
    rerender({ options: { initialValues: { name: 'Test' } } })
    rerender({ options: { initialValues: { name: 'Test' } } })

    // Should not cause excessive re-renders
    expect(renderCount).toBeLessThan(10)
  })
})
