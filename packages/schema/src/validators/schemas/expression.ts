/**
 * Expression Zod Schemas
 *
 * Mapbox 스타일 표현식 시스템의 Zod 스키마
 * ALLOWED_OPERATORS는 types/expression.ts에서 가져옴
 */

import { z } from 'zod'
import { ALLOWED_OPERATORS } from '../../types/expression'

// ============================================================================
// Operator Schema
// ============================================================================

export const operatorSchema = z.enum(ALLOWED_OPERATORS as unknown as [string, ...string[]])

// ============================================================================
// Literal Values
// ============================================================================

export const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

export type Literal = z.infer<typeof literalSchema>

// ============================================================================
// Context References
// ============================================================================

export const contextReferenceSchema = z
  .string()
  .refine((val) => val.startsWith('$'), 'Context reference must start with $')

export type ContextReference = z.infer<typeof contextReferenceSchema>

// ============================================================================
// Expression (Recursive)
// ============================================================================

/**
 * 재귀적 표현식 스키마
 * - 리터럴 값
 * - 컨텍스트 참조 ($state.xxx, $context.xxx 등)
 * - 연산자 표현식 [operator, ...args]
 */
export const expressionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    literalSchema,
    contextReferenceSchema,
    z.tuple([operatorSchema]).rest(z.lazy(() => expressionSchema)),
  ])
)

// Expression 타입은 재귀적이므로 별도 정의 필요
// types/expression.ts의 Expression 타입을 사용
