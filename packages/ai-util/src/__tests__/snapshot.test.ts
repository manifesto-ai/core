import { describe, expect, it } from 'vitest'
import type { EvaluationContext, FormState } from '@manifesto-ai/engine'
import type { EntitySchema, Expression, FormViewSchema } from '@manifesto-ai/schema'

import { diffSnapshots } from '../delta'
import { buildSemanticSnapshot } from '../snapshot'
import { areValuesEqual } from '../utils'
import type { SemanticSnapshot } from '../types'

const viewSchema: FormViewSchema = {
  _type: 'view',
  id: 'product-form',
  name: 'Product Form',
  version: '1.0.0',
  entityRef: 'product',
  mode: 'edit',
  layout: { type: 'form' },
  sections: [
    {
      id: 'main',
      title: 'Main',
      layout: { type: 'form' },
      fields: [
        { id: 'name', entityFieldId: 'name', component: 'text-input', label: 'Name' },
        { id: 'status', entityFieldId: 'status', component: 'select', label: 'Status' },
      ],
    },
  ],
}

const entitySchema: EntitySchema = {
  id: 'product',
  name: 'Product',
  fields: [
    { id: 'name', name: 'Name', dataType: 'string' },
    {
      id: 'status',
      name: 'Status',
      dataType: 'enum',
      enumValues: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
    },
  ],
}

const createFormState = (overrides: Partial<FormState> = {}): FormState => ({
  values: { name: 'Widget', status: 'published' },
  fields: new Map([
    [
      'name',
      { id: 'name', entityFieldId: 'name', hidden: false, disabled: false, errors: [], props: {} },
    ],
    [
      'status',
      {
        id: 'status',
        entityFieldId: 'status',
        hidden: false,
        disabled: true,
        errors: ['required'],
        props: {},
      },
    ],
  ]),
  fieldOptions: new Map(),
  isValid: false,
  isDirty: true,
  isSubmitting: false,
  ...overrides,
})

const createEvaluationContext = (state: Record<string, unknown> = {}): EvaluationContext => ({
  state,
  context: {},
  user: {},
  params: {},
  result: {},
  env: {},
})

