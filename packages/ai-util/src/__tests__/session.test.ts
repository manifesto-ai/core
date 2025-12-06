import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createFormRuntime } from '@manifesto-ai/engine'
import type { EntityField, EntitySchema, FormViewSchema, ViewField, ViewSection } from '@manifesto-ai/schema'
import { err } from '@manifesto-ai/schema'

import { createInteroperabilitySession } from '../session'

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
  sections: [createSection([createField('name'), createField('category')])],
})

const createEntitySchema = (
  overrides: Partial<Record<string, Partial<EntityField>>> = {}
): EntitySchema => ({
  id: 'product',
  name: 'Product',
  fields: [
    { id: 'name', name: 'Name', dataType: 'string', ...(overrides['name'] ?? {}) },
    {
      id: 'category',
      name: 'Category',
      dataType: 'enum',
      enumValues: [
        { label: 'Digital', value: 'DIGITAL' },
        { label: 'Physical', value: 'PHYSICAL' },
      ],
      ...(overrides['category'] ?? {}),
    },
  ],
})

describe('createInteroperabilitySession', () => {
  const schema = createSchema()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns snapshot and delta when updating a field', () => {
    const runtime = createFormRuntime(schema, { initialValues: { name: '' } })
    const initResult = runtime.initialize()
    expect(initResult._tag).toBe('Ok')

    const session = createInteroperabilitySession({ runtime, viewSchema: schema })
    const initial = session.snapshot()
    expect(initial.state.fields['name']?.meta.dirty).toBe(false)

    const result = session.dispatch({
      type: 'updateField',
      fieldId: 'name',
      value: 'Alice',
    })

    expect(result._tag).toBe('Ok')
    if (result._tag === 'Ok') {
      const { snapshot, delta } = result.value
      expect(snapshot.state.values['name']).toBe('Alice')
      expect(snapshot.state.fields['name']!.meta.dirty).toBe(true)
      expect(delta.fields?.['name']?.value).toBe('Alice')
      expect(delta.fields?.['name']?.dirty).toBe(true)
      expect(snapshot.state.form.isDirty).toBe(true)
    }
  })

  it('rejects hidden field updates with FIELD_FORBIDDEN', () => {
    const runtime = createFormRuntime(schema)
    const initResult = runtime.initialize()
    expect(initResult._tag).toBe('Ok')

    const fieldMetas = (runtime as unknown as { fieldMetas: Map<string, unknown> }).fieldMetas
    const meta = fieldMetas.get('category') as { hidden: boolean; disabled: boolean }
    fieldMetas.set('category', { ...meta, hidden: true })

    const session = createInteroperabilitySession({ runtime, viewSchema: schema })
    const snapshot = session.snapshot()
    const interaction = snapshot.interactions.find((i) => i.id === 'updateField:category')
    expect(interaction?.available).toBe(false)

    const result = session.dispatch({
      type: 'updateField',
      fieldId: 'category',
      value: 'DIGITAL',
    })

    expect(result._tag).toBe('Err')
    if (result._tag === 'Err') {
      expect(result.error.type).toBe('FIELD_FORBIDDEN')
      expect((result.error as any).reason).toBe('HIDDEN')
    }
  })

  it('rejects unknown fields with FIELD_NOT_FOUND', () => {
    const runtime = createFormRuntime(schema)
    const initResult = runtime.initialize()
    expect(initResult._tag).toBe('Ok')

    const session = createInteroperabilitySession({ runtime, viewSchema: schema })

    const result = session.dispatch({
      type: 'updateField',
      fieldId: 'unknown',
      value: 'X',
    })

    expect(result._tag).toBe('Err')
    if (result._tag === 'Err') {
      expect(result.error.type).toBe('FIELD_NOT_FOUND')
    }
  })

  it('maps runtime errors to RUNTIME_ERROR', () => {
    const runtime = createFormRuntime(schema)
    const initResult = runtime.initialize()
    expect(initResult._tag).toBe('Ok')

    const dispatchSpy = vi
      .spyOn(runtime as unknown as { dispatch: typeof runtime.dispatch }, 'dispatch')
      .mockReturnValue(err({ type: 'SCHEMA_ERROR', message: 'broken schema' }))

    const session = createInteroperabilitySession({ runtime, viewSchema: schema })
    const result = session.dispatch({ type: 'submit' })

    expect(dispatchSpy).toHaveBeenCalled()
    expect(result._tag).toBe('Err')
    if (result._tag === 'Err') {
      expect(result.error.type).toBe('RUNTIME_ERROR')
      expect((result.error as any).message).toContain('broken schema')
    }
  })

  it('rejects invalid enum values with INVALID_ENUM_VALUE', () => {
    const entitySchema = createEntitySchema()
    const runtime = createFormRuntime(schema, { entitySchema })
    const initResult = runtime.initialize()
    expect(initResult._tag).toBe('Ok')

    const dispatchSpy = vi.spyOn(runtime as unknown as { dispatch: typeof runtime.dispatch }, 'dispatch')

    const session = createInteroperabilitySession({ runtime, viewSchema: schema, entitySchema })
    const result = session.dispatch({
      type: 'updateField',
      fieldId: 'category',
      value: 'UNLISTED',
    })

    expect(dispatchSpy).not.toHaveBeenCalled()
    expect(result._tag).toBe('Err')
    if (result._tag === 'Err') {
      expect(result.error.type).toBe('INVALID_ENUM_VALUE')
      expect((result.error as any).validValues).toEqual(
        expect.arrayContaining(['DIGITAL', 'PHYSICAL'])
      )
    }
  })

  it('rejects type mismatches using field data types', () => {
    const entitySchema = createEntitySchema({
      category: { dataType: 'number', enumValues: undefined },
    })
    const runtime = createFormRuntime(schema, { entitySchema })
    const initResult = runtime.initialize()
    expect(initResult._tag).toBe('Ok')

    const dispatchSpy = vi.spyOn(runtime as unknown as { dispatch: typeof runtime.dispatch }, 'dispatch')

    const session = createInteroperabilitySession({ runtime, viewSchema: schema, entitySchema })
    const result = session.dispatch({
      type: 'updateField',
      fieldId: 'category',
      value: 'abc',
    })

    expect(dispatchSpy).not.toHaveBeenCalled()
    expect(result._tag).toBe('Err')
    if (result._tag === 'Err') {
      expect(result.error.type).toBe('TYPE_MISMATCH')
      expect((result.error as any).message).toContain('숫자를 입력해야 합니다')
    }
  })

  it('rejects submit when the form is invalid', () => {
    const runtime = createFormRuntime(schema)
    const initResult = runtime.initialize()
    expect(initResult._tag).toBe('Ok')

    const fieldMetas = (runtime as unknown as { fieldMetas: Map<string, any> }).fieldMetas
    const categoryMeta = fieldMetas.get('category')
    fieldMetas.set('category', { ...categoryMeta, errors: ['missing'] })

    const dispatchSpy = vi.spyOn(runtime as unknown as { dispatch: typeof runtime.dispatch }, 'dispatch')

    const session = createInteroperabilitySession({ runtime, viewSchema: schema })
    const result = session.dispatch({ type: 'submit' })

    expect(dispatchSpy).not.toHaveBeenCalled()
    expect(result._tag).toBe('Err')
    if (result._tag === 'Err') {
      expect(result.error.type).toBe('ACTION_REJECTED')
      expect((result.error as any).reason).toBe('FORM_INVALID')
    }
  })

  it('routes reset and validate actions through the runtime', () => {
    const runtime = createFormRuntime(schema, { initialValues: { name: 'Alice' } })
    const initResult = runtime.initialize()
    expect(initResult._tag).toBe('Ok')

    const dispatchSpy = vi.spyOn(runtime as unknown as { dispatch: typeof runtime.dispatch }, 'dispatch')

    const session = createInteroperabilitySession({ runtime, viewSchema: schema })

    const resetResult = session.dispatch({ type: 'reset' })
    expect(resetResult._tag).toBe('Ok')
    expect(dispatchSpy).toHaveBeenNthCalledWith(1, { type: 'RESET' })

    const validateResult = session.dispatch({ type: 'validate', fieldIds: ['name'] })
    expect(validateResult._tag).toBe('Ok')
    expect(dispatchSpy).toHaveBeenNthCalledWith(2, { type: 'VALIDATE', fieldIds: ['name'] })
  })

  describe('deferred mode auto-apply', () => {
    const schemaWithPriceLimit: FormViewSchema = {
      _type: 'view',
      id: 'product-form',
      name: 'Product Form',
      version: '1.0.0',
      entityRef: 'product',
      mode: 'create',
      layout: { type: 'form' },
      sections: [
        createSection([
          createField('category'),
          createField('priceLimit', {
            // Hidden condition as reaction with updateProp
            reactions: [
              {
                trigger: 'change',
                actions: [
                  {
                    type: 'updateProp',
                    target: 'priceLimit',
                    prop: 'hidden',
                    value: ['!=', '$state.category', 'DIGITAL'],
                  },
                ],
              },
            ],
          }),
        ]),
      ],
    }

    it('stores pending update in deferred mode for hidden field', () => {
      const runtime = createFormRuntime(schemaWithPriceLimit, {
        initialValues: { category: 'PHYSICAL', priceLimit: null },
      })
      const initResult = runtime.initialize()
      expect(initResult._tag).toBe('Ok')

      // Manually set priceLimit as hidden (simulating the condition evaluation)
      const fieldMetas = (runtime as unknown as { fieldMetas: Map<string, any> }).fieldMetas
      const priceLimitMeta = fieldMetas.get('priceLimit')
      fieldMetas.set('priceLimit', { ...priceLimitMeta, hidden: true })

      const session = createInteroperabilitySession({
        runtime,
        viewSchema: schemaWithPriceLimit,
        defaultPolicy: 'deferred',
      })

      // priceLimit is hidden because category is 'PHYSICAL'
      const snapshot1 = session.snapshot()
      expect(snapshot1.state.fields['priceLimit']?.meta.hidden).toBe(true)

      // Try to set priceLimit - should be deferred
      const result = session.dispatch({
        type: 'updateField',
        fieldId: 'priceLimit',
        value: 100,
      })

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        // Value not applied yet
        expect(result.value.snapshot.state.values['priceLimit']).not.toBe(100)
        // But pending update exists
        expect(result.value.snapshot.pendingUpdates?.['priceLimit']).toBeDefined()
        expect(result.value.snapshot.pendingUpdates?.['priceLimit'].value).toBe(100)
      }
    })

    it('auto-applies pending updates when field becomes visible', () => {
      const runtime = createFormRuntime(schemaWithPriceLimit, {
        initialValues: { category: 'PHYSICAL', priceLimit: null },
      })
      const initResult = runtime.initialize()
      expect(initResult._tag).toBe('Ok')

      // Manually set priceLimit as hidden
      const fieldMetas = (runtime as unknown as { fieldMetas: Map<string, any> }).fieldMetas
      const priceLimitMeta = fieldMetas.get('priceLimit')
      fieldMetas.set('priceLimit', { ...priceLimitMeta, hidden: true })

      const session = createInteroperabilitySession({
        runtime,
        viewSchema: schemaWithPriceLimit,
        defaultPolicy: 'deferred',
      })

      // Set pending update for priceLimit
      const deferResult = session.dispatch({
        type: 'updateField',
        fieldId: 'priceLimit',
        value: 100,
      })
      expect(deferResult._tag).toBe('Ok')

      // Make priceLimit visible before changing category
      fieldMetas.set('priceLimit', { ...priceLimitMeta, hidden: false })

      // Now change category to DIGITAL - this should trigger auto-apply check
      const result = session.dispatch({
        type: 'updateField',
        fieldId: 'category',
        value: 'DIGITAL',
      })

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        // priceLimit should now be visible
        expect(result.value.snapshot.state.fields['priceLimit']?.meta.hidden).toBe(false)
        // priceLimit value should be auto-applied
        expect(result.value.snapshot.state.values['priceLimit']).toBe(100)
        // No more pending updates
        expect(result.value.snapshot.pendingUpdates?.['priceLimit']).toBeUndefined()
        // appliedPendingUpdates should contain priceLimit
        expect(result.value.appliedPendingUpdates).toContain('priceLimit')
      }
    })
  })
})
