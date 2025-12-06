/**
 * Vue - Product Form Stories
 *
 * 상품 등록 폼 테스트
 */

import type { Meta, StoryObj } from '@storybook/vue3'
import { h, defineComponent } from 'vue'
import { FormRenderer } from '@manifesto-ai/vue'
import {
  productCreateView,
  productEntity,
  createMockFetchHandler,
} from '@manifesto-ai/example-schemas'

const mockFetchHandler = createMockFetchHandler()

const initialValues = {
  status: 'DRAFT',
  productTypeCode: 'PHYSICAL',
  fulfillmentTypeCode: 'STANDARD',
  discountRate: 0,
  stockQuantity: 0,
}

const ProductFormComponent = defineComponent({
  name: 'ProductFormComponent',
  setup() {
    const handleSubmit = (data: Record<string, unknown>) => {
      console.log('Submit data:', data)
      alert('상품이 등록되었습니다!\n\n' + JSON.stringify(data, null, 2))
    }

    const handleError = (error: unknown) => {
      console.error('Error:', error)
    }

    return () =>
      h('div', { style: { padding: '2rem', maxWidth: '800px', margin: '0 auto' } }, [
        h('h1', '상품 등록'),
        h(FormRenderer, {
          schema: productCreateView,
          entitySchema: productEntity,
          initialValues,
          fetchHandler: mockFetchHandler,
          debug: true,
          onSubmit: handleSubmit,
          onError: handleError,
        }),
      ])
  },
})

const meta: Meta<typeof ProductFormComponent> = {
  title: 'Vue/ProductForm',
  component: ProductFormComponent,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Default Form',
}

export const PhysicalProductFields: Story = {
  name: 'Physical Product - Stock Fields',
  // TODO: 초기화 지연 문제 디버깅 필요
}

export const DigitalProductFields: Story = {
  name: 'Digital Product - Hidden Shipping Fields',
  // TODO: 초기화 지연 문제 디버깅 필요
}
