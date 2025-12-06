/**
 * Common Types - AI Generator 공통 타입 정의
 */

import type { EntitySchema } from '@manifesto-ai/schema'

// ============================================================================
// Generator Context - 모든 Generator에 전달되는 컨텍스트
// ============================================================================

export interface GeneratorContext {
  readonly entity?: EntitySchema
  readonly industry?: IndustryContext
  readonly locale?: string
  readonly customPrompt?: string
}

export interface IndustryContext {
  readonly type: IndustryType
  readonly conventions?: readonly NamingConvention[]
  readonly requiredFields?: readonly string[]
  readonly terminology?: Record<string, string>
}

export type IndustryType = 'finance' | 'commerce' | 'healthcare' | 'saas' | 'logistics' | 'general'

export interface NamingConvention {
  readonly pattern: RegExp | string
  readonly replacement: string
  readonly description?: string
}

// ============================================================================
// Generation Result - Generator 출력 래퍼
// ============================================================================

export interface GenerationResult<T> {
  readonly value: T
  readonly metadata: GenerationMetadata
}

export interface GenerationMetadata {
  readonly model: string
  readonly provider: string
  readonly tokensUsed: TokenUsage
  readonly latencyMs: number
  readonly cached: boolean
  readonly finishReason?: FinishReason
}

export interface TokenUsage {
  readonly prompt: number
  readonly completion: number
  readonly total: number
}

export type FinishReason = 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'error'

// ============================================================================
// Generator Options - Generator 설정
// ============================================================================

export interface GeneratorOptions {
  readonly temperature?: number
  readonly maxTokens?: number
  readonly maxRetries?: number
  readonly timeout?: number
  readonly customPrompt?: string
  readonly validate?: boolean
}

export const DEFAULT_GENERATOR_OPTIONS: Required<GeneratorOptions> = {
  temperature: 0.3,
  maxTokens: 4096,
  maxRetries: 3,
  timeout: 30000,
  customPrompt: '',
  validate: true,
}

// ============================================================================
// View Plan Types (Planner Layer용 - 향후 확장)
// ============================================================================

export type ViewType = 'list' | 'form' | 'detail' | 'dashboard' | 'wizard'
export type ViewPurpose = 'search' | 'create' | 'edit' | 'view' | 'analytics' | 'overview'

export interface ViewPlan {
  readonly viewType: ViewType
  readonly purpose: ViewPurpose
  readonly entity: string
  readonly priority: number
  readonly config?: ViewPlanConfig
}

export interface ViewPlanConfig {
  readonly title?: string
  readonly description?: string
  readonly features?: readonly string[]
  readonly relations?: readonly string[]
}

// ============================================================================
// Sync Events (Sync Manager용 - 향후 확장)
// ============================================================================

export type SyncEvent =
  | FieldAddedEvent
  | FieldRemovedEvent
  | FieldRenamedEvent
  | TypeChangedEvent

export interface FieldAddedEvent {
  readonly type: 'field-added'
  readonly fieldId: string
  readonly field: unknown
}

export interface FieldRemovedEvent {
  readonly type: 'field-removed'
  readonly fieldId: string
}

export interface FieldRenamedEvent {
  readonly type: 'field-renamed'
  readonly oldId: string
  readonly newId: string
}

export interface TypeChangedEvent {
  readonly type: 'type-changed'
  readonly fieldId: string
  readonly oldType: string
  readonly newType: string
}
