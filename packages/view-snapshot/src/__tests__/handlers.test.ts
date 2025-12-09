/**
 * Handler Tests
 *
 * 각 도메인별 Intent Handler 테스트
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  FormHandler,
  createFormHandler,
  TableHandler,
  createTableHandler,
  OverlayHandler,
  createOverlayHandler,
  TabsHandler,
  createTabsHandler,
  ActionHandler,
  createActionHandler,
} from '../engine'
import type { HandlerContext } from '../types'

// ============================================================================
// Mock Setup
// ============================================================================

const createMockFormRuntime = () => ({
  dispatch: vi.fn().mockReturnValue({ _tag: 'Ok' }),
  getState: vi.fn(),
  subscribe: vi.fn(),
  initialize: vi.fn(),
})

const createMockListRuntime = () => ({
  dispatch: vi.fn().mockResolvedValue({ _tag: 'Ok' }),
  getState: vi.fn(),
  subscribe: vi.fn(),
  initialize: vi.fn(),
  getSelectedRows: vi.fn(() => []),
})

const createMockNodeRegistry = () => ({
  getFormNode: vi.fn(),
  getListNode: vi.fn(),
  getTabsNode: vi.fn(),
  getAllFormNodes: vi.fn(() => []),
  getAllListNodes: vi.fn(() => []),
  getAllNodeIds: vi.fn(() => []),
  hasNode: vi.fn(),
  getNodeType: vi.fn(),
  registerForm: vi.fn(),
  registerList: vi.fn(),
  unregisterForm: vi.fn(),
  unregisterList: vi.fn(),
  clear: vi.fn(),
})

const createMockOverlayManager = () => ({
  open: vi.fn(),
  openWithTemplate: vi.fn(),
  close: vi.fn(),
  confirm: vi.fn(),
  cancel: vi.fn(),
  dismiss: vi.fn(),
  submit: vi.fn(),
  getStack: vi.fn(() => []),
  isEmpty: vi.fn(() => true),
  size: vi.fn(() => 0),
  getTopOverlay: vi.fn(),
  closeAll: vi.fn(),
  waitForResult: vi.fn(),
})

const createMockContext = (overrides: Partial<HandlerContext> = {}): HandlerContext => ({
  nodeRegistry: createMockNodeRegistry() as any,
  overlayManager: createMockOverlayManager() as any,
  ...overrides,
})

// ============================================================================
// FormHandler Tests
// ============================================================================

describe('FormHandler', () => {
  let handler: FormHandler
  let mockContext: HandlerContext
  let mockFormRuntime: ReturnType<typeof createMockFormRuntime>

  beforeEach(() => {
    handler = createFormHandler() as FormHandler
    mockFormRuntime = createMockFormRuntime()
    mockContext = createMockContext()
  })

  it('should have correct target intent types', () => {
    expect(handler.targets).toEqual(['setFieldValue', 'submit', 'reset'])
  })

  describe('setFieldValue', () => {
    it('should dispatch FIELD_CHANGE event to runtime', async () => {
      ;(mockContext.nodeRegistry.getFormNode as any).mockReturnValue({
        nodeId: 'form-1',
        runtime: mockFormRuntime,
        schema: {},
      })

      const result = await handler.execute(
        { type: 'setFieldValue', nodeId: 'form-1', fieldId: 'email', value: 'test@example.com' },
        mockContext
      )

      expect(mockFormRuntime.dispatch).toHaveBeenCalledWith({
        type: 'FIELD_CHANGE',
        fieldId: 'email',
        value: 'test@example.com',
      })
      expect(result.success).toBe(true)
    })

    it('should return error when form node not found', async () => {
      ;(mockContext.nodeRegistry.getFormNode as any).mockReturnValue(undefined)

      const result = await handler.execute(
        { type: 'setFieldValue', nodeId: 'missing', fieldId: 'email', value: 'test' },
        mockContext
      )

      expect(result.success).toBe(false)
      expect(result.errorType).toBe('NODE_NOT_FOUND')
    })

    it('should handle runtime dispatch error', async () => {
      mockFormRuntime.dispatch.mockReturnValue({
        _tag: 'Err',
        error: { type: 'VALIDATION_ERROR', errors: { email: ['Invalid email format'] } },
      })
      ;(mockContext.nodeRegistry.getFormNode as any).mockReturnValue({
        nodeId: 'form-1',
        runtime: mockFormRuntime,
        schema: {},
      })

      const result = await handler.execute(
        { type: 'setFieldValue', nodeId: 'form-1', fieldId: 'email', value: 'invalid' },
        mockContext
      )

      expect(result.success).toBe(false)
      expect(result.errorType).toBe('RUNTIME_ERROR')
      expect(result.message).toContain('email')
    })
  })

  describe('submit', () => {
    it('should dispatch SUBMIT event to runtime', async () => {
      ;(mockContext.nodeRegistry.getFormNode as any).mockReturnValue({
        nodeId: 'form-1',
        runtime: mockFormRuntime,
        schema: {},
      })

      const result = await handler.execute(
        { type: 'submit', nodeId: 'form-1' },
        mockContext
      )

      expect(mockFormRuntime.dispatch).toHaveBeenCalledWith({ type: 'SUBMIT' })
      expect(result.success).toBe(true)
    })

    it('should handle validation error on submit', async () => {
      mockFormRuntime.dispatch.mockReturnValue({
        _tag: 'Err',
        error: {
          type: 'VALIDATION_ERROR',
          errors: { name: ['Required'], email: ['Invalid'] },
        },
      })
      ;(mockContext.nodeRegistry.getFormNode as any).mockReturnValue({
        nodeId: 'form-1',
        runtime: mockFormRuntime,
        schema: {},
      })

      const result = await handler.execute(
        { type: 'submit', nodeId: 'form-1' },
        mockContext
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('name')
      expect(result.message).toContain('email')
    })
  })

  describe('reset', () => {
    it('should dispatch RESET event to runtime', async () => {
      ;(mockContext.nodeRegistry.getFormNode as any).mockReturnValue({
        nodeId: 'form-1',
        runtime: mockFormRuntime,
        schema: {},
      })

      const result = await handler.execute(
        { type: 'reset', nodeId: 'form-1' },
        mockContext
      )

      expect(mockFormRuntime.dispatch).toHaveBeenCalledWith({ type: 'RESET' })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================================================
// TableHandler Tests
// ============================================================================

describe('TableHandler', () => {
  let handler: TableHandler
  let mockContext: HandlerContext
  let mockListRuntime: ReturnType<typeof createMockListRuntime>

  beforeEach(() => {
    handler = createTableHandler() as TableHandler
    mockListRuntime = createMockListRuntime()
    mockContext = createMockContext()
  })

  it('should have correct target intent types', () => {
    expect(handler.targets).toEqual(['selectRow', 'selectAll', 'deselectAll', 'changePage', 'sortColumn'])
  })

  describe('selectRow', () => {
    it('should dispatch SELECT_ROW event', async () => {
      ;(mockContext.nodeRegistry.getListNode as any).mockReturnValue({
        nodeId: 'list-1',
        runtime: mockListRuntime,
        schema: {},
      })

      const result = await handler.execute(
        { type: 'selectRow', nodeId: 'list-1', rowId: 'row-123', append: true },
        mockContext
      )

      expect(mockListRuntime.dispatch).toHaveBeenCalledWith({
        type: 'SELECT_ROW',
        rowId: 'row-123',
      })
      expect(result.success).toBe(true)
    })

    it('should deselect all before selecting when append is false', async () => {
      ;(mockContext.nodeRegistry.getListNode as any).mockReturnValue({
        nodeId: 'list-1',
        runtime: mockListRuntime,
        schema: {},
      })

      await handler.execute(
        { type: 'selectRow', nodeId: 'list-1', rowId: 'row-123', append: false },
        mockContext
      )

      expect(mockListRuntime.dispatch).toHaveBeenNthCalledWith(1, { type: 'DESELECT_ALL' })
      expect(mockListRuntime.dispatch).toHaveBeenNthCalledWith(2, {
        type: 'SELECT_ROW',
        rowId: 'row-123',
      })
    })

    it('should return error when list node not found', async () => {
      ;(mockContext.nodeRegistry.getListNode as any).mockReturnValue(undefined)

      const result = await handler.execute(
        { type: 'selectRow', nodeId: 'missing', rowId: 'row-1' },
        mockContext
      )

      expect(result.success).toBe(false)
      expect(result.errorType).toBe('NODE_NOT_FOUND')
    })
  })

  describe('selectAll', () => {
    it('should dispatch SELECT_ALL event', async () => {
      ;(mockContext.nodeRegistry.getListNode as any).mockReturnValue({
        nodeId: 'list-1',
        runtime: mockListRuntime,
        schema: {},
      })

      const result = await handler.execute(
        { type: 'selectAll', nodeId: 'list-1' },
        mockContext
      )

      expect(mockListRuntime.dispatch).toHaveBeenCalledWith({ type: 'SELECT_ALL' })
      expect(result.success).toBe(true)
    })
  })

  describe('deselectAll', () => {
    it('should dispatch DESELECT_ALL event', async () => {
      ;(mockContext.nodeRegistry.getListNode as any).mockReturnValue({
        nodeId: 'list-1',
        runtime: mockListRuntime,
        schema: {},
      })

      const result = await handler.execute(
        { type: 'deselectAll', nodeId: 'list-1' },
        mockContext
      )

      expect(mockListRuntime.dispatch).toHaveBeenCalledWith({ type: 'DESELECT_ALL' })
      expect(result.success).toBe(true)
    })
  })

  describe('changePage', () => {
    it('should dispatch PAGE_CHANGE event', async () => {
      ;(mockContext.nodeRegistry.getListNode as any).mockReturnValue({
        nodeId: 'list-1',
        runtime: mockListRuntime,
        schema: {},
      })

      const result = await handler.execute(
        { type: 'changePage', nodeId: 'list-1', page: 3 },
        mockContext
      )

      expect(mockListRuntime.dispatch).toHaveBeenCalledWith({
        type: 'PAGE_CHANGE',
        page: 3,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('sortColumn', () => {
    it('should dispatch SORT_CHANGE event with explicit direction', async () => {
      ;(mockContext.nodeRegistry.getListNode as any).mockReturnValue({
        nodeId: 'list-1',
        runtime: mockListRuntime,
        schema: {},
      })

      const result = await handler.execute(
        { type: 'sortColumn', nodeId: 'list-1', columnId: 'name', direction: 'desc' },
        mockContext
      )

      expect(mockListRuntime.dispatch).toHaveBeenCalledWith({
        type: 'SORT_CHANGE',
        field: 'name',
        direction: 'desc',
      })
      expect(result.success).toBe(true)
    })

    it('should dispatch SORT_TOGGLE event without direction', async () => {
      ;(mockContext.nodeRegistry.getListNode as any).mockReturnValue({
        nodeId: 'list-1',
        runtime: mockListRuntime,
        schema: {},
      })

      const result = await handler.execute(
        { type: 'sortColumn', nodeId: 'list-1', columnId: 'name' },
        mockContext
      )

      expect(mockListRuntime.dispatch).toHaveBeenCalledWith({
        type: 'SORT_TOGGLE',
        field: 'name',
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================================================
// OverlayHandler Tests
// ============================================================================

describe('OverlayHandler', () => {
  let handler: OverlayHandler
  let mockContext: HandlerContext

  beforeEach(() => {
    handler = createOverlayHandler() as OverlayHandler
    mockContext = createMockContext()
  })

  it('should have correct target intent types', () => {
    expect(handler.targets).toEqual([
      'openOverlay',
      'submitOverlay',
      'closeOverlay',
      'confirmDialog',
      'dismissToast',
    ])
  })

  describe('openOverlay', () => {
    it('should open overlay with template', async () => {
      const mockInstance = { instanceId: 'overlay-1' }
      ;(mockContext.overlayManager.openWithTemplate as any).mockReturnValue(mockInstance)

      const result = await handler.execute(
        { type: 'openOverlay', template: 'confirm', boundData: { message: 'Test' } },
        mockContext
      )

      expect(mockContext.overlayManager.openWithTemplate).toHaveBeenCalledWith(
        'confirm',
        expect.objectContaining({ boundData: { message: 'Test' } })
      )
      expect(result.success).toBe(true)
    })

    it('should return error when template not found', async () => {
      ;(mockContext.overlayManager.openWithTemplate as any).mockReturnValue(undefined)

      const result = await handler.execute(
        { type: 'openOverlay', template: 'missing' },
        mockContext
      )

      expect(result.success).toBe(false)
      expect(result.errorType).toBe('TEMPLATE_NOT_FOUND')
    })

    it('should bind selected rows from data source node', async () => {
      const selectedRows = [{ id: '1' }, { id: '2' }]
      ;(mockContext.nodeRegistry.getListNode as any).mockReturnValue({
        nodeId: 'list-1',
        runtime: { getSelectedRows: () => selectedRows },
        schema: {},
      })
      ;(mockContext.overlayManager.openWithTemplate as any).mockReturnValue({ instanceId: 'overlay-1' })

      await handler.execute(
        { type: 'openOverlay', template: 'confirm', dataSourceNodeId: 'list-1' },
        mockContext
      )

      expect(mockContext.overlayManager.openWithTemplate).toHaveBeenCalledWith(
        'confirm',
        expect.objectContaining({
          boundData: expect.objectContaining({
            selectedRows,
            selectedRow: { id: '1' },
            count: 2,
          }),
        })
      )
    })
  })

  describe('closeOverlay', () => {
    it('should close overlay', async () => {
      ;(mockContext.overlayManager.close as any).mockReturnValue(true)

      const result = await handler.execute(
        { type: 'closeOverlay', instanceId: 'overlay-1' },
        mockContext
      )

      expect(mockContext.overlayManager.close).toHaveBeenCalledWith('overlay-1')
      expect(result.success).toBe(true)
    })

    it('should return error when overlay not found', async () => {
      ;(mockContext.overlayManager.close as any).mockReturnValue(false)

      const result = await handler.execute(
        { type: 'closeOverlay', instanceId: 'missing' },
        mockContext
      )

      expect(result.success).toBe(false)
      expect(result.errorType).toBe('OVERLAY_NOT_FOUND')
    })
  })

  describe('confirmDialog', () => {
    it('should confirm dialog', async () => {
      ;(mockContext.overlayManager.confirm as any).mockReturnValue(true)

      const result = await handler.execute(
        { type: 'confirmDialog', instanceId: 'dialog-1' },
        mockContext
      )

      expect(mockContext.overlayManager.confirm).toHaveBeenCalledWith('dialog-1')
      expect(result.success).toBe(true)
    })
  })

  describe('dismissToast', () => {
    it('should dismiss toast', async () => {
      ;(mockContext.overlayManager.dismiss as any).mockReturnValue(true)

      const result = await handler.execute(
        { type: 'dismissToast', instanceId: 'toast-1' },
        mockContext
      )

      expect(mockContext.overlayManager.dismiss).toHaveBeenCalledWith('toast-1')
      expect(result.success).toBe(true)
    })
  })
})

// ============================================================================
// TabsHandler Tests
// ============================================================================

describe('TabsHandler', () => {
  let handler: TabsHandler
  let mockContext: HandlerContext
  let onTabChange: ReturnType<typeof vi.fn>

  beforeEach(() => {
    handler = createTabsHandler() as TabsHandler
    onTabChange = vi.fn()
    mockContext = createMockContext({ onTabChange })
  })

  it('should have correct target intent types', () => {
    expect(handler.targets).toEqual(['switchTab'])
  })

  describe('switchTab', () => {
    it('should call onTabChange callback', async () => {
      const result = await handler.execute(
        { type: 'switchTab', nodeId: 'tabs-1', tabId: 'tab-2' },
        mockContext
      )

      expect(onTabChange).toHaveBeenCalledWith('tabs-1', 'tab-2')
      expect(result.success).toBe(true)
    })

    it('should return error when onTabChange not configured', async () => {
      mockContext = createMockContext({ onTabChange: undefined })

      const result = await handler.execute(
        { type: 'switchTab', nodeId: 'tabs-1', tabId: 'tab-2' },
        mockContext
      )

      expect(result.success).toBe(false)
      expect(result.errorType).toBe('INVALID_OPERATION')
      expect(result.message).toContain('not configured')
    })
  })
})

// ============================================================================
// ActionHandler Tests
// ============================================================================

describe('ActionHandler', () => {
  let handler: ActionHandler
  let mockContext: HandlerContext
  let onActionTrigger: ReturnType<typeof vi.fn>

  beforeEach(() => {
    handler = createActionHandler() as ActionHandler
    onActionTrigger = vi.fn().mockResolvedValue(undefined)
    mockContext = createMockContext({ onActionTrigger })
  })

  it('should have correct target intent types', () => {
    expect(handler.targets).toEqual(['triggerAction'])
  })

  describe('triggerAction', () => {
    it('should call onActionTrigger callback', async () => {
      const result = await handler.execute(
        { type: 'triggerAction', nodeId: 'btn-1', actionType: 'delete' },
        mockContext
      )

      expect(onActionTrigger).toHaveBeenCalledWith('btn-1', 'delete')
      expect(result.success).toBe(true)
    })

    it('should return error when onActionTrigger not configured', async () => {
      mockContext = createMockContext({ onActionTrigger: undefined })

      const result = await handler.execute(
        { type: 'triggerAction', nodeId: 'btn-1', actionType: 'delete' },
        mockContext
      )

      expect(result.success).toBe(false)
      expect(result.errorType).toBe('INVALID_OPERATION')
    })

    it('should handle action trigger failure', async () => {
      onActionTrigger.mockRejectedValue(new Error('Action failed'))
      mockContext = createMockContext({ onActionTrigger })

      const result = await handler.execute(
        { type: 'triggerAction', nodeId: 'btn-1', actionType: 'delete' },
        mockContext
      )

      expect(result.success).toBe(false)
      expect(result.errorType).toBe('RUNTIME_ERROR')
      expect(result.message).toBe('Action failed')
    })
  })
})
