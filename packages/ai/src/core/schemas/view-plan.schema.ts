/**
 * View Plan Schema - Zod schemas for Planner Layer
 *
 * 자연어 요구사항을 ViewPlan[]으로 변환하기 위한 스키마 정의
 */

import { z } from 'zod'

// ============================================================================
// View Type & Purpose Schemas
// ============================================================================

export const ViewTypeSchema = z.enum(['list', 'form', 'detail', 'dashboard', 'wizard'])
export type ViewType = z.infer<typeof ViewTypeSchema>

export const ViewPurposeSchema = z.enum(['search', 'create', 'edit', 'view', 'analytics', 'overview'])
export type ViewPurpose = z.infer<typeof ViewPurposeSchema>

// ============================================================================
// Entity Role Schema
// ============================================================================

/**
 * Entity 역할 - CRUD 패턴 결정에 사용
 */
export const EntityRoleSchema = z.enum([
  'core',         // 핵심 엔티티 (Customer, Product) - full CRUD
  'master',       // 마스터 데이터 (Category, Status) - list + form
  'transaction',  // 트랜잭션 (Order, Payment) - list + wizard + detail
  'analytics',    // 분석용 (Report, Dashboard) - dashboard + list
  'config',       // 설정 (Settings, Config) - form only
])
export type EntityRole = z.infer<typeof EntityRoleSchema>

// ============================================================================
// Entity Info Schema
// ============================================================================

export const EntityInfoSchema = z.object({
  name: z.string().describe('Entity name in PascalCase (e.g., "Customer", "ProductOrder")'),
  description: z.string().describe('Brief description of this entity'),
  role: EntityRoleSchema.default('core').describe('Entity role for view pattern inference'),
  suggestedFields: z
    .array(z.string())
    .optional()
    .describe('Suggested field names for this entity'),
})

export type EntityInfo = z.infer<typeof EntityInfoSchema>

// ============================================================================
// Entity Relation Schema
// ============================================================================

export const EntityRelationSchema = z.object({
  from: z.string().describe('Source entity name'),
  to: z.string().describe('Target entity name'),
  type: z.enum(['oneToOne', 'oneToMany', 'manyToMany']),
  description: z.string().optional(),
})

export type EntityRelation = z.infer<typeof EntityRelationSchema>

// ============================================================================
// View Plan Config Schema
// ============================================================================

export const ViewPlanConfigSchema = z.object({
  title: z.string().optional().describe('View title'),
  description: z.string().optional().describe('View description'),
  features: z.array(z.string()).optional().describe('Specific features for this view'),
  relations: z.array(z.string()).optional().describe('Related entities to include'),
})

export type ViewPlanConfig = z.infer<typeof ViewPlanConfigSchema>

// ============================================================================
// View Plan Schema
// ============================================================================

export const ViewPlanSchema = z.object({
  viewType: ViewTypeSchema,
  purpose: ViewPurposeSchema,
  entity: z.string().describe('Target entity name'),
  priority: z.number().int().min(1).describe('View priority (1 = highest)'),
  config: ViewPlanConfigSchema.optional(),
})

export type ViewPlan = z.infer<typeof ViewPlanSchema>

// ============================================================================
// Generated Planner Output Schema
// ============================================================================

export const GeneratedPlannerOutputSchema = z.object({
  systemName: z.string().describe('System name (e.g., "고객 관리 시스템")'),
  description: z.string().describe('System description'),
  entities: z
    .array(EntityInfoSchema)
    .min(1)
    .max(10)
    .describe('Entities identified from requirements'),
  viewPlans: z
    .array(ViewPlanSchema)
    .min(1)
    .max(30)
    .describe('View plans for the system'),
  entityRelations: z
    .array(EntityRelationSchema)
    .optional()
    .describe('Relationships between entities'),
})

export type GeneratedPlannerOutput = z.infer<typeof GeneratedPlannerOutputSchema>

// ============================================================================
// Planner Request Schema
// ============================================================================

export const PlannerRequestSchema = z.object({
  prompt: z.string().min(5).describe('Natural language system requirements'),
  hints: z.array(z.string()).optional().describe('Additional hints'),
  excludeViewTypes: z.array(ViewTypeSchema).optional().describe('View types to exclude'),
  maxEntities: z.number().int().min(1).max(20).default(10),
  maxViews: z.number().int().min(1).max(50).default(20),
  industry: z
    .enum(['finance', 'commerce', 'healthcare', 'saas', 'logistics', 'general'])
    .optional()
    .describe('Industry context'),
})

export type PlannerRequest = z.infer<typeof PlannerRequestSchema>

// ============================================================================
// CRUD Pattern Mapping
// ============================================================================

/**
 * Entity Role → 기본 View 조합 매핑
 */
export const CRUD_PATTERNS: Record<EntityRole, readonly { viewType: ViewType; purpose: ViewPurpose }[]> = {
  core: [
    { viewType: 'list', purpose: 'search' },
    { viewType: 'form', purpose: 'create' },
    { viewType: 'form', purpose: 'edit' },
    { viewType: 'detail', purpose: 'view' },
  ],
  master: [
    { viewType: 'list', purpose: 'search' },
    { viewType: 'form', purpose: 'create' },
    { viewType: 'form', purpose: 'edit' },
  ],
  transaction: [
    { viewType: 'list', purpose: 'search' },
    { viewType: 'wizard', purpose: 'create' },
    { viewType: 'detail', purpose: 'view' },
  ],
  analytics: [
    { viewType: 'dashboard', purpose: 'overview' },
    { viewType: 'list', purpose: 'analytics' },
  ],
  config: [
    { viewType: 'form', purpose: 'edit' },
  ],
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * ViewPlan이 유효한 Entity를 참조하는지 확인
 */
export const validateViewPlanEntities = (
  viewPlans: readonly ViewPlan[],
  entities: readonly EntityInfo[]
): { valid: boolean; errors: readonly string[] } => {
  const entityNames = new Set(entities.map(e => e.name))
  const errors: string[] = []

  for (const plan of viewPlans) {
    if (!entityNames.has(plan.entity)) {
      errors.push(`ViewPlan references unknown entity: "${plan.entity}"`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Priority 중복 확인
 */
export const validatePriorities = (
  viewPlans: readonly ViewPlan[]
): { valid: boolean; warnings: readonly string[] } => {
  const priorities = new Map<number, string[]>()
  const warnings: string[] = []

  for (const plan of viewPlans) {
    const key = plan.priority
    if (!priorities.has(key)) {
      priorities.set(key, [])
    }
    priorities.get(key)!.push(`${plan.entity}/${plan.viewType}/${plan.purpose}`)
  }

  for (const [priority, plans] of priorities) {
    if (plans.length > 1) {
      warnings.push(`Multiple views with priority ${priority}: ${plans.join(', ')}`)
    }
  }

  return {
    valid: true, // Duplicates are warnings, not errors
    warnings,
  }
}

/**
 * Entity 이름 정규화 (PascalCase, 단수형)
 */
export const normalizeEntityName = (name: string): string => {
  // Remove common suffixes
  let normalized = name
    .replace(/List$|s$/i, '')
    .replace(/Data$/i, '')
    .trim()

  // Convert to PascalCase
  normalized = normalized
    .split(/[\s_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')

  return normalized
}
