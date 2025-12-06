/**
 * Vue - Delivery Register Stories
 *
 * 배송 수단 등록 폼의 타입별 필드 토글 검증
 */

import type { Meta, StoryObj } from '@storybook/vue3'
import { h, defineComponent } from 'vue'
import { userEvent, expect } from '@storybook/test'
import { FormRenderer } from '@manifesto-ai/vue'
import {
  deliveryRegisterView,
  deliveryRegisterEntity,
  createMockFetchHandler,
  waitForFormLoad,
  waitForField,
  getSectionElement,
} from '@manifesto-ai/example-schemas'

const mockFetchHandler = createMockFetchHandler()

const initialValues = {
  status: 'DRAFT',
  weatherProof: false,
  hazardousMaterialsConsent: false,
  needsSignature: true,
  customerNotification: true,
}

const DeliveryRegisterComponent = defineComponent({
  name: 'DeliveryRegisterComponent',
  setup() {
    const handleSubmit = (data: Record<string, unknown>) => {
      console.log('Submit data:', data)
      alert('배송 수단이 등록되었습니다!\n\n' + JSON.stringify(data, null, 2))
    }

    const handleError = (error: unknown) => {
      console.error('Error:', error)
    }

    return () =>
      h('div', { style: { padding: '2rem', maxWidth: '900px', margin: '0 auto' } }, [
        h(
          'header',
          {
            style: {
              marginBottom: '2rem',
              paddingBottom: '1rem',
              borderBottom: '2px solid #e0e0e0',
            },
          },
          [
            h('h1', '배송 수단 등록'),
            h('p', { style: { color: '#666' } }, '배송 타입에 따라 다른 필드가 표시됩니다'),
          ]
        ),
        h(FormRenderer, {
          schema: deliveryRegisterView,
          entitySchema: deliveryRegisterEntity,
          initialValues,
          fetchHandler: mockFetchHandler,
          debug: true,
          onSubmit: handleSubmit,
          onError: handleError,
        }),
      ])
  },
})

const meta: Meta<typeof DeliveryRegisterComponent> = {
  title: 'Vue/DeliveryRegister',
  component: DeliveryRegisterComponent,
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

// 배송 타입별 섹션 토글 확인
export const ParcelModeFields: Story = {
  name: 'Parcel Mode - Dynamic Fields',
  play: async ({ canvasElement, step }) => {
    await waitForFormLoad(canvasElement)

    await step('배송 타입을 PARCEL로 설정', async () => {
      const modeSelect = (await waitForField(canvasElement, 'deliveryMode')) as HTMLSelectElement
      await userEvent.selectOptions(modeSelect, 'PARCEL')
    })

    await step('일반 택배 타입에서 포장 티어 필드 확인', async () => {
      const packageTier = await waitForField(canvasElement, 'packageTier')
      expect(packageTier).toBeTruthy()
    })

    await step('대형 화물 섹션은 숨김', async () => {
      const freightSection = getSectionElement(canvasElement, 'freight-spec')
      expect(freightSection).toBeNull()
    })
  },
}

export const FreightModeFields: Story = {
  name: 'Freight Mode - Hazard Consent',
  play: async ({ canvasElement, step }) => {
    await waitForFormLoad(canvasElement)

    await step('배송 타입을 대형 화물로 변경', async () => {
      const modeSelect = (await waitForField(canvasElement, 'deliveryMode')) as HTMLSelectElement
      await userEvent.selectOptions(modeSelect, 'FREIGHT')
    })

    await step('대형 화물 전용 필드 확인', async () => {
      await waitForField(canvasElement, 'handlingMethod')
      await waitForField(canvasElement, 'oversizeSurcharge')
      await waitForField(canvasElement, 'hazardousMaterialsConsent')
    })
  },
}
