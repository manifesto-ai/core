/**
 * Schema Validators - Zod 기반 런타임 검증
 *
 * DSL 문법 오류를 런타임 전에 검증
 */

import { z } from 'zod'
import { ALLOWED_OPERATORS } from '../types/expression'

// ============================================================================
// Common Validators
// ============================================================================

const schemaVersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/, 'Invalid version format')

const schemaMetadataSchema = z.object({
  id: z.string().min(1),
  version: schemaVersionSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

// ============================================================================
// Expression Validators
// ============================================================================

const literalSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
])

const contextReferenceSchema = z.string().refine(
  (val) => val.startsWith('$'),
  'Context reference must start with $'
)

const operatorSchema = z.enum(ALLOWED_OPERATORS as unknown as [string, ...string[]])

// 재귀적 표현식 스키마
const expressionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    literalSchema,
    contextReferenceSchema,
    z.tuple([operatorSchema]).rest(z.lazy(() => expressionSchema)),
  ])
)

// ============================================================================
// Entity Validators
// ============================================================================

const dataTypeSchema = z.enum([
  'string', 'number', 'boolean', 'date', 'datetime',
  'array', 'object', 'enum', 'reference',
])

const constraintSchema = z.object({
  type: z.enum(['required', 'min', 'max', 'pattern', 'custom']),
  value: z.unknown().optional(),
  message: z.string().optional(),
  expression: expressionSchema.optional(),
})

const enumValueSchema = z.object({
  value: z.union([z.string(), z.number()]),
  label: z.string(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
})

const referenceConfigSchema = z.object({
  entity: z.string(),
  displayField: z.string(),
  valueField: z.string(),
  cascade: z.enum(['none', 'delete', 'nullify']).optional(),
})

const entityFieldSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    dataType: dataTypeSchema,
    label: z.string(),
    description: z.string().optional(),
    defaultValue: z.unknown().optional(),
    constraints: z.array(constraintSchema).optional(),
    enumValues: z.array(enumValueSchema).optional(),
    reference: referenceConfigSchema.optional(),
    arrayItemType: dataTypeSchema.optional(),
    objectFields: z.array(z.lazy(() => entityFieldSchema)).optional(),
  })
)

const relationSchema = z.object({
  type: z.enum(['hasOne', 'hasMany', 'belongsTo', 'manyToMany']),
  target: z.string(),
  foreignKey: z.string().optional(),
  through: z.string().optional(),
})

const indexConfigSchema = z.object({
  fields: z.array(z.string()).min(1),
  unique: z.boolean().optional(),
  name: z.string().optional(),
})

export const entitySchemaValidator = schemaMetadataSchema.extend({
  _type: z.literal('entity'),
  fields: z.array(entityFieldSchema),
  relations: z.array(relationSchema).optional(),
  indexes: z.array(indexConfigSchema).optional(),
})

// ============================================================================
// View Validators
// ============================================================================

const layoutTypeSchema = z.enum(['form', 'grid', 'flex', 'tabs', 'accordion', 'wizard'])

const layoutConfigSchema = z.object({
  type: layoutTypeSchema,
  columns: z.number().optional(),
  gap: z.string().optional(),
  direction: z.enum(['row', 'column']).optional(),
})

const componentTypeSchema = z.enum([
  'text-input', 'number-input', 'select', 'multi-select',
  'checkbox', 'radio', 'date-picker', 'datetime-picker',
  'textarea', 'rich-editor', 'file-upload', 'image-upload',
  'autocomplete', 'toggle', 'slider', 'color-picker', 'custom',
])

interface StyleConfigInput {
  className?: string
  style?: Record<string, string | number>
  variants?: Record<string, StyleConfigInput>
}

const styleConfigSchema: z.ZodType<StyleConfigInput> = z.object({
  className: z.string().optional(),
  style: z.record(z.union([z.string(), z.number()])).optional(),
  variants: z.lazy(() => z.record(styleConfigSchema)).optional(),
})

const reactionActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('setValue'),
    target: z.string(),
    value: z.unknown(),
  }),
  z.object({
    type: z.literal('setOptions'),
    target: z.string(),
    source: z.object({
      type: z.enum(['static', 'api', 'derived']),
      static: z.array(enumValueSchema).optional(),
      api: z.object({
        endpoint: z.string(),
        method: z.enum(['GET', 'POST']).optional(),
        params: z.record(z.unknown()).optional(),
        transform: z.object({
          path: z.string().optional(),
          map: z.object({ value: z.string(), label: z.string() }).optional(),
        }).optional(),
      }).optional(),
      derived: expressionSchema.optional(),
    }),
  }),
  z.object({
    type: z.literal('updateProp'),
    target: z.string(),
    prop: z.string(),
    value: z.unknown(),
  }),
  z.object({
    type: z.literal('validate'),
    targets: z.array(z.string()).optional(),
    mode: z.enum(['silent', 'visible']).optional(),
  }),
  z.object({
    type: z.literal('navigate'),
    path: z.string(),
    params: z.record(z.unknown()).optional(),
  }),
  z.object({
    type: z.literal('emit'),
    event: z.string(),
    payload: z.record(z.unknown()).optional(),
  }),
])

const reactionSchema = z.object({
  trigger: z.enum(['change', 'blur', 'focus', 'mount', 'unmount']),
  condition: expressionSchema.optional(),
  actions: z.array(reactionActionSchema),
  debounce: z.number().optional(),
  throttle: z.number().optional(),
})

