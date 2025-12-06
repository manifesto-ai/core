import { describe, expect, it, vi } from 'vitest'
import { ActionHandlerRegistry } from '../registry/actionRegistry'
import { FieldRendererRegistry } from '../registry/fieldRegistry'

describe('FieldRendererRegistry', () => {
  it('normalizes eager registration objects and preserves metadata', async () => {
    const registry = new FieldRendererRegistry<{ render: () => void }>()
    const renderer = { render: () => {} }

    registry.register('textarea', {
      renderer,
      meta: { label: 'Textarea', tags: ['form'] },
    })

    expect(registry.list()).toEqual([
      { type: 'textarea', lazy: false, meta: { label: 'Textarea', tags: ['form'] } },
    ])
    expect(await registry.resolve('textarea')).toBe(renderer)
  })

  it('handles lazy registration that returns raw renderer values and caches them', async () => {
    const registry = new FieldRendererRegistry<{ name: string }>()
    const component = { name: 'RawRenderer' }
    const loader = vi.fn(async () => component)

    registry.register('raw-input', { lazy: loader, meta: { description: 'lazy raw' } })

    const resolved = await registry.resolve('raw-input')
    expect(resolved).toEqual(component)
    expect(loader).toHaveBeenCalledTimes(1)
    expect(registry.get('raw-input')).toMatchObject({ renderer: component, meta: { description: 'lazy raw' } })

    const resolvedAgain = await registry.resolve('raw-input')
    expect(resolvedAgain).toBe(resolved)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('registers and resolves lazy renderers', async () => {
    const registry = new FieldRendererRegistry<string>()
    const loader = vi.fn(async () => ({ default: 'TextInput' }))

    registry.register('text-input', { lazy: loader })

    expect(registry.has('text-input')).toBe(true)
    expect(registry.list()).toEqual([{ type: 'text-input', lazy: true, meta: undefined }])

    const resolved = await registry.resolve('text-input')
    expect(resolved).toBe('TextInput')
    expect(loader).toHaveBeenCalledTimes(1)

    // Ensure subsequent resolves use cached renderer
    const resolvedAgain = await registry.resolve('text-input')
    expect(resolvedAgain).toBe('TextInput')
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('clones registry without sharing state', () => {
    const registry = new FieldRendererRegistry<string>()
    registry.register('text-input', 'TextInput')

    const cloned = registry.clone()
    cloned.register('number-input', 'NumberInput')

    expect(registry.has('number-input')).toBe(false)
    expect(cloned.has('text-input')).toBe(true)
  })
})

describe('ActionHandlerRegistry', () => {
  it('registers, lists, and invokes handlers', async () => {
    const registry = new ActionHandlerRegistry<{ value: number }>()
    const handler = vi.fn()

    registry.register('save', handler)

    expect(registry.has('save')).toBe(true)
    expect(registry.list()).toEqual(['save'])

    await registry.get('save')?.({ value: 42 })
    expect(handler).toHaveBeenCalledWith({ value: 42 })
  })

  it('clones registry without sharing handlers', () => {
    const registry = new ActionHandlerRegistry()
    registry.register('save', () => {})

    const cloned = registry.clone()
    cloned.register('cancel', () => {})

    expect(registry.has('cancel')).toBe(false)
    expect(cloned.has('save')).toBe(true)
  })
})
