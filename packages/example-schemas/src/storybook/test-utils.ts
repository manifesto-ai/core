/**
 * Shared Test Utilities for Stories
 *
 * React와 Vue Storybook E2E 테스트에서 사용하는 공통 유틸리티
 * DOM 기반으로 프레임워크에 독립적임
 */

// waitFor 타입 정의 (Storybook test에서 주입)
type WaitForOptions = { timeout?: number }
type WaitForFn = <T>(
  callback: () => T | Promise<T>,
  options?: WaitForOptions
) => Promise<T>

// 기본 waitFor 구현 (폴링 기반)
const defaultWaitFor: WaitForFn = async (callback, options = {}) => {
  const { timeout = 5000 } = options
  const startTime = Date.now()
  const interval = 50

  while (Date.now() - startTime < timeout) {
    try {
      const result = await callback()
      return result
    } catch {
      await new Promise((resolve) => setTimeout(resolve, interval))
    }
  }

  // 마지막 시도
  return callback()
}

// Storybook test에서 주입할 수 있는 waitFor
let waitFor: WaitForFn = defaultWaitFor

/**
 * Storybook test의 waitFor를 주입
 */
export const setWaitFor = (fn: WaitForFn) => {
  waitFor = fn
}

/**
 * 필드 ID로 입력 요소 찾기
 */
export const getFieldInput = (
  canvasElement: HTMLElement,
  fieldId: string
): HTMLElement | null => {
  // ID로 직접 찾기
  let element = canvasElement.querySelector(`#${fieldId}`) as HTMLElement | null
  if (element) return element

  // data-field-id wrapper 내에서 찾기
  const wrapper = canvasElement.querySelector(`[data-field-id="${fieldId}"]`)
  element = wrapper?.querySelector('select, input, textarea') as HTMLElement | null
  return element
}

/**
 * 폼 로딩 완료 대기
 */
export const waitForFormLoad = async (canvasElement: HTMLElement) => {
  // 초기 렌더링 안정화를 위한 짧은 대기
  await new Promise((resolve) => setTimeout(resolve, 100))

  await waitFor(
    () => {
      const formContent = canvasElement.querySelector('.form-renderer__content')
      if (!formContent) throw new Error('Form not loaded')
      return formContent
    },
    { timeout: 15000 }
  )
}

/**
 * 특정 필드가 나타날 때까지 대기
 */
export const waitForField = async (
  canvasElement: HTMLElement,
  fieldId: string
): Promise<HTMLElement> => {
  return await waitFor(
    () => {
      const element = getFieldInput(canvasElement, fieldId)
      if (!element) throw new Error(`Field ${fieldId} not found`)
      return element
    },
    { timeout: 10000 }
  )
}

/**
 * 특정 필드가 사라질 때까지 대기
 */
export const waitForFieldHidden = async (
  canvasElement: HTMLElement,
  fieldId: string
) => {
  await waitFor(
    () => {
      const element = getFieldInput(canvasElement, fieldId)
      if (element) throw new Error(`Field ${fieldId} still visible`)
    },
    { timeout: 10000 }
  )
}

/**
 * 섹션 존재 여부 확인
 */
export const getSectionElement = (
  canvasElement: HTMLElement,
  sectionId: string
): HTMLElement | null => {
  return canvasElement.querySelector(`[data-section-id="${sectionId}"]`)
}

/**
 * Select 필드 값 변경
 */
export const changeSelectValue = async (
  canvasElement: HTMLElement,
  fieldId: string,
  value: string
) => {
  const select = await waitForField(canvasElement, fieldId)
  if (select instanceof HTMLSelectElement) {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  }
}

/**
 * Input 필드 값 변경
 */
export const changeInputValue = async (
  canvasElement: HTMLElement,
  fieldId: string,
  value: string | number
) => {
  const input = await waitForField(canvasElement, fieldId)
  if (input instanceof HTMLInputElement) {
    input.value = String(value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }
}

/**
 * Checkbox 필드 토글
 */
export const toggleCheckbox = async (
  canvasElement: HTMLElement,
  fieldId: string,
  checked?: boolean
) => {
  const checkbox = await waitForField(canvasElement, fieldId)
  if (checkbox instanceof HTMLInputElement && checkbox.type === 'checkbox') {
    if (checked !== undefined) {
      checkbox.checked = checked
    } else {
      checkbox.checked = !checkbox.checked
    }
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))
  }
}

/**
 * 디버그 패널에서 폼 데이터 가져오기
 */
