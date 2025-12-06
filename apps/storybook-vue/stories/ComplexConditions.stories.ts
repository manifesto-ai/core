/**
 * Vue - Complex Conditions Stories
 *
 * 복합 조건 로직 테스트
 * - AND 조건: 여러 필드가 모두 특정 값일 때
 * - OR 조건: 여러 필드 중 하나라도 특정 값일 때
 * - 중첩 조건: (A AND B) OR C 형태의 복합 조건
 * - 실제 시나리오: 상품 유형별, 결제 방식별 동적 필드
 */

import type { Meta, StoryObj } from '@storybook/vue3'
import { h, defineComponent } from 'vue'
import { FormRenderer } from '@manifesto-ai/vue'
import {
  complexConditionsView,
  complexConditionsEntity,
  createMockFetchHandler,
  waitForFormLoad,
  changeSelectValue,
  waitForSection,
  waitForSectionHidden,
  assertSectionVisible,
  assertSectionHidden,
} from '@manifesto-ai/example-schemas'

const mockFetchHandler = createMockFetchHandler()

const ComplexConditionsComponent = defineComponent({
  name: 'ComplexConditionsComponent',
  setup() {
    const handleSubmit = (data: Record<string, unknown>) => {
      console.log('Submit data:', data)
      alert('폼이 제출되었습니다!\n\n' + JSON.stringify(data, null, 2))
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
            h('h1', '복합 조건 테스트'),
            h('p', { style: { color: '#666' } }, '다양한 조건 조합에 따른 동적 UI 변경 검증'),
          ]
        ),
        h(FormRenderer, {
          schema: complexConditionsView,
          entitySchema: complexConditionsEntity,
          initialValues: {
            conditionA: 'NO',
            conditionB: 'NO',
            conditionC: 'NO',
            itemType: 'NONE',
            paymentMethod: 'NONE',
          },
          fetchHandler: mockFetchHandler,
          debug: true,
          onSubmit: handleSubmit,
          onError: handleError,
        }),
      ])
  },
})

