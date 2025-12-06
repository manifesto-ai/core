/**
 * Sync Manager Tests
 */

import { describe, it, expect } from 'vitest'
import type {
  EntitySchema,
  EntityField,
  FormViewSchema,
  ListViewSchema,
  ViewField,
  ListColumn,
} from '../../types'
import {
  syncViews,
  syncFormView,
  syncListView,
  analyzeViewImpact,
  summarizeSyncResults,
  getViewsRequiringReview,
} from '../sync-manager'

// ============================================================================
// Test Fixtures
// ============================================================================

const createField = (
  id: string,
  dataType: EntityField['dataType'],
  options?: Partial<EntityField>
): EntityField => ({
  id,
  dataType,
  label: options?.label ?? id,
  ...options,
})

const createEntity = (
  id: string,
  name: string,
  fields: EntityField[]
): EntitySchema => ({
  _type: 'entity',
  id,
  version: '0.1.0',
  name,
  fields,
})

const createViewField = (
  id: string,
  entityFieldId: string,
  options?: Partial<ViewField>
): ViewField => ({
  id,
  entityFieldId,
  component: 'text-input',
  label: id,
  colSpan: 1,
  ...options,
})

const createColumn = (
  id: string,
  entityFieldId: string,
  options?: Partial<ListColumn>
): ListColumn => ({
  id,
  entityFieldId,
  columnType: 'text',
  label: id,
  width: 'auto',
  ...options,
})

const createFormView = (
  id: string,
  fields: ViewField[]
): FormViewSchema => ({
  _type: 'form-view',
  id,
  version: '0.1.0',
  name: id,
  entityId: 'test-entity',
  purpose: 'create',
  sections: [{ id: 'main', title: 'Main', fields }],
})

const createListView = (
  id: string,
  columns: ListColumn[]
): ListViewSchema => ({
  _type: 'list-view',
  id,
  version: '0.1.0',
  name: id,
  entityId: 'test-entity',
  columns,
})

// ============================================================================
// Main API Tests
// ============================================================================

