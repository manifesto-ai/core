/**
 * View Layer Zod Schemas
 *
 * 화면 구성을 정의하는 View 레이어의 Zod 스키마
 * 타입은 z.infer<>로 도출
 */

import { z } from 'zod'
import { schemaMetadataSchema } from './common'
import { expressionSchema } from './expression'
import { enumValueSchema } from './entity'

// ============================================================================
// Layout
// ============================================================================

export const layoutTypeSchema = z.enum(['form', 'grid', 'flex', 'tabs', 'accordion', 'wizard'])

export type LayoutType = z.infer<typeof layoutTypeSchema>

export const layoutConfigSchema = z.object({
  type: layoutTypeSchema,
  columns: z.number().optional(),
  gap: z.string().optional(),
  direction: z.enum(['row', 'column']).optional(),
})

export type LayoutConfig = z.infer<typeof layoutConfigSchema>

// ============================================================================
// Component Type
// ============================================================================

export const componentTypeSchema = z.enum([
  'text-input',
  'number-input',
  'select',
  'multi-select',
  'checkbox',
  'radio',
  'date-picker',
  'datetime-picker',
  'textarea',
  'rich-editor',
  'file-upload',
  'image-upload',
  'autocomplete',
  'toggle',
  'slider',
  'color-picker',
  'custom',
])

export type ComponentType = z.infer<typeof componentTypeSchema>

// ============================================================================
// Style Config (Recursive)
// ============================================================================

export interface StyleConfig {
  readonly className?: string
  readonly style?: Record<string, string | number>
  readonly variants?: Record<string, StyleConfig>
}

export const styleConfigSchema: z.ZodType<StyleConfig> = z.object({
  className: z.string().optional(),
  style: z.record(z.union([z.string(), z.number()])).optional(),
  variants: z.lazy(() => z.record(styleConfigSchema)).optional(),
})

// ============================================================================
// Data Source
// ============================================================================

export const dataSourceTypeSchema = z.enum(['static', 'api', 'derived'])

export type DataSourceType = z.infer<typeof dataSourceTypeSchema>

export const apiDataSourceSchema = z.object({
  endpoint: z.string(),
  method: z.enum(['GET', 'POST']).optional(),
  params: z.record(z.unknown()).optional(),
  transform: z
    .object({
      path: z.string().optional(),
      map: z.object({ value: z.string(), label: z.string() }).optional(),
    })
    .optional(),
})

export type ApiDataSource = z.infer<typeof apiDataSourceSchema>

export const dataSourceSchema = z.object({
  type: dataSourceTypeSchema,
  static: z.array(enumValueSchema).optional(),
  api: apiDataSourceSchema.optional(),
  derived: expressionSchema.optional(),
})

export type DataSource = z.infer<typeof dataSourceSchema>

// ============================================================================
// Reaction Actions (Discriminated Union)
// ============================================================================

export const setValueActionSchema = z.object({
  type: z.literal('setValue'),
  target: z.string(),
  value: z.unknown(),
})

export const setOptionsActionSchema = z.object({
  type: z.literal('setOptions'),
  target: z.string(),
  source: dataSourceSchema,
})

export const updatePropActionSchema = z.object({
  type: z.literal('updateProp'),
  target: z.string(),
  prop: z.string(),
  value: z.unknown(),
})

export const validateActionSchema = z.object({
  type: z.literal('validate'),
  targets: z.array(z.string()).optional(),
  mode: z.enum(['silent', 'visible']).optional(),
})

export const navigateActionSchema = z.object({
  type: z.literal('navigate'),
  path: z.string(),
  params: z.record(z.unknown()).optional(),
})

export const emitActionSchema = z.object({
  type: z.literal('emit'),
  event: z.string(),
  payload: z.record(z.unknown()).optional(),
})

export const reactionActionSchema = z.discriminatedUnion('type', [
  setValueActionSchema,
  setOptionsActionSchema,
  updatePropActionSchema,
  validateActionSchema,
  navigateActionSchema,
  emitActionSchema,
])

export type ReactionAction = z.infer<typeof reactionActionSchema>

// ============================================================================
// Reaction
// ============================================================================

export const reactionTriggerSchema = z.enum(['change', 'blur', 'focus', 'mount', 'unmount'])

export type ReactionTrigger = z.infer<typeof reactionTriggerSchema>

export const reactionSchema = z.object({
  trigger: reactionTriggerSchema,
  condition: expressionSchema.optional(),
  actions: z.array(reactionActionSchema),
  debounce: z.number().optional(),
  throttle: z.number().optional(),
})

export type Reaction = z.infer<typeof reactionSchema>

// ============================================================================
// View Field
// ============================================================================

export const viewFieldSchema = z.object({
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

export type ViewField = z.infer<typeof viewFieldSchema>

// ============================================================================
// View Section
// ============================================================================

export const viewSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  layout: layoutConfigSchema.optional(),
  fields: z.array(viewFieldSchema),
  visible: expressionSchema.optional(),
  collapsible: z.boolean().optional(),
  collapsed: z.boolean().optional(),
})

export type ViewSection = z.infer<typeof viewSectionSchema>

// ============================================================================
// Confirm Config
// ============================================================================

export const confirmConfigSchema = z.object({
  title: z.string(),
  message: z.string(),
  confirmLabel: z.string().optional(),
  cancelLabel: z.string().optional(),
  variant: z.enum(['default', 'danger']).optional(),
})

export type ConfirmConfig = z.infer<typeof confirmConfigSchema>

// ============================================================================
// Action Reference
// ============================================================================

export const actionReferenceTypeSchema = z.enum(['submit', 'cancel', 'custom', 'navigate'])

export type ActionReferenceType = z.infer<typeof actionReferenceTypeSchema>

export const actionReferenceSchema = z.object({
  type: actionReferenceTypeSchema,
  actionId: z.string().optional(),
  confirm: confirmConfigSchema.optional(),
  path: z.string().optional(),
})

export type ActionReference = z.infer<typeof actionReferenceSchema>

// ============================================================================
// View Action
// ============================================================================

export const buttonVariantSchema = z.enum(['primary', 'secondary', 'danger', 'ghost'])

export type ButtonVariant = z.infer<typeof buttonVariantSchema>

export const viewActionSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  variant: buttonVariantSchema.optional(),
  icon: z.string().optional(),
  disabled: expressionSchema.optional(),
  visible: expressionSchema.optional(),
  action: actionReferenceSchema,
})

export type ViewAction = z.infer<typeof viewActionSchema>

// ============================================================================
// View Header & Footer
// ============================================================================

export const viewHeaderSchema = z.object({
  title: z.union([z.string(), expressionSchema]),
  subtitle: z.union([z.string(), expressionSchema]).optional(),
  actions: z.array(viewActionSchema).optional(),
})

export type ViewHeader = z.infer<typeof viewHeaderSchema>

export const viewFooterSchema = z.object({
  actions: z.array(viewActionSchema).optional(),
  sticky: z.boolean().optional(),
})

export type ViewFooter = z.infer<typeof viewFooterSchema>

// ============================================================================
// Form View Schema
// ============================================================================

export const formViewSchemaValidator = schemaMetadataSchema.extend({
  _type: z.literal('view'),
  entityRef: z.string(),
  mode: z.enum(['create', 'edit', 'view']),
  layout: layoutConfigSchema.optional(),
  sections: z.array(viewSectionSchema),
  header: viewHeaderSchema.optional(),
  footer: viewFooterSchema.optional(),
})

export type FormViewSchema = z.infer<typeof formViewSchemaValidator>
