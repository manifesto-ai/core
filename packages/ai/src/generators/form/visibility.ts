/**
 * Form Visibility Generator
 *
 * Entity 필드 관계를 분석하여 visibility 조건을 자동 생성
 * ConditionGenerator를 활용한 자연어 → Expression 변환 지원
 */

import type { EntitySchema, EntityField, Expression, Reaction } from '@manifesto-ai/schema'
import type { AIClient } from '../../core/client'
import type { GeneratorContext } from '../../types'
import { tryGenerateFromTemplate, generateCondition } from '../condition'

// ============================================================================
// Types
// ============================================================================

export interface VisibilityHint {
  readonly fieldId: string
  readonly rule: string // 자연어 규칙: "VIP 고객일 때만 보임"
}

export interface VisibilityConfig {
  readonly hints?: readonly VisibilityHint[]
  readonly inferFromDependencies?: boolean // 기본: true
  readonly useLLM?: boolean // 템플릿 실패시 LLM 사용 여부, 기본: true
}

export interface FieldVisibility {
  readonly fieldId: string
  readonly targetFieldId: string // 이 필드가 hidden될 대상
  readonly expression: Expression
  readonly source: 'template' | 'llm' | 'inferred'
  readonly rule?: string
}

// ============================================================================
// Dependency-based Visibility Inference
// ============================================================================

/**
 * Entity 필드의 enum 값을 기반으로 visibility 규칙 추론
 *
 * 예: customerType 필드가 'business'일 때 businessName 필드 표시
 */
const inferVisibilityFromEnumField = (
  sourceField: EntityField,
  targetField: EntityField,
  _entity: EntitySchema
): Expression | null => {
  // 타겟 필드 이름이 소스 필드의 enum 값과 관련된 경우
  if (!sourceField.enumValues || sourceField.enumValues.length === 0) {
    return null
  }

  const targetLower = targetField.id.toLowerCase()
  const sourceLower = sourceField.id.toLowerCase()

  // 패턴: sourceField가 enum이고, targetField가 특정 enum 값과 관련된 이름인 경우
  // 예: userType: ['personal', 'business'], targetField: 'businessDetails'
  for (const enumVal of sourceField.enumValues) {
    const enumValueStr = String(enumVal.value).toLowerCase()
    const enumLabelLower = enumVal.label.toLowerCase()

    if (targetLower.includes(enumValueStr) || targetLower.includes(enumLabelLower)) {
      // businessDetails는 userType === 'business'일 때 보임
      return ['==', `$state.${sourceField.id}`, enumVal.value] as Expression
    }
  }

  // 패턴: targetField 이름이 source 이름을 포함하는 경우
  // 예: hasDelivery(boolean) -> deliveryAddress
  if (sourceField.dataType === 'boolean') {
    const sourceBaseName = sourceLower.replace(/^(has|is|enable|show|use)/, '')
    if (targetLower.includes(sourceBaseName)) {
      return ['==', `$state.${sourceField.id}`, true] as Expression
    }
  }

  return null
}

/**
 * Boolean 필드를 기반으로 visibility 규칙 추론
 *
 * 예: sameAsShipping(boolean) → billingAddress 숨김
 */
const inferVisibilityFromBooleanField = (
  sourceField: EntityField,
  targetField: EntityField,
  _entity: EntitySchema
): Expression | null => {
  if (sourceField.dataType !== 'boolean') {
    return null
  }

  const sourceLower = sourceField.id.toLowerCase()
  const targetLower = targetField.id.toLowerCase()

  // 패턴: sameAsX → X 관련 필드 숨김
  const sameAsMatch = sourceLower.match(/^sameas(.+)$/)
  if (sameAsMatch && sameAsMatch[1]) {
    const relatedName = sameAsMatch[1]
    // sameAsShipping이 true면 billingAddress 숨김
    if (targetLower.includes('billing') && relatedName.includes('shipping')) {
      return ['==', `$state.${sourceField.id}`, false] as Expression
    }
    // 일반적인 경우: sameAsX가 true면 X 관련 필드 숨김
    if (targetLower.includes(relatedName)) {
      return ['==', `$state.${sourceField.id}`, false] as Expression
    }
  }

  // 패턴: hasX/enableX/showX → X 관련 필드
  const prefixMatch = sourceLower.match(/^(has|enable|show|use)(.+)$/)
  if (prefixMatch && prefixMatch[2]) {
    const featureName = prefixMatch[2]
    if (targetLower.includes(featureName)) {
      return ['==', `$state.${sourceField.id}`, true] as Expression
    }
  }

  return null
}

/**
 * Reference 필드를 기반으로 visibility 규칙 추론
 *
 * 예: parentCategory 선택 시 subCategory 표시
 */
const inferVisibilityFromReferenceField = (
  sourceField: EntityField,
  targetField: EntityField,
  _entity: EntitySchema
): Expression | null => {
  if (sourceField.dataType !== 'reference') {
    return null
  }

  const sourceLower = sourceField.id.toLowerCase()
  const targetLower = targetField.id.toLowerCase()

  // 패턴: parent → child 관계
  if (sourceLower.includes('parent') && targetLower.includes('sub')) {
    return ['!=', `$state.${sourceField.id}`, null] as Expression
  }
  if (sourceLower.includes('parent') && targetLower.includes('child')) {
    return ['!=', `$state.${sourceField.id}`, null] as Expression
  }

  // 패턴: category → subcategory
  if (sourceLower.includes('category') && targetLower.includes('subcategory')) {
    return ['!=', `$state.${sourceField.id}`, null] as Expression
  }

  return null
}

