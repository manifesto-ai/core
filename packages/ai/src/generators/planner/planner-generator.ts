/**
 * Planner Generator
 *
 * 자연어 요구사항을 ViewPlan[]으로 변환
 */

import { ok, isOk } from '@manifesto-ai/schema'
import { createGenerator, type Generator } from '../base'
import type { AIClient } from '../../core/client'
import type { GeneratorContext, IndustryType, AIGeneratorError } from '../../types'
import { schemaValidationError } from '../../types/errors'
import {
  GeneratedPlannerOutputSchema,
  type GeneratedPlannerOutput,
  type EntityInfo,
  type ViewPlan,
  type EntityRelation,
  validateViewPlanEntities,
  normalizeEntityName,
} from '../../core/schemas/view-plan.schema'
import { generateAllViewPlans, inferEntityRole } from './patterns'
import { buildSystemPrompt, buildUserPrompt } from './prompts'

// ============================================================================
// Input/Output Types
// ============================================================================

export interface PlannerGeneratorInput {
  readonly prompt: string
  readonly hints?: readonly string[]
  readonly excludeViewTypes?: readonly string[]
  readonly maxEntities?: number
  readonly maxViews?: number
}

export interface PlannerGeneratorOutput {
  readonly systemName: string
  readonly description: string
  readonly entities: readonly EntityInfo[]
  readonly viewPlans: readonly ViewPlan[]
  readonly entityRelations?: readonly EntityRelation[]
}

// ============================================================================
// Post-processing
// ============================================================================

/**
 * Entity 이름 정규화 및 역할 추론
 */
const normalizeEntities = (
  entities: readonly EntityInfo[],
  industry: string = 'general'
): EntityInfo[] => {
  return entities.map(entity => ({
    ...entity,
    name: normalizeEntityName(entity.name),
    role: entity.role ?? inferEntityRole(entity.name, industry),
  }))
}

/**
 * ViewPlan 필터링 (excludeViewTypes 적용)
 */
const filterViewPlans = (
  viewPlans: readonly ViewPlan[],
  excludeViewTypes?: readonly string[]
): ViewPlan[] => {
  if (!excludeViewTypes || excludeViewTypes.length === 0) {
    return [...viewPlans]
  }

  return viewPlans.filter(plan => !excludeViewTypes.includes(plan.viewType))
}

/**
 * Priority 재할당 (gaps 제거)
 */
const reassignPriorities = (viewPlans: ViewPlan[]): ViewPlan[] => {
  return viewPlans
    .sort((a, b) => a.priority - b.priority)
    .map((plan, index) => ({
      ...plan,
      priority: index + 1,
    }))
}

/**
 * ViewPlan 제한 적용
 */
const limitViewPlans = (
  viewPlans: ViewPlan[],
  maxViews: number
): ViewPlan[] => {
  return viewPlans.slice(0, maxViews)
}

// ============================================================================
// Validation
// ============================================================================

const validatePlannerOutput = (
  output: GeneratedPlannerOutput
): AIGeneratorError | null => {
  // Entity 참조 검증
  const entityValidation = validateViewPlanEntities(output.viewPlans, output.entities)
  if (!entityValidation.valid) {
    return schemaValidationError(
      ['viewPlans'],
      entityValidation.errors.join('; ')
    )
  }

  // Entity 이름 중복 확인
  const entityNames = new Set<string>()
  for (const entity of output.entities) {
    const normalized = normalizeEntityName(entity.name)
    if (entityNames.has(normalized)) {
      return schemaValidationError(
        ['entities'],
        `Duplicate entity name: ${normalized}`
      )
    }
    entityNames.add(normalized)
  }

  return null
}

// ============================================================================
// Planner Generator
// ============================================================================

export const plannerGenerator: Generator<PlannerGeneratorInput, PlannerGeneratorOutput> =
  createGenerator(
    'PlannerGenerator',
    async (input, context, client, options) => {
      const industry = context.industry?.type ?? 'general'
      const systemPrompt = buildSystemPrompt(industry)
      const userPrompt = buildUserPrompt({
        prompt: input.prompt,
        hints: input.hints,
        excludeViewTypes: input.excludeViewTypes,
        maxEntities: input.maxEntities,
        maxViews: input.maxViews,
      })

      const result = await client.generateObject({
        schema: GeneratedPlannerOutputSchema,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        schemaName: 'SystemPlan',
        schemaDescription: 'A system plan with entities and views',
      })

      if (!isOk(result)) {
        return result
      }

      const generated = result.value.value

      // Validation
      if (options.validate) {
        const validationError = validatePlannerOutput(generated)
        if (validationError) {
          return { _tag: 'Err', error: validationError }
        }
      }

      // Post-processing
      const normalizedEntities = normalizeEntities(generated.entities, industry)
      let processedViewPlans = filterViewPlans(generated.viewPlans, input.excludeViewTypes)
      processedViewPlans = limitViewPlans(processedViewPlans, input.maxViews ?? 20)
      processedViewPlans = reassignPriorities(processedViewPlans)

      return ok({
        value: {
          systemName: generated.systemName,
          description: generated.description,
          entities: normalizedEntities,
          viewPlans: processedViewPlans,
          entityRelations: generated.entityRelations,
        },
        metadata: result.value.metadata,
      })
    },
    {
      temperature: 0.4, // Slightly higher for creative planning
      maxTokens: 8192, // Larger output for complex plans
      validate: true,
    }
  )

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * 간단한 System Plan 생성 헬퍼
 *
 * @example
 * ```typescript
 * const result = await generatePlan(
 *   client,
 *   '온라인 쇼핑몰 관리 시스템',
 *   { industry: 'commerce' }
 * )
 *
 * if ('entities' in result) {
 *   console.log(result.entities)
 *   console.log(result.viewPlans)
 * }
 * ```
 */
export const generatePlan = async (
  client: AIClient,
  prompt: string,
  options?: {
    readonly industry?: IndustryType
    readonly hints?: readonly string[]
    readonly excludeViewTypes?: readonly string[]
    readonly maxEntities?: number
    readonly maxViews?: number
  }
): Promise<PlannerGeneratorOutput | AIGeneratorError> => {
  const context: GeneratorContext = options?.industry
    ? { industry: { type: options.industry } }
    : {}

  const result = await plannerGenerator.generate(
    {
      prompt,
      hints: options?.hints,
      excludeViewTypes: options?.excludeViewTypes,
      maxEntities: options?.maxEntities,
      maxViews: options?.maxViews,
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
 * Entity 정보만으로 ViewPlan 생성 (LLM 호출 없음)
 *
 * @example
 * ```typescript
 * const entities: EntityInfo[] = [
 *   { name: 'Customer', description: '고객', role: 'core' },
 *   { name: 'Order', description: '주문', role: 'transaction' },
 * ]
 *
 * const viewPlans = generateViewPlansFromEntities(entities, 'commerce')
 * ```
 */
export const generateViewPlansFromEntities = (
  entities: readonly EntityInfo[],
  industry: IndustryType = 'general'
): ViewPlan[] => {
  return generateAllViewPlans(entities, industry)
}

/**
 * Entity 역할 추론 헬퍼
 */
export { inferEntityRole } from './patterns'
