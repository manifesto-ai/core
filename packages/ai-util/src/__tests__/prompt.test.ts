import { describe, expect, it } from 'vitest'

import {
  generateSystemPrompt,
  compressSnapshot,
  serializeCompressed,
  generateFieldSummary,
  generateDeltaUpdate,
} from '../prompt'
import type { SemanticSnapshot, FieldStateAtom, FieldConstraint } from '../types'

const createTestSnapshot = (overrides: Partial<SemanticSnapshot> = {}): SemanticSnapshot => ({
  topology: {
    viewId: 'product-form',
    entityRef: 'product',
    mode: 'create',
    sections: [{ id: 'main', title: 'Main', fields: ['name', 'price', 'category'] }],
  },
  state: {
    form: {
      isValid: false,
      isDirty: true,
      isSubmitting: false,
    },
    fields: {
      name: {
        id: 'name',
        entityFieldId: 'name',
        label: 'Product Name',
        value: '',
        meta: { valid: false, dirty: false, touched: false, hidden: false, disabled: false, errors: ['Required'] },
      },
      price: {
        id: 'price',
        entityFieldId: 'price',
        label: 'Price',
        value: 100,
        meta: { valid: true, dirty: true, touched: true, hidden: false, disabled: false, errors: [] },
      },
      category: {
        id: 'category',
        entityFieldId: 'category',
        label: 'Category',
        value: 'BOOK',
        meta: { valid: true, dirty: false, touched: false, hidden: false, disabled: false, errors: [] },
      },
    },
    values: { name: '', price: 100, category: 'BOOK' },
  },
  constraints: {
    name: { hidden: false, disabled: false },
    price: { hidden: false, disabled: false },
    category: { hidden: false, disabled: false },
  },
  interactions: [
    { id: 'updateField:name', intent: 'updateField', target: 'name', available: true },
    { id: 'updateField:price', intent: 'updateField', target: 'price', available: true },
    { id: 'updateField:category', intent: 'updateField', target: 'category', available: true },
    { id: 'submit', intent: 'submit', available: false, reason: 'form is invalid' },
    { id: 'reset', intent: 'reset', available: true },
    { id: 'validate', intent: 'validate', available: true },
  ],
  ...overrides,
})

describe('generateSystemPrompt', () => {
  it('generates comprehensive system prompt', () => {
    const snapshot = createTestSnapshot()
    const prompt = generateSystemPrompt(snapshot)

    expect(prompt).toContain('## Form Context: product-form')
    expect(prompt).toContain('Mode: create')
    expect(prompt).toContain('### Form Status')
    expect(prompt).toContain('### Fields')
    expect(prompt).toContain('### Available Actions')
  })

  it('includes field values when enabled', () => {
    const snapshot = createTestSnapshot()
    const prompt = generateSystemPrompt(snapshot, { includeValues: true })

    expect(prompt).toContain('100')
    expect(prompt).toContain('"BOOK"')
  })

  it('includes validation errors when enabled', () => {
    const snapshot = createTestSnapshot()
    const prompt = generateSystemPrompt(snapshot, { includeErrors: true })

    expect(prompt).toContain('Required')
  })

  it('includes hidden fields with visibility reasoning', () => {
    const snapshot = createTestSnapshot({
      constraints: {
        name: { hidden: false, disabled: false },
        price: {
          hidden: true,
          disabled: false,
          visibilityMeta: {
            conditionType: 'simple',
            satisfied: false,
            failedDependencies: [
              { field: 'category', currentValue: 'BOOK', operator: '==', expectedValue: 'DIGITAL', description: 'category must equal "DIGITAL"' },
            ],
            satisfactionPath: [
              { field: 'category', action: 'set', targetValue: 'DIGITAL', order: 1 },
            ],
          },
        },
        category: { hidden: false, disabled: false },
      },
    })

    const prompt = generateSystemPrompt(snapshot, { includeVisibilityReasoning: true })

    expect(prompt).toContain('### Hidden Fields')
    expect(prompt).toContain('price')
    expect(prompt).toContain('category must equal "DIGITAL"')
  })

  it('includes pending updates when present', () => {
    const snapshot = createTestSnapshot({
      pendingUpdates: {
        price: {
          fieldId: 'price',
          value: 200,
          blockedBy: ['category'],
          createdAt: Date.now(),
        },
      },
    })

    const prompt = generateSystemPrompt(snapshot, { includePendingUpdates: true })

    expect(prompt).toContain('### Pending Updates')
    expect(prompt).toContain('price')
    expect(prompt).toContain('200')
    expect(prompt).toContain('category')
  })

  it('generates compact prompt when enabled', () => {
    const snapshot = createTestSnapshot()
    const normalPrompt = generateSystemPrompt(snapshot, { compact: false })
    const compactPrompt = generateSystemPrompt(snapshot, { compact: true })

    expect(compactPrompt.length).toBeLessThan(normalPrompt.length)
  })
})

