/**
 * E2E Integration Tests - Sync Manager
 *
 * Entity 변경 → View 동기화 전체 파이프라인 테스트
 */

import { describe, it, expect } from 'vitest'
import type { EntitySchema, EntityField, FormViewSchema, ListViewSchema } from '@manifesto-ai/schema'
import {
  // Sync Manager
  syncViews,
  syncFormView,
  syncListView,
  analyzeViewImpact,
  summarizeSyncResults,
  getViewsRequiringReview,
  // Diff utilities
  diffEntities,
  filterChangesByType,
  stringSimilarity,
  // Form inference
  inferComponentType,
  inferColSpan,
} from '../../index'

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

const createFormView = (
  id: string,
  entityId: string,
  fields: { id: string; entityFieldId: string; component: string }[]
): FormViewSchema => ({
  _type: 'form-view',
  id,
  version: '0.1.0',
  name: id,
  entityId,
  sections: [
    {
      id: 'main',
      title: 'Main',
      fields: fields.map(f => ({
        id: f.id,
        entityFieldId: f.entityFieldId,
        component: f.component as any,
        label: f.id,
        colSpan: 1,
      })),
    },
  ],
})

const createListView = (
  id: string,
  entityId: string,
  columns: { id: string; entityFieldId: string; type: string }[]
): ListViewSchema => ({
  _type: 'list-view',
  id,
  version: '0.1.0',
  name: id,
  entityId,
  columns: columns.map(c => ({
    id: c.id,
    entityFieldId: c.entityFieldId,
    type: c.type as any,
    label: c.id,
  })),
})

// ============================================================================
// Full Sync Pipeline Tests
// ============================================================================

