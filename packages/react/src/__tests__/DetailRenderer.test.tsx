import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import type { FormViewSchema } from '@manifesto-ai/schema'
import { FieldRendererRegistry } from '@manifesto-ai/ui'
import TextField from '../components/fields/TextField'
import { DetailRenderer } from '../components/detail/DetailRenderer'

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
      fields: [
        { id: 'name', entityFieldId: 'name', component: 'text-input', label: 'Name' },
      ],
    },
  ],
}

describe('DetailRenderer (React)', () => {
  it('renders field values in readonly mode', async () => {
    const registry = new FieldRendererRegistry()
    registry.register('text-input', TextField)

    const { getByDisplayValue } = render(
      <DetailRenderer schema={detailView} initialValues={{ name: 'Chair' }} fieldRegistry={registry} />
    )

    await waitFor(() => {
      expect(getByDisplayValue('Chair')).toBeTruthy()
    })
  })
})
