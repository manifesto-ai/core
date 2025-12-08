/**
 * Engine Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  NodeRegistry,
  createNodeRegistry,
  TemplateRegistry,
  createTemplateRegistry,
  registerDefaultTemplates,
  OverlayManager,
  createOverlayManager,
} from '../engine'

import type { OverlayTemplate } from '../types'

describe('NodeRegistry', () => {
  let registry: NodeRegistry

  beforeEach(() => {
    registry = new NodeRegistry()
  })

  describe('Form Node Registration', () => {
    it('should register form node', () => {
      const mockRuntime = {} as any
      const mockSchema = { id: 'test-form', mode: 'create' } as any

      registry.registerForm('form-1', mockRuntime, mockSchema)

      expect(registry.hasNode('form-1')).toBe(true)
      expect(registry.getNodeType('form-1')).toBe('form')
    })

    it('should get registered form node', () => {
      const mockRuntime = {} as any
      const mockSchema = { id: 'test-form' } as any

      registry.registerForm('form-1', mockRuntime, mockSchema)

      const node = registry.getFormNode('form-1')
      expect(node).toBeDefined()
      expect(node?.nodeId).toBe('form-1')
      expect(node?.runtime).toBe(mockRuntime)
      expect(node?.schema).toBe(mockSchema)
    })

    it('should throw error when registering duplicate node', () => {
      const mockRuntime = {} as any
      const mockSchema = {} as any

      registry.registerForm('form-1', mockRuntime, mockSchema)

      expect(() => {
        registry.registerForm('form-1', mockRuntime, mockSchema)
      }).toThrow('already registered')
    })

    it('should unregister form node', () => {
      const mockRuntime = {} as any
      const mockSchema = {} as any

      registry.registerForm('form-1', mockRuntime, mockSchema)
      const result = registry.unregisterForm('form-1')

      expect(result).toBe(true)
      expect(registry.hasNode('form-1')).toBe(false)
    })
  })

  describe('List Node Registration', () => {
    it('should register list node', () => {
      const mockRuntime = {} as any
      const mockSchema = { id: 'test-list', mode: 'list' } as any

      registry.registerList('list-1', mockRuntime, mockSchema)

      expect(registry.hasNode('list-1')).toBe(true)
      expect(registry.getNodeType('list-1')).toBe('list')
    })

    it('should get all form nodes', () => {
      const mockRuntime = {} as any
      const mockSchema = {} as any

      registry.registerForm('form-1', mockRuntime, mockSchema)
      registry.registerForm('form-2', mockRuntime, mockSchema)

      const nodes = registry.getAllFormNodes()
      expect(nodes).toHaveLength(2)
    })

    it('should get all list nodes', () => {
      const mockRuntime = {} as any
      const mockSchema = {} as any

      registry.registerList('list-1', mockRuntime, mockSchema)
      registry.registerList('list-2', mockRuntime, mockSchema)

      const nodes = registry.getAllListNodes()
      expect(nodes).toHaveLength(2)
    })
  })

  describe('Clear', () => {
    it('should clear all nodes', () => {
      const mockRuntime = {} as any
      const mockSchema = {} as any

      registry.registerForm('form-1', mockRuntime, mockSchema)
      registry.registerList('list-1', mockRuntime, mockSchema)

      registry.clear()

      expect(registry.getAllNodeIds()).toHaveLength(0)
    })
  })
})

describe('TemplateRegistry', () => {
  let registry: TemplateRegistry

  beforeEach(() => {
    registry = new TemplateRegistry()
  })

  it('should register template', () => {
    const template: OverlayTemplate = {
      id: 'test-dialog',
      kind: 'dialog',
      title: 'Test',
    }

    registry.register(template)

    expect(registry.has('test-dialog')).toBe(true)
    expect(registry.get('test-dialog')).toBe(template)
  })

  it('should throw error when registering duplicate template', () => {
    const template: OverlayTemplate = {
      id: 'test-dialog',
      kind: 'dialog',
    }

    registry.register(template)

    expect(() => {
      registry.register(template)
    }).toThrow('already registered')
  })

  it('should unregister template', () => {
    const template: OverlayTemplate = {
      id: 'test-dialog',
      kind: 'dialog',
    }

    registry.register(template)
    const result = registry.unregister('test-dialog')

    expect(result).toBe(true)
    expect(registry.has('test-dialog')).toBe(false)
  })

  it('should get templates by kind', () => {
    registry.register({ id: 'dialog-1', kind: 'dialog' })
    registry.register({ id: 'dialog-2', kind: 'dialog' })
    registry.register({ id: 'toast-1', kind: 'toast' })

    const dialogs = registry.getByKind('dialog')
    const toasts = registry.getByKind('toast')

    expect(dialogs).toHaveLength(2)
    expect(toasts).toHaveLength(1)
  })

  it('should register default templates', () => {
    registerDefaultTemplates(registry)

    expect(registry.has('confirm')).toBe(true)
    expect(registry.has('deleteConfirm')).toBe(true)
    expect(registry.has('success')).toBe(true)
    expect(registry.has('error')).toBe(true)
  })
})

describe('OverlayManager', () => {
  let templateRegistry: TemplateRegistry
  let overlayManager: OverlayManager

  beforeEach(() => {
    templateRegistry = new TemplateRegistry()
    registerDefaultTemplates(templateRegistry)
    overlayManager = new OverlayManager(templateRegistry)
  })

  describe('Open/Close', () => {
    it('should open overlay', () => {
      const instance = overlayManager.open(
        { kind: 'dialog', template: 'confirm' },
        { boundData: { message: 'Test' } }
      )

      expect(instance.instanceId).toMatch(/^overlay-\d+$/)
      expect(instance.kind).toBe('dialog')
      expect(instance.template).toBe('confirm')
      expect(instance.boundData).toEqual({ message: 'Test' })
      expect(instance.awaitingResult).toBe(true)
    })

    it('should open overlay with template', () => {
      const instance = overlayManager.openWithTemplate('confirm', {
        boundData: { message: 'Hello' },
      })

      expect(instance).toBeDefined()
      expect(instance?.kind).toBe('dialog')
    })

    it('should return undefined for non-existent template', () => {
      const instance = overlayManager.openWithTemplate('non-existent')
      expect(instance).toBeUndefined()
    })

    it('should close overlay', () => {
      const instance = overlayManager.open(
        { kind: 'dialog', template: 'confirm' },
        {}
      )

      const result = overlayManager.close(instance.instanceId)

      expect(result).toBe(true)
      expect(overlayManager.isEmpty()).toBe(true)
    })

    it('should return false when closing non-existent overlay', () => {
      const result = overlayManager.close('non-existent')
      expect(result).toBe(false)
    })
  })

  describe('Stack Management', () => {
    it('should maintain overlay stack', () => {
      overlayManager.open({ kind: 'dialog', template: 'confirm' }, {})
      overlayManager.open({ kind: 'modal', template: 'test' }, {})

      expect(overlayManager.size()).toBe(2)
    })

    it('should get top overlay', () => {
      overlayManager.open({ kind: 'dialog', template: 'confirm' }, {})
      const second = overlayManager.open({ kind: 'modal', template: 'test' }, {})

      expect(overlayManager.getTopOverlay()).toBe(second)
    })

    it('should close all overlays', () => {
      overlayManager.open({ kind: 'dialog', template: 'confirm' }, {})
      overlayManager.open({ kind: 'modal', template: 'test' }, {})

      overlayManager.closeAll()

      expect(overlayManager.isEmpty()).toBe(true)
    })
  })

  describe('Dialog Operations', () => {
    it('should confirm dialog', () => {
      const instance = overlayManager.open(
        { kind: 'dialog', template: 'confirm' },
        {}
      )

      const result = overlayManager.confirm(instance.instanceId)

      expect(result).toBe(true)
      expect(overlayManager.isEmpty()).toBe(true)
    })

    it('should cancel dialog', () => {
      const instance = overlayManager.open(
        { kind: 'dialog', template: 'confirm' },
        {}
      )

      const result = overlayManager.cancel(instance.instanceId)

      expect(result).toBe(true)
      expect(overlayManager.isEmpty()).toBe(true)
    })
  })

  describe('Toast Operations', () => {
    it('should dismiss toast', () => {
      const instance = overlayManager.open(
        { kind: 'toast', template: 'success' },
        {}
      )

      const result = overlayManager.dismiss(instance.instanceId)

      expect(result).toBe(true)
      expect(overlayManager.isEmpty()).toBe(true)
    })

    it('should not dismiss non-toast overlay', () => {
      const instance = overlayManager.open(
        { kind: 'dialog', template: 'confirm' },
        {}
      )

      const result = overlayManager.dismiss(instance.instanceId)

      expect(result).toBe(false)
    })
  })

  describe('Message Interpolation', () => {
    it('should interpolate message template', () => {
      const instance = overlayManager.open(
        {
          kind: 'dialog',
          template: 'deleteConfirm',
          messageTemplate: '선택한 {count}개 항목을 삭제하시겠습니까?',
        },
        { boundData: { count: 5 } }
      )

      expect(instance.message).toBe('선택한 5개 항목을 삭제하시겠습니까?')
    })
  })

  describe('Promise API', () => {
    it('should resolve when confirmed', async () => {
      const instance = overlayManager.open(
        { kind: 'dialog', template: 'confirm' },
        { boundData: { value: 'test' } }
      )

      const resultPromise = overlayManager.waitForResult(instance.instanceId)
      overlayManager.confirm(instance.instanceId)

      const result = await resultPromise
      expect(result.type).toBe('confirmed')
    })

    it('should resolve when cancelled', async () => {
      const instance = overlayManager.open(
        { kind: 'dialog', template: 'confirm' },
        {}
      )

      const resultPromise = overlayManager.waitForResult(instance.instanceId)
      overlayManager.cancel(instance.instanceId)

      const result = await resultPromise
      expect(result.type).toBe('cancelled')
    })

    it('should return cancelled for non-existent overlay', async () => {
      const result = await overlayManager.waitForResult('non-existent')
      expect(result.type).toBe('cancelled')
    })
  })
})