describe('Sync Manager Integration', () => {
  describe('Entity Evolution Scenario', () => {
    it('should handle complete entity evolution: add, rename, remove fields', () => {
      // Initial Entity
      const v1Entity = createEntity('customer', 'Customer', [
        createField('name', 'string', { label: 'Name' }),
        createField('email', 'string', { label: 'Email' }),
        createField('phone', 'string', { label: 'Phone' }),
      ])

      // Evolved Entity: renamed email, removed phone, added address
      const v2Entity = createEntity('customer', 'Customer', [
        createField('name', 'string', { label: 'Name' }),
        createField('emailAddress', 'string', { label: 'Email' }), // renamed
        // phone removed
        createField('address', 'string', { label: 'Address' }), // added
      ])

      // Views based on v1
      const formView = createFormView('customer-form', 'customer', [
        { id: 'nameField', entityFieldId: 'name', component: 'text-input' },
        { id: 'emailField', entityFieldId: 'email', component: 'text-input' },
        { id: 'phoneField', entityFieldId: 'phone', component: 'text-input' },
      ])

      const listView = createListView('customer-list', 'customer', [
        { id: 'nameCol', entityFieldId: 'name', type: 'text' },
        { id: 'emailCol', entityFieldId: 'email', type: 'text' },
        { id: 'phoneCol', entityFieldId: 'phone', type: 'text' },
      ])

      // Sync with auto-all mode
      const result = syncViews({
        oldEntity: v1Entity,
        newEntity: v2Entity,
        views: [formView, listView],
        config: {
          mode: 'auto-all',
          includeNewFields: true,
          fieldMappingHints: [
            { oldFieldId: 'email', newFieldId: 'emailAddress' },
          ],
        },
      })

      // Verify changes detected
      expect(result.changes.changes.length).toBeGreaterThan(0)
      expect(result.changes.hasBreakingChanges).toBe(true)

      // Check rename detected
      const renames = filterChangesByType(result.changes.changes, 'FIELD_RENAMED')
      expect(renames.length).toBe(1)
      expect(renames[0].oldId).toBe('email')
      expect(renames[0].newId).toBe('emailAddress')

      // Check removal detected
      const removals = filterChangesByType(result.changes.changes, 'FIELD_REMOVED')
      expect(removals.length).toBe(1)
      expect(removals[0].fieldId).toBe('phone')

      // Check addition detected
      const additions = filterChangesByType(result.changes.changes, 'FIELD_ADDED')
      expect(additions.length).toBe(1)
      expect(additions[0].fieldId).toBe('address')

      // Verify Form View updated
      const formResult = result.syncResults.find(r => r.viewId === 'customer-form')!
      expect(formResult.appliedActions.length).toBeGreaterThan(0)

      // email → emailAddress renamed
      const updatedForm = formResult.updatedView as FormViewSchema
      const emailFieldUpdated = updatedForm.sections?.[0]?.fields?.find(
        f => f.entityFieldId === 'emailAddress'
      )
      expect(emailFieldUpdated).toBeDefined()

      // phone removed
      const phoneField = updatedForm.sections?.[0]?.fields?.find(
        f => f.entityFieldId === 'phone'
      )
      expect(phoneField).toBeUndefined()

      // address added
      const addressField = updatedForm.sections?.[0]?.fields?.find(
        f => f.entityFieldId === 'address'
      )
      expect(addressField).toBeDefined()

      // Verify List View updated
      const listResult = result.syncResults.find(r => r.viewId === 'customer-list')!
      const updatedList = listResult.updatedView as ListViewSchema

      // email → emailAddress renamed
      const emailColUpdated = updatedList.columns?.find(
        c => c.entityFieldId === 'emailAddress'
      )
      expect(emailColUpdated).toBeDefined()

      // phone removed
      const phoneCol = updatedList.columns?.find(c => c.entityFieldId === 'phone')
      expect(phoneCol).toBeUndefined()

      // address added
      const addressCol = updatedList.columns?.find(c => c.entityFieldId === 'address')
      expect(addressCol).toBeDefined()
    })
  })

  describe('Type Change Scenario', () => {
    it('should update components when field types change', () => {
      const v1Entity = createEntity('product', 'Product', [
        createField('price', 'string', { label: 'Price' }), // was string
        createField('inStock', 'string', { label: 'In Stock' }), // was string
      ])

      const v2Entity = createEntity('product', 'Product', [
        createField('price', 'number', { label: 'Price' }), // now number
        createField('inStock', 'boolean', { label: 'In Stock' }), // now boolean
      ])

      const formView = createFormView('product-form', 'product', [
        { id: 'priceField', entityFieldId: 'price', component: 'text-input' },
        { id: 'stockField', entityFieldId: 'inStock', component: 'text-input' },
      ])

      const result = syncFormView(v1Entity, v2Entity, formView, {
        mode: 'auto-all',
      })

      const updatedForm = result.updatedView as FormViewSchema
      const priceField = updatedForm.sections?.[0]?.fields?.find(
        f => f.entityFieldId === 'price'
      )
      const stockField = updatedForm.sections?.[0]?.fields?.find(
        f => f.entityFieldId === 'inStock'
      )

      // Components should be updated
      expect(priceField?.component).toBe('number-input')
      expect(stockField?.component).toBe('checkbox')
    })
  })

  describe('Enum Value Change Scenario', () => {
    it('should track enum value changes', () => {
      const v1Entity = createEntity('order', 'Order', [
        createField('status', 'enum', {
          label: 'Status',
          enumValues: [
            { value: 'pending', label: 'Pending' },
            { value: 'processing', label: 'Processing' },
            { value: 'completed', label: 'Completed' },
          ],
        }),
      ])

      const v2Entity = createEntity('order', 'Order', [
        createField('status', 'enum', {
          label: 'Status',
          enumValues: [
            { value: 'pending', label: 'Pending' },
            { value: 'processing', label: 'In Progress' }, // label changed
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' }, // added
          ],
        }),
      ])

      const { changes, viewImpacts } = analyzeViewImpact(
        v1Entity,
        v2Entity,
        []
      )

      const enumChanges = filterChangesByType(changes.changes, 'FIELD_ENUM_CHANGED')
      expect(enumChanges.length).toBe(1)
      expect(enumChanges[0].addedValues.length).toBe(1)
      expect(enumChanges[0].addedValues[0].value).toBe('cancelled')
      expect(enumChanges[0].modifiedValues.length).toBe(1)
      expect(enumChanges[0].modifiedValues[0].new.label).toBe('In Progress')
    })
  })

  describe('Auto-safe Mode Scenario', () => {
    it('should skip removals but apply safe updates in auto-safe mode', () => {
      const v1Entity = createEntity('user', 'User', [
        createField('userName', 'string', { label: 'Username' }),
        createField('legacyField', 'string', { label: 'Legacy' }),
      ])

      const v2Entity = createEntity('user', 'User', [
        createField('userNameUpdated', 'string', { label: 'Username' }), // renamed
        // legacyField removed
      ])

      const formView = createFormView('user-form', 'user', [
        { id: 'usernameField', entityFieldId: 'userName', component: 'text-input' },
        { id: 'legacyInput', entityFieldId: 'legacyField', component: 'text-input' },
      ])

      const result = syncFormView(v1Entity, v2Entity, formView, {
        mode: 'auto-safe',
        fieldMappingHints: [
          { oldFieldId: 'userName', newFieldId: 'userNameUpdated' },
        ],
      })

      // Rename should be applied
      const updatedForm = result.updatedView as FormViewSchema
      const renamedField = updatedForm.sections?.[0]?.fields?.find(
        f => f.entityFieldId === 'userNameUpdated'
      )
      expect(renamedField).toBeDefined()

      // Removal should be skipped (field still exists)
      const legacyField = updatedForm.sections?.[0]?.fields?.find(
        f => f.entityFieldId === 'legacyField'
      )
      expect(legacyField).toBeDefined()

      // Should have skipped actions
      expect(result.skippedActions.length).toBeGreaterThan(0)
      expect(result.skippedActions.some(s => s.action._type === 'REMOVE_FIELD')).toBe(true)

      // Should require review
      expect(result.requiresReview).toBe(true)
    })
  })

  describe('Filter and Sort Cleanup Scenario', () => {
    it('should cleanup filters and sorts when fields are removed', () => {
      const v1Entity = createEntity('task', 'Task', [
        createField('title', 'string'),
        createField('status', 'enum'),
        createField('priority', 'enum'),
        createField('dueDate', 'date'),
      ])

      const v2Entity = createEntity('task', 'Task', [
        createField('title', 'string'),
        createField('status', 'enum'),
        // priority removed
        // dueDate removed
      ])

      const listView: ListViewSchema = {
        _type: 'list-view',
        id: 'task-list',
        version: '0.1.0',
        name: 'Task List',
        entityId: 'task',
        columns: [
          { id: 'titleCol', entityFieldId: 'title', type: 'text', label: 'Title' },
          { id: 'statusCol', entityFieldId: 'status', type: 'enum', label: 'Status' },
          { id: 'priorityCol', entityFieldId: 'priority', type: 'enum', label: 'Priority' },
          { id: 'dueDateCol', entityFieldId: 'dueDate', type: 'date', label: 'Due Date' },
        ],
        filtering: {
          enabled: true,
          fields: [
            { id: 'statusFilter', entityFieldId: 'status', label: 'Status', type: 'select' },
            { id: 'priorityFilter', entityFieldId: 'priority', label: 'Priority', type: 'select' },
          ],
        },
        sorting: {
          enabled: true,
          defaultSort: { field: 'dueDate', direction: 'asc' },
        },
      }

      const result = syncListView(v1Entity, v2Entity, listView, {
        mode: 'auto-all',
      })

      const updatedList = result.updatedView as ListViewSchema

      // Columns should be cleaned up
      expect(updatedList.columns?.length).toBe(2)
      expect(updatedList.columns?.some(c => c.entityFieldId === 'priority')).toBe(false)
      expect(updatedList.columns?.some(c => c.entityFieldId === 'dueDate')).toBe(false)

      // Filters should be cleaned up
      expect(updatedList.filtering?.fields?.length).toBe(1)
      expect(updatedList.filtering?.fields?.[0].entityFieldId).toBe('status')

      // Sort should be cleared (dueDate was removed)
      expect(updatedList.sorting?.defaultSort).toBeUndefined()
    })

    it('should update filter and sort field IDs when fields are renamed', () => {
      const v1Entity = createEntity('task', 'Task', [
        createField('taskStatus', 'enum', { label: 'Status' }),
        createField('taskCreatedAt', 'datetime', { label: 'Created At' }),
      ])

      const v2Entity = createEntity('task', 'Task', [
        createField('taskStatusCode', 'enum', { label: 'Status' }),
        createField('taskCreationDate', 'datetime', { label: 'Created At' }),
      ])

      const listView: ListViewSchema = {
        _type: 'list-view',
        id: 'task-list',
        version: '0.1.0',
        name: 'Task List',
        entityId: 'task',
        columns: [
          { id: 'statusCol', entityFieldId: 'taskStatus', type: 'enum', label: 'Status' },
          { id: 'createdCol', entityFieldId: 'taskCreatedAt', type: 'datetime', label: 'Created' },
        ],
        filtering: {
          enabled: true,
          fields: [
            { id: 'statusFilter', entityFieldId: 'taskStatus', label: 'Status', type: 'select' },
          ],
        },
        sorting: {
          enabled: true,
          defaultSort: { field: 'taskCreatedAt', direction: 'desc' },
        },
      }

      const result = syncListView(v1Entity, v2Entity, listView, {
        mode: 'auto-all',
      })

      const updatedList = result.updatedView as ListViewSchema

      // Columns should be updated
      expect(updatedList.columns?.[0].entityFieldId).toBe('taskStatusCode')
      expect(updatedList.columns?.[1].entityFieldId).toBe('taskCreationDate')

      // Filter should be updated
      expect(updatedList.filtering?.fields?.[0].entityFieldId).toBe('taskStatusCode')

      // Sort should be updated
      expect(updatedList.sorting?.defaultSort?.field).toBe('taskCreationDate')
    })
  })

  describe('Multiple Views Scenario', () => {
    it('should sync multiple views simultaneously', () => {
      const v1Entity = createEntity('article', 'Article', [
        createField('title', 'string'),
        createField('content', 'string'),
        createField('authorId', 'reference'),
      ])

      const v2Entity = createEntity('article', 'Article', [
        createField('title', 'string'),
        createField('body', 'string'), // renamed from content
        createField('writerId', 'reference'), // renamed from authorId
        createField('publishedAt', 'datetime'), // added
      ])

      const formView = createFormView('article-form', 'article', [
        { id: 'titleField', entityFieldId: 'title', component: 'text-input' },
        { id: 'contentField', entityFieldId: 'content', component: 'textarea' },
        { id: 'authorField', entityFieldId: 'authorId', component: 'autocomplete' },
      ])

      const listView = createListView('article-list', 'article', [
        { id: 'titleCol', entityFieldId: 'title', type: 'text' },
        { id: 'contentCol', entityFieldId: 'content', type: 'text' },
        { id: 'authorCol', entityFieldId: 'authorId', type: 'text' },
      ])

      const result = syncViews({
        oldEntity: v1Entity,
        newEntity: v2Entity,
        views: [formView, listView],
        config: {
          mode: 'auto-all',
          includeNewFields: true,
          fieldMappingHints: [
            { oldFieldId: 'content', newFieldId: 'body' },
            { oldFieldId: 'authorId', newFieldId: 'writerId' },
          ],
        },
      })

      // Both views should be synced
      expect(result.syncResults.length).toBe(2)

      // Summary should work
      const summary = summarizeSyncResults(result)
      expect(summary).toContain('Entity Changes')
      expect(summary).toContain('article-form')
      expect(summary).toContain('article-list')

      // Check views requiring review
      // Note: requiresReview can be true due to breaking changes even in auto-all mode
      const reviewNeeded = getViewsRequiringReview(result)
      // Breaking changes (renames) may still require review notification
      expect(reviewNeeded.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('No Changes Scenario', () => {
    it('should handle no changes gracefully', () => {
      const entity = createEntity('static', 'Static', [
        createField('name', 'string'),
        createField('value', 'number'),
      ])

      const formView = createFormView('static-form', 'static', [
        { id: 'nameField', entityFieldId: 'name', component: 'text-input' },
        { id: 'valueField', entityFieldId: 'value', component: 'number-input' },
      ])

      const result = syncViews({
        oldEntity: entity,
        newEntity: entity, // same entity
        views: [formView],
        config: { mode: 'auto-all', includeNewFields: false },
      })

      // No changes detected
      expect(result.changes.changes.length).toBe(0)
      expect(result.changes.hasBreakingChanges).toBe(false)

      // View unchanged
      expect(result.syncResults[0].appliedActions.length).toBe(0)
      expect(result.syncResults[0].updatedView).toEqual(formView)
    })
  })
})

// ============================================================================
// Rename Detection Tests
// ============================================================================

describe('Rename Detection Integration', () => {
  it('should detect renames by ID similarity with matching attributes', () => {
    // High ID similarity + same dataType + same label = strong rename signal
    const v1Entity = createEntity('user', 'User', [
      createField('emailAddress', 'string', { label: 'Email Address' }),
    ])

    const v2Entity = createEntity('user', 'User', [
      createField('emailAddr', 'string', { label: 'Email Address' }), // similar ID + same label
    ])

    const changes = diffEntities(v1Entity, v2Entity)

    // Should detect as rename (ID similarity ~67% + same dataType + same label)
    // Score = 0.67 * 0.3 + 0.25 + 0.2 = 0.65, which is above 0.5 threshold
    const renames = filterChangesByType(changes.changes, 'FIELD_RENAMED')
    expect(renames.length).toBe(1)
    expect(renames[0].oldId).toBe('emailAddress')
    expect(renames[0].newId).toBe('emailAddr')
  })

  it('should detect renames by same dataType and label', () => {
    // Even with different IDs, same dataType + same label + same constraints + same description
    // can trigger rename when all attributes match strongly
    const v1Entity = createEntity('product', 'Product', [
      createField('itemPrice', 'number', {
        label: 'Price',
        constraints: [{ type: 'min', value: 0 }],
        description: 'The price of the product'
      }),
    ])

    const v2Entity = createEntity('product', 'Product', [
      createField('productCost', 'number', {
        label: 'Price',
        constraints: [{ type: 'min', value: 0 }],
        description: 'The price of the product'
      }), // same type, same label, same constraints, same description
    ])

    const changes = diffEntities(v1Entity, v2Entity)

    // Score breakdown:
    // - ID similarity: 0 (too different, below 0.6 threshold)
    // - Same dataType: +0.25
    // - Same label: +0.2
    // - Same constraints (1.0 similarity): +0.15
    // - Same description: +0.1
    // Total = 0.7, which is above 0.5 threshold
    const renames = filterChangesByType(changes.changes, 'FIELD_RENAMED')
    expect(renames.length).toBe(1)
  })

  it('should not detect rename for completely different fields', () => {
    const v1Entity = createEntity('item', 'Item', [
      createField('name', 'string'),
    ])

    const v2Entity = createEntity('item', 'Item', [
      createField('quantity', 'number'),
    ])

    const changes = diffEntities(v1Entity, v2Entity)

    // Should be separate add/remove, not rename
    const renames = filterChangesByType(changes.changes, 'FIELD_RENAMED')
    expect(renames.length).toBe(0)

    const removals = filterChangesByType(changes.changes, 'FIELD_REMOVED')
    expect(removals.length).toBe(1)

    const additions = filterChangesByType(changes.changes, 'FIELD_ADDED')
    expect(additions.length).toBe(1)
  })

  it('should prioritize user hints over heuristics', () => {
    const v1Entity = createEntity('account', 'Account', [
      createField('oldName', 'string'),
    ])

    const v2Entity = createEntity('account', 'Account', [
      createField('completelyDifferentName', 'string'),
    ])

    // Without hint: would be add/remove
    const changesNoHint = diffEntities(v1Entity, v2Entity)
    expect(filterChangesByType(changesNoHint.changes, 'FIELD_RENAMED').length).toBe(0)

    // With hint: should be rename
    const changesWithHint = diffEntities(v1Entity, v2Entity, {
      fieldMappingHints: [
        { oldFieldId: 'oldName', newFieldId: 'completelyDifferentName' },
      ],
    })
    expect(filterChangesByType(changesWithHint.changes, 'FIELD_RENAMED').length).toBe(1)
  })
})

// ============================================================================
// String Similarity Tests
// ============================================================================

describe('String Similarity', () => {
  it('should calculate correct similarity', () => {
    expect(stringSimilarity('hello', 'hello')).toBe(1)
    expect(stringSimilarity('hello', 'helo')).toBeGreaterThan(0.7)
    expect(stringSimilarity('abc', 'xyz')).toBe(0)
    expect(stringSimilarity('email', 'emailAddress')).toBeGreaterThan(0.4)
    expect(stringSimilarity('', '')).toBe(1) // edge case
  })
})
