import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { FormRenderer, createActionRegistry } from '@manifesto-ai/react'
import type { EntitySchema, FormViewSchema } from '@manifesto-ai/schema'
import type { LightweightValidator } from '@manifesto-ai/ui'

const entity: EntitySchema = {
  _type: 'entity',
  id: 'product',
  name: 'Product',
  version: '1.0.0',
  fields: [
    { id: 'name', dataType: 'string', label: 'Name', constraints: [{ type: 'required' }] },
    { id: 'price', dataType: 'number', label: 'Price', constraints: [{ type: 'min', value: 0 }] },
    { id: 'password', dataType: 'string', label: 'Password', constraints: [{ type: 'min', value: 8 }] },
  ],
}

const view: FormViewSchema = {
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
      title: 'Basic Info',
      layout: { type: 'grid', columns: 1 },
      fields: [
        { id: 'name', entityFieldId: 'name', component: 'text-input', label: 'Name', placeholder: 'Product name' },
        { id: 'price', entityFieldId: 'price', component: 'number-input', label: 'Price', placeholder: '0' },
        {
          id: 'password',
          entityFieldId: 'password',
          component: 'text-input',
          label: 'Owner Password',
          placeholder: 'At least 8 chars, 1 special',
        },
      ],
    },
  ],
  header: {
    title: 'Product',
    actions: [
      { id: 'verifyIdentity', label: 'Verify Identity', variant: 'primary', action: { type: 'custom', actionId: 'verifyIdentity' } },
    ],
  },
}

const passwordValidators: LightweightValidator[] = [
  { id: 'length', message: '8글자 이상이어야 합니다', test: (v) => typeof v === 'string' && v.length >= 8 },
  { id: 'special', message: '특수문자를 포함하세요', test: (v) => typeof v === 'string' && /[^A-Za-z0-9]/.test(v) },
]

const actionRegistry = createActionRegistry()
actionRegistry.register('verifyIdentity', ({ runtime }) => {
  const values = runtime.getState().values
  alert(`ID Check: owner=${values.name ?? ''}, price=${values.price ?? ''}`)
})

const liveValidators = new Map<string, readonly LightweightValidator[]>([['password', passwordValidators]])

const Component = () => (
  <div style={{ padding: '2rem', maxWidth: '720px', margin: '0 auto' }}>
    <h1>Simple Product Form</h1>
    <FormRenderer
      schema={view}
      entitySchema={entity}
      initialValues={{ price: 10 }}
      liveValidators={liveValidators}
      actionRegistry={actionRegistry}
      onSubmit={(data) => console.log('Submit', data)}
    />
  </div>
)

const meta: Meta<typeof Component> = {
  title: 'React/Form',
  component: Component,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
