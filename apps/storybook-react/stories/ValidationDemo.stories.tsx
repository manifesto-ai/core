/**
 * React - Validation Demo Stories
 *
 * 다양한 유효성 검증 규칙 테스트
 * - required: 필수 입력 검증
 * - min/max: 숫자 범위 검증
 * - minLength/maxLength: 문자열 길이 검증
 * - pattern: 정규식 패턴 검증
 */

import type { Meta, StoryObj } from '@storybook/react'
import { userEvent } from '@storybook/test'
import { FormRenderer } from '@manifesto-ai/react'
import {
  validationDemoView,
  validationDemoEntity,
  createMockFetchHandler,
  waitForFormLoad,
  waitForField,
  waitForFieldError,
  waitForFieldErrorClear,
} from '@manifesto-ai/example-schemas'

// 필드에 blur 이벤트를 트리거하는 헬퍼 함수
// 필드를 클릭한 후 body를 클릭하여 blur 발생시킴
const blurByClickingAway = async (canvasElement: HTMLElement) => {
  // body나 다른 요소 클릭하여 blur 트리거
  const formContent = canvasElement.querySelector('.form-renderer__content')
  if (formContent) {
    await userEvent.click(formContent)
  }
  // React 상태 업데이트 대기
  await new Promise((resolve) => setTimeout(resolve, 150))
}

// 필드에 포커스 후 값 입력하고 blur 트리거하는 헬퍼 함수
const typeAndBlur = async (
  canvasElement: HTMLElement,
  fieldId: string,
  value: string | number
) => {
  const input = await waitForField(canvasElement, fieldId)
  await userEvent.click(input) // 포커스
  await userEvent.clear(input) // 기존 값 지우기
  await userEvent.type(input, String(value)) // 값 입력
  await blurByClickingAway(canvasElement)
}

const mockFetchHandler = createMockFetchHandler()

const ValidationDemoComponent = () => {
  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <header
        style={{
          marginBottom: '2rem',
          paddingBottom: '1rem',
          borderBottom: '2px solid #e0e0e0',
        }}
      >
        <h1>유효성 검증 데모</h1>
        <p style={{ color: '#666' }}>
          다양한 검증 규칙 테스트 (required, min/max, pattern)
        </p>
      </header>

      <FormRenderer
        schema={validationDemoView}
        entitySchema={validationDemoEntity}
        initialValues={{}}
        fetchHandler={mockFetchHandler}
        debug
        onSubmit={(data) => {
          console.log('Submit data:', data)
          alert('폼이 제출되었습니다!\n\n' + JSON.stringify(data, null, 2))
        }}
        onError={(error) => console.error('Error:', error)}
        renderFooter={({ reset, isValid, isDirty, isSubmitting }) => (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '1rem',
              padding: '1.5rem 0',
              borderTop: '1px solid #e0e0e0',
              marginTop: '1rem',
            }}
          >
            <button type="button" onClick={reset} disabled={!isDirty}>
              초기화
            </button>
            <button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting ? '제출 중...' : '제출'}
            </button>
          </div>
        )}
      />
    </div>
  )
}