export const getDebugFormData = (canvasElement: HTMLElement): unknown | null => {
  const debugPanel = canvasElement.querySelector('.form-renderer__debug pre')
  if (debugPanel?.textContent) {
    try {
      return JSON.parse(debugPanel.textContent)
    } catch {
      return null
    }
  }
  return null
}

/**
 * 필드가 특정 값을 가질 때까지 대기
 */
export const waitForFieldValue = async (
  canvasElement: HTMLElement,
  fieldId: string,
  expectedValue: string
) => {
  await waitFor(
    () => {
      const element = getFieldInput(canvasElement, fieldId)
      if (!element) throw new Error(`Field ${fieldId} not found`)
      const currentValue =
        element instanceof HTMLInputElement || element instanceof HTMLSelectElement
          ? element.value
          : ''
      if (currentValue !== expectedValue) {
        throw new Error(
          `Field ${fieldId} has value "${currentValue}", expected "${expectedValue}"`
        )
      }
    },
    { timeout: 5000 }
  )
}

// ============================================================================
// 유효성 검증 관련 헬퍼
// ============================================================================

/**
 * 필드의 에러 메시지 요소 찾기
 */
export const getFieldError = (
  canvasElement: HTMLElement,
  fieldId: string
): HTMLElement | null => {
  // data-field-id wrapper에서 에러 메시지 찾기
  const wrapper = canvasElement.querySelector(`[data-field-id="${fieldId}"]`)
  if (wrapper) {
    const error = wrapper.querySelector('.field-error, .error-message, [class*="error"]')
    if (error) return error as HTMLElement
  }
  // 직접 ID로 에러 메시지 찾기
  return canvasElement.querySelector(`#${fieldId}-error`) as HTMLElement | null
}

/**
 * 필드에 에러가 있는지 확인
 */
export const hasFieldError = (
  canvasElement: HTMLElement,
  fieldId: string
): boolean => {
  return getFieldError(canvasElement, fieldId) !== null
}

/**
 * 필드 에러 메시지 검증
 */
export const assertFieldError = (
  canvasElement: HTMLElement,
  fieldId: string,
  expectedMessage?: string
) => {
  const errorElement = getFieldError(canvasElement, fieldId)
  if (!errorElement) {
    throw new Error(`Expected error for field ${fieldId}, but none found`)
  }
  if (expectedMessage && !errorElement.textContent?.includes(expectedMessage)) {
    throw new Error(
      `Expected error message "${expectedMessage}" for field ${fieldId}, but got "${errorElement.textContent}"`
    )
  }
}

/**
 * 필드에 에러가 없는지 확인
 */
export const assertNoFieldError = (
  canvasElement: HTMLElement,
  fieldId: string
) => {
  const errorElement = getFieldError(canvasElement, fieldId)
  if (errorElement) {
    throw new Error(
      `Expected no error for field ${fieldId}, but found: "${errorElement.textContent}"`
    )
  }
}

/**
 * 필드 에러가 나타날 때까지 대기
 */
export const waitForFieldError = async (
  canvasElement: HTMLElement,
  fieldId: string,
  timeout = 5000
): Promise<HTMLElement> => {
  return await waitFor(
    () => {
      const error = getFieldError(canvasElement, fieldId)
      if (!error) throw new Error(`Error for field ${fieldId} not found`)
      return error
    },
    { timeout }
  )
}

/**
 * 필드 에러가 사라질 때까지 대기
 */
export const waitForFieldErrorClear = async (
  canvasElement: HTMLElement,
  fieldId: string,
  timeout = 5000
) => {
  await waitFor(
    () => {
      const error = getFieldError(canvasElement, fieldId)
      if (error) throw new Error(`Error for field ${fieldId} still visible`)
    },
    { timeout }
  )
}

// ============================================================================
// 제출 버튼 상태 관련 헬퍼
// ============================================================================

/**
 * 제출 버튼 요소 찾기
 */
export const getSubmitButton = (
  canvasElement: HTMLElement
): HTMLButtonElement | null => {
  return canvasElement.querySelector(
    'button[type="submit"]'
  ) as HTMLButtonElement | null
}

/**
 * 제출 버튼 활성화 여부 확인
 */
export const isSubmitButtonEnabled = (canvasElement: HTMLElement): boolean => {
  const button = getSubmitButton(canvasElement)
  return button !== null && !button.disabled
}

/**
 * 제출 버튼이 활성화될 때까지 대기
 */
export const waitForSubmitEnabled = async (
  canvasElement: HTMLElement,
  timeout = 5000
) => {
  await waitFor(
    () => {
      if (!isSubmitButtonEnabled(canvasElement)) {
        throw new Error('Submit button is still disabled')
      }
    },
    { timeout }
  )
}

