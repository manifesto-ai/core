/**
 * List Strategy Tests
 */

import { describe, it, expect } from 'vitest'
import type { EntitySchema, EntityField, ListViewSchema, ListColumn } from '../../types'
import { analyzeListViewImpact, applyListStrategy } from '../strategies/list-strategy'
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

const createColumn = (
  id: string,
  entityFieldId: string,
  options?: Partial<ListColumn>
): ListColumn => ({
  id,
  entityFieldId,
  type: 'text',
  label: id,
  width: 'auto',
  ...options,
})

const createListView = (
  id: string,
  columns: ListColumn[],
  options?: Partial<ListViewSchema>
): ListViewSchema => ({
  _type: 'list-view',
  id,
  version: '0.1.0',
  name: id,
  entityId: 'test-entity',
  columns,
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

describe('analyzeListViewImpact', () => {
  it('should detect impact of column field removal', () => {
    const oldEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
      createField('email', 'string'),
    ])
    const newEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
    ])

    const listView = createListView('customer-list', [
      createColumn('nameCol', 'name'),
      createColumn('emailCol', 'email'),
    ])

    const changes = diffEntities(oldEntity, newEntity)
    const impact = analyzeListViewImpact(listView, changes)

    expect(impact.affectedElements.some(e => e.entityFieldId === 'email')).toBe(true)
    expect(impact.suggestedActions.some(a => a._type === 'REMOVE_FIELD')).toBe(true)
    expect(impact.requiresReview).toBe(true)
  })

  it('should detect impact of column field rename', () => {
    const oldEntity = createEntity('customer', 'Customer', [
      createField('customerEmail', 'string', { label: 'Email' }),
    ])
    const newEntity = createEntity('customer', 'Customer', [
      createField('customerEmailAddr', 'string', { label: 'Email' }),
    ])

    const listView = createListView('customer-list', [
      createColumn('emailCol', 'customerEmail'),
    ])

    const changes = diffEntities(oldEntity, newEntity)
    const impact = analyzeListViewImpact(listView, changes)

    expect(impact.suggestedActions.some(a => a._type === 'UPDATE_FIELD_ID')).toBe(true)
  })

  it('should detect impact on filters', () => {
    const oldEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
      createField('status', 'enum'),
    ])
    const newEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
    ])

    const listView = createListView('customer-list', [
      createColumn('nameCol', 'name'),
    ], {
      filtering: {
        enabled: true,
        fields: [
          { id: 'statusFilter', entityFieldId: 'status', label: 'Status', type: 'select' },
        ],
      },
    })

    const changes = diffEntities(oldEntity, newEntity)
    const impact = analyzeListViewImpact(listView, changes)

    expect(impact.affectedElements.some(e => e.elementType === 'filter')).toBe(true)
  })

  it('should detect impact on sort', () => {
    const oldEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
      createField('createdAt', 'datetime'),
    ])
    const newEntity = createEntity('customer', 'Customer', [
      createField('name', 'string'),
    ])

    const listView = createListView('customer-list', [
      createColumn('nameCol', 'name'),
    ], {
      sorting: {
        enabled: true,
        defaultSort: { field: 'createdAt', direction: 'desc' },
      },
    })

    const changes = diffEntities(oldEntity, newEntity)
    const impact = analyzeListViewImpact(listView, changes)

    expect(impact.affectedElements.some(e => e.elementType === 'sort')).toBe(true)
  })
})

// ============================================================================
// Strategy Application Tests
// ============================================================================

