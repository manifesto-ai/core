/**
 * Entity Diff Tests
 */

import { describe, it, expect } from 'vitest'
import type { EntitySchema, EntityField } from '../../types'
import {
  diffEntities,
  filterChangesByType,
  filterChangesBySeverity,
  summarizeChanges,
} from '../diff/entity-diff'
import { stringSimilarity } from '../diff/rename-detector'

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

// ============================================================================
// Basic Diff Tests
// ============================================================================

describe('diffEntities', () => {
  describe('Field Addition', () => {
    it('should detect added fields', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
        createField('email', 'string'),
      ])

      const result = diffEntities(oldEntity, newEntity)

      expect(result.changes.length).toBe(1)
      expect(result.changes[0]._type).toBe('FIELD_ADDED')
      if (result.changes[0]._type === 'FIELD_ADDED') {
        expect(result.changes[0].fieldId).toBe('email')
        expect(result.changes[0].severity).toBe('info')
      }
      expect(result.hasBreakingChanges).toBe(false)
    })

    it('should detect multiple added fields', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
        createField('email', 'string'),
        createField('phone', 'string'),
        createField('age', 'number'),
      ])

      const result = diffEntities(oldEntity, newEntity)

      const addedChanges = filterChangesByType(result.changes, 'FIELD_ADDED')
      expect(addedChanges.length).toBe(3)
    })
  })

  describe('Field Removal', () => {
    it('should detect removed fields', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
        createField('email', 'string'),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
      ])

      const result = diffEntities(oldEntity, newEntity)

      expect(result.changes.length).toBe(1)
      expect(result.changes[0]._type).toBe('FIELD_REMOVED')
      if (result.changes[0]._type === 'FIELD_REMOVED') {
        expect(result.changes[0].fieldId).toBe('email')
        expect(result.changes[0].severity).toBe('critical')
      }
      expect(result.hasBreakingChanges).toBe(true)
    })
  })

  describe('Field Rename Detection', () => {
    it('should detect field rename with similar names', () => {
      // Use highly similar IDs and same label/type to ensure detection
      const oldEntity = createEntity('customer', 'Customer', [
        createField('customerEmail', 'string', {
          label: 'Email Address',
          constraints: [{ type: 'required' }],
        }),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('customerEmailAddr', 'string', {
          label: 'Email Address',
          constraints: [{ type: 'required' }],
        }),
      ])

      const result = diffEntities(oldEntity, newEntity)

      const renamedChanges = filterChangesByType(result.changes, 'FIELD_RENAMED')
      expect(renamedChanges.length).toBe(1)
      expect(renamedChanges[0].oldId).toBe('customerEmail')
      expect(renamedChanges[0].newId).toBe('customerEmailAddr')
      expect(result.renamedFields.get('customerEmail')).toBe('customerEmailAddr')
    })

    it('should use user-provided hints for rename detection', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('oldField', 'string'),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('completelyDifferentName', 'string'),
      ])

      const result = diffEntities(oldEntity, newEntity, {
        fieldMappingHints: [
          { oldFieldId: 'oldField', newFieldId: 'completelyDifferentName' },
        ],
      })

      const renamedChanges = filterChangesByType(result.changes, 'FIELD_RENAMED')
      expect(renamedChanges.length).toBe(1)
      expect(renamedChanges[0].confidence).toBe(1.0) // User hint = max confidence
    })

    it('should not detect rename for completely different fields', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('alpha', 'string'),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('beta', 'number'), // Different type, different name
      ])

      const result = diffEntities(oldEntity, newEntity)

      // Should be detected as remove + add, not rename
      expect(filterChangesByType(result.changes, 'FIELD_RENAMED').length).toBe(0)
      expect(filterChangesByType(result.changes, 'FIELD_REMOVED').length).toBe(1)
      expect(filterChangesByType(result.changes, 'FIELD_ADDED').length).toBe(1)
    })
  })

  describe('Field Type Change', () => {
    it('should detect type change on same field', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('age', 'string'),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('age', 'number'),
      ])

      const result = diffEntities(oldEntity, newEntity)

      const typeChanges = filterChangesByType(result.changes, 'FIELD_TYPE_CHANGED')
      expect(typeChanges.length).toBe(1)
      expect(typeChanges[0].oldType).toBe('string')
      expect(typeChanges[0].newType).toBe('number')
      expect(typeChanges[0].compatibility.level).toBe('requires-component-change')
    })

    it('should mark incompatible type changes as critical', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('data', 'array'),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('data', 'number'),
      ])

      const result = diffEntities(oldEntity, newEntity)

      const typeChanges = filterChangesByType(result.changes, 'FIELD_TYPE_CHANGED')
      expect(typeChanges[0].compatibility.level).toBe('incompatible')
      expect(typeChanges[0].severity).toBe('critical')
      expect(result.hasBreakingChanges).toBe(true)
    })
  })

  describe('Label Change', () => {
    it('should detect label changes', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('name', 'string', { label: 'Full Name' }),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('name', 'string', { label: 'Customer Name' }),
      ])

      const result = diffEntities(oldEntity, newEntity)

      const labelChanges = filterChangesByType(result.changes, 'FIELD_LABEL_CHANGED')
      expect(labelChanges.length).toBe(1)
      expect(labelChanges[0].oldLabel).toBe('Full Name')
      expect(labelChanges[0].newLabel).toBe('Customer Name')
      expect(labelChanges[0].severity).toBe('info')
    })
  })

  describe('Constraint Change', () => {
    it('should detect added constraints', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('email', 'string'),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('email', 'string', {
          constraints: [{ type: 'required' }, { type: 'email' }],
        }),
      ])

      const result = diffEntities(oldEntity, newEntity)

      const constraintChanges = filterChangesByType(result.changes, 'FIELD_CONSTRAINT_CHANGED')
      expect(constraintChanges.length).toBe(1)
      expect(constraintChanges[0].addedConstraints.length).toBe(2)
      expect(constraintChanges[0].severity).toBe('warning') // Adding constraints is warning
    })

    it('should detect removed constraints', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('email', 'string', {
          constraints: [{ type: 'required' }],
        }),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('email', 'string'),
      ])

      const result = diffEntities(oldEntity, newEntity)

      const constraintChanges = filterChangesByType(result.changes, 'FIELD_CONSTRAINT_CHANGED')
      expect(constraintChanges.length).toBe(1)
      expect(constraintChanges[0].removedConstraints.length).toBe(1)
      expect(constraintChanges[0].severity).toBe('info') // Removing constraints is info
    })
  })

  describe('Enum Change', () => {
    it('should detect enum value changes', () => {
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

      const result = diffEntities(oldEntity, newEntity)

      const enumChanges = filterChangesByType(result.changes, 'FIELD_ENUM_CHANGED')
      expect(enumChanges.length).toBe(1)
      expect(enumChanges[0].addedValues.length).toBe(1)
      expect(enumChanges[0].addedValues[0].value).toBe('completed')
    })

    it('should detect removed enum values', () => {
      const oldEntity = createEntity('order', 'Order', [
        createField('status', 'enum', {
          enumValues: [
            { value: 'pending', label: 'Pending' },
            { value: 'active', label: 'Active' },
            { value: 'cancelled', label: 'Cancelled' },
          ],
        }),
      ])
      const newEntity = createEntity('order', 'Order', [
        createField('status', 'enum', {
          enumValues: [
            { value: 'pending', label: 'Pending' },
            { value: 'active', label: 'Active' },
          ],
        }),
      ])

      const result = diffEntities(oldEntity, newEntity)

      const enumChanges = filterChangesByType(result.changes, 'FIELD_ENUM_CHANGED')
      expect(enumChanges.length).toBe(1)
      expect(enumChanges[0].removedValues.length).toBe(1)
      expect(enumChanges[0].removedValues[0].value).toBe('cancelled')
    })

    it('should detect modified enum labels', () => {
      const oldEntity = createEntity('order', 'Order', [
        createField('status', 'enum', {
          enumValues: [{ value: 'pending', label: 'Pending' }],
        }),
      ])
      const newEntity = createEntity('order', 'Order', [
        createField('status', 'enum', {
          enumValues: [{ value: 'pending', label: 'Waiting' }],
        }),
      ])

      const result = diffEntities(oldEntity, newEntity)

      const enumChanges = filterChangesByType(result.changes, 'FIELD_ENUM_CHANGED')
      expect(enumChanges.length).toBe(1)
      expect(enumChanges[0].modifiedValues.length).toBe(1)
      expect(enumChanges[0].modifiedValues[0].old.label).toBe('Pending')
      expect(enumChanges[0].modifiedValues[0].new.label).toBe('Waiting')
    })
  })

  describe('Reference Change', () => {
    it('should detect reference entity changes', () => {
      const oldEntity = createEntity('order', 'Order', [
        createField('customerId', 'reference', {
          reference: { entity: 'customer', displayField: 'name', valueField: 'id' },
        }),
      ])
      const newEntity = createEntity('order', 'Order', [
        createField('customerId', 'reference', {
          reference: { entity: 'user', displayField: 'name', valueField: 'id' },
        }),
      ])

      const result = diffEntities(oldEntity, newEntity)

      const refChanges = filterChangesByType(result.changes, 'FIELD_REFERENCE_CHANGED')
      expect(refChanges.length).toBe(1)
      expect(refChanges[0].oldEntity).toBe('customer')
      expect(refChanges[0].newEntity).toBe('user')
      expect(refChanges[0].severity).toBe('critical')
    })
  })

  describe('No Changes', () => {
    it('should return empty changes for identical entities', () => {
      const entity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
        createField('email', 'string'),
      ])

      const result = diffEntities(entity, entity)

      expect(result.changes.length).toBe(0)
      expect(result.hasBreakingChanges).toBe(false)
      expect(result.hasCriticalChanges).toBe(false)
    })
  })

  describe('Complex Scenarios', () => {
    it('should handle multiple changes at once', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
        createField('customerEmail', 'string', { label: 'Email' }), // Will be renamed
        createField('phone', 'string'),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('name', 'string', { label: 'Full Name' }), // Label changed
        createField('customerEmailAddr', 'string', { label: 'Email' }), // Renamed (same label, similar id)
        createField('age', 'number'), // Added
        // phone removed
      ])

      const result = diffEntities(oldEntity, newEntity)

      expect(filterChangesByType(result.changes, 'FIELD_LABEL_CHANGED').length).toBe(1)
      expect(filterChangesByType(result.changes, 'FIELD_RENAMED').length).toBe(1)
      expect(filterChangesByType(result.changes, 'FIELD_ADDED').length).toBe(1)
      expect(filterChangesByType(result.changes, 'FIELD_REMOVED').length).toBe(1)
    })
  })
})

