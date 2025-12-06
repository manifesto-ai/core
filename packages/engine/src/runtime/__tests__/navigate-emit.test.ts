/**
 * Navigate and Emit Actions Tests
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createFormRuntime, type NavigateHandler, type EmitHandler } from '../form-runtime'
import type { ViewSchema, ViewField, Reaction } from '@manifesto-ai/schema'

// Helper to create a minimal view schema with a field that has a reaction
const createViewSchema = (reactions: Reaction[]): ViewSchema => ({
  _tag: 'ViewSchema',
  id: 'test-view',
  name: 'Test View',
  version: '0.1.0',
  entityRef: 'test-entity',
  mode: 'create',
  sections: [
    {
      id: 'section-1',
      title: 'Section 1',
      fields: [
        {
          _tag: 'ViewField',
          id: 'testField',
          entityFieldId: 'testField',
          component: 'textInput',
          reactions,
        } as ViewField,
      ],
    },
  ],
  header: { title: 'Test' },
  footer: { actions: [] },
})

describe('navigate action', () => {
  let navigateHandler: NavigateHandler

  beforeEach(() => {
    navigateHandler = vi.fn()
  })

  test('navigateHandler가 설정되지 않으면 조용히 무시됨', () => {
    const schema = createViewSchema([
      {
        trigger: 'change',
        actions: [
          { type: 'navigate', path: '/details' },
        ],
      },
    ])

    const runtime = createFormRuntime(schema, { debug: false })
    const result = runtime.initialize()

    expect(result._tag).toBe('Ok')

    // Should not throw
    runtime.dispatch({ type: 'FIELD_CHANGE', fieldId: 'testField', value: 'test' })
  })

  test('navigate 액션이 핸들러를 호출함', () => {
    const schema = createViewSchema([
      {
        trigger: 'change',
        actions: [
          { type: 'navigate', path: '/details' },
        ],
      },
    ])

    const runtime = createFormRuntime(schema, {
      navigateHandler,
    })
    runtime.initialize()

    runtime.dispatch({ type: 'FIELD_CHANGE', fieldId: 'testField', value: 'test' })

    expect(navigateHandler).toHaveBeenCalledWith('/details', {})
  })

  test('navigate 액션에 params가 전달됨', () => {
    const schema = createViewSchema([
      {
        trigger: 'change',
        actions: [
          {
            type: 'navigate',
            path: '/details/:id',
            params: { id: '123', mode: 'edit' },
          },
        ],
      },
    ])

    const runtime = createFormRuntime(schema, {
      navigateHandler,
    })
    runtime.initialize()

    runtime.dispatch({ type: 'FIELD_CHANGE', fieldId: 'testField', value: 'test' })

    expect(navigateHandler).toHaveBeenCalledWith('/details/:id', { id: '123', mode: 'edit' })
  })

  test('navigate 액션의 params 표현식이 평가됨', () => {
    const schema = createViewSchema([
      {
        trigger: 'change',
        actions: [
          {
            type: 'navigate',
            path: '/details/:id',
            params: { id: '$state.testField' },
          },
        ],
      },
    ])

    const runtime = createFormRuntime(schema, {
      navigateHandler,
    })
    runtime.initialize()

    runtime.dispatch({ type: 'FIELD_CHANGE', fieldId: 'testField', value: 'abc-123' })

    expect(navigateHandler).toHaveBeenCalledWith('/details/:id', { id: 'abc-123' })
  })
})

describe('emit action', () => {
  let emitHandler: EmitHandler

  beforeEach(() => {
    emitHandler = vi.fn()
  })

  test('emitHandler가 설정되지 않으면 조용히 무시됨', () => {
    const schema = createViewSchema([
      {
        trigger: 'change',
        actions: [
          { type: 'emit', event: 'custom-event' },
        ],
      },
    ])

    const runtime = createFormRuntime(schema, { debug: false })
    const result = runtime.initialize()

    expect(result._tag).toBe('Ok')

    // Should not throw
    runtime.dispatch({ type: 'FIELD_CHANGE', fieldId: 'testField', value: 'test' })
  })

  test('emit 액션이 핸들러를 호출함', () => {
    const schema = createViewSchema([
      {
        trigger: 'change',
        actions: [
          { type: 'emit', event: 'field-changed' },
        ],
      },
    ])

    const runtime = createFormRuntime(schema, {
      emitHandler,
    })
    runtime.initialize()

    runtime.dispatch({ type: 'FIELD_CHANGE', fieldId: 'testField', value: 'test' })

    expect(emitHandler).toHaveBeenCalledWith('field-changed', {})
  })

  test('emit 액션에 payload가 전달됨', () => {
    const schema = createViewSchema([
      {
        trigger: 'change',
        actions: [
          {
            type: 'emit',
            event: 'data-updated',
            payload: { source: 'form', action: 'change' },
          },
        ],
      },
    ])

    const runtime = createFormRuntime(schema, {
      emitHandler,
    })
    runtime.initialize()

    runtime.dispatch({ type: 'FIELD_CHANGE', fieldId: 'testField', value: 'test' })

    expect(emitHandler).toHaveBeenCalledWith('data-updated', {
      source: 'form',
      action: 'change',
    })
  })

  test('emit 액션의 payload 표현식이 평가됨', () => {
    const schema = createViewSchema([
      {
        trigger: 'change',
        actions: [
          {
            type: 'emit',
            event: 'value-updated',
            payload: {
              value: '$state.testField',
              fieldId: 'testField',
            },
          },
        ],
      },
    ])

    const runtime = createFormRuntime(schema, {
      emitHandler,
    })
    runtime.initialize()

    runtime.dispatch({ type: 'FIELD_CHANGE', fieldId: 'testField', value: 'new-value' })

    expect(emitHandler).toHaveBeenCalledWith('value-updated', {
      value: 'new-value',
      fieldId: 'testField',
    })
  })
})

describe('navigate and emit actions combined', () => {
  test('navigate와 emit 액션이 함께 실행됨', () => {
    const navigateHandler = vi.fn()
    const emitHandler = vi.fn()

    const schema = createViewSchema([
      {
        trigger: 'change',
        actions: [
          { type: 'emit', event: 'before-navigate' },
          { type: 'navigate', path: '/next-page' },
        ],
      },
    ])

    const runtime = createFormRuntime(schema, {
      navigateHandler,
      emitHandler,
    })
    runtime.initialize()

    runtime.dispatch({ type: 'FIELD_CHANGE', fieldId: 'testField', value: 'test' })

    expect(emitHandler).toHaveBeenCalledWith('before-navigate', {})
    expect(navigateHandler).toHaveBeenCalledWith('/next-page', {})
  })
})