const meta: Meta<typeof ComplexConditionsComponent> = {
  title: 'Vue/E2E/ComplexConditions',
  component: ComplexConditionsComponent,
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

// AND 조건 테스트: A AND B
export const AndCondition: Story = {
  name: 'AND Condition (A AND B)',
  play: async ({ canvasElement, step }) => {
    await waitForFormLoad(canvasElement)

    await step('초기 상태: AND 결과 섹션 숨김', async () => {
      assertSectionHidden(canvasElement, 'and-result')
    })

    await step('A만 YES: 섹션 여전히 숨김', async () => {
      await changeSelectValue(canvasElement, 'conditionA', 'YES')
      await new Promise((r) => setTimeout(r, 100))
      assertSectionHidden(canvasElement, 'and-result')
    })

    await step('A와 B 모두 YES: 섹션 표시', async () => {
      await changeSelectValue(canvasElement, 'conditionB', 'YES')
      await waitForSection(canvasElement, 'and-result')
      assertSectionVisible(canvasElement, 'and-result')
    })

    await step('B를 NO로 변경: 섹션 숨김', async () => {
      await changeSelectValue(canvasElement, 'conditionB', 'NO')
      await waitForSectionHidden(canvasElement, 'and-result')
    })
  },
}

// OR 조건 테스트: A OR C
export const OrCondition: Story = {
  name: 'OR Condition (A OR C)',
  play: async ({ canvasElement, step }) => {
    await waitForFormLoad(canvasElement)

    await step('초기 상태: OR 결과 섹션 숨김', async () => {
      assertSectionHidden(canvasElement, 'or-result')
    })

    await step('A만 YES: 섹션 표시', async () => {
      await changeSelectValue(canvasElement, 'conditionA', 'YES')
      await waitForSection(canvasElement, 'or-result')
      assertSectionVisible(canvasElement, 'or-result')
    })

    await step('A를 NO로, C를 YES로: 섹션 여전히 표시', async () => {
      await changeSelectValue(canvasElement, 'conditionA', 'NO')
      await new Promise((r) => setTimeout(r, 100))
      await changeSelectValue(canvasElement, 'conditionC', 'YES')
      await waitForSection(canvasElement, 'or-result')
    })

    await step('C를 NO로: 섹션 숨김', async () => {
      await changeSelectValue(canvasElement, 'conditionC', 'NO')
      await waitForSectionHidden(canvasElement, 'or-result')
    })
  },
}

// 중첩 조건 테스트: (A AND B) OR C
export const NestedCondition: Story = {
  name: 'Nested Condition ((A AND B) OR C)',
  play: async ({ canvasElement, step }) => {
    await waitForFormLoad(canvasElement)

    await step('초기 상태: 중첩 결과 섹션 숨김', async () => {
      assertSectionHidden(canvasElement, 'nested-result')
    })

    await step('A AND B 충족: 섹션 표시', async () => {
      await changeSelectValue(canvasElement, 'conditionA', 'YES')
      await changeSelectValue(canvasElement, 'conditionB', 'YES')
      await waitForSection(canvasElement, 'nested-result')
    })

    await step('A AND B 해제, C만 YES: 여전히 표시', async () => {
      await changeSelectValue(canvasElement, 'conditionA', 'NO')
      await changeSelectValue(canvasElement, 'conditionB', 'NO')
      await changeSelectValue(canvasElement, 'conditionC', 'YES')
      await waitForSection(canvasElement, 'nested-result')
    })

    await step('모든 조건 해제: 섹션 숨김', async () => {
      await changeSelectValue(canvasElement, 'conditionC', 'NO')
      await waitForSectionHidden(canvasElement, 'nested-result')
    })
  },
}

// 상품 유형별 동적 필드 테스트
export const ItemTypeCondition: Story = {
  name: 'Item Type Conditions',
  play: async ({ canvasElement, step }) => {
    await waitForFormLoad(canvasElement)

    await step('초기 상태: 모든 상품 유형 섹션 숨김', async () => {
      assertSectionHidden(canvasElement, 'physical-item')
      assertSectionHidden(canvasElement, 'digital-item')
      assertSectionHidden(canvasElement, 'service-item')
    })

    await step('실물 상품 선택: 실물 상품 섹션만 표시', async () => {
      await changeSelectValue(canvasElement, 'itemType', 'PHYSICAL')
      await waitForSection(canvasElement, 'physical-item')
      assertSectionHidden(canvasElement, 'digital-item')
      assertSectionHidden(canvasElement, 'service-item')
    })

    await step('디지털 상품 선택: 디지털 상품 섹션만 표시', async () => {
      await changeSelectValue(canvasElement, 'itemType', 'DIGITAL')
      await waitForSection(canvasElement, 'digital-item')
      await waitForSectionHidden(canvasElement, 'physical-item')
      assertSectionHidden(canvasElement, 'service-item')
    })

    await step('서비스 선택: 서비스 섹션만 표시', async () => {
      await changeSelectValue(canvasElement, 'itemType', 'SERVICE')
      await waitForSection(canvasElement, 'service-item')
      await waitForSectionHidden(canvasElement, 'digital-item')
    })
  },
}

// 결제 방식별 동적 필드 테스트
export const PaymentMethodCondition: Story = {
  name: 'Payment Method Conditions',
  play: async ({ canvasElement, step }) => {
    await waitForFormLoad(canvasElement)

    await step('초기 상태: 모든 결제 섹션 숨김', async () => {
      assertSectionHidden(canvasElement, 'card-payment')
      assertSectionHidden(canvasElement, 'bank-payment')
      assertSectionHidden(canvasElement, 'virtual-payment')
      assertSectionHidden(canvasElement, 'mobile-payment')
    })

    await step('카드 결제 선택: 카드 결제 섹션만 표시', async () => {
      await changeSelectValue(canvasElement, 'paymentMethod', 'CARD')
      await waitForSection(canvasElement, 'card-payment')
    })

    await step('계좌이체 선택: 계좌이체 섹션만 표시', async () => {
      await changeSelectValue(canvasElement, 'paymentMethod', 'BANK')
      await waitForSection(canvasElement, 'bank-payment')
      await waitForSectionHidden(canvasElement, 'card-payment')
    })

    await step('가상계좌 선택', async () => {
      await changeSelectValue(canvasElement, 'paymentMethod', 'VIRTUAL')
      await waitForSection(canvasElement, 'virtual-payment')
      await waitForSectionHidden(canvasElement, 'bank-payment')
    })

    await step('휴대폰 결제 선택', async () => {
      await changeSelectValue(canvasElement, 'paymentMethod', 'MOBILE')
      await waitForSection(canvasElement, 'mobile-payment')
      await waitForSectionHidden(canvasElement, 'virtual-payment')
    })
  },
}

// 복합 시나리오: 실물 상품 + 카드 결제
export const ComboCondition: Story = {
  name: 'Combo Condition (PHYSICAL + CARD)',
  play: async ({ canvasElement, step }) => {
    await waitForFormLoad(canvasElement)

    await step('초기 상태: 추가 옵션 섹션 숨김', async () => {
      assertSectionHidden(canvasElement, 'combo-option')
    })

    await step('실물 상품만 선택: 추가 옵션 숨김', async () => {
      await changeSelectValue(canvasElement, 'itemType', 'PHYSICAL')
      await waitForSection(canvasElement, 'physical-item')
      assertSectionHidden(canvasElement, 'combo-option')
    })

    await step('실물 상품 + 카드 결제: 추가 옵션 표시', async () => {
      await changeSelectValue(canvasElement, 'paymentMethod', 'CARD')
      await waitForSection(canvasElement, 'card-payment')
      await waitForSection(canvasElement, 'combo-option')
    })

    await step('결제 방식을 계좌이체로 변경: 추가 옵션 숨김', async () => {
      await changeSelectValue(canvasElement, 'paymentMethod', 'BANK')
      await waitForSectionHidden(canvasElement, 'combo-option')
    })

    await step('상품 유형을 디지털로 변경: 추가 옵션 숨김 유지', async () => {
      await changeSelectValue(canvasElement, 'paymentMethod', 'CARD')
      await changeSelectValue(canvasElement, 'itemType', 'DIGITAL')
      await new Promise((r) => setTimeout(r, 100))
      assertSectionHidden(canvasElement, 'combo-option')
    })
  },
}
