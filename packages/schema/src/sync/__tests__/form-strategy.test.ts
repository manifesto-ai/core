/**
 * Form Strategy Tests
 */

import { describe, it, expect } from 'vitest'
import type { EntitySchema, EntityField, FormViewSchema, ViewField } from '../../types'
import { analyzeFormViewImpact, applyFormStrategy } from '../strategies/form-strategy'
import { diffEntities } from '../diff/entity-diff'
import type { SyncManagerConfig } from '../types'

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

const createFormView = (
  id: string,
  fields: ViewField[],
  options?: Partial<FormViewSchema>
): FormViewSchema => ({
  _type: 'form-view',
  id,
  version: '0.1.0',
  name: id,
  entityId: 'test-entity',
  purpose: 'create',
  sections: [
    {
      id: 'main',
      title: 'Main',
      fields,
    },
  ],
  ...options,
})

const defaultConfig: SyncManagerConfig = {
  mode: 'auto-all',
  includeNewFields: false,
  preserveCustomizations: true,
}

// ============================================================================
// Impact Analysis Tests
// ============================================================================

describe('analyzeFormViewImpact', () => {
  it('should detect impact of field removal', () => {
    const oldEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
      createField('email', 'string'),
    ])
    const newEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
      // email removed
    ])

    const formView = createFormView('customer-form', [
      createViewField('nameField', 'name'),
      createViewField('emailField', 'email'),
    ])

    const changes = diffEntities(oldEntity, newEntity)
    const impact = analyzeFormViewImpact(formView, changes)

    expect(impact.affectedElements.length).toBeGreaterThan(0)
    expect(impact.affectedElements.some(e => e.entityFieldId === 'email')).toBe(true)
    expect(impact.suggestedActions.some(a => a._type === 'REMOVE_FIELD')).toBe(true)
    expect(impact.requiresReview).toBe(true)
  })

  it('should detect impact of field rename', () => {
    const oldEntity = createEntity('customer', 'Customer', [
      createField('customerEmail', 'string', { label: 'Email' }),
    ])
    const newEntity = createEntity('customer', 'Customer', [
      createField('customerEmailAddr', 'string', { label: 'Email' }),
    ])

    const formView = createFormView('customer-form', [
      createViewField('emailField', 'customerEmail'),
    ])

    const changes = diffEntities(oldEntity, newEntity)
    const impact = analyzeFormViewImpact(formView, changes)

    expect(impact.suggestedActions.some(a => a._type === 'UPDATE_FIELD_ID')).toBe(true)
  })

  it('should detect impact of type change', () => {
    const oldEntity = createEntity('customer', 'Customer', [
      createField('age', 'string'),
    ])
    const newEntity = createEntity('customer', 'Customer', [
      createField('age', 'number'),
    ])

    const formView = createFormView('customer-form', [
      createViewField('ageField', 'age', { component: 'text-input' }),
    ])

    const changes = diffEntities(oldEntity, newEntity)
    const impact = analyzeFormViewImpact(formView, changes)

    expect(impact.suggestedActions.some(a => a._type === 'UPDATE_COMPONENT')).toBe(true)
  })

  it('should detect impact of enum change', () => {
    const oldEntity = createEntity('order', 'Order', [
      createField('status', 'enum', {
        enumValues: [
          { value: 'pending', label: 'Pending' },
          { value: 'active', label: 'Active' },
        ],
      }),
    ])
    const newEntity = createEntity('order', 'Order', [
      createField('status', 'enum', {
        enumValues: [
          { value: 'pending', label: 'Pending' },
          { value: 'active', label: 'Active' },
          { value: 'completed', label: 'Completed' },
        ],
      }),
    ])

    const formView = createFormView('order-form', [
      createViewField('statusField', 'status', { component: 'select' }),
    ])

    const changes = diffEntities(oldEntity, newEntity)
    const impact = analyzeFormViewImpact(formView, changes)

    expect(impact.suggestedActions.some(a => a._type === 'UPDATE_ENUM_OPTIONS')).toBe(true)
  })
})

// ============================================================================
// Strategy Application Tests
// ============================================================================

