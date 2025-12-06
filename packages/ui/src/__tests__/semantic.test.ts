import type { FormState } from '@manifesto-ai/engine'
import type { Expression, FormViewSchema, ListViewSchema } from '@manifesto-ai/schema'
import { describe, expect, it, vi } from 'vitest'
import { resolveFieldRenderers } from '../adapter'
import { FieldRendererRegistry } from '../registry/fieldRegistry'
import { SemanticRendererRegistry } from '../registry/semanticRegistry'
import { buildFormSemanticTree, buildListSemanticTree, buildSemanticTree } from '../semantic'

const formView: FormViewSchema = {
  _type: 'view',
  id: 'product-form',
  name: 'Product Form',
  version: '1.0.0',
  entityRef: 'product',
  mode: 'create',
  layout: { type: 'form', columns: 1 },
  sections: [
    {
      id: 'main',
      title: 'Main',
      layout: { type: 'grid', columns: 2 },
      fields: [
        {
          id: 'name',
          entityFieldId: 'name',
          component: 'text-input',
          label: 'Name',
        },
        {
          id: 'price',
          entityFieldId: 'price',
          component: 'number-input',
          label: 'Price',
        },
      ],
    },
  ],
  header: {
    title: 'Create Product',
    actions: [
      {
        id: 'cancel',
        label: 'Cancel',
        variant: 'secondary',
        action: { type: 'cancel' },
      },
    ],
  },
  footer: {
    actions: [
      {
        id: 'save',
        label: 'Save',
        variant: 'primary',
        action: { type: 'submit' },
      },
    ],
  },
}

const formState: FormState = {
  values: { name: 'Laptop', price: 1299 },
  fields: new Map([
    [
      'name',
      { id: 'name', entityFieldId: 'name', hidden: false, disabled: false, errors: [], props: { maxLength: 50 } },
    ],
    [
      'price',
      { id: 'price', entityFieldId: 'price', hidden: true, disabled: false, errors: ['Required'], props: {} },
    ],
  ]),
  fieldOptions: new Map([
    ['price', [{ value: 1, label: 'One' }]],
  ]),
  isValid: false,
  isDirty: true,
  isSubmitting: false,
}

const simpleListView: ListViewSchema = {
  _type: 'view',
  id: 'products',
  name: 'Products',
  version: '1.0.0',
  entityRef: 'product',
  mode: 'list',
  columns: [{ id: 'name', entityFieldId: 'name', type: 'text', label: 'Name' }],
  dataSource: { type: 'static', static: [] },
}

describe('Semantic builders', () => {
  it('builds form semantic tree with state merged', () => {
    const tree = buildFormSemanticTree({ kind: 'form', view: formView, state: formState })

    expect(tree.kind).toBe('form')
    expect(tree.sections[0].fields[0].state.value).toBe('Laptop')
    expect(tree.sections[0].fields[1].state.hidden).toBe(true)
    expect(tree.sections[0].fields[1].state.options?.[0].label).toBe('One')
    expect(tree.headerActions?.[0].label).toBe('Cancel')
  })

  it('filters hidden fields when includeHidden is false', () => {
    const tree = buildFormSemanticTree(
      { kind: 'form', view: formView, state: formState },
      { includeHidden: false }
    )

    const fieldIds = tree.sections[0].fields.map((field) => field.fieldId)
    expect(fieldIds).toEqual(['name'])
  })

  it('builds list semantic tree and filters columns with hidden expressions', () => {
    const alwaysHidden: Expression = ['==', 1, 1]

    const listView: ListViewSchema = {
      _type: 'view',
      id: 'products',
      name: 'Products',
      version: '1.0.0',
      entityRef: 'product',
      mode: 'list',
      columns: [
        { id: 'name', entityFieldId: 'name', type: 'text', label: 'Name' },
        { id: 'price', entityFieldId: 'price', type: 'number', label: 'Price', hidden: alwaysHidden },
      ],
      dataSource: { type: 'static', static: [] },
    }

    const tree = buildListSemanticTree(
      { kind: 'list', view: listView, rows: [{ name: 'Pen', price: 3 }] },
      { includeHidden: false }
    )
    expect(tree.columns.map((col) => col.columnId)).toEqual(['name'])
    expect(tree.rows?.[0].name).toBe('Pen')
  })

  it('attaches live validator errors and ui state hints', () => {
    const validators = new Map([
      [
        'price',
        [
          {
            id: 'positive',
            message: 'Price must be positive',
            test: (value: unknown) => typeof value === 'number' && value > 0,
          },
        ],
      ],
    ])

    const invalidState: FormState = {
      ...formState,
      values: { ...formState.values, price: -10 },
    }

    const tree = buildFormSemanticTree(
      { kind: 'form', view: formView, state: invalidState },
      { liveValidators: validators, uiState: { activeTab: 'pricing' } }
    )

    const priceField = tree.sections[0].fields.find((field) => field.fieldId === 'price')
    expect(priceField?.state.liveErrors).toEqual(['Price must be positive'])
    expect(tree.uiStateHints).toEqual({ activeTab: 'pricing' })
  })
})