describe('syncViews', () => {
  it('should handle no changes', () => {
    const entity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
    ])

    const formView = createFormView('form', [
      createViewField('nameField', 'name'),
    ])

    const result = syncViews({
      oldEntity: entity,
      newEntity: entity,
      views: [formView],
    })

    expect(result.changes.changes.length).toBe(0)
    expect(result.syncResults[0].appliedActions.length).toBe(0)
    expect(result.syncResults[0].updatedView).toEqual(formView)
  })

  it('should sync both FormView and ListView', () => {
    const oldEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
      createField('email', 'string'),
    ])
    const newEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
      // email removed
    ])

    const formView = createFormView('form', [
      createViewField('nameField', 'name'),
      createViewField('emailField', 'email'),
    ])
    const listView = createListView('list', [
      createColumn('nameCol', 'name'),
      createColumn('emailCol', 'email'),
    ])

    const result = syncViews({
      oldEntity,
      newEntity,
      views: [formView, listView],
      config: { mode: 'auto-all' },
    })

    expect(result.changes.changes.length).toBeGreaterThan(0)
    expect(result.syncResults.length).toBe(2)

    // Both views should have field removed
    const formResult = result.syncResults.find(r => r.viewId === 'form')!
    const listResult = result.syncResults.find(r => r.viewId === 'list')!

    expect(formResult.appliedActions.some(a => a._type === 'REMOVE_FIELD')).toBe(true)
    expect(listResult.appliedActions.some(a => a._type === 'REMOVE_FIELD')).toBe(true)
  })

  it('should use field mapping hints for rename detection', () => {
    const oldEntity = createEntity('customer', 'Customer', [
      createField('oldName', 'string'),
    ])
    const newEntity = createEntity('customer', 'Customer', [
      createField('completelyDifferentName', 'string'),
    ])

    const formView = createFormView('form', [
      createViewField('nameField', 'oldName'),
    ])

    const result = syncViews({
      oldEntity,
      newEntity,
      views: [formView],
      config: {
        mode: 'auto-all',
        fieldMappingHints: [
          { oldFieldId: 'oldName', newFieldId: 'completelyDifferentName' },
        ],
      },
    })

    // Should detect as rename, not remove+add
    expect(result.changes.renamedFields.has('oldName')).toBe(true)
    expect(result.changes.renamedFields.get('oldName')).toBe('completelyDifferentName')

    const formResult = result.syncResults[0]
    expect(formResult.appliedActions.some(a => a._type === 'UPDATE_FIELD_ID')).toBe(true)
  })

  it('should respect sync mode configuration', () => {
    const oldEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
      createField('email', 'string'),
    ])
    const newEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
    ])

    const formView = createFormView('form', [
      createViewField('nameField', 'name'),
      createViewField('emailField', 'email'),
    ])

    // Manual mode - no auto changes
    const manualResult = syncViews({
      oldEntity,
      newEntity,
      views: [formView],
      config: { mode: 'manual' },
    })
    expect(manualResult.syncResults[0].appliedActions.length).toBe(0)
    expect(manualResult.syncResults[0].skippedActions.length).toBeGreaterThan(0)

    // Auto-safe mode - safe changes only
    const safeResult = syncViews({
      oldEntity,
      newEntity,
      views: [formView],
      config: { mode: 'auto-safe' },
    })
    expect(safeResult.syncResults[0].skippedActions.some(
      s => s.action._type === 'REMOVE_FIELD'
    )).toBe(true)

    // Auto-all mode - all changes
    const allResult = syncViews({
      oldEntity,
      newEntity,
      views: [formView],
      config: { mode: 'auto-all' },
    })
    expect(allResult.syncResults[0].appliedActions.some(
      a => a._type === 'REMOVE_FIELD'
    )).toBe(true)
  })

  it('should mark views requiring review', () => {
    const oldEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
      createField('email', 'string'),
    ])
    const newEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
    ])

    const formView = createFormView('form', [
      createViewField('nameField', 'name'),
      createViewField('emailField', 'email'),
    ])

    // Auto-safe should require review for removal
    const result = syncViews({
      oldEntity,
      newEntity,
      views: [formView],
      config: { mode: 'auto-safe' },
    })

    expect(result.syncResults[0].requiresReview).toBe(true)
    expect(getViewsRequiringReview(result).length).toBe(1)
  })
})

// ============================================================================
// Convenience Function Tests
// ============================================================================

describe('syncFormView', () => {
  it('should sync single FormView', () => {
    const oldEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
      createField('email', 'string'),
    ])
    const newEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
    ])

    const formView = createFormView('form', [
      createViewField('nameField', 'name'),
      createViewField('emailField', 'email'),
    ])

    const result = syncFormView(oldEntity, newEntity, formView, { mode: 'auto-all' })

    expect(result.viewId).toBe('form')
    expect(result.viewType).toBe('form')
    expect(result.appliedActions.length).toBeGreaterThan(0)
  })
})

describe('syncListView', () => {
  it('should sync single ListView', () => {
    const oldEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
      createField('email', 'string'),
    ])
    const newEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
    ])

    const listView = createListView('list', [
      createColumn('nameCol', 'name'),
      createColumn('emailCol', 'email'),
    ])

    const result = syncListView(oldEntity, newEntity, listView, { mode: 'auto-all' })

    expect(result.viewId).toBe('list')
    expect(result.viewType).toBe('list')
    expect(result.appliedActions.length).toBeGreaterThan(0)
  })
})

