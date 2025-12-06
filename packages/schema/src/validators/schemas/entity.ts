/**
 * Entity Layer Zod Schemas
 *
 * 데이터 구조를 정의하는 Entity 레이어의 Zod 스키마
 * 타입은 z.infer<>로 도출
 */

import { z } from 'zod'
import { schemaMetadataSchema } from './common'
import { expressionSchema } from './expression'

// ============================================================================
// Data Type
// ============================================================================

export const dataTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'date',
  'datetime',
  'array',
  'object',
  'enum',
  'reference',
  // Extended types
  'uuid',
  'email',
  'url',
  'phone',
  'text', // Long text
  'json',
  'money',
])

export type DataType = z.infer<typeof dataTypeSchema>

// ============================================================================
// Constraint
// ============================================================================

export const constraintTypeSchema = z.enum([
  'required',
  'min',
  'max',
  'minLength',
  'maxLength',
  'pattern',
  'email',
  'url',
  'custom',
])

export type ConstraintType = z.infer<typeof constraintTypeSchema>

export const constraintSchema = z.object({
  type: constraintTypeSchema,
  value: z.unknown().optional(),
  message: z.string().optional(),
  expression: expressionSchema.optional(),
})

export type Constraint = z.infer<typeof constraintSchema>

// ============================================================================
// Enum Value
// ============================================================================

export const enumValueSchema = z.object({
  value: z.union([z.string(), z.number()]),
  label: z.string(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
})

export type EnumValue = z.infer<typeof enumValueSchema>

// ============================================================================
// Reference Config
// ============================================================================

export const cascadeTypeSchema = z.enum(['none', 'delete', 'nullify', 'restrict'])

export type CascadeType = z.infer<typeof cascadeTypeSchema>

export const referenceConfigSchema = z.object({
  entity: z.string(),
  displayField: z.string(),
  valueField: z.string(),
  cascade: cascadeTypeSchema.optional(),
})

export type ReferenceConfig = z.infer<typeof referenceConfigSchema>

// ============================================================================
// Entity Field (Recursive for nested objects)
// ============================================================================

export const entityFieldSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    type: dataTypeSchema,
    label: z.string(),
    description: z.string().optional(),
    required: z.boolean().optional(),
    unique: z.boolean().optional(),
    indexed: z.boolean().optional(),
    defaultValue: z.unknown().optional(),
    constraints: z.array(constraintSchema).optional(),
    enumValues: z.array(enumValueSchema).optional(),
    reference: referenceConfigSchema.optional(),
    arrayItemType: dataTypeSchema.optional(),
    objectFields: z.array(z.lazy(() => entityFieldSchema)).optional(),
  })
)

// EntityField 타입은 재귀적이므로 명시적 정의
export interface EntityField {
  readonly id: string
  readonly type: DataType
  readonly label: string
  readonly description?: string
  readonly required?: boolean
  readonly unique?: boolean
  readonly indexed?: boolean
  readonly defaultValue?: unknown
  readonly constraints?: readonly Constraint[]
  readonly enumValues?: readonly EnumValue[]
  readonly reference?: ReferenceConfig
  readonly arrayItemType?: DataType
  readonly objectFields?: readonly EntityField[]
}

// ============================================================================
// Relation
// ============================================================================

export const relationTypeSchema = z.enum(['hasOne', 'hasMany', 'belongsTo', 'manyToMany'])

export type RelationType = z.infer<typeof relationTypeSchema>

export const relationSchema = z.object({
  type: relationTypeSchema,
  target: z.string(),
  foreignKey: z.string().optional(),
  through: z.string().optional(),
  as: z.string().optional(),
})

export type Relation = z.infer<typeof relationSchema>

// ============================================================================
// Index Config
// ============================================================================

export const indexConfigSchema = z.object({
  fields: z.array(z.string()).min(1),
  unique: z.boolean().optional(),
  name: z.string().optional(),
})

export type IndexConfig = z.infer<typeof indexConfigSchema>

// ============================================================================
// Entity Schema
// ============================================================================

export const entitySchemaValidator = schemaMetadataSchema.extend({
  _type: z.literal('entity'),
  fields: z.array(entityFieldSchema),
  relations: z.array(relationSchema).optional(),
  indexes: z.array(indexConfigSchema).optional(),
  tableName: z.string().optional(),
  timestamps: z.boolean().optional(),
  softDelete: z.boolean().optional(),
})

export type EntitySchema = z.infer<typeof entitySchemaValidator>
