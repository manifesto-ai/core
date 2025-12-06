/**
 * Condition Generator
 *
 * 자연어 비즈니스 규칙을 Expression AST로 변환
 * Template-First 전략: 템플릿 매칭 시도 후 LLM fallback
 */

import type { Expression } from '@manifesto-ai/schema'
import { ok, err, isOk } from '@manifesto-ai/schema'
import { createGenerator, type Generator } from '../base'
import type { AIClient } from '../../core/client'
import type { GeneratorContext, AIGeneratorError } from '../../types'
import { schemaValidationError } from '../../types/errors'
import {
  GeneratedConditionSchema,
  type ConditionTarget,
  extractReferencedFields,
} from '../../core/schemas/condition.schema'
import { matchTemplate } from './templates'
import { validateForTarget } from './validator'
import { buildSystemPrompt, buildUserPrompt } from './prompts'

// ============================================================================
// Input/Output Types
// ============================================================================

export interface ConditionGeneratorInput {
  readonly naturalLanguageRule: string
  readonly target: ConditionTarget
  readonly entityId: string
  readonly availableFields: readonly string[]
  readonly hints?: readonly string[]
  readonly useTemplates?: boolean
}

export interface ConditionGeneratorOutput {
  readonly expression: Expression
  readonly source: 'template' | 'llm'
  readonly templateName?: string
  readonly referencedFields: readonly string[]
  readonly interpretation?: string
  readonly confidence?: number
}

// ============================================================================
// Template-First Logic
// ============================================================================

const tryTemplateMatch = (
  input: ConditionGeneratorInput
): ConditionGeneratorOutput | null => {
  if (input.useTemplates === false) {
    return null
  }

  const templateResult = matchTemplate(input.naturalLanguageRule, input.availableFields)

  if (!templateResult) {
    return null
  }

  // 필드 참조 검증
  for (const field of templateResult.referencedFields) {
    if (!input.availableFields.includes(field)) {
      return null // 잘못된 필드 참조시 템플릿 결과 폐기
    }
  }

  return {
    expression: templateResult.expression,
    source: 'template',
    templateName: templateResult.templateName,
    referencedFields: [...templateResult.referencedFields],
    confidence: templateResult.confidence,
  }
}

// ============================================================================
// LLM Fallback
// ============================================================================

const generateWithLLM = async (
  input: ConditionGeneratorInput,
  _context: GeneratorContext,
  client: AIClient,
  options: { temperature: number; maxTokens: number }
): Promise<{ output: ConditionGeneratorOutput; metadata: unknown } | AIGeneratorError> => {
  const systemPrompt = buildSystemPrompt(input.target)
  const userPrompt = buildUserPrompt({
    naturalLanguageRule: input.naturalLanguageRule,
    target: input.target,
    entityId: input.entityId,
    availableFields: input.availableFields,
    hints: input.hints,
  })

  const result = await client.generateObject({
    schema: GeneratedConditionSchema,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    schemaName: 'Condition',
    schemaDescription: 'A business rule expression AST',
  })

  if (!isOk(result)) {
    return result.error
  }

  const generated = result.value.value

  // Expression 검증
  const validationResult = validateForTarget(
    generated.expression,
    input.target,
    input.availableFields
  )

  if (!validationResult.valid) {
    return schemaValidationError(
      ['expression'],
      validationResult.errors.map(e => e.message).join('; ')
    )
  }

  const referencedFields = extractReferencedFields(generated.expression)

  return {
    output: {
      expression: generated.expression as Expression,
      source: 'llm',
      referencedFields,
      interpretation: generated.interpretation,
    },
    metadata: result.value.metadata,
  }
}

// ============================================================================
// Condition Generator
// ============================================================================

export const conditionGenerator: Generator<ConditionGeneratorInput, ConditionGeneratorOutput> =
  createGenerator(
    'ConditionGenerator',
    async (input, context, client, options) => {
      // Step 1: Template 매칭 시도
      const templateResult = tryTemplateMatch(input)

      if (templateResult) {
        // 템플릿 매칭 성공 - LLM 호출 없이 즉시 반환
        return ok({
          value: templateResult,
          metadata: {
            model: 'template',
            provider: 'local',
            tokensUsed: { prompt: 0, completion: 0, total: 0 },
            latencyMs: 0,
            cached: true,
          },
        })
      }

      // Step 2: LLM Fallback
      const llmResult = await generateWithLLM(input, context, client, {
        temperature: options.temperature ?? 0.2,
        maxTokens: options.maxTokens ?? 1024,
      })

      if ('_type' in llmResult || '_tag' in llmResult) {
        return err(llmResult as AIGeneratorError)
      }

      return ok({
        value: llmResult.output,
        metadata: llmResult.metadata as {
          model: string
          provider: string
          tokensUsed: { prompt: number; completion: number; total: number }
          latencyMs: number
          cached: boolean
        },
      })
    },
    {
      temperature: 0.2, // 낮은 temperature로 일관된 결과
      maxTokens: 1024,
      validate: true,
    }
  )

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * 간단한 Condition 생성 헬퍼
 *
 * @example
 * ```typescript
 * const result = await generateCondition(
 *   client,
 *   'VIP 고객이고 금액이 100만원 이상일 때',
 *   {
 *     target: 'visibility',
 *     entityId: 'customer',
 *     availableFields: ['status', 'grade', 'amount', 'name'],
 *   }
 * )
 *
 * if ('expression' in result) {
 *   console.log(result.expression) // ["AND", ["==", "$state.grade", "VIP"], [">=", "$state.amount", 1000000]]
 * }
 * ```
 */
export const generateCondition = async (
  client: AIClient,
  naturalLanguageRule: string,
  options: {
    readonly target: ConditionTarget
    readonly entityId: string
    readonly availableFields: readonly string[]
    readonly hints?: readonly string[]
    readonly useTemplates?: boolean
  },
  context: GeneratorContext = {}
): Promise<ConditionGeneratorOutput | AIGeneratorError> => {
  const result = await conditionGenerator.generate(
    {
      naturalLanguageRule,
      target: options.target,
      entityId: options.entityId,
      availableFields: options.availableFields,
      hints: options.hints,
      useTemplates: options.useTemplates ?? true,
    },
    context,
    client
  )

  if (isOk(result)) {
    return result.value.value
  }

  return result.error
}

/**
 * 템플릿만 사용하여 Condition 생성 (LLM 호출 없음)
 *
 * @example
 * ```typescript
 * const result = tryGenerateFromTemplate(
 *   'VIP 고객만 보임',
 *   ['status', 'grade', 'name']
 * )
 *
 * if (result) {
 *   console.log(result.expression) // ["==", "$state.grade", "VIP"]
 * }
 * ```
 */
export const tryGenerateFromTemplate = (
  naturalLanguageRule: string,
  availableFields: readonly string[]
): ConditionGeneratorOutput | null => {
  const templateResult = matchTemplate(naturalLanguageRule, availableFields)

  if (!templateResult) {
    return null
  }

  return {
    expression: templateResult.expression,
    source: 'template',
    templateName: templateResult.templateName,
    referencedFields: [...templateResult.referencedFields],
    confidence: templateResult.confidence,
  }
}
