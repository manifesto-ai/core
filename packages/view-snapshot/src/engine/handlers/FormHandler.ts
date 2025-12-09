/**
 * FormHandler
 *
 * Form 관련 Intent를 처리하는 핸들러
 * - setFieldValue
 * - submit
 * - reset
 */

import type { FormRuntime, FormRuntimeError } from '@manifesto-ai/engine'
import type { IntentHandler, HandlerContext } from '../../types/dispatcher'
import type { IntentResult, SetFieldValueIntent, SubmitFormIntent, ResetFormIntent } from '../../types/intents'

// ============================================================================
// Types
// ============================================================================

type FormIntent = SetFieldValueIntent | SubmitFormIntent | ResetFormIntent

// ============================================================================
// FormHandler
// ============================================================================

export class FormHandler implements IntentHandler<FormIntent> {
  readonly targets = ['setFieldValue', 'submit', 'reset'] as const

  async execute(intent: FormIntent, context: HandlerContext): Promise<IntentResult> {
    const { nodeRegistry } = context
    const nodeId = intent.nodeId
    const formNode = nodeRegistry.getFormNode(nodeId)

    if (!formNode) {
      return {
        success: false,
        errorType: 'NODE_NOT_FOUND',
        message: `Form node "${nodeId}" not found`,
      }
    }

    const { runtime } = formNode

    switch (intent.type) {
      case 'setFieldValue':
        return this.handleSetFieldValue(intent, runtime)

      case 'submit':
        return this.handleSubmit(runtime)

      case 'reset':
        return this.handleReset(runtime)
    }
  }

  private handleSetFieldValue(
    intent: SetFieldValueIntent,
    runtime: FormRuntime
  ): IntentResult {
    const result = runtime.dispatch({
      type: 'FIELD_CHANGE',
      fieldId: intent.fieldId,
      value: intent.value,
    })

    if (result._tag === 'Err') {
      return {
        success: false,
        errorType: 'RUNTIME_ERROR',
        message: this.formatFormError(result.error),
      }
    }

    return { success: true }
  }

  private handleSubmit(runtime: FormRuntime): IntentResult {
    const result = runtime.dispatch({ type: 'SUBMIT' })

    if (result._tag === 'Err') {
      return {
        success: false,
        errorType: 'RUNTIME_ERROR',
        message: this.formatFormError(result.error),
      }
    }

    return { success: true }
  }

  private handleReset(runtime: FormRuntime): IntentResult {
    const result = runtime.dispatch({ type: 'RESET' })

    if (result._tag === 'Err') {
      return {
        success: false,
        errorType: 'RUNTIME_ERROR',
        message: this.formatFormError(result.error),
      }
    }

    return { success: true }
  }

  private formatFormError(error: FormRuntimeError): string {
    if (error.type === 'VALIDATION_ERROR') {
      const errorMessages = Object.entries(error.errors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ')
      return `Validation errors: ${errorMessages}`
    }

    return error.message ?? `Form error: ${error.type}`
  }
}

/**
 * FormHandler 팩토리 함수
 */
export const createFormHandler = (): IntentHandler<FormIntent> => {
  return new FormHandler()
}
