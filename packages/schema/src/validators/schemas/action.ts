/**
 * Action Layer Zod Schemas
 *
 * 데이터 흐름을 정의하는 Action 레이어의 Zod 스키마
 * 타입은 z.infer<>로 도출
 */

import { z } from 'zod'
import { schemaMetadataSchema } from './common'
import { expressionSchema } from './expression'

// ============================================================================
// Action Trigger
// ============================================================================

export const actionTriggerTypeSchema = z.enum(['manual', 'event', 'schedule'])

export type ActionTriggerType = z.infer<typeof actionTriggerTypeSchema>

export const actionTriggerSchema = z.object({
  type: actionTriggerTypeSchema,
  event: z.string().optional(),
  cron: z.string().optional(),
})

export type ActionTrigger = z.infer<typeof actionTriggerSchema>

// ============================================================================
// Transform Step
// ============================================================================

export const transformOperationSchema = z.enum([
  'map',
  'filter',
  'reduce',
  'pick',
  'omit',
  'rename',
  'custom',
])

export type TransformOperation = z.infer<typeof transformOperationSchema>

export const transformStepSchema = z.object({
  _step: z.literal('transform'),
  id: z.string(),
  operation: transformOperationSchema,
  config: z.record(z.unknown()),
  outputKey: z.string().optional(),
})

export type TransformStep = z.infer<typeof transformStepSchema>

export const transformPipelineSchema = z.object({
  steps: z.array(transformStepSchema),
})

export type TransformPipeline = z.infer<typeof transformPipelineSchema>

// ============================================================================
// Adapter Config
// ============================================================================

export const adapterTypeSchema = z.enum(['legacy', 'graphql', 'soap', 'rest'])

export type AdapterType = z.infer<typeof adapterTypeSchema>

export const adapterConfigSchema = z.object({
  type: adapterTypeSchema,
  requestTransform: transformPipelineSchema.optional(),
  responseTransform: transformPipelineSchema.optional(),
})

export type AdapterConfig = z.infer<typeof adapterConfigSchema>

// ============================================================================
// HTTP Method
// ============================================================================

export const httpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])

export type HttpMethod = z.infer<typeof httpMethodSchema>

// ============================================================================
// API Call Step
// ============================================================================

export const apiCallStepSchema = z.object({
  _step: z.literal('apiCall'),
  id: z.string(),
  endpoint: z.string(),
  method: httpMethodSchema,
  headers: z.record(z.union([z.string(), expressionSchema])).optional(),
  body: z.union([z.record(z.unknown()), expressionSchema]).optional(),
  adapter: adapterConfigSchema.optional(),
  outputKey: z.string().optional(),
  timeout: z.number().optional(),
  retries: z.number().optional(),
})

export type ApiCallStep = z.infer<typeof apiCallStepSchema>

// ============================================================================
// Set State Step
// ============================================================================

export const setStateStepSchema = z.object({
  _step: z.literal('setState'),
  id: z.string(),
  updates: z.record(z.unknown()),
})

export type SetStateStep = z.infer<typeof setStateStepSchema>

// ============================================================================
// Navigation Step
// ============================================================================

export const navigationStepSchema = z.object({
  _step: z.literal('navigation'),
  id: z.string(),
  path: z.string(),
  params: z.record(z.unknown()).optional(),
  replace: z.boolean().optional(),
})

export type NavigationStep = z.infer<typeof navigationStepSchema>

// ============================================================================
// Action Step (Recursive Discriminated Union)
// ============================================================================

export const actionStepSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion('_step', [
    apiCallStepSchema,
    transformStepSchema,
    setStateStepSchema,
    navigationStepSchema,
    z.object({
      _step: z.literal('condition'),
      id: z.string(),
      condition: expressionSchema,
      then: z.array(actionStepSchema),
      else: z.array(actionStepSchema).optional(),
    }),
    z.object({
      _step: z.literal('parallel'),
      id: z.string(),
      steps: z.array(actionStepSchema),
      mode: z.enum(['all', 'race', 'allSettled']).optional(),
    }),
  ])
)

// ActionStep 타입은 재귀적이므로 명시적 정의
export type ActionStep =
  | ApiCallStep
  | TransformStep
  | SetStateStep
  | NavigationStep
  | ConditionStep
  | ParallelStep

export interface ConditionStep {
  readonly _step: 'condition'
  readonly id: string
  readonly condition: unknown // Expression
  readonly then: readonly ActionStep[]
  readonly else?: readonly ActionStep[]
}

export interface ParallelStep {
  readonly _step: 'parallel'
  readonly id: string
  readonly steps: readonly ActionStep[]
  readonly mode?: 'all' | 'race' | 'allSettled'
}

// ============================================================================
// Action Schema
// ============================================================================

export const actionSchemaValidator = schemaMetadataSchema.extend({
  _type: z.literal('action'),
  trigger: actionTriggerSchema,
  steps: z.array(actionStepSchema),
  rollback: z.array(actionStepSchema).optional(),
  timeout: z.number().optional(),
  retries: z.number().optional(),
})

export type ActionSchema = z.infer<typeof actionSchemaValidator>
