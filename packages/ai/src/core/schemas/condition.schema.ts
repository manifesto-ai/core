/**
 * Condition Schema - Zod schemas for Condition generation
 *
 * 자연어 비즈니스 규칙을 Expression AST로 변환하기 위한 스키마 정의
 */

import { z } from 'zod'

// ============================================================================
// Context Reference Schema
// ============================================================================

/**
 * Context Reference 패턴
 * $state.fieldId, $context.key, $user.property 등
 */
export const ContextReferencePrefixes = ['$state', '$context', '$user', '$params', '$result', '$env'] as const

export type ContextReferencePrefix = typeof ContextReferencePrefixes[number]

export const ContextReferenceSchema = z
  .string()
  .regex(/^\$(state|context|user|params|result|env)\.[a-zA-Z_][a-zA-Z0-9_]*$/)
  .describe('Context reference (e.g., $state.fieldId, $user.role)')

// ============================================================================
// Operator Schemas
// ============================================================================

/**
 * 비교 연산자
 */
export const ComparisonOperatorSchema = z.enum(['==', '!=', '>', '>=', '<', '<='])
export type ComparisonOperator = z.infer<typeof ComparisonOperatorSchema>

/**
 * 논리 연산자
 */
export const LogicalOperatorSchema = z.enum(['AND', 'OR', 'NOT'])
export type LogicalOperator = z.infer<typeof LogicalOperatorSchema>

/**
 * 컬렉션 연산자
 */
export const CollectionOperatorSchema = z.enum(['IN', 'NOT_IN', 'CONTAINS', 'IS_EMPTY', 'LENGTH'])
export type CollectionOperator = z.infer<typeof CollectionOperatorSchema>

/**
 * 타입 체크 연산자
 */
export const TypeOperatorSchema = z.enum(['IS_NULL', 'IS_NOT_NULL'])
export type TypeOperator = z.infer<typeof TypeOperatorSchema>

/**
 * Condition에서 주로 사용되는 연산자 (전체 연산자 중 서브셋)
 */
export const ConditionOperatorSchema = z.union([
  ComparisonOperatorSchema,
  LogicalOperatorSchema,
  CollectionOperatorSchema,
  TypeOperatorSchema,
])
export type ConditionOperator = z.infer<typeof ConditionOperatorSchema>

// ============================================================================
// Literal Schema
// ============================================================================

export const LiteralSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
])
export type Literal = z.infer<typeof LiteralSchema>

// ============================================================================
// Expression Schema (Recursive)
// ============================================================================

/**
 * Expression AST를 위한 기본 스키마
 *
 * Mapbox Expression 스타일:
 * - Literal: string | number | boolean | null
 * - ContextReference: "$state.fieldId"
 * - OperatorExpression: ["==", "$state.status", "VIP"]
 */
export const ExpressionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    // Literal values
    LiteralSchema,
    // Context reference (validated as string with pattern)
    ContextReferenceSchema,
    // Operator expression [operator, ...operands]
    z.tuple([ConditionOperatorSchema]).rest(z.lazy(() => ExpressionSchema)),
    // Array of expressions (for IN operator)
    z.array(z.lazy(() => ExpressionSchema)),
  ])
)

// ============================================================================
// Condition Target Schema
// ============================================================================

/**
 * Condition 적용 대상
 */
export const ConditionTargetSchema = z.enum([
  'visibility',   // 필드/버튼 표시 조건
  'disabled',     // 비활성화 조건
  'validation',   // 유효성 검사
  'reaction',     // 필드 간 반응
])
export type ConditionTarget = z.infer<typeof ConditionTargetSchema>

// ============================================================================
// Generated Condition Schema (LLM Output)
// ============================================================================

/**
 * LLM이 생성하는 Condition 결과물
 */
export const GeneratedConditionSchema = z.object({
  expression: ExpressionSchema.describe(
    'Mapbox-style expression AST (e.g., ["==", "$state.status", "VIP"])'
  ),
  referencedFields: z
    .array(z.string())
    .describe('List of field IDs referenced in the expression'),
  interpretation: z
    .string()
    .optional()
    .describe('Natural language explanation of the condition'),
})

export type GeneratedCondition = z.infer<typeof GeneratedConditionSchema>

// ============================================================================
// Condition Generation Request Schema
// ============================================================================

/**
 * Condition 생성 요청 입력
 */
export const ConditionGenerationRequestSchema = z.object({
  naturalLanguageRule: z
    .string()
    .min(2)
    .describe('Natural language business rule (e.g., "VIP 고객만 보임")'),
  target: ConditionTargetSchema.describe('Where this condition will be applied'),
  entityId: z.string().describe('Entity ID for field reference validation'),
  availableFields: z
    .array(z.string())
    .describe('List of available field IDs in the entity'),
  hints: z
    .array(z.string())
    .optional()
    .describe('Additional hints for condition generation'),
  useTemplates: z
    .boolean()
    .default(true)
    .describe('Whether to try template matching first'),
})

export type ConditionGenerationRequest = z.infer<typeof ConditionGenerationRequestSchema>

// ============================================================================
// Condition Generation Result Schema
// ============================================================================

/**
 * Condition 생성 결과
 */
export const ConditionGenerationResultSchema = z.object({
  expression: ExpressionSchema,
  source: z.enum(['template', 'llm']).describe('How the condition was generated'),
  templateName: z.string().optional().describe('Template name if source is template'),
  referencedFields: z.array(z.string()),
  interpretation: z.string().optional(),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Confidence score (0-1) for LLM-generated conditions'),
})

export type ConditionGenerationResult = z.infer<typeof ConditionGenerationResultSchema>

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Expression이 유효한 Context Reference인지 확인
 */
export const isValidContextReference = (value: string): boolean => {
  return ContextReferenceSchema.safeParse(value).success
}

/**
 * Expression이 유효한 Condition Operator인지 확인
 */
export const isValidConditionOperator = (op: string): boolean => {
  return ConditionOperatorSchema.safeParse(op).success
}

/**
 * Expression에서 참조된 필드 ID 추출
 */
export const extractReferencedFields = (expr: unknown): string[] => {
  const fields: string[] = []

  const traverse = (node: unknown): void => {
    if (typeof node === 'string' && node.startsWith('$state.')) {
      const fieldId = node.slice('$state.'.length)
      if (!fields.includes(fieldId)) {
        fields.push(fieldId)
      }
    } else if (Array.isArray(node)) {
      for (const child of node) {
        traverse(child)
      }
    }
  }

  traverse(expr)
  return fields
}
