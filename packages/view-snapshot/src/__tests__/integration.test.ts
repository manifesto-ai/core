/**
 * Integration Tests
 *
 * ViewSnapshotEngine 통합 테스트 - 전체 파이프라인 검증
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FormRuntime, ListRuntime } from '@manifesto-ai/engine'
import type { FormViewSchema, ListViewSchema } from '@manifesto-ai/schema'
import {
  ViewSnapshotEngine,
  createViewSnapshotEngine,
  createLoggerMiddleware,
  createGuardrailMiddleware,
} from '../engine'
import type { PageSnapshot, ViewIntent } from '../types'

// ============================================================================
// Test Schemas
// ============================================================================

const createTestFormSchema = (): FormViewSchema => ({
  id: 'test-form',
  mode: 'create',
  sections: [
    {
      id: 'main',
      fields: [
        { id: 'name', type: 'text', entityFieldId: 'name' },
        { id: 'email', type: 'email', entityFieldId: 'email' },
      ],
    },
  ],
})

const createTestListSchema = (): ListViewSchema => ({
  id: 'test-list',
  mode: 'list',
  columns: [
    { id: 'name', entityFieldId: 'name', label: 'Name' },
    { id: 'email', entityFieldId: 'email', label: 'Email' },
  ],
  selection: { mode: 'multiple' },
  pagination: { pageSize: 10 },
  dataSource: { type: 'static' },
})

// ============================================================================
// ViewSnapshotEngine Integration Tests
// ============================================================================

describe('ViewSnapshotEngine Integration', () => {
  let engine: ViewSnapshotEngine

  beforeEach(() => {
    engine = new ViewSnapshotEngine({
      pageId: 'test-page',
      pageLabel: 'Test Page',
    })
  })

  afterEach(() => {
    engine.dispose()
  })

  describe('Engine Lifecycle', () => {
    it('should create engine with default configuration', () => {
      const snapshot = engine.getViewSnapshot()

      expect(snapshot.kind).toBe('page')
      expect(snapshot.nodeId).toBe('test-page')
      expect(snapshot.label).toBe('Test Page')
      expect(snapshot.children).toEqual([])
    })

    it('should register form runtime and include in snapshot', () => {
      const schema = createTestFormSchema()
      const runtime = new FormRuntime(schema)
      runtime.initialize()

      engine.registerFormRuntime('form-1', runtime, schema)

      const snapshot = engine.getViewSnapshot()
      expect(snapshot.children).toHaveLength(1)
      expect(snapshot.children[0].kind).toBe('form')
      expect(snapshot.children[0].nodeId).toBe('form-1')
    })

    it('should register list runtime and include in snapshot', async () => {
      const schema = createTestListSchema()
      const runtime = new ListRuntime(schema, { fetchHandler: async () => ({ data: [], total: 0 }) })
      await runtime.initialize()

      engine.registerListRuntime('list-1', runtime, schema)

      const snapshot = engine.getViewSnapshot()
      expect(snapshot.children).toHaveLength(1)
      expect(snapshot.children[0].kind).toBe('table')
      expect(snapshot.children[0].nodeId).toBe('list-1')
    })

    it('should unregister runtime and remove from snapshot', () => {
      const schema = createTestFormSchema()
      const runtime = new FormRuntime(schema)
      runtime.initialize()

      engine.registerFormRuntime('form-1', runtime, schema)
      expect(engine.getViewSnapshot().children).toHaveLength(1)

      const result = engine.unregisterRuntime('form-1')
      expect(result).toBe(true)
      expect(engine.getViewSnapshot().children).toHaveLength(0)
    })

    it('should clean up on dispose', () => {
      const schema = createTestFormSchema()
      const runtime = new FormRuntime(schema)
      runtime.initialize()

      engine.registerFormRuntime('form-1', runtime, schema)
      engine.dispose()

      expect(engine.getViewSnapshot().children).toHaveLength(0)
    })
  })

  describe('Intent Dispatch with Handlers', () => {
    it('should dispatch setFieldValue intent through FormHandler', async () => {
      const schema = createTestFormSchema()
      const runtime = new FormRuntime(schema)
      runtime.initialize()

      engine.registerFormRuntime('form-1', runtime, schema)

      const snapshot = await engine.dispatchIntent({
        type: 'setFieldValue',
        nodeId: 'form-1',
        fieldId: 'name',
        value: 'John Doe',
      })

      const formSnapshot = snapshot.children[0]
      expect(formSnapshot.kind).toBe('form')

      const nameField = (formSnapshot as any).fields.find((f: any) => f.id === 'name')
      expect(nameField?.value).toBe('John Doe')
    })

    it('should dispatch submit intent through FormHandler', async () => {
      const schema = createTestFormSchema()
      const runtime = new FormRuntime(schema)
      runtime.initialize()

      engine.registerFormRuntime('form-1', runtime, schema)

      // Set values first
      await engine.dispatchIntent({
        type: 'setFieldValue',
        nodeId: 'form-1',
        fieldId: 'name',
        value: 'Test',
      })

      // Then submit
      const snapshot = await engine.dispatchIntent({
        type: 'submit',
        nodeId: 'form-1',
      })

      expect(snapshot).toBeDefined()
    })

    it('should dispatch multiple intents sequentially', async () => {
      const schema = createTestFormSchema()
      const runtime = new FormRuntime(schema)
      runtime.initialize()

      engine.registerFormRuntime('form-1', runtime, schema)

      const snapshot = await engine.dispatchIntents([
        { type: 'setFieldValue', nodeId: 'form-1', fieldId: 'name', value: 'Jane' },
        { type: 'setFieldValue', nodeId: 'form-1', fieldId: 'email', value: 'jane@test.com' },
      ])

      const formSnapshot = snapshot.children[0] as any
      const nameField = formSnapshot.fields.find((f: any) => f.id === 'name')
      const emailField = formSnapshot.fields.find((f: any) => f.id === 'email')

      expect(nameField?.value).toBe('Jane')
      expect(emailField?.value).toBe('jane@test.com')
    })

    it('should return error for non-existent node', async () => {
      const snapshot = await engine.dispatchIntent({
        type: 'setFieldValue',
        nodeId: 'missing-form',
        fieldId: 'name',
        value: 'Test',
      })

      // Snapshot should still be returned (with empty children)
      expect(snapshot.children).toHaveLength(0)
    })
  })

  describe('Overlay Integration', () => {
    it('should open overlay through intent dispatch', async () => {
      engine.registerTemplate({
        id: 'test-dialog',
        kind: 'dialog',
        title: 'Test Dialog',
      })

      const snapshot = await engine.dispatchIntent({
        type: 'openOverlay',
        template: 'test-dialog',
        boundData: { message: 'Hello' },
      })

      expect(snapshot.overlays).toHaveLength(1)
      expect(snapshot.overlays[0].template).toBe('test-dialog')
      expect(snapshot.overlays[0].boundData).toEqual({ message: 'Hello' })
    })

    it('should close overlay through intent dispatch', async () => {
      engine.registerTemplate({
        id: 'test-dialog',
        kind: 'dialog',
      })

      // Open
      const snapshotAfterOpen = await engine.dispatchIntent({
        type: 'openOverlay',
        template: 'test-dialog',
      })

      const instanceId = snapshotAfterOpen.overlays[0].instanceId

      // Close
      const snapshotAfterClose = await engine.dispatchIntent({
        type: 'closeOverlay',
        instanceId,
      })

      expect(snapshotAfterClose.overlays).toHaveLength(0)
    })
  })

  describe('Subscription', () => {
    it('should notify listeners on intent dispatch', async () => {
      const listener = vi.fn()
      engine.subscribe(listener)

      const schema = createTestFormSchema()
      const runtime = new FormRuntime(schema)
      runtime.initialize()

      engine.registerFormRuntime('form-1', runtime, schema)

      await engine.dispatchIntent({
        type: 'setFieldValue',
        nodeId: 'form-1',
        fieldId: 'name',
        value: 'Test',
      })

      // Called twice: once for registration, once for dispatch
      expect(listener).toHaveBeenCalled()
      expect(listener.mock.calls[listener.mock.calls.length - 1][0]).toMatchObject({
        kind: 'page',
        nodeId: 'test-page',
      })
    })

    it('should unsubscribe correctly', async () => {
      const listener = vi.fn()
      const unsubscribe = engine.subscribe(listener)

      unsubscribe()

      await engine.dispatchIntent({
        type: 'openOverlay',
        template: 'confirm',
      })

      expect(listener).not.toHaveBeenCalled()
    })
  })
})

// ============================================================================
// Custom Middleware Integration Tests
// ============================================================================

describe('Custom Middleware Integration', () => {
  it('should use custom logger middleware', async () => {
    const logs: string[] = []
    const customLogger = (...args: unknown[]) => {
      logs.push(String(args[0]))
    }

    const engine = new ViewSnapshotEngine({
      pageId: 'test-page',
    })

    // Access internal dispatcher to add middleware (for testing)
    const dispatcher = (engine as any).intentDispatcher
    dispatcher.use(createLoggerMiddleware({
      logger: customLogger,
      errorLogger: customLogger,
      prefix: '[Test]',
      measureTime: false,
    }), { priority: 100, name: 'test-logger' })

    const schema = createTestFormSchema()
    const runtime = new FormRuntime(schema)
    runtime.initialize()

    engine.registerFormRuntime('form-1', runtime, schema)

    await engine.dispatchIntent({
      type: 'setFieldValue',
      nodeId: 'form-1',
      fieldId: 'name',
      value: 'Test',
    })

    expect(logs.some(log => log.includes('[Test]'))).toBe(true)
    expect(logs.some(log => log.includes('setFieldValue'))).toBe(true)

    engine.dispose()
  })

  it('should use custom guardrail middleware', async () => {
    const engine = new ViewSnapshotEngine({
      pageId: 'test-page',
    })

    // Custom guard that blocks all intents with 'blocked' in nodeId
    const customGuard = (intent: ViewIntent) => {
      if ('nodeId' in intent && (intent as any).nodeId.includes('blocked')) {
        return {
          success: false,
          errorType: 'CUSTOM_BLOCKED',
          message: 'Node is blocked',
        }
      }
      return null
    }

    const dispatcher = (engine as any).intentDispatcher
    dispatcher.use(createGuardrailMiddleware({
      checkNodeExists: false,
      customGuards: [customGuard],
    }), { priority: 200, name: 'custom-guard' })

    const schema = createTestFormSchema()
    const runtime = new FormRuntime(schema)
    runtime.initialize()

    engine.registerFormRuntime('blocked-form', runtime, schema)

    // This should be blocked by custom guard
    await engine.dispatchIntent({
      type: 'setFieldValue',
      nodeId: 'blocked-form',
      fieldId: 'name',
      value: 'Test',
    })

    // Form value should not have changed (blocked)
    const snapshot = engine.getViewSnapshot()
    const formSnapshot = snapshot.children[0] as any
    const nameField = formSnapshot.fields.find((f: any) => f.id === 'name')
    expect(nameField?.value).not.toBe('Test')

    engine.dispose()
  })
})

// ============================================================================
// End-to-End Flow Tests
// ============================================================================

describe('End-to-End Flows', () => {
  it('should handle complete form submission flow', async () => {
    const engine = new ViewSnapshotEngine({
      pageId: 'user-form-page',
    })

    const schema = createTestFormSchema()
    const runtime = new FormRuntime(schema)
    runtime.initialize()

    engine.registerFormRuntime('user-form', runtime, schema)

    // Step 1: Fill form fields
    await engine.dispatchIntents([
      { type: 'setFieldValue', nodeId: 'user-form', fieldId: 'name', value: 'Alice' },
      { type: 'setFieldValue', nodeId: 'user-form', fieldId: 'email', value: 'alice@test.com' },
    ])

    // Step 2: Verify form state
    let snapshot = engine.getViewSnapshot()
    let formSnapshot = snapshot.children[0] as any
    expect(formSnapshot.fields.find((f: any) => f.id === 'name')?.value).toBe('Alice')
    expect(formSnapshot.fields.find((f: any) => f.id === 'email')?.value).toBe('alice@test.com')

    // Step 3: Submit form
    await engine.dispatchIntent({ type: 'submit', nodeId: 'user-form' })

    // Step 4: Reset form
    await engine.dispatchIntent({ type: 'reset', nodeId: 'user-form' })

    snapshot = engine.getViewSnapshot()
    formSnapshot = snapshot.children[0] as any
    expect(formSnapshot.fields.find((f: any) => f.id === 'name')?.value).toBeUndefined()

    engine.dispose()
  })

  it('should handle dialog confirmation flow', async () => {
    const engine = new ViewSnapshotEngine({
      pageId: 'confirm-page',
    })

    engine.registerTemplate({
      id: 'delete-confirm',
      kind: 'dialog',
      title: 'Delete Confirmation',
    })

    // Step 1: Open dialog
    let snapshot = await engine.dispatchIntent({
      type: 'openOverlay',
      template: 'delete-confirm',
      boundData: { itemName: 'Test Item' },
    })

    expect(snapshot.overlays).toHaveLength(1)
    const instanceId = snapshot.overlays[0].instanceId

    // Step 2: Confirm dialog
    snapshot = await engine.dispatchIntent({
      type: 'confirmDialog',
      instanceId,
    })

    expect(snapshot.overlays).toHaveLength(0)

    engine.dispose()
  })

  it('should handle list selection and action flow', async () => {
    const engine = new ViewSnapshotEngine({
      pageId: 'list-page',
    })

    const testData = [
      { id: '1', name: 'Item 1', email: 'item1@test.com' },
      { id: '2', name: 'Item 2', email: 'item2@test.com' },
      { id: '3', name: 'Item 3', email: 'item3@test.com' },
    ]

    const schema = createTestListSchema()
    const runtime = new ListRuntime(schema, {
      initialData: testData,
    })
    runtime.initialize()

    engine.registerListRuntime('item-list', runtime, schema)

    // Step 1: Select a row
    await engine.dispatchIntent({
      type: 'selectRow',
      nodeId: 'item-list',
      rowId: '1',
      append: false,
    })

    let snapshot = engine.getViewSnapshot()
    let tableSnapshot = snapshot.children[0] as any
    expect(tableSnapshot.selection.selectedRowIds).toContain('1')

    // Step 2: Select all
    await engine.dispatchIntent({
      type: 'selectAll',
      nodeId: 'item-list',
    })

    snapshot = engine.getViewSnapshot()
    tableSnapshot = snapshot.children[0] as any
    expect(tableSnapshot.selection.selectedRowIds).toHaveLength(3)

    // Step 3: Deselect all
    await engine.dispatchIntent({
      type: 'deselectAll',
      nodeId: 'item-list',
    })

    snapshot = engine.getViewSnapshot()
    tableSnapshot = snapshot.children[0] as any
    expect(tableSnapshot.selection.selectedRowIds).toHaveLength(0)

    engine.dispose()
  })
})