describe('buildSemanticSnapshot', () => {
  it('maps entity metadata, constraints, and interactions', () => {
    const snapshot = buildSemanticSnapshot({
      viewSchema,
      state: createFormState(),
      baselineValues: { name: 'Widget', status: 'draft' },
      entitySchema,
    })

    expect(snapshot.state.fields.status.dataType).toBe('enum')
    expect(snapshot.state.fields.status.enumValues?.map((v) => v.value)).toEqual(
      expect.arrayContaining(['draft', 'published'])
    )
    expect(snapshot.state.fields.status.meta.dirty).toBe(true)
    expect(snapshot.state.fields.name.meta.dirty).toBe(false)
    expect(snapshot.constraints.status.reason).toBe('disabled')

    const updateStatus = snapshot.interactions.find((i) => i.id === 'updateField:status')
    expect(updateStatus?.available).toBe(false)
    expect(updateStatus?.reason).toContain('disabled')

    const submit = snapshot.interactions.find((i) => i.id === 'submit')
    expect(submit?.available).toBe(false)
    expect(submit?.reason).toBe('form is invalid')
  })

  describe('visibilityMeta auto-inclusion', () => {
    it('includes visibilityMeta in constraints for hidden fields when expressions are provided', () => {
      const hiddenState = createFormState({
        fields: new Map([
          [
            'name',
            { id: 'name', entityFieldId: 'name', hidden: false, disabled: false, errors: [], props: {} },
          ],
          [
            'status',
            { id: 'status', entityFieldId: 'status', hidden: true, disabled: false, errors: [], props: {} },
          ],
        ]),
      })

      const visibilityExpressions = new Map<string, Expression>([
        ['status', ['==', '$state.category', 'DIGITAL']],
      ])

      const evaluationContext = createEvaluationContext({ category: 'PHYSICAL' })

      const snapshot = buildSemanticSnapshot({
        viewSchema,
        state: hiddenState,
        baselineValues: {},
        entitySchema,
        visibilityExpressions,
        evaluationContext,
      })

      expect(snapshot.constraints.status.hidden).toBe(true)
      expect(snapshot.constraints.status.visibilityMeta).toBeDefined()
      expect(snapshot.constraints.status.visibilityMeta?.satisfied).toBe(false)
      expect(snapshot.constraints.status.visibilityMeta?.failedDependencies).toHaveLength(1)
      expect(snapshot.constraints.status.visibilityMeta?.failedDependencies[0]).toMatchObject({
        field: 'category',
        currentValue: 'PHYSICAL',
        expectedValue: 'DIGITAL',
      })
      expect(snapshot.constraints.status.visibilityMeta?.satisfactionPath).toBeDefined()
      expect(snapshot.constraints.status.visibilityMeta?.satisfactionPath?.[0]).toMatchObject({
        field: 'category',
        action: 'set',
        targetValue: 'DIGITAL',
      })
    })

    it('does not include visibilityMeta for visible fields', () => {
      const visibleState = createFormState({
        fields: new Map([
          [
            'name',
            { id: 'name', entityFieldId: 'name', hidden: false, disabled: false, errors: [], props: {} },
          ],
          [
            'status',
            { id: 'status', entityFieldId: 'status', hidden: false, disabled: false, errors: [], props: {} },
          ],
        ]),
      })

      const visibilityExpressions = new Map<string, Expression>([
        ['status', ['==', '$state.category', 'DIGITAL']],
      ])

      const evaluationContext = createEvaluationContext({ category: 'DIGITAL' })

      const snapshot = buildSemanticSnapshot({
        viewSchema,
        state: visibleState,
        baselineValues: {},
        entitySchema,
        visibilityExpressions,
        evaluationContext,
      })

      expect(snapshot.constraints.status.hidden).toBe(false)
      expect(snapshot.constraints.status.visibilityMeta).toBeUndefined()
    })

    it('does not include visibilityMeta when expressions are not provided', () => {
      const hiddenState = createFormState({
        fields: new Map([
          [
            'name',
            { id: 'name', entityFieldId: 'name', hidden: false, disabled: false, errors: [], props: {} },
          ],
          [
            'status',
            { id: 'status', entityFieldId: 'status', hidden: true, disabled: false, errors: [], props: {} },
          ],
        ]),
      })

      const snapshot = buildSemanticSnapshot({
        viewSchema,
        state: hiddenState,
        baselineValues: {},
        entitySchema,
        // No visibilityExpressions or evaluationContext
      })

      expect(snapshot.constraints.status.hidden).toBe(true)
      expect(snapshot.constraints.status.visibilityMeta).toBeUndefined()
    })

    it('handles compound AND conditions in visibilityMeta', () => {
      const hiddenState = createFormState({
        fields: new Map([
          [
            'name',
            { id: 'name', entityFieldId: 'name', hidden: false, disabled: false, errors: [], props: {} },
          ],
          [
            'status',
            { id: 'status', entityFieldId: 'status', hidden: true, disabled: false, errors: [], props: {} },
          ],
        ]),
      })

      const visibilityExpressions = new Map<string, Expression>([
        ['status', ['AND', ['==', '$state.category', 'DIGITAL'], ['==', '$state.isActive', true]]],
      ])

      const evaluationContext = createEvaluationContext({ category: 'PHYSICAL', isActive: false })

      const snapshot = buildSemanticSnapshot({
        viewSchema,
        state: hiddenState,
        baselineValues: {},
        entitySchema,
        visibilityExpressions,
        evaluationContext,
      })

      expect(snapshot.constraints.status.visibilityMeta?.conditionType).toBe('compound')
      expect(snapshot.constraints.status.visibilityMeta?.failedDependencies).toHaveLength(2)
      expect(snapshot.constraints.status.visibilityMeta?.satisfactionPath).toHaveLength(2)
    })
  })
})