const meta: Meta<typeof ValidationDemoComponent> = {
  title: 'React/E2E/ValidationDemo',
  component: ValidationDemoComponent,
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

// 필수 입력 검증 테스트
export const RequiredValidation: Story = {
  name: 'Required Validation',
  play: async ({ canvasElement, step }) => {
    await waitForFormLoad(canvasElement)

    await step('필수 텍스트 필드 blur 시 에러 표시', async () => {
      const input = await waitForField(canvasElement, 'requiredText')
      await userEvent.click(input)
      await blurByClickingAway(canvasElement)
      await waitForFieldError(canvasElement, 'requiredText')
    })

    await step('값 입력 후 에러 클리어', async () => {
      await typeAndBlur(canvasElement, 'requiredText', '테스트 값')
      await waitForFieldErrorClear(canvasElement, 'requiredText')
    })
  },
}

// 숫자 범위 검증 테스트
export const RangeValidation: Story = {
  name: 'Range Validation (min/max)',
  play: async ({ canvasElement, step }) => {
    await waitForFormLoad(canvasElement)

    await step('최소값 미달 시 에러 표시', async () => {
      await typeAndBlur(canvasElement, 'numberRange', '5')
      await waitForFieldError(canvasElement, 'numberRange')
    })

    await step('범위 내 값 입력 시 에러 클리어', async () => {
      await typeAndBlur(canvasElement, 'numberRange', '50')
      await waitForFieldErrorClear(canvasElement, 'numberRange')
    })

    await step('최대값 초과 시 에러 표시', async () => {
      await typeAndBlur(canvasElement, 'numberRange', '150')
      await waitForFieldError(canvasElement, 'numberRange')
    })
  },
}

// 문자열 길이 검증 테스트
export const LengthValidation: Story = {
  name: 'Length Validation (minLength/maxLength)',
  play: async ({ canvasElement, step }) => {
    await waitForFormLoad(canvasElement)

    await step('최소 길이 미달 시 에러 표시', async () => {
      await typeAndBlur(canvasElement, 'shortText', 'ab')
      await waitForFieldError(canvasElement, 'shortText')
    })

    await step('범위 내 길이 입력 시 에러 클리어', async () => {
      await typeAndBlur(canvasElement, 'shortText', 'valid')
      await waitForFieldErrorClear(canvasElement, 'shortText')
    })

    await step('최대 길이 초과 시 에러 표시', async () => {
      await typeAndBlur(canvasElement, 'shortText', '12345678901')
      await waitForFieldError(canvasElement, 'shortText')
    })
  },
}

// 패턴 검증 테스트
export const PatternValidation: Story = {
  name: 'Pattern Validation (regex)',
  play: async ({ canvasElement, step }) => {
    await waitForFormLoad(canvasElement)

    await step('전화번호 패턴 불일치 시 에러', async () => {
      await typeAndBlur(canvasElement, 'phoneNumber', '12345678')
      await waitForFieldError(canvasElement, 'phoneNumber')
    })

    await step('올바른 전화번호 형식 입력 시 통과', async () => {
      await typeAndBlur(canvasElement, 'phoneNumber', '010-1234-5678')
      await waitForFieldErrorClear(canvasElement, 'phoneNumber')
    })

    await step('이메일 패턴 검증', async () => {
      await typeAndBlur(canvasElement, 'requiredEmail', 'invalid-email')
      await waitForFieldError(canvasElement, 'requiredEmail')

      await typeAndBlur(canvasElement, 'requiredEmail', 'valid@email.com')
      await waitForFieldErrorClear(canvasElement, 'requiredEmail')
    })
  },
}

// 복합 검증 테스트 (사용자명)
export const UsernameValidation: Story = {
  name: 'Username Validation (required + length + pattern)',
  play: async ({ canvasElement, step }) => {
    await waitForFormLoad(canvasElement)

    await step('필수 검증', async () => {
      const input = await waitForField(canvasElement, 'username')
      await userEvent.click(input)
      await blurByClickingAway(canvasElement)
      await waitForFieldError(canvasElement, 'username')
    })

    await step('길이 검증 (4자 미만)', async () => {
      await typeAndBlur(canvasElement, 'username', 'abc')
      await waitForFieldError(canvasElement, 'username')
    })

    await step('패턴 검증 (특수문자 포함)', async () => {
      await typeAndBlur(canvasElement, 'username', 'user@name')
      await waitForFieldError(canvasElement, 'username')
    })

    await step('올바른 사용자명', async () => {
      await typeAndBlur(canvasElement, 'username', 'valid_user123')
      await waitForFieldErrorClear(canvasElement, 'username')
    })
  },
}

// 비밀번호 복합 검증 테스트
export const PasswordValidation: Story = {
  name: 'Password Validation (required + min + pattern)',
  play: async ({ canvasElement, step }) => {
    await waitForFormLoad(canvasElement)

    await step('길이 검증 (8자 미만)', async () => {
      await typeAndBlur(canvasElement, 'password', 'Short1')
      await waitForFieldError(canvasElement, 'password')
    })

    await step('패턴 검증 (대문자 없음)', async () => {
      await typeAndBlur(canvasElement, 'password', 'lowercase123')
      await waitForFieldError(canvasElement, 'password')
    })

    await step('패턴 검증 (숫자 없음)', async () => {
      await typeAndBlur(canvasElement, 'password', 'NoNumbers')
      await waitForFieldError(canvasElement, 'password')
    })

    await step('올바른 비밀번호', async () => {
      await typeAndBlur(canvasElement, 'password', 'ValidPass123')
      await waitForFieldErrorClear(canvasElement, 'password')
    })
  },
}
