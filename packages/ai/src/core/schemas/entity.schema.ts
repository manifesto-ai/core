/**
 * Entity Schema - Zod schemas for Entity generation
 *
 * LLM이 생성할 EntitySchema의 구조를 Zod로 정의
 */

import { z } from 'zod'

// ============================================================================
// Field Constraint Schema
// ============================================================================

export const GeneratedConstraintSchema = z.object({
  type: z.enum(['required', 'min', 'max', 'pattern', 'custom']),
  value: z.unknown().optional(),
  message: z.string().optional().describe('User-friendly error message'),
})

export type GeneratedConstraint = z.infer<typeof GeneratedConstraintSchema>

// ============================================================================
// Enum Value Schema
// ============================================================================

export const GeneratedEnumValueSchema = z.object({
  value: z.string().describe('Internal value (code)'),
  label: z.string().describe('Display label'),
  description: z.string().optional(),
})

export type GeneratedEnumValue = z.infer<typeof GeneratedEnumValueSchema>

// ============================================================================
// Reference Config Schema
// ============================================================================

export const GeneratedReferenceConfigSchema = z.object({
  entity: z.string().describe('Target entity ID'),
  displayField: z.string().describe('Field to display (e.g., name)'),
  valueField: z.string().describe('Field for value (e.g., id)'),
})

export type GeneratedReferenceConfig = z.infer<typeof GeneratedReferenceConfigSchema>

// ============================================================================
// Entity Field Schema
// ============================================================================

export const GeneratedFieldSchema = z.object({
  id: z.string().describe('Unique field identifier in camelCase (e.g., customerName, productCode)'),
  dataType: z
    .enum(['string', 'number', 'boolean', 'date', 'datetime', 'enum', 'reference'])
    .describe('Field data type'),
  label: z.string().describe('Human-readable label (e.g., "Customer Name", "Product Code")'),
  description: z.string().optional().describe('Brief description of what this field represents'),
  required: z.boolean().default(false).describe('Whether this field is required'),
  constraints: z.array(GeneratedConstraintSchema).optional().describe('Validation constraints'),
  enumValues: z
    .array(GeneratedEnumValueSchema)
    .optional()
    .describe('Enum options (only for dataType: enum)'),
  reference: GeneratedReferenceConfigSchema.optional().describe(
    'Reference config (only for dataType: reference)'
  ),
  defaultValue: z.unknown().optional().describe('Default value for this field'),
})

export type GeneratedField = z.infer<typeof GeneratedFieldSchema>

// ============================================================================
// Relation Schema
// ============================================================================

export const GeneratedRelationSchema = z.object({
  type: z.enum(['hasOne', 'hasMany', 'belongsTo', 'manyToMany']),
  target: z.string().describe('Target entity ID'),
  foreignKey: z.string().optional().describe('Foreign key field name'),
  through: z.string().optional().describe('Join table name (for manyToMany)'),
})

export type GeneratedRelation = z.infer<typeof GeneratedRelationSchema>

// ============================================================================
// Full Entity Schema
// ============================================================================

export const GeneratedEntitySchema = z.object({
  id: z.string().describe('Entity identifier in kebab-case (e.g., customer, product-order)'),
  name: z.string().describe('Human-readable entity name (e.g., "Customer", "Product Order")'),
  description: z.string().optional().describe('Brief description of this entity'),
  fields: z
    .array(GeneratedFieldSchema)
    .min(1)
    .describe('Entity fields - at minimum include id and name fields'),
  relations: z
    .array(GeneratedRelationSchema)
    .optional()
    .describe('Relationships to other entities'),
  tags: z.array(z.string()).optional().describe('Tags for categorization'),
})

export type GeneratedEntity = z.infer<typeof GeneratedEntitySchema>

// ============================================================================
// Entity Generation Request Schema (for user input validation)
// ============================================================================

export const EntityGenerationRequestSchema = z.object({
  domainDescription: z
    .string()
    .min(10)
    .describe('Natural language description of the entity domain'),
  hints: z.array(z.string()).optional().describe('Additional hints for field generation'),
  industry: z
    .enum(['finance', 'commerce', 'healthcare', 'saas', 'logistics', 'general'])
    .optional()
    .describe('Industry context for naming conventions'),
  relatedEntities: z
    .array(z.string())
    .optional()
    .describe('Names of related entities for relation inference'),
})

export type EntityGenerationRequest = z.infer<typeof EntityGenerationRequestSchema>