describe('diffSnapshots', () => {
  const baseTopology: SemanticSnapshot['topology'] = {
    viewId: 'product-form',
    entityRef: 'product',
    mode: 'edit',
    sections: [],
  }

  it('detects form, field, and interaction deltas', () => {
    const previous: SemanticSnapshot = {
      topology: baseTopology,
      state: {
        form: { isValid: true, isDirty: false, isSubmitting: false },
        values: { name: 'Alpha', status: 'draft' },
        fields: {
          name: {
            id: 'name',
            entityFieldId: 'name',
            value: 'Alpha',
            meta: {
              valid: true,
              dirty: false,
              touched: false,
              hidden: false,
              disabled: false,
              errors: [],
            },
          },
          status: {
            id: 'status',
            entityFieldId: 'status',
            value: 'draft',
            dataType: 'enum',
            enumValues: [{ label: 'Draft', value: 'draft' }],
            meta: {
              valid: false,
              dirty: false,
              touched: false,
              hidden: false,
              disabled: false,
              errors: ['required'],
            },
          },
        },
      },
      constraints: {
        name: { hidden: false, disabled: false },
        status: { hidden: false, disabled: false },
      },
      interactions: [
        { id: 'updateField:name', intent: 'updateField', target: 'name', available: true },
        { id: 'updateField:status', intent: 'updateField', target: 'status', available: true },
        { id: 'submit', intent: 'submit', available: true },
      ],
    }

    const next: SemanticSnapshot = {
      topology: baseTopology,
      state: {
        form: { isValid: false, isDirty: true, isSubmitting: true },
        values: { name: 'Beta', status: 'published' },
        fields: {
          name: {
            id: 'name',
            entityFieldId: 'name',
            value: 'Beta',
            meta: {
              valid: true,
              dirty: true,
              touched: true,
              hidden: false,
              disabled: false,
              errors: [],
            },
          },
          status: {
            id: 'status',
            entityFieldId: 'status',
            value: 'published',
            dataType: 'enum',
            enumValues: [{ label: 'Draft', value: 'draft' }],
            meta: {
              valid: true,
              dirty: true,
              touched: true,
              hidden: true,
              disabled: true,
              errors: [],
            },
          },
        },
      },
      constraints: {
        name: { hidden: false, disabled: false },
        status: { hidden: true, disabled: true, reason: 'disabled' },
      },
      interactions: [
        { id: 'updateField:name', intent: 'updateField', target: 'name', available: true },
        {
          id: 'updateField:status',
          intent: 'updateField',
          target: 'status',
          available: false,
          reason: 'field is disabled',
        },
        { id: 'submit', intent: 'submit', available: false, reason: 'form is invalid' },
      ],
    }

    const delta = diffSnapshots(previous, next)

    expect(delta.form).toEqual({ isValid: false, isDirty: true, isSubmitting: true })
    expect(delta.fields?.name).toMatchObject({ value: 'Beta', dirty: true, touched: true })
    expect(delta.fields?.status).toMatchObject({
      value: 'published',
      valid: true,
      dirty: true,
      touched: true,
      hidden: true,
      disabled: true,
      errors: [],
    })
    expect(delta.interactions?.['updateField:status']).toEqual({
      available: false,
      reason: 'field is disabled',
    })
  })
})

describe('areValuesEqual', () => {
  it('compares nested structures and primitives', () => {
    expect(areValuesEqual({ a: 1, b: ['x'] }, { a: 1, b: ['x'] })).toBe(true)
    expect(areValuesEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(areValuesEqual(1, 2)).toBe(false)
  })

  it('returns false when values cannot be serialized', () => {
    const first: Record<string, unknown> = {}
    first.self = first

    const second: Record<string, unknown> = {}
    second.self = second

    expect(areValuesEqual(first, second)).toBe(false)
  })
})