describe('Semantic renderer registry + adapter helpers', () => {
  it('buildSemanticTree uses default registry and forwards options', () => {
    const tree = buildSemanticTree(
      { kind: 'form', view: formView, state: formState },
      { uiState: { focusedField: 'name' } }
    )

    expect(tree.kind).toBe('form')
    expect(tree.uiStateHints).toEqual({ focusedField: 'name' })
  })

  it('uses default registry to build detail tree', () => {
    const registry = new SemanticRendererRegistry()
    const tree = registry.build({ kind: 'detail', view: formView, state: formState })

    expect(tree.kind).toBe('detail')
    expect(tree.sections[0].fields[0].fieldId).toBe('name')
  })

  it('throws when renderer is missing', () => {
    const registry = new SemanticRendererRegistry(false)

    expect(() =>
      registry.build({
        kind: 'form',
        view: formView,
        state: formState,
      })
    ).toThrowError('No semantic renderer registered for kind "form"')
  })

  it('allows overriding renderers and cloning without sharing entries', () => {
    const registry = new SemanticRendererRegistry(false)
    const options = { includeHidden: false }
    const customRenderer = vi.fn(() => ({
      id: 'custom-list',
      kind: 'list',
      viewId: simpleListView.id,
      entityRef: simpleListView.entityRef,
      columns: [],
    }))

    registry.register('list', customRenderer)

    const listTree = registry.build({ kind: 'list', view: simpleListView, rows: [] }, options)
    expect(customRenderer).toHaveBeenCalledWith({ kind: 'list', view: simpleListView, rows: [] }, options)
    expect(listTree.kind).toBe('list')

    const clone = registry.clone()
    const formRenderer = vi.fn(() => buildFormSemanticTree({ kind: 'form', view: formView, state: formState }))
    clone.register('form', formRenderer)

    expect(registry.has('form')).toBe(false)
    expect(clone.build({ kind: 'form', view: formView, state: formState })).toMatchObject({ kind: 'form' })
  })

  it('resolves field renderers and reports missing ones', async () => {
    const tree = buildFormSemanticTree({ kind: 'form', view: formView, state: formState })
    const fieldRegistry = new FieldRendererRegistry<string>([
      ['text-input', 'TextRenderer'],
    ])

    const result = await resolveFieldRenderers(tree, fieldRegistry)
    expect(result.tree.sections[0].fields[0].renderer).toBe('TextRenderer')
    expect(result.missing).toEqual(['number-input'])
  })

  it('returns list trees untouched when no field renderers are needed', async () => {
    const tree = buildListSemanticTree({ kind: 'list', view: simpleListView, rows: [] })
    const registry = { resolve: vi.fn() } as unknown as FieldRendererRegistry<string>

    const result = await resolveFieldRenderers(tree, registry)
    expect(result.tree).toBe(tree)
    expect(result.missing).toEqual([])
    expect(registry.resolve).not.toHaveBeenCalled()
  })

  it('deduplicates missing renderer types when resolving fields', async () => {
    const duplicateFormView: FormViewSchema = {
      _type: 'view',
      id: 'duplicate-form',
      name: 'Duplicate Form',
      version: '1.0.0',
      entityRef: 'product',
      mode: 'create',
      layout: { type: 'form', columns: 1 },
      sections: [
        {
          id: 'main',
          layout: { type: 'grid', columns: 1 },
          fields: [
            { id: 'first', entityFieldId: 'first', component: 'custom-input', label: 'First' },
            { id: 'second', entityFieldId: 'second', component: 'custom-input', label: 'Second' },
          ],
        },
      ],
    }

    const tree = buildFormSemanticTree({ kind: 'form', view: duplicateFormView })
    const result = await resolveFieldRenderers(tree, new FieldRendererRegistry())

    expect(result.missing).toEqual(['custom-input'])
    expect(result.tree.sections[0].fields.map((field) => field.renderer)).toEqual([undefined, undefined])
  })
})