/**
 * Entity의 모든 필드 관계를 분석하여 visibility 규칙 추론
 */
export const inferVisibilityRules = (entity: EntitySchema): FieldVisibility[] => {
  const rules: FieldVisibility[] = []

  for (const sourceField of entity.fields) {
    for (const targetField of entity.fields) {
      // 자기 자신은 제외
      if (sourceField.id === targetField.id) {
        continue
      }

      // 각 추론 함수 시도
      let expression: Expression | null = null

      expression = inferVisibilityFromBooleanField(sourceField, targetField, entity)
      if (!expression) {
        expression = inferVisibilityFromEnumField(sourceField, targetField, entity)
      }
      if (!expression) {
        expression = inferVisibilityFromReferenceField(sourceField, targetField, entity)
      }

      if (expression) {
        rules.push({
          fieldId: sourceField.id,
          targetFieldId: targetField.id,
          expression,
          source: 'inferred',
        })
      }
    }
  }

  return rules
}

// ============================================================================
// Hint-based Visibility Generation
// ============================================================================

/**
 * 자연어 힌트에서 visibility 규칙 생성
 * Template-First 전략: 템플릿 매칭 시도 후 LLM fallback
 */
export const generateVisibilityFromHints = async (
  hints: readonly VisibilityHint[],
  entity: EntitySchema,
  client: AIClient | null,
  config: VisibilityConfig = {}
): Promise<FieldVisibility[]> => {
  const rules: FieldVisibility[] = []
  const availableFields = entity.fields.map((f) => f.id)

  for (const hint of hints) {
    // Step 1: Template 매칭 시도 (LLM 호출 없음)
    const templateResult = tryGenerateFromTemplate(hint.rule, availableFields)

    if (templateResult) {
      rules.push({
        fieldId: templateResult.referencedFields[0] ?? 'unknown',
        targetFieldId: hint.fieldId,
        expression: templateResult.expression,
        source: 'template',
        rule: hint.rule,
      })
      continue
    }

    // Step 2: LLM Fallback (client가 있고 useLLM이 true인 경우)
    if (client && config.useLLM !== false) {
      const llmResult = await generateCondition(client, hint.rule, {
        target: 'visibility',
        entityId: entity.id,
        availableFields,
      })

      if ('expression' in llmResult) {
        rules.push({
          fieldId: llmResult.referencedFields[0] ?? 'unknown',
          targetFieldId: hint.fieldId,
          expression: llmResult.expression,
          source: 'llm',
          rule: hint.rule,
        })
      }
    }
  }

  return rules
}

// ============================================================================
// Reaction Builder
// ============================================================================

/**
 * FieldVisibility를 Reaction으로 변환
 */
export const visibilityToReaction = (visibility: FieldVisibility): Reaction => {
  return {
    trigger: 'change',
    actions: [
      {
        type: 'updateProp',
        target: visibility.targetFieldId,
        prop: 'hidden',
        // hidden = NOT(visibility condition)
        // visibility.expression이 true면 보이므로, false일 때 hidden
        value: ['NOT', visibility.expression] as Expression,
      },
    ],
  }
}

/**
 * 여러 FieldVisibility를 그룹화하여 Reaction 배열 생성
 * 같은 소스 필드에서 여러 타겟을 제어하는 경우 하나의 Reaction으로 합침
 */
export const buildVisibilityReactions = (
  visibilities: readonly FieldVisibility[]
): Map<string, Reaction[]> => {
  const reactionsBySourceField = new Map<string, Reaction[]>()

  for (const vis of visibilities) {
    const reaction = visibilityToReaction(vis)
    const existing = reactionsBySourceField.get(vis.fieldId) ?? []
    existing.push(reaction)
    reactionsBySourceField.set(vis.fieldId, existing)
  }

  return reactionsBySourceField
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Entity에 대한 visibility 규칙을 종합적으로 생성
 *
 * 1. hints가 있으면 자연어 규칙에서 생성 (Template → LLM)
 * 2. inferFromDependencies가 true면 필드 관계에서 추론
 * 3. 모든 규칙을 Reaction Map으로 반환
 *
 * @example
 * ```typescript
 * const reactions = await generateFormVisibility(entity, {
 *   hints: [
 *     { fieldId: 'billingAddress', rule: '배송지와 동일 체크 해제시 표시' },
 *     { fieldId: 'businessName', rule: '사업자 유형일 때만 표시' }
 *   ],
 *   inferFromDependencies: true
 * }, client)
 *
 * // reactions는 Map<fieldId, Reaction[]>
 * // FormViewSchema의 각 field에 reactions 추가
 * ```
 */
export const generateFormVisibility = async (
  entity: EntitySchema,
  config: VisibilityConfig = {},
  client: AIClient | null = null,
  _context: GeneratorContext = {}
): Promise<Map<string, Reaction[]>> => {
  const allVisibilities: FieldVisibility[] = []

  // 1. Hint-based generation
  if (config.hints && config.hints.length > 0) {
    const hintRules = await generateVisibilityFromHints(config.hints, entity, client, config)
    allVisibilities.push(...hintRules)
  }

  // 2. Dependency-based inference
  if (config.inferFromDependencies !== false) {
    const inferredRules = inferVisibilityRules(entity)
    // 이미 hint로 생성된 타겟은 제외
    const hintTargets = new Set(config.hints?.map((h) => h.fieldId) ?? [])
    const filteredInferred = inferredRules.filter(
      (r) => !hintTargets.has(r.targetFieldId)
    )
    allVisibilities.push(...filteredInferred)
  }

  return buildVisibilityReactions(allVisibilities)
}