const viewFieldSchema = z.object({
  id: z.string().min(1),
  entityFieldId: z.string(),
  component: componentTypeSchema,
  label: z.string().optional(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  props: z.record(z.unknown()).optional(),
  styles: styleConfigSchema.optional(),
  reactions: z.array(reactionSchema).optional(),
  dependsOn: z.array(z.string()).optional(),
  order: z.number().optional(),
  colSpan: z.number().optional(),
  rowSpan: z.number().optional(),
})

const viewSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  layout: layoutConfigSchema,
  fields: z.array(viewFieldSchema),
  visible: expressionSchema.optional(),
  collapsible: z.boolean().optional(),
  collapsed: z.boolean().optional(),
})

const confirmConfigSchema = z.object({
  title: z.string(),
  message: z.string(),
  confirmLabel: z.string().optional(),
  cancelLabel: z.string().optional(),
})

const actionReferenceSchema = z.object({
  type: z.enum(['submit', 'cancel', 'custom']),
  actionId: z.string().optional(),
  confirm: confirmConfigSchema.optional(),
})

const viewActionSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  variant: z.enum(['primary', 'secondary', 'danger', 'ghost']).optional(),
  icon: z.string().optional(),
  disabled: expressionSchema.optional(),
  visible: expressionSchema.optional(),
  action: actionReferenceSchema,
})

const viewHeaderSchema = z.object({
  title: z.union([z.string(), expressionSchema]),
  subtitle: z.union([z.string(), expressionSchema]).optional(),
  actions: z.array(viewActionSchema).optional(),
})

const viewFooterSchema = z.object({
  actions: z.array(viewActionSchema),
  sticky: z.boolean().optional(),
})

export const viewSchemaValidator = schemaMetadataSchema.extend({
  _type: z.literal('view'),
  entityRef: z.string(),
  mode: z.enum(['create', 'edit', 'view', 'list']),
  layout: layoutConfigSchema,
  sections: z.array(viewSectionSchema),
  header: viewHeaderSchema.optional(),
  footer: viewFooterSchema.optional(),
})

// ============================================================================
// Action Validators
// ============================================================================

const actionTriggerSchema = z.object({
  type: z.enum(['manual', 'event', 'schedule']),
  event: z.string().optional(),
  cron: z.string().optional(),
})

const transformStepSchema = z.object({
  _step: z.literal('transform'),
  id: z.string(),
  operation: z.enum(['map', 'filter', 'reduce', 'pick', 'omit', 'rename', 'custom']),
  config: z.record(z.unknown()),
  outputKey: z.string().optional(),
})

const transformPipelineSchema = z.object({
  steps: z.array(transformStepSchema),
})

const adapterConfigSchema = z.object({
  type: z.enum(['legacy', 'graphql', 'soap']),
  requestTransform: transformPipelineSchema.optional(),
  responseTransform: transformPipelineSchema.optional(),
})

const apiCallStepSchema = z.object({
  _step: z.literal('apiCall'),
  id: z.string(),
  endpoint: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  headers: z.record(z.union([z.string(), expressionSchema])).optional(),
  body: z.union([z.record(z.unknown()), expressionSchema]).optional(),
  adapter: adapterConfigSchema.optional(),
  outputKey: z.string().optional(),
})

const setStateStepSchema = z.object({
  _step: z.literal('setState'),
  id: z.string(),
  updates: z.record(z.unknown()),
})

const navigationStepSchema = z.object({
  _step: z.literal('navigation'),
  id: z.string(),
  path: z.string(),
  params: z.record(z.unknown()).optional(),
  replace: z.boolean().optional(),
})

// 재귀적 액션 스텝 스키마
const actionStepSchema: z.ZodType<unknown> = z.lazy(() =>
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

export const actionSchemaValidator = schemaMetadataSchema.extend({
  _type: z.literal('action'),
  trigger: actionTriggerSchema,
  steps: z.array(actionStepSchema),
  rollback: z.array(actionStepSchema).optional(),
  timeout: z.number().optional(),
  retries: z.number().optional(),
})

// ============================================================================
// Unified Schema Validator
// ============================================================================

export const schemaValidator = z.discriminatedUnion('_type', [
  entitySchemaValidator,
  viewSchemaValidator,
  actionSchemaValidator,
])

// ============================================================================
// Validation Functions
// ============================================================================

import type { Result } from '../types/result'
import { ok, err } from '../types/result'
import type { Schema, EntitySchema, ViewSchema, ActionSchema } from '../types/schema'

export interface ValidationError {
  path: (string | number)[]
  message: string
}

export const validateSchema = (data: unknown): Result<Schema, ValidationError[]> => {
  const result = schemaValidator.safeParse(data)

  if (result.success) {
    return ok(result.data as Schema)
  }

  const errors: ValidationError[] = result.error.errors.map((e) => ({
    path: e.path,
    message: e.message,
  }))

  return err(errors)
}

export const validateEntitySchema = (data: unknown): Result<EntitySchema, ValidationError[]> => {
  const result = entitySchemaValidator.safeParse(data)

  if (result.success) {
    return ok(result.data as EntitySchema)
  }

  return err(result.error.errors.map((e) => ({ path: e.path, message: e.message })))
}

export const validateViewSchema = (data: unknown): Result<ViewSchema, ValidationError[]> => {
  const result = viewSchemaValidator.safeParse(data)

  if (result.success) {
    return ok(result.data as ViewSchema)
  }

  return err(result.error.errors.map((e) => ({ path: e.path, message: e.message })))
}

export const validateActionSchema = (data: unknown): Result<ActionSchema, ValidationError[]> => {
  const result = actionSchemaValidator.safeParse(data)

  if (result.success) {
    return ok(result.data as ActionSchema)
  }

  return err(result.error.errors.map((e) => ({ path: e.path, message: e.message })))
}