describe('compressSnapshot', () => {
  it('compresses snapshot to token-efficient format', () => {
    const snapshot = createTestSnapshot()
    const compressed = compressSnapshot(snapshot)

    expect(compressed.form).toBe('invalid+dirty')
    expect(compressed.fields).toHaveLength(3)
    expect(compressed.actions).toContain('updateField:name')
    expect(compressed.actions).toContain('reset')
    expect(compressed.actions).not.toContain('submit')
  })

  it('excludes hidden fields from compressed fields', () => {
    const snapshot = createTestSnapshot({
      constraints: {
        name: { hidden: false, disabled: false },
        price: { hidden: true, disabled: false },
        category: { hidden: false, disabled: false },
      },
    })

    const compressed = compressSnapshot(snapshot)

    expect(compressed.fields).toHaveLength(2)
    expect(compressed.hidden).toContain('price')
  })

  it('marks fields with errors', () => {
    const snapshot = createTestSnapshot()
    const compressed = compressSnapshot(snapshot)

    const nameField = compressed.fields.find(f => f.id === 'name')
    expect(nameField?.status).toBe('error')
    expect(nameField?.errors).toContain('Required')

    const priceField = compressed.fields.find(f => f.id === 'price')
    expect(priceField?.status).toBe('ok')
  })

  it('includes pending fields', () => {
    const snapshot = createTestSnapshot({
      pendingUpdates: {
        hiddenField: {
          fieldId: 'hiddenField',
          value: 'pending value',
          blockedBy: ['category'],
          createdAt: Date.now(),
        },
      },
    })

    const compressed = compressSnapshot(snapshot)
    expect(compressed.pending).toContain('hiddenField')
  })
})

describe('serializeCompressed', () => {
  it('serializes compressed snapshot to JSON', () => {
    const snapshot = createTestSnapshot()
    const compressed = compressSnapshot(snapshot)
    const serialized = serializeCompressed(compressed)

    expect(typeof serialized).toBe('string')
    expect(() => JSON.parse(serialized)).not.toThrow()

    const parsed = JSON.parse(serialized)
    expect(parsed.form).toBe('invalid+dirty')
  })
})

describe('generateFieldSummary', () => {
  it('generates field count summary', () => {
    const fields: Record<string, FieldStateAtom> = {
      name: {
        id: 'name',
        entityFieldId: 'name',
        value: '',
        meta: { valid: false, dirty: false, touched: false, hidden: false, disabled: false, errors: ['Required'] },
      },
      price: {
        id: 'price',
        entityFieldId: 'price',
        value: 100,
        meta: { valid: true, dirty: true, touched: true, hidden: false, disabled: false, errors: [] },
      },
    }
    const constraints: Record<string, FieldConstraint> = {
      name: { hidden: false, disabled: false },
      price: { hidden: false, disabled: false },
    }

    const summary = generateFieldSummary(fields, constraints)

    expect(summary).toContain('Visible: 2')
    expect(summary).toContain('Errors: 1')
  })

  it('includes hidden and disabled counts', () => {
    const fields: Record<string, FieldStateAtom> = {
      visible: {
        id: 'visible',
        entityFieldId: 'visible',
        value: 'test',
        meta: { valid: true, dirty: false, touched: false, hidden: false, disabled: false, errors: [] },
      },
      hidden: {
        id: 'hidden',
        entityFieldId: 'hidden',
        value: null,
        meta: { valid: true, dirty: false, touched: false, hidden: true, disabled: false, errors: [] },
      },
      disabled: {
        id: 'disabled',
        entityFieldId: 'disabled',
        value: 'fixed',
        meta: { valid: true, dirty: false, touched: false, hidden: false, disabled: true, errors: [] },
      },
    }
    const constraints: Record<string, FieldConstraint> = {
      visible: { hidden: false, disabled: false },
      hidden: { hidden: true, disabled: false },
      disabled: { hidden: false, disabled: true },
    }

    const summary = generateFieldSummary(fields, constraints)

    expect(summary).toContain('Visible: 1')
    expect(summary).toContain('Hidden: 1')
    expect(summary).toContain('Disabled: 1')
  })
})

describe('generateDeltaUpdate', () => {
  it('detects value changes', () => {
    const before = createTestSnapshot()
    const after = createTestSnapshot({
      state: {
        ...createTestSnapshot().state,
        fields: {
          ...createTestSnapshot().state.fields,
          price: {
            ...createTestSnapshot().state.fields.price,
            value: 200,
          },
        },
        values: { ...createTestSnapshot().state.values, price: 200 },
      },
    })

    const delta = generateDeltaUpdate(before, after)

    expect(delta).toContain('price')
    expect(delta).toContain('100')
    expect(delta).toContain('200')
  })

  it('detects visibility changes', () => {
    const before = createTestSnapshot()
    const after = createTestSnapshot({
      state: {
        ...createTestSnapshot().state,
        fields: {
          ...createTestSnapshot().state.fields,
          price: {
            ...createTestSnapshot().state.fields.price,
            meta: { ...createTestSnapshot().state.fields.price.meta, hidden: true },
          },
        },
      },
    })

    const delta = generateDeltaUpdate(before, after)

    expect(delta).toContain('price')
    expect(delta).toContain('hidden')
  })

  it('detects error changes', () => {
    const before = createTestSnapshot()
    const after = createTestSnapshot({
      state: {
        ...createTestSnapshot().state,
        fields: {
          ...createTestSnapshot().state.fields,
          name: {
            ...createTestSnapshot().state.fields.name,
            meta: { ...createTestSnapshot().state.fields.name.meta, errors: [] },
          },
        },
      },
    })

    const delta = generateDeltaUpdate(before, after)

    expect(delta).toContain('name')
    expect(delta).toContain('cleared')
  })

  it('returns "No changes" when snapshots are identical', () => {
    const snapshot = createTestSnapshot()
    const delta = generateDeltaUpdate(snapshot, snapshot)

    expect(delta).toBe('No changes')
  })
})