// ============================================================================
// Filter Utility Tests
// ============================================================================

describe('filterChangesBySeverity', () => {
  it('should filter by minimum severity', () => {
    const oldEntity = createEntity('test', 'Test', [
      createField('a', 'string'),
      createField('b', 'string'),
      createField('c', 'string', { label: 'Old Label' }),
    ])
    const newEntity = createEntity('test', 'Test', [
      // a removed (critical)
      createField('b', 'number'), // type changed (warning)
      createField('c', 'string', { label: 'New Label' }), // label changed (info)
    ])

    const result = diffEntities(oldEntity, newEntity)

    const criticalOnly = filterChangesBySeverity(result.changes, 'critical')
    const warningUp = filterChangesBySeverity(result.changes, 'warning')
    const all = filterChangesBySeverity(result.changes, 'info')

    expect(criticalOnly.length).toBeLessThan(warningUp.length)
    expect(warningUp.length).toBeLessThanOrEqual(all.length)
  })
})

// ============================================================================
// String Similarity Tests
// ============================================================================

describe('stringSimilarity', () => {
  it('should return 1 for identical strings', () => {
    expect(stringSimilarity('hello', 'hello')).toBe(1)
  })

  it('should return 0 for empty strings', () => {
    expect(stringSimilarity('', 'hello')).toBe(0)
    expect(stringSimilarity('hello', '')).toBe(0)
  })

  it('should return high similarity for similar strings', () => {
    expect(stringSimilarity('email', 'emailAddress')).toBeGreaterThan(0.4)
    expect(stringSimilarity('userName', 'username')).toBeGreaterThan(0.8)
  })

  it('should be case insensitive', () => {
    expect(stringSimilarity('Email', 'email')).toBe(1)
  })
})

// ============================================================================
// Summary Tests
// ============================================================================

describe('summarizeChanges', () => {
  it('should generate readable summary', () => {
    const oldEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
      createField('email', 'string'),
    ])
    const newEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
    ])

    const result = diffEntities(oldEntity, newEntity)
    const summary = summarizeChanges(result)

    expect(summary).toContain('Customer')
    expect(summary).toContain('FIELD_REMOVED')
    expect(summary).toContain('breaking changes')
  })
})