describe('applyFormStrategy', () => {
  describe('auto-all mode', () => {
    it('should remove field from view when entity field is removed', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
        createField('email', 'string'),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
      ])

      const formView = createFormView('customer-form', [
        createViewField('nameField', 'name'),
        createViewField('emailField', 'email'),
      ])

      const changes = diffEntities(oldEntity, newEntity)
      const impact = analyzeFormViewImpact(formView, changes)
      const result = applyFormStrategy(formView, impact, changes, defaultConfig)

      const remainingFields = result.updatedView.sections?.[0]?.fields ?? []
      expect(remainingFields.length).toBe(1)
      expect(remainingFields[0].entityFieldId).toBe('name')
      expect(result.appliedActions.some(a => a._type === 'REMOVE_FIELD')).toBe(true)
    })

    it('should update entityFieldId when field is renamed', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('customerEmail', 'string', { label: 'Email' }),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('customerEmailAddr', 'string', { label: 'Email' }),
      ])

      const formView = createFormView('customer-form', [
        createViewField('emailField', 'customerEmail'),
      ])

      const changes = diffEntities(oldEntity, newEntity)
      const impact = analyzeFormViewImpact(formView, changes)
      const result = applyFormStrategy(formView, impact, changes, defaultConfig)

      const updatedField = result.updatedView.sections?.[0]?.fields?.[0]
      expect(updatedField?.entityFieldId).toBe('customerEmailAddr')
    })

    it('should update component when type changes', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('age', 'string'),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('age', 'number'),
      ])

      const formView = createFormView('customer-form', [
        createViewField('ageField', 'age', { component: 'text-input' }),
      ])

      const changes = diffEntities(oldEntity, newEntity)
      const impact = analyzeFormViewImpact(formView, changes)
      const result = applyFormStrategy(formView, impact, changes, defaultConfig)

      const updatedField = result.updatedView.sections?.[0]?.fields?.[0]
      expect(updatedField?.component).toBe('number-input')
    })
  })

  describe('auto-safe mode', () => {
    const safeConfig: SyncManagerConfig = {
      mode: 'auto-safe',
      includeNewFields: false,
      preserveCustomizations: true,
    }

    it('should not remove fields automatically', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
        createField('email', 'string'),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
      ])

      const formView = createFormView('customer-form', [
        createViewField('nameField', 'name'),
        createViewField('emailField', 'email'),
      ])

      const changes = diffEntities(oldEntity, newEntity)
      const impact = analyzeFormViewImpact(formView, changes)
      const result = applyFormStrategy(formView, impact, changes, safeConfig)

      // Field should NOT be removed in auto-safe
      const remainingFields = result.updatedView.sections?.[0]?.fields ?? []
      expect(remainingFields.length).toBe(2)
      expect(result.skippedActions.some(s => s.action._type === 'REMOVE_FIELD')).toBe(true)
    })

    it('should update field ID automatically', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('customerEmail', 'string', { label: 'Email' }),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('customerEmailAddr', 'string', { label: 'Email' }),
      ])

      const formView = createFormView('customer-form', [
        createViewField('emailField', 'customerEmail'),
      ])

      const changes = diffEntities(oldEntity, newEntity)
      const impact = analyzeFormViewImpact(formView, changes)
      const result = applyFormStrategy(formView, impact, changes, safeConfig)

      // Field ID update IS safe
      const updatedField = result.updatedView.sections?.[0]?.fields?.[0]
      expect(updatedField?.entityFieldId).toBe('customerEmailAddr')
    })
  })

  describe('manual mode', () => {
    const manualConfig: SyncManagerConfig = {
      mode: 'manual',
      includeNewFields: false,
      preserveCustomizations: true,
    }

    it('should not apply any changes automatically', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
        createField('email', 'string'),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
      ])

      const formView = createFormView('customer-form', [
        createViewField('nameField', 'name'),
        createViewField('emailField', 'email'),
      ])

      const changes = diffEntities(oldEntity, newEntity)
      const impact = analyzeFormViewImpact(formView, changes)
      const result = applyFormStrategy(formView, impact, changes, manualConfig)

      // No changes should be applied
      expect(result.appliedActions.length).toBe(0)
      expect(result.skippedActions.length).toBeGreaterThan(0)
      expect(result.updatedView).toEqual(formView)
    })
  })

  describe('includeNewFields option', () => {
    it('should add new fields when enabled', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
        createField('email', 'string', { label: 'Email Address' }),
      ])

      const formView = createFormView('customer-form', [
        createViewField('nameField', 'name'),
      ])

      const config: SyncManagerConfig = {
        mode: 'auto-all',
        includeNewFields: true,
        preserveCustomizations: true,
      }

      const changes = diffEntities(oldEntity, newEntity)
      const impact = analyzeFormViewImpact(formView, changes)
      const result = applyFormStrategy(formView, impact, changes, config)

      const fields = result.updatedView.sections?.[0]?.fields ?? []
      expect(fields.length).toBe(2)
      expect(fields.some(f => f.entityFieldId === 'email')).toBe(true)
    })

    it('should not add new fields when disabled', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
        createField('email', 'string'),
      ])

      const formView = createFormView('customer-form', [
        createViewField('nameField', 'name'),
      ])

      const changes = diffEntities(oldEntity, newEntity)
      const impact = analyzeFormViewImpact(formView, changes)
      const result = applyFormStrategy(formView, impact, changes, defaultConfig)

      const fields = result.updatedView.sections?.[0]?.fields ?? []
      expect(fields.length).toBe(1)
    })
  })
})

// ============================================================================
// Reaction Reference Tests
// ============================================================================

describe('Reaction References', () => {
  it('should detect affected reactions when field is removed', () => {
    const oldEntity = createEntity('order', 'Order', [
      createField('hasDiscount', 'boolean'),
      createField('discountAmount', 'number'),
    ])
    const newEntity = createEntity('order', 'Order', [
      createField('discountAmount', 'number'),
      // hasDiscount removed
    ])

    const formView = createFormView('order-form', [
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

    const changes = diffEntities(oldEntity, newEntity)
    const impact = analyzeFormViewImpact(formView, changes)

    // Should detect the reaction is affected
    expect(impact.affectedElements.some(e => e.elementType === 'reaction')).toBe(true)
  })

  it('should update reaction references when field is renamed', () => {
    const oldEntity = createEntity('order', 'Order', [
      createField('hasDiscount', 'boolean', { label: 'Has Discount' }),
      createField('discountAmt', 'number'),
    ])
    const newEntity = createEntity('order', 'Order', [
      createField('hasDiscountApplied', 'boolean', { label: 'Has Discount' }), // renamed
      createField('discountAmt', 'number'),
    ])

    const formView = createFormView('order-form', [
      createViewField('discountField', 'discountAmt', {
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

    const changes = diffEntities(oldEntity, newEntity)
    const impact = analyzeFormViewImpact(formView, changes)
    const result = applyFormStrategy(formView, impact, changes, defaultConfig)

    // Verify reaction condition was updated
    const updatedField = result.updatedView.sections?.[0]?.fields?.[0]
    const updatedCondition = updatedField?.reactions?.[0]?.condition

    expect(updatedCondition).toEqual(['==', '$state.hasDiscountApplied', true])
  })
})
