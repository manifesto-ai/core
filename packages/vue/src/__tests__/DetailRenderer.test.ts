import { describe, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { FormViewSchema } from '@manifesto-ai/schema'
import { FieldRendererRegistry } from '@manifesto-ai/ui'
import { markRaw } from 'vue'
import TextField from '../components/fields/TextField.vue'
import DetailRenderer from '../components/detail/DetailRenderer.vue'

const detailView: FormViewSchema = {
  _type: 'view',
  id: 'product-detail',
  name: 'Product Detail',
  version: '1.0.0',
  entityRef: 'product',
  mode: 'view',
  layout: { type: 'form' },
  sections: [
    {
      id: 'main',
      title: 'Main',
      layout: { type: 'grid', columns: 1 },
      fields: [{ id: 'name', entityFieldId: 'name', component: 'text-input', label: 'Name' }],
    },
  ],
}

describe('DetailRenderer (Vue)', () => {
  it('renders field value', async () => {
    const registry = new FieldRendererRegistry()
    registry.register('text-input', markRaw(TextField))

    const wrapper = mount(DetailRenderer, {
      props: {
        schema: detailView,
        initialValues: { name: 'Desk' },
        fieldRegistry: registry,
      },
    })

    await flushPromises()
    await wrapper.vm.$nextTick()
    expect(wrapper.html()).toContain('Desk')
  })
})
