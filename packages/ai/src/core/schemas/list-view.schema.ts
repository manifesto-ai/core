/**
 * List View Schema - Zod schemas for ListView generation
 *
 * LLM이 생성할 ListViewSchema의 구조를 Zod로 정의
 * ColumnType Zod 스키마는 @manifesto-ai/schema에서 가져옴
 */

import { z } from 'zod'
import { columnTypeSchema, type ColumnType } from '@manifesto-ai/schema'

// Re-export original ColumnType schema and type for external use
export { columnTypeSchema }
export type { ColumnType }

// ============================================================================
// Column Schema
// ============================================================================

export const GeneratedColumnFormatSchema = z.object({
  dateFormat: z.string().optional().describe('Date format string (e.g., "YYYY-MM-DD")'),
  numberFormat: z
    .object({
      style: z.enum(['decimal', 'currency', 'percent']).optional(),
      currency: z.string().optional(),
      decimals: z.number().optional(),
      prefix: z.string().optional(),
      suffix: z.string().optional(),
    })
    .optional(),
  enumMap: z.record(z.string()).optional().describe('Map enum values to display labels'),
})

export type GeneratedColumnFormat = z.infer<typeof GeneratedColumnFormatSchema>

/**
 * LLM이 생성 가능한 ColumnType의 서브셋
 * 원본 ColumnType(@manifesto-ai/schema)의 모든 값을 포함하지 않음
 * - LLM이 자동 생성하기에 적합한 타입만 포함
 * - 'link', 'image', 'actions', 'custom'은 사용자가 명시적으로 지정해야 함
 */
export const GeneratedColumnTypeSchema = z
  .enum(['text', 'number', 'date', 'datetime', 'boolean', 'enum', 'badge'])
  .describe('Column display type (LLM-generated subset)')

export type GeneratedColumnType = z.infer<typeof GeneratedColumnTypeSchema>

export const GeneratedListColumnSchema = z.object({
  id: z.string().describe('Unique column identifier'),
  entityFieldId: z.string().describe('Reference to entity field ID'),
  type: GeneratedColumnTypeSchema,
  label: z.string().describe('Column header label'),
  width: z.number().optional().describe('Column width in pixels'),
  sortable: z.boolean().default(true).describe('Whether column is sortable'),
  filterable: z.boolean().default(false).describe('Whether column has filter'),
  align: z.enum(['left', 'center', 'right']).optional().describe('Text alignment'),
  format: GeneratedColumnFormatSchema.optional(),
  priority: z
    .number()
    .min(1)
    .max(10)
    .describe('Display priority (1=highest, shown first)'),
})

export type GeneratedListColumn = z.infer<typeof GeneratedListColumnSchema>

// ============================================================================
// Filter Schema
// ============================================================================

export const GeneratedFilterFieldSchema = z.object({
  id: z.string().describe('Filter field identifier'),
  entityFieldId: z.string().describe('Reference to entity field ID'),
  label: z.string().describe('Filter label'),
  type: z
    .enum(['text', 'select', 'date-range', 'number-range'])
    .describe('Filter input type'),
})

export type GeneratedFilterField = z.infer<typeof GeneratedFilterFieldSchema>

// ============================================================================
// Full ListView Schema
// ============================================================================

export const GeneratedListViewSchema = z.object({
  id: z.string().describe('View identifier in kebab-case (e.g., "customers-list")'),
  name: z.string().describe('Human-readable view name'),
  description: z.string().optional(),
  columns: z
    .array(GeneratedListColumnSchema)
    .min(1)
    .describe('List columns - select most important fields for display'),
  defaultSort: z
    .object({
      field: z.string().describe('Field ID to sort by'),
      direction: z.enum(['asc', 'desc']),
    })
    .optional(),
  filters: z
    .array(GeneratedFilterFieldSchema)
    .optional()
    .describe('Filter fields for searching'),
  searchable: z.boolean().default(true).describe('Enable text search'),
  pageSize: z.number().default(20).describe('Default page size'),
})

export type GeneratedListView = z.infer<typeof GeneratedListViewSchema>

// ============================================================================
// List View Generation Request Schema
// ============================================================================

export const ListViewGenerationRequestSchema = z.object({
  entityId: z.string().describe('Target entity ID'),
  purpose: z
    .enum(['search', 'overview', 'selection', 'report'])
    .default('search')
    .describe('Primary purpose of the list'),
  maxColumns: z.number().default(7).describe('Maximum number of columns to display'),
  includeFilters: z.boolean().default(true).describe('Generate filter fields'),
})

export type ListViewGenerationRequest = z.infer<typeof ListViewGenerationRequestSchema>
