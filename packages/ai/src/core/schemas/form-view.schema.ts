/**
 * Form View Schema - Zod schemas for FormView generation
 *
 * LLM이 생성할 FormViewSchema의 구조를 Zod로 정의
 * ComponentType Zod 스키마는 @manifesto-ai/schema에서 가져옴
 */

import { z } from 'zod'
import { componentTypeSchema, type ComponentType } from '@manifesto-ai/schema'

// ============================================================================
// Component Type Schema for LLM Generation
// ============================================================================

/**
 * LLM이 생성 가능한 ComponentType의 서브셋
 * 원본 componentTypeSchema(@manifesto-ai/schema)의 서브셋
 * - LLM이 자동 생성하기에 적합한 타입만 포함
 * - 'rich-editor', 'file-upload', 'image-upload', 'color-picker', 'custom'은
 *   사용자가 명시적으로 지정해야 하므로 제외
 */
export const GeneratedComponentTypeSchema = z
  .enum([
    'text-input',
    'number-input',
    'select',
    'multi-select',
    'checkbox',
    'radio',
    'date-picker',
    'datetime-picker',
    'textarea',
    'toggle',
    'slider',
    'autocomplete',
  ])
  .describe('UI component type for the field (LLM-generated subset)')

export type GeneratedComponentType = z.infer<typeof GeneratedComponentTypeSchema>

// Re-export original ComponentType schema and type for external use
export { componentTypeSchema }
export type { ComponentType }

// ============================================================================
// Form Field Schema
// ============================================================================

export const GeneratedFormFieldSchema = z.object({
  id: z.string().describe('Unique field identifier (usually same as entityFieldId)'),
  entityFieldId: z.string().describe('Reference to entity field ID'),
  component: GeneratedComponentTypeSchema,
  label: z.string().optional().describe('Override label (uses entity field label if not set)'),
  placeholder: z.string().optional().describe('Placeholder text'),
  helpText: z.string().optional().describe('Help text below the field'),
  colSpan: z.number().min(1).max(4).default(1).describe('Column span in grid layout'),
  order: z.number().describe('Display order within section'),
})

export type GeneratedFormField = z.infer<typeof GeneratedFormFieldSchema>

// ============================================================================
// Form Section Schema
// ============================================================================

export const GeneratedFormSectionSchema = z.object({
  id: z.string().describe('Unique section identifier'),
  title: z.string().optional().describe('Section title'),
  description: z.string().optional().describe('Section description'),
  columns: z.number().min(1).max(4).default(2).describe('Number of columns in grid'),
  fields: z.array(GeneratedFormFieldSchema).min(1).describe('Fields in this section'),
  collapsible: z.boolean().default(false).describe('Whether section can be collapsed'),
  order: z.number().describe('Section display order'),
})

export type GeneratedFormSection = z.infer<typeof GeneratedFormSectionSchema>

// ============================================================================
// Full FormView Schema
// ============================================================================

export const GeneratedFormViewSchema = z.object({
  id: z.string().describe('View identifier in kebab-case (e.g., "customer-create")'),
  name: z.string().describe('Human-readable view name'),
  description: z.string().optional(),
  mode: z.enum(['create', 'edit']).describe('Form mode'),
  sections: z
    .array(GeneratedFormSectionSchema)
    .min(1)
    .describe('Form sections - group related fields together'),
  submitLabel: z.string().default('Submit').describe('Submit button label'),
  cancelLabel: z.string().default('Cancel').describe('Cancel button label'),
})

export type GeneratedFormView = z.infer<typeof GeneratedFormViewSchema>

// ============================================================================
// Form View Generation Request Schema
// ============================================================================

export const FormViewGenerationRequestSchema = z.object({
  entityId: z.string().describe('Target entity ID'),
  mode: z.enum(['create', 'edit']).default('create').describe('Form mode'),
  maxSections: z.number().default(4).describe('Maximum number of sections'),
  columnsPerSection: z.number().default(2).describe('Default columns per section'),
})

export type FormViewGenerationRequest = z.infer<typeof FormViewGenerationRequestSchema>

// ============================================================================
// Component Type Mapping Helper
// ============================================================================

/**
 * DataType → GeneratedComponentType 기본 매핑
 * LLM이 생성 가능한 컴포넌트 타입으로만 매핑
 */
export const DEFAULT_COMPONENT_MAP: Record<string, GeneratedComponentType> = {
  string: 'text-input',
  number: 'number-input',
  boolean: 'checkbox',
  date: 'date-picker',
  datetime: 'datetime-picker',
  enum: 'select',
  reference: 'autocomplete',
}