describe('analyzeViewImpact', () => {
  it('should analyze without applying changes', () => {
    const oldEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
      createField('email', 'string'),
    ])
    const newEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
    ])

    const formView = createFormView('form', [
      createViewField('nameField', 'name'),
      createViewField('emailField', 'email'),
    ])

    const analysis = analyzeViewImpact(oldEntity, newEntity, [formView])

    expect(analysis.changes.changes.length).toBeGreaterThan(0)
    expect(analysis.viewImpacts.length).toBe(1)
    expect(analysis.viewImpacts[0].suggestedActions.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// Summary Tests
// ============================================================================

describe('summarizeSyncResults', () => {
  it('should generate readable summary', () => {
    const oldEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
      createField('email', 'string'),
    ])
    const newEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
    ])

    const formView = createFormView('form', [
      createViewField('nameField', 'name'),
      createViewField('emailField', 'email'),
    ])

    const result = syncViews({
      oldEntity,
      newEntity,
      views: [formView],
      config: { mode: 'auto-all' },
    })

    const summary = summarizeSyncResults(result)

    expect(summary).toContain('Entity Changes:')
    expect(summary).toContain('form')
    expect(summary).toContain('Applied:')
  })
})

// ============================================================================
// Complex Scenarios
// ============================================================================

describe('Complex Scenarios', () => {
  it('should handle multiple entity changes at once', () => {
    const oldEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
      createField('customerEmail', 'string', { label: 'Email' }), // Will be renamed
      createField('phone', 'string'), // Will be removed
      createField('age', 'string'), // Will change type
    ])
    const newEntity = createEntity('customer', 'Customer', [
      createField('name', 'string', { label: 'Full Name' }), // Label changed
      createField('customerEmailAddr', 'string', { label: 'Email' }), // Renamed
      // phone removed
      createField('age', 'number'), // Type changed
      createField('address', 'string'), // Added
    ])

    const formView = createFormView('form', [
      createViewField('nameField', 'name'),
      createViewField('emailField', 'customerEmail'),
      createViewField('phoneField', 'phone'),
      createViewField('ageField', 'age', { component: 'text-input' }),
    ])

    const result = syncViews({
      oldEntity,
      newEntity,
      views: [formView],
      config: { mode: 'auto-all', includeNewFields: true },
    })

    const syncResult = result.syncResults[0]
    const updatedFields = (syncResult.updatedView as FormViewSchema).sections?.[0]?.fields ?? []

    // Phone should be removed
    expect(updatedFields.find(f => f.entityFieldId === 'phone')).toBeUndefined()

    // Email should be renamed
    expect(updatedFields.find(f => f.entityFieldId === 'customerEmailAddr')).toBeDefined()

    // Age component should be updated
    const ageField = updatedFields.find(f => f.entityFieldId === 'age')
    expect(ageField?.component).toBe('number-input')

    // Address should be added
    expect(updatedFields.find(f => f.entityFieldId === 'address')).toBeDefined()
  })

  it('should handle views with reactions referencing changed fields', () => {
    const oldEntity = createEntity('order', 'Order', [
      createField('hasDiscount', 'boolean', { label: 'Has Discount' }),
      createField('discountAmount', 'number'),
    ])
    const newEntity = createEntity('order', 'Order', [
      createField('discountEnabled', 'boolean', { label: 'Has Discount' }), // Renamed
      createField('discountAmount', 'number'),
    ])

    const formView = createFormView('form', [
      createViewField('discountToggle', 'hasDiscount'),
      createViewField('discountField', 'discountAmount', {
        reactions: [
          {
            trigger: 'init',
            condition: ['==', '$state.hasDiscount', true],
            actions: [
              { type: 'updateProp', target: 'discountField', prop: 'hidden', value: false },
            ],
          },
        ],
      }),
    ])

    // Use field mapping hint to assist rename detection
    const result = syncViews({
      oldEntity,
      newEntity,
      views: [formView],
      config: {
        mode: 'auto-all',
        fieldMappingHints: [
          { oldFieldId: 'hasDiscount', newFieldId: 'discountEnabled' },
        ],
      },
    })

    const updatedForm = result.syncResults[0].updatedView as FormViewSchema
    const discountField = updatedForm.sections?.[0]?.fields?.find(
      f => f.entityFieldId === 'discountAmount'
    )

    // Reaction condition should be updated
    expect(discountField?.reactions?.[0]?.condition).toEqual(
      ['==', '$state.discountEnabled', true]
    )
  })
})