/**
 * 제출 버튼이 비활성화될 때까지 대기
 */
export const waitForSubmitDisabled = async (
  canvasElement: HTMLElement,
  timeout = 5000
) => {
  await waitFor(
    () => {
      if (isSubmitButtonEnabled(canvasElement)) {
        throw new Error('Submit button is still enabled')
      }
    },
    { timeout }
  )
}

// ============================================================================
// 섹션 관련 헬퍼
// ============================================================================

/**
 * 섹션이 나타날 때까지 대기
 */
export const waitForSection = async (
  canvasElement: HTMLElement,
  sectionId: string,
  timeout = 10000
): Promise<HTMLElement> => {
  return await waitFor(
    () => {
      const section = getSectionElement(canvasElement, sectionId)
      if (!section) throw new Error(`Section ${sectionId} not found`)
      return section
    },
    { timeout }
  )
}

/**
 * 섹션이 사라질 때까지 대기
 */
export const waitForSectionHidden = async (
  canvasElement: HTMLElement,
  sectionId: string,
  timeout = 10000
) => {
  await waitFor(
    () => {
      const section = getSectionElement(canvasElement, sectionId)
      if (section) throw new Error(`Section ${sectionId} still visible`)
    },
    { timeout }
  )
}

/**
 * 섹션이 표시되어 있는지 확인
 */
export const assertSectionVisible = (
  canvasElement: HTMLElement,
  sectionId: string
) => {
  const section = getSectionElement(canvasElement, sectionId)
  if (!section) {
    throw new Error(`Expected section ${sectionId} to be visible, but it's not found`)
  }
}

/**
 * 섹션이 숨겨져 있는지 확인
 */
export const assertSectionHidden = (
  canvasElement: HTMLElement,
  sectionId: string
) => {
  const section = getSectionElement(canvasElement, sectionId)
  if (section) {
    throw new Error(`Expected section ${sectionId} to be hidden, but it's visible`)
  }
}

// ============================================================================
// 복합 상태 헬퍼
// ============================================================================

/**
 * 여러 필드 값을 한번에 설정
 */
export const setMultipleFields = async (
  canvasElement: HTMLElement,
  values: Record<string, string | boolean | number>
) => {
  for (const [fieldId, value] of Object.entries(values)) {
    const field = await waitForField(canvasElement, fieldId)

    if (field instanceof HTMLSelectElement) {
      field.value = String(value)
      field.dispatchEvent(new Event('change', { bubbles: true }))
    } else if (field instanceof HTMLInputElement) {
      if (field.type === 'checkbox') {
        field.checked = Boolean(value)
        field.dispatchEvent(new Event('change', { bubbles: true }))
      } else {
        field.value = String(value)
        field.dispatchEvent(new Event('input', { bubbles: true }))
        field.dispatchEvent(new Event('change', { bubbles: true }))
      }
    } else if (field instanceof HTMLTextAreaElement) {
      field.value = String(value)
      field.dispatchEvent(new Event('input', { bubbles: true }))
      field.dispatchEvent(new Event('change', { bubbles: true }))
    }

    // 각 필드 변경 후 짧은 대기
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

/**
 * 필드에 blur 이벤트 트리거 (유효성 검증 활성화용)
 *
 * React는 synthetic event system을 사용하므로 일반 Event 대신
 * FocusEvent를 사용하고, 네이티브 blur() 메서드도 함께 호출합니다.
 */
export const triggerFieldBlur = async (
  canvasElement: HTMLElement,
  fieldId: string
) => {
  const field = await waitForField(canvasElement, fieldId)

  // 네이티브 blur 메서드 호출 (React의 onBlur 핸들러 트리거)
  if (field instanceof HTMLInputElement ||
      field instanceof HTMLTextAreaElement ||
      field instanceof HTMLSelectElement) {
    field.blur()
  }

  // FocusEvent로 blur 이벤트 디스패치 (추가 안전장치)
  field.dispatchEvent(new FocusEvent('blur', { bubbles: true, relatedTarget: null }))

  // React 상태 업데이트 대기
  await new Promise((resolve) => setTimeout(resolve, 50))
}

/**
 * 폼의 전체 유효성 상태 확인
 */
export const isFormValid = (canvasElement: HTMLElement): boolean => {
  const errors = canvasElement.querySelectorAll(
    '.field-error, .error-message, [class*="error"]:not([class*="error-boundary"])'
  )
  return errors.length === 0 && isSubmitButtonEnabled(canvasElement)
}
