/**
 * IntentDispatcher Tests
 *
 * Strategy Pattern + Middleware Pipeline 테스트
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  IntentDispatcher,
  createIntentDispatcher,
  createLoggerMiddleware,
  createGuardrailMiddleware,
} from '../engine'
import type {
  IntentHandler,
  IntentMiddleware,
  ViewIntent,
  IntentResult,
  HandlerContext,
} from '../types'

// ============================================================================
// Mock Setup
// ============================================================================

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

// ============================================================================
// IntentDispatcher Tests
// ============================================================================

describe('IntentDispatcher', () => {
  let dispatcher: IntentDispatcher
  let mockNodeRegistry: ReturnType<typeof createMockNodeRegistry>
  let mockOverlayManager: ReturnType<typeof createMockOverlayManager>

  beforeEach(() => {
    mockNodeRegistry = createMockNodeRegistry()
    mockOverlayManager = createMockOverlayManager()
    dispatcher = createIntentDispatcher(
      mockNodeRegistry as any,
      mockOverlayManager as any
    )
  })

  describe('Handler Registration', () => {
    it('should register handler for single intent type', async () => {
      const handler: IntentHandler = {
        targets: ['testIntent'],
        execute: vi.fn().mockResolvedValue({ success: true }),
      }

      dispatcher.register(handler)

      const result = await dispatcher.dispatch({
        type: 'testIntent',
        nodeId: 'test-1',
      } as ViewIntent)

      expect(handler.execute).toHaveBeenCalled()
      expect(result.success).toBe(true)
    })

    it('should register handler for multiple intent types', async () => {
      const handler: IntentHandler = {
        targets: ['intentA', 'intentB', 'intentC'],
        execute: vi.fn().mockResolvedValue({ success: true }),
      }

      dispatcher.register(handler)

      await dispatcher.dispatch({ type: 'intentA', nodeId: 'n1' } as ViewIntent)
      await dispatcher.dispatch({ type: 'intentB', nodeId: 'n2' } as ViewIntent)
      await dispatcher.dispatch({ type: 'intentC', nodeId: 'n3' } as ViewIntent)

      expect(handler.execute).toHaveBeenCalledTimes(3)
    })

    it('should return error for unregistered intent type', async () => {
      const result = await dispatcher.dispatch({
        type: 'unknownIntent',
        nodeId: 'test-1',
      } as ViewIntent)

      expect(result.success).toBe(false)
      expect(result.errorType).toBe('INVALID_OPERATION')
      expect(result.message).toContain('No handler registered')
    })

    it('should overwrite handler when registering duplicate', async () => {
      const firstHandler: IntentHandler = {
        targets: ['testIntent'],
        execute: vi.fn().mockResolvedValue({ success: true, data: 'first' }),
      }
      const secondHandler: IntentHandler = {
        targets: ['testIntent'],
        execute: vi.fn().mockResolvedValue({ success: true, data: 'second' }),
      }

      dispatcher.register(firstHandler)
      dispatcher.register(secondHandler)

      await dispatcher.dispatch({ type: 'testIntent', nodeId: 'n1' } as ViewIntent)

      expect(firstHandler.execute).not.toHaveBeenCalled()
      expect(secondHandler.execute).toHaveBeenCalled()
    })
  })

  describe('Handler Execution', () => {
    it('should pass intent and context to handler', async () => {
      const handler: IntentHandler = {
        targets: ['testIntent'],
        execute: vi.fn().mockResolvedValue({ success: true }),
      }

      dispatcher.register(handler)

      const intent = { type: 'testIntent', nodeId: 'test-1', value: 42 } as ViewIntent

      await dispatcher.dispatch(intent)

      expect(handler.execute).toHaveBeenCalledWith(
        intent,
        expect.objectContaining({
          nodeRegistry: mockNodeRegistry,
          overlayManager: mockOverlayManager,
        })
      )
    })

    it('should catch and wrap handler errors', async () => {
      const handler: IntentHandler = {
        targets: ['testIntent'],
        execute: vi.fn().mockRejectedValue(new Error('Handler crashed')),
      }

      dispatcher.register(handler)

      const result = await dispatcher.dispatch({
        type: 'testIntent',
        nodeId: 'test-1',
      } as ViewIntent)

      expect(result.success).toBe(false)
      expect(result.errorType).toBe('RUNTIME_ERROR')
      expect(result.message).toBe('Handler crashed')
    })

    it('should handle non-Error thrown values', async () => {
      const handler: IntentHandler = {
        targets: ['testIntent'],
        execute: vi.fn().mockRejectedValue('string error'),
      }

      dispatcher.register(handler)

      const result = await dispatcher.dispatch({
        type: 'testIntent',
        nodeId: 'test-1',
      } as ViewIntent)

      expect(result.success).toBe(false)
      expect(result.errorType).toBe('RUNTIME_ERROR')
      expect(result.message).toBe('Unknown error')
    })
  })

  describe('Middleware Pipeline', () => {
    it('should execute middleware before handler', async () => {
      const executionOrder: string[] = []

      const middleware: IntentMiddleware = async (intent, context, next) => {
        executionOrder.push('middleware-before')
        const result = await next()
        executionOrder.push('middleware-after')
        return result
      }

      const handler: IntentHandler = {
        targets: ['testIntent'],
        execute: vi.fn().mockImplementation(async () => {
          executionOrder.push('handler')
          return { success: true }
        }),
      }

      dispatcher.use(middleware)
      dispatcher.register(handler)

      await dispatcher.dispatch({ type: 'testIntent', nodeId: 'n1' } as ViewIntent)

      expect(executionOrder).toEqual(['middleware-before', 'handler', 'middleware-after'])
    })

    it('should execute middlewares in priority order', async () => {
      const executionOrder: string[] = []

      const lowPriorityMiddleware: IntentMiddleware = async (intent, context, next) => {
        executionOrder.push('low')
        return next()
      }

      const highPriorityMiddleware: IntentMiddleware = async (intent, context, next) => {
        executionOrder.push('high')
        return next()
      }

      const mediumPriorityMiddleware: IntentMiddleware = async (intent, context, next) => {
        executionOrder.push('medium')
        return next()
      }

      dispatcher.use(lowPriorityMiddleware, { priority: 0, name: 'low' })
      dispatcher.use(highPriorityMiddleware, { priority: 100, name: 'high' })
      dispatcher.use(mediumPriorityMiddleware, { priority: 50, name: 'medium' })

      dispatcher.register({
        targets: ['testIntent'],
        execute: async () => ({ success: true }),
      })

      await dispatcher.dispatch({ type: 'testIntent', nodeId: 'n1' } as ViewIntent)

      expect(executionOrder).toEqual(['high', 'medium', 'low'])
    })

    it('should allow middleware to short-circuit (not call next)', async () => {
      const blockingMiddleware: IntentMiddleware = async () => {
        return {
          success: false,
          errorType: 'BLOCKED',
          message: 'Blocked by middleware',
        }
      }

      const handler: IntentHandler = {
        targets: ['testIntent'],
        execute: vi.fn().mockResolvedValue({ success: true }),
      }

      dispatcher.use(blockingMiddleware)
      dispatcher.register(handler)

      const result = await dispatcher.dispatch({
        type: 'testIntent',
        nodeId: 'n1',
      } as ViewIntent)

      expect(result.success).toBe(false)
      expect(result.errorType).toBe('BLOCKED')
      expect(handler.execute).not.toHaveBeenCalled()
    })

    it('should allow middleware to modify result', async () => {
      const modifyingMiddleware: IntentMiddleware = async (intent, context, next) => {
        const result = await next()
        return {
          ...result,
          modifiedBy: 'middleware',
        } as IntentResult
      }

      dispatcher.use(modifyingMiddleware)
      dispatcher.register({
        targets: ['testIntent'],
        execute: async () => ({ success: true }),
      })

      const result = await dispatcher.dispatch({
        type: 'testIntent',
        nodeId: 'n1',
      } as ViewIntent)

      expect(result.success).toBe(true)
      expect((result as any).modifiedBy).toBe('middleware')
    })

    it('should pass context to middleware', async () => {
      let receivedContext: HandlerContext | null = null

      const middleware: IntentMiddleware = async (intent, context, next) => {
        receivedContext = context
        return next()
      }

      dispatcher.use(middleware)
      dispatcher.register({
        targets: ['testIntent'],
        execute: async () => ({ success: true }),
      })

      await dispatcher.dispatch({ type: 'testIntent', nodeId: 'n1' } as ViewIntent)

      expect(receivedContext).not.toBeNull()
      expect(receivedContext!.nodeRegistry).toBe(mockNodeRegistry)
      expect(receivedContext!.overlayManager).toBe(mockOverlayManager)
    })
  })
})

// ============================================================================
// LoggerMiddleware Tests
// ============================================================================

describe('LoggerMiddleware', () => {
  let dispatcher: IntentDispatcher
  let mockLogger: ReturnType<typeof vi.fn>
  let mockErrorLogger: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockLogger = vi.fn()
    mockErrorLogger = vi.fn()

    dispatcher = createIntentDispatcher(
      createMockNodeRegistry() as any,
      createMockOverlayManager() as any
    )
  })

  it('should log intent dispatch start and completion', async () => {
    const middleware = createLoggerMiddleware({
      logger: mockLogger,
      errorLogger: mockErrorLogger,
      measureTime: false,
    })

    dispatcher.use(middleware)
    dispatcher.register({
      targets: ['testIntent'],
      execute: async () => ({ success: true }),
    })

    await dispatcher.dispatch({ type: 'testIntent', nodeId: 'n1' } as ViewIntent)

    expect(mockLogger).toHaveBeenCalledTimes(2)
    expect(mockLogger).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('Dispatching'),
      expect.any(Object)
    )
    expect(mockLogger).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('Completed'),
      expect.any(Object)
    )
  })

  it('should log errors on failure', async () => {
    const middleware = createLoggerMiddleware({
      logger: mockLogger,
      errorLogger: mockErrorLogger,
      measureTime: false,
    })

    dispatcher.use(middleware)
    dispatcher.register({
      targets: ['testIntent'],
      execute: async () => ({
        success: false,
        errorType: 'TEST_ERROR',
        message: 'Test failure',
      }),
    })

    await dispatcher.dispatch({ type: 'testIntent', nodeId: 'n1' } as ViewIntent)

    expect(mockErrorLogger).toHaveBeenCalledWith(
      expect.stringContaining('Failed'),
      expect.objectContaining({
        errorType: 'TEST_ERROR',
        message: 'Test failure',
      })
    )
  })

  it('should measure execution time when enabled', async () => {
    const middleware = createLoggerMiddleware({
      logger: mockLogger,
      errorLogger: mockErrorLogger,
      measureTime: true,
    })

    dispatcher.use(middleware)
    dispatcher.register({
      targets: ['testIntent'],
      execute: async () => ({ success: true }),
    })

    await dispatcher.dispatch({ type: 'testIntent', nodeId: 'n1' } as ViewIntent)

    // Check that completion log includes time
    expect(mockLogger).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/Completed.*\d+\.\d+ms/),
      expect.any(Object)
    )
  })

  it('should use custom prefix', async () => {
    const middleware = createLoggerMiddleware({
      logger: mockLogger,
      errorLogger: mockErrorLogger,
      prefix: '[Custom]',
      measureTime: false,
    })

    dispatcher.use(middleware)
    dispatcher.register({
      targets: ['testIntent'],
      execute: async () => ({ success: true }),
    })

    await dispatcher.dispatch({ type: 'testIntent', nodeId: 'n1' } as ViewIntent)

    expect(mockLogger).toHaveBeenCalledWith(
      expect.stringContaining('[Custom]'),
      expect.any(Object)
    )
  })
})

// ============================================================================
// GuardrailMiddleware Tests
// ============================================================================

describe('GuardrailMiddleware', () => {
  let dispatcher: IntentDispatcher
  let mockNodeRegistry: ReturnType<typeof createMockNodeRegistry>

  beforeEach(() => {
    mockNodeRegistry = createMockNodeRegistry()
    dispatcher = createIntentDispatcher(
      mockNodeRegistry as any,
      createMockOverlayManager() as any
    )
  })

  describe('Node Existence Check', () => {
    it('should block form intent when form node not found', async () => {
      mockNodeRegistry.getFormNode.mockReturnValue(undefined)

      const middleware = createGuardrailMiddleware({ checkNodeExists: true })
      dispatcher.use(middleware)
      dispatcher.register({
        targets: ['setFieldValue'],
        execute: vi.fn().mockResolvedValue({ success: true }),
      })

      const result = await dispatcher.dispatch({
        type: 'setFieldValue',
        nodeId: 'missing-form',
        fieldId: 'field1',
        value: 'test',
      } as ViewIntent)

      expect(result.success).toBe(false)
      expect(result.errorType).toBe('NODE_NOT_FOUND')
      expect(result.message).toContain('missing-form')
    })

    it('should allow form intent when form node exists', async () => {
      mockNodeRegistry.getFormNode.mockReturnValue({ nodeId: 'form-1', runtime: {}, schema: {} })

      const handler = {
        targets: ['setFieldValue'],
        execute: vi.fn().mockResolvedValue({ success: true }),
      }

      const middleware = createGuardrailMiddleware({ checkNodeExists: true })
      dispatcher.use(middleware)
      dispatcher.register(handler)

      const result = await dispatcher.dispatch({
        type: 'setFieldValue',
        nodeId: 'form-1',
        fieldId: 'field1',
        value: 'test',
      } as ViewIntent)

      expect(result.success).toBe(true)
      expect(handler.execute).toHaveBeenCalled()
    })

    it('should block list intent when list node not found', async () => {
      mockNodeRegistry.getListNode.mockReturnValue(undefined)

      const middleware = createGuardrailMiddleware({ checkNodeExists: true })
      dispatcher.use(middleware)
      dispatcher.register({
        targets: ['selectRow'],
        execute: vi.fn().mockResolvedValue({ success: true }),
      })

      const result = await dispatcher.dispatch({
        type: 'selectRow',
        nodeId: 'missing-list',
        rowId: 'row-1',
      } as ViewIntent)

      expect(result.success).toBe(false)
      expect(result.errorType).toBe('NODE_NOT_FOUND')
    })

    it('should skip node check when disabled', async () => {
      mockNodeRegistry.getFormNode.mockReturnValue(undefined)

      const handler = {
        targets: ['setFieldValue'],
        execute: vi.fn().mockResolvedValue({ success: true }),
      }

      const middleware = createGuardrailMiddleware({ checkNodeExists: false })
      dispatcher.use(middleware)
      dispatcher.register(handler)

      await dispatcher.dispatch({
        type: 'setFieldValue',
        nodeId: 'any-form',
        fieldId: 'field1',
        value: 'test',
      } as ViewIntent)

      expect(handler.execute).toHaveBeenCalled()
    })
  })

  describe('Custom Guards', () => {
    it('should execute custom guard functions', async () => {
      const customGuard = vi.fn().mockReturnValue(null) // null = pass

      const middleware = createGuardrailMiddleware({
        checkNodeExists: false,
        customGuards: [customGuard],
      })

      dispatcher.use(middleware)
      dispatcher.register({
        targets: ['testIntent'],
        execute: async () => ({ success: true }),
      })

      await dispatcher.dispatch({ type: 'testIntent', nodeId: 'n1' } as ViewIntent)

      expect(customGuard).toHaveBeenCalled()
    })

    it('should block when custom guard returns error', async () => {
      const customGuard = vi.fn().mockReturnValue({
        success: false,
        errorType: 'CUSTOM_ERROR',
        message: 'Custom validation failed',
      })

      const handler = {
        targets: ['testIntent'],
        execute: vi.fn().mockResolvedValue({ success: true }),
      }

      const middleware = createGuardrailMiddleware({
        checkNodeExists: false,
        customGuards: [customGuard],
      })

      dispatcher.use(middleware)
      dispatcher.register(handler)

      const result = await dispatcher.dispatch({
        type: 'testIntent',
        nodeId: 'n1',
      } as ViewIntent)

      expect(result.success).toBe(false)
      expect(result.errorType).toBe('CUSTOM_ERROR')
      expect(handler.execute).not.toHaveBeenCalled()
    })

    it('should stop at first failing guard', async () => {
      const firstGuard = vi.fn().mockReturnValue({
        success: false,
        errorType: 'FIRST_GUARD',
        message: 'First guard failed',
      })
      const secondGuard = vi.fn().mockReturnValue(null)

      const middleware = createGuardrailMiddleware({
        checkNodeExists: false,
        customGuards: [firstGuard, secondGuard],
      })

      dispatcher.use(middleware)
      dispatcher.register({
        targets: ['testIntent'],
        execute: async () => ({ success: true }),
      })

      const result = await dispatcher.dispatch({
        type: 'testIntent',
        nodeId: 'n1',
      } as ViewIntent)

      expect(result.errorType).toBe('FIRST_GUARD')
      expect(secondGuard).not.toHaveBeenCalled()
    })
  })
})
