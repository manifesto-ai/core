import { describe, expect, it } from 'vitest'

import { createFormRuntime } from '@manifesto-ai/engine'
import type { FormViewSchema, ViewField, ViewSection } from '@manifesto-ai/schema'

import { createInteroperabilitySession } from '../session'
import { toToolDefinitions } from '../tools'
import type { SemanticSnapshot } from '../types'

const createField = (id: string, overrides: Partial<ViewField> = {}): ViewField => ({
  id,
  entityFieldId: id,
  component: 'text-input',
  ...overrides,
})

const createSection = (fields: ViewField[]): ViewSection => ({
  id: 'main',
  title: 'Main',
  layout: { type: 'form' },
  fields,
})

const createSchema = (): FormViewSchema => ({
  _type: 'view',
  id: 'product-form',
  name: 'Product Form',
  version: '1.0.0',
  entityRef: 'product',
  mode: 'create',
  layout: { type: 'form' },
  sections: [
    createSection([
      createField('name'),
      createField('category'),
      createField('hiddenField'),
    ]),
  ],
})

describe('toToolDefinitions', () => {
  it('emits updateField tool with available field enums', () => {
    const runtime = createFormRuntime(createSchema())
    const initResult = runtime.initialize()
    expect(initResult._tag).toBe('Ok')

    const session = createInteroperabilitySession({ runtime, viewSchema: createSchema() })
    const snapshot = session.snapshot()

    // Mark one field hidden to ensure it is excluded from choices
    const metaMap = (runtime as unknown as { fieldMetas: Map<string, any> }).fieldMetas
    const hiddenMeta = metaMap.get('hiddenField')
    metaMap.set('hiddenField', { ...hiddenMeta, hidden: true })

    const tools = toToolDefinitions(session.snapshot(), { omitUnavailable: true })
    const updateTool = tools.find((t) => t.function.name === 'updateField')
    expect(updateTool).toBeDefined()

    const fieldEnum = (updateTool!.function.parameters as any).properties.fieldId.enum as string[]
    expect(fieldEnum).toContain('name')
    expect(fieldEnum).toContain('category')
    expect(fieldEnum).not.toContain('hiddenField')
  })

  it('includes submit/validate/reset tools', () => {
    const runtime = createFormRuntime(createSchema())
    runtime.initialize()
    const session = createInteroperabilitySession({ runtime, viewSchema: createSchema() })
    const tools = toToolDefinitions(session.snapshot())
    const names = tools.map((t) => t.function.name)
    expect(names).toEqual(expect.arrayContaining(['submit', 'validate', 'reset', 'updateField']))
  })

  it('describes unavailable interactions when tools are present', () => {
    const snapshot: SemanticSnapshot = {
      topology: { viewId: 'product-form', entityRef: 'product', mode: 'create', sections: [] },
      state: {
        form: { isValid: false, isDirty: false, isSubmitting: false },
        fields: {},
        values: {},
      },
      constraints: {},
      interactions: [{ id: 'submit', intent: 'submit', available: false, reason: 'form invalid' }],
    }

    const tools = toToolDefinitions(snapshot)
    const updateTool = tools.find((t) => t.function.name === 'updateField')
    expect(updateTool?.function.description).toContain('no fields are available')

    const submitTool = tools.find((t) => t.function.name === 'submit')
    expect(submitTool?.function.description).toContain('Currently blocked')
  })
})