describe('applyListStrategy', () => {
  describe('auto-all mode', () => {
    it('should remove column when entity field is removed', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
        createField('email', 'string'),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
      ])

      const listView = createListView('customer-list', [
        createColumn('nameCol', 'name'),
        createColumn('emailCol', 'email'),
      ])

      const changes = diffEntities(oldEntity, newEntity)
      const impact = analyzeListViewImpact(listView, changes)
      const result = applyListStrategy(listView, impact, changes, defaultConfig)

      expect(result.updatedView.columns?.length).toBe(1)
      expect(result.updatedView.columns?.[0].entityFieldId).toBe('name')
      expect(result.appliedActions.some(a => a._type === 'REMOVE_FIELD')).toBe(true)
    })

    it('should update entityFieldId when field is renamed', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('customerEmail', 'string', { label: 'Email' }),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('customerEmailAddr', 'string', { label: 'Email' }),
      ])

      const listView = createListView('customer-list', [
        createColumn('emailCol', 'customerEmail'),
      ])

      const changes = diffEntities(oldEntity, newEntity)
      const impact = analyzeListViewImpact(listView, changes)
      const result = applyListStrategy(listView, impact, changes, defaultConfig)

      expect(result.updatedView.columns?.[0].entityFieldId).toBe('customerEmailAddr')
    })

    it('should update column type when data type changes', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('age', 'string'),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('age', 'number'),
      ])

      const listView = createListView('customer-list', [
        createColumn('ageCol', 'age', { type: 'text' }),
      ])

      const changes = diffEntities(oldEntity, newEntity)
      const impact = analyzeListViewImpact(listView, changes)
      const result = applyListStrategy(listView, impact, changes, defaultConfig)

      expect(result.updatedView.columns?.[0].type).toBe('number')
    })

    it('should remove filter when entity field is removed', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
        createField('status', 'enum'),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
      ])

      const listView = createListView('customer-list', [
        createColumn('nameCol', 'name'),
        createColumn('statusCol', 'status'),
      ], {
        filtering: {
          enabled: true,
          fields: [
            { id: 'statusFilter', entityFieldId: 'status', label: 'Status', type: 'select' },
            { id: 'nameFilter', entityFieldId: 'name', label: 'Name', type: 'text' },
          ],
        },
      })

      const changes = diffEntities(oldEntity, newEntity)
      const impact = analyzeListViewImpact(listView, changes)
      const result = applyListStrategy(listView, impact, changes, defaultConfig)

      // Column should be removed
      expect(result.updatedView.columns?.length).toBe(1)
      expect(result.updatedView.columns?.[0].entityFieldId).toBe('name')
      // Filter should also be removed
      expect(result.updatedView.filtering?.fields?.length).toBe(1)
      expect(result.updatedView.filtering?.fields?.[0].entityFieldId).toBe('name')
    })

    it('should remove sort when entity field is removed', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
        createField('createdAt', 'datetime'),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
      ])

      const listView = createListView('customer-list', [
        createColumn('nameCol', 'name'),
        createColumn('createdAtCol', 'createdAt'),
      ], {
        sorting: {
          enabled: true,
          defaultSort: { field: 'createdAt', direction: 'desc' },
        },
      })

      const changes = diffEntities(oldEntity, newEntity)
      const impact = analyzeListViewImpact(listView, changes)
      const result = applyListStrategy(listView, impact, changes, defaultConfig)

      // Column should be removed
      expect(result.updatedView.columns?.length).toBe(1)
      // Sort should also be removed
      expect(result.updatedView.sorting?.defaultSort).toBeUndefined()
    })

    it('should update filter entityFieldId when field is renamed', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('customerStatus', 'enum', { label: 'Status' }),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('customerStatusCode', 'enum', { label: 'Status' }),
      ])

      const listView = createListView('customer-list', [
        createColumn('statusCol', 'customerStatus'),
      ], {
        filtering: {
          enabled: true,
          fields: [
            { id: 'statusFilter', entityFieldId: 'customerStatus', label: 'Status', type: 'select' },
          ],
        },
      })

      const changes = diffEntities(oldEntity, newEntity)
      const impact = analyzeListViewImpact(listView, changes)
      const result = applyListStrategy(listView, impact, changes, defaultConfig)

      expect(result.updatedView.columns?.[0].entityFieldId).toBe('customerStatusCode')
      expect(result.updatedView.filtering?.fields?.[0].entityFieldId).toBe('customerStatusCode')
    })

    it('should update sort field when field is renamed', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('customerCreatedAt', 'datetime', { label: 'Created At' }),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('customerCreationDate', 'datetime', { label: 'Created At' }),
      ])

      const listView = createListView('customer-list', [
        createColumn('createdAtCol', 'customerCreatedAt'),
      ], {
        sorting: {
          enabled: true,
          defaultSort: { field: 'customerCreatedAt', direction: 'desc' },
        },
      })

      const changes = diffEntities(oldEntity, newEntity)
      const impact = analyzeListViewImpact(listView, changes)
      const result = applyListStrategy(listView, impact, changes, defaultConfig)

      expect(result.updatedView.columns?.[0].entityFieldId).toBe('customerCreationDate')
      expect(result.updatedView.sorting?.defaultSort?.field).toBe('customerCreationDate')
    })
  })

  describe('auto-safe mode', () => {
    const safeConfig: SyncManagerConfig = {
      mode: 'auto-safe',
      includeNewFields: false,
      preserveCustomizations: true,
    }

    it('should not remove columns automatically', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
        createField('email', 'string'),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
      ])

      const listView = createListView('customer-list', [
        createColumn('nameCol', 'name'),
        createColumn('emailCol', 'email'),
      ])

      const changes = diffEntities(oldEntity, newEntity)
      const impact = analyzeListViewImpact(listView, changes)
      const result = applyListStrategy(listView, impact, changes, safeConfig)

      expect(result.updatedView.columns?.length).toBe(2)
      expect(result.skippedActions.some(s => s.action._type === 'REMOVE_FIELD')).toBe(true)
    })

    it('should still update field IDs automatically', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('customerEmail', 'string', { label: 'Email' }),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('customerEmailAddr', 'string', { label: 'Email' }),
      ])

      const listView = createListView('customer-list', [
        createColumn('emailCol', 'customerEmail'),
      ])

      const changes = diffEntities(oldEntity, newEntity)
      const impact = analyzeListViewImpact(listView, changes)
      const result = applyListStrategy(listView, impact, changes, safeConfig)

      expect(result.updatedView.columns?.[0].entityFieldId).toBe('customerEmailAddr')
    })

    it('should not remove filters automatically but should update field IDs', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('customerStatus', 'enum', { label: 'Status' }),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('customerStatusCode', 'enum', { label: 'Status' }),
      ])

      const listView = createListView('customer-list', [
        createColumn('statusCol', 'customerStatus'),
      ], {
        filtering: {
          enabled: true,
          fields: [
            { id: 'statusFilter', entityFieldId: 'customerStatus', label: 'Status', type: 'select' },
          ],
        },
      })

      const changes = diffEntities(oldEntity, newEntity)
      const impact = analyzeListViewImpact(listView, changes)
      const result = applyListStrategy(listView, impact, changes, safeConfig)

      // Column field ID should be updated
      expect(result.updatedView.columns?.[0].entityFieldId).toBe('customerStatusCode')
      // Filter field ID should also be updated (UPDATE is allowed in auto-safe)
      expect(result.updatedView.filtering?.fields?.[0].entityFieldId).toBe('customerStatusCode')
    })

    it('should not remove sort automatically', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
        createField('createdAt', 'datetime'),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
      ])

      const listView = createListView('customer-list', [
        createColumn('nameCol', 'name'),
        createColumn('createdAtCol', 'createdAt'),
      ], {
        sorting: {
          enabled: true,
          defaultSort: { field: 'createdAt', direction: 'desc' },
        },
      })

      const changes = diffEntities(oldEntity, newEntity)
      const impact = analyzeListViewImpact(listView, changes)
      const result = applyListStrategy(listView, impact, changes, safeConfig)

      // Column should remain (removal skipped)
      expect(result.updatedView.columns?.length).toBe(2)
      // Sort should also remain (removal skipped)
      expect(result.updatedView.sorting?.defaultSort?.field).toBe('createdAt')
      // Verify REMOVE_SORT was skipped
      expect(result.skippedActions.some(s => s.action._type === 'REMOVE_SORT')).toBe(true)
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

      const listView = createListView('customer-list', [
        createColumn('nameCol', 'name'),
        createColumn('emailCol', 'email'),
      ])

      const changes = diffEntities(oldEntity, newEntity)
      const impact = analyzeListViewImpact(listView, changes)
      const result = applyListStrategy(listView, impact, changes, manualConfig)

      expect(result.appliedActions.length).toBe(0)
      expect(result.skippedActions.length).toBeGreaterThan(0)
    })
  })

  describe('includeNewFields option', () => {
    it('should add new columns when enabled', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
        createField('email', 'string', { label: 'Email Address' }),
      ])

      const listView = createListView('customer-list', [
        createColumn('nameCol', 'name'),
      ])

      const config: SyncManagerConfig = {
        mode: 'auto-all',
        includeNewFields: true,
        preserveCustomizations: true,
      }

      const changes = diffEntities(oldEntity, newEntity)
      const impact = analyzeListViewImpact(listView, changes)
      const result = applyListStrategy(listView, impact, changes, config)

      expect(result.updatedView.columns?.length).toBe(2)
      expect(result.updatedView.columns?.some(c => c.entityFieldId === 'email')).toBe(true)
    })

    it('should not add new columns when disabled', () => {
      const oldEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
      ])
      const newEntity = createEntity('customer', 'Customer', [
        createField('name', 'string'),
        createField('email', 'string'),
      ])

      const listView = createListView('customer-list', [
        createColumn('nameCol', 'name'),
      ])

      const changes = diffEntities(oldEntity, newEntity)
      const impact = analyzeListViewImpact(listView, changes)
      const result = applyListStrategy(listView, impact, changes, defaultConfig)

      expect(result.updatedView.columns?.length).toBe(1)
    })
  })
})
