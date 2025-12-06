/**
 * List View Zod Schemas
 *
 * 목록 화면을 정의하는 List View의 Zod 스키마
 * 타입은 z.infer<>로 도출
 */

import { z } from 'zod'
import { schemaMetadataSchema } from './common'
import { expressionSchema } from './expression'
import { enumValueSchema } from './entity'
import {
  viewHeaderSchema,
  viewFooterSchema,
  confirmConfigSchema,
  actionReferenceSchema,
  buttonVariantSchema,
} from './view'

// ============================================================================
// Column Type
// ============================================================================

export const columnTypeSchema = z.enum([
  'text',
  'number',
  'date',
  'datetime',
  'boolean',
  'enum',
  'link',
  'image',
  'badge',
  'actions',
  'custom',
])

export type ColumnType = z.infer<typeof columnTypeSchema>

// ============================================================================
// Column Format
// ============================================================================

export const numberFormatSchema = z.object({
  locale: z.string().optional(),
  style: z.enum(['decimal', 'currency', 'percent']).optional(),
  currency: z.string().optional(),
  minimumFractionDigits: z.number().optional(),
  maximumFractionDigits: z.number().optional(),
  decimals: z.number().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
})

export type NumberFormat = z.infer<typeof numberFormatSchema>

export const badgeVariantSchema = z.enum(['success', 'warning', 'error', 'info', 'default'])

export type BadgeVariant = z.infer<typeof badgeVariantSchema>

export const badgeConfigSchema = z.object({
  label: z.string(),
  variant: badgeVariantSchema.optional(),
  color: z.string().optional(),
  bgColor: z.string().optional(),
})

export type BadgeConfig = z.infer<typeof badgeConfigSchema>

export const columnFormatSchema = z.object({
  dateFormat: z.string().optional(),
  numberFormat: numberFormatSchema.optional(),
  enumMap: z.record(z.string()).optional(),
  badgeMap: z.record(badgeConfigSchema).optional(),
  linkTemplate: z.string().optional(),
  imageSize: z.object({ width: z.number(), height: z.number() }).optional(),
})

export type ColumnFormat = z.infer<typeof columnFormatSchema>

// ============================================================================
// Column Summary
// ============================================================================

export const columnSummaryTypeSchema = z.enum(['sum', 'avg', 'count', 'min', 'max', 'expression'])

export type ColumnSummaryType = z.infer<typeof columnSummaryTypeSchema>

export const columnSummarySchema = z.object({
  type: columnSummaryTypeSchema,
  expression: expressionSchema.optional(),
  label: z.string().optional(),
  format: columnFormatSchema.optional(),
})

export type ColumnSummary = z.infer<typeof columnSummarySchema>

// ============================================================================
// Row Action
// ============================================================================

export const rowActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string().optional(),
  variant: buttonVariantSchema.optional(),
  visible: expressionSchema.optional(),
  disabled: expressionSchema.optional(),
  confirm: confirmConfigSchema.optional(),
  action: actionReferenceSchema,
})

export type RowAction = z.infer<typeof rowActionSchema>

// ============================================================================
// Bulk Action
// ============================================================================

export const bulkActionSchema = rowActionSchema.extend({
  minSelection: z.number().optional(),
})

export type BulkAction = z.infer<typeof bulkActionSchema>

// ============================================================================
// List Column
// ============================================================================

export const columnAlignSchema = z.enum(['left', 'center', 'right'])

export type ColumnAlign = z.infer<typeof columnAlignSchema>

export const listColumnSchema = z.object({
  id: z.string(),
  entityFieldId: z.string(),
  type: columnTypeSchema,
  label: z.string(),
  width: z.union([z.string(), z.number()]).optional(),
  minWidth: z.number().optional(),
  maxWidth: z.number().optional(),
  sortable: z.boolean().optional(),
  filterable: z.boolean().optional(),
  hidden: expressionSchema.optional(),
  align: columnAlignSchema.optional(),
  fixed: z.enum(['left', 'right']).optional(),
  format: columnFormatSchema.optional(),
  summary: columnSummarySchema.optional(),
  cellRenderer: z.string().optional(),
  actions: z.array(rowActionSchema).optional(),
})

export type ListColumn = z.infer<typeof listColumnSchema>

// ============================================================================
// Pagination Config
// ============================================================================

export const paginationConfigSchema = z.object({
  enabled: z.boolean().optional(),
  pageSize: z.number().optional(),
  pageSizeOptions: z.array(z.number()).optional(),
  showTotal: z.boolean().optional(),
  showPageSize: z.boolean().optional(),
  showJumper: z.boolean().optional(),
})

export type PaginationConfig = z.infer<typeof paginationConfigSchema>

// ============================================================================
// Sorting Config
// ============================================================================

export const sortDirectionSchema = z.enum(['asc', 'desc'])

export type SortDirection = z.infer<typeof sortDirectionSchema>

export const sortingConfigSchema = z.object({
  enabled: z.boolean().optional(),
  defaultSort: z
    .object({
      field: z.string(),
      direction: sortDirectionSchema,
    })
    .optional(),
  multiSort: z.boolean().optional(),
})

export type SortingConfig = z.infer<typeof sortingConfigSchema>

// ============================================================================
// Filter Field
// ============================================================================

export const filterFieldTypeSchema = z.enum([
  'text',
  'select',
  'multi-select',
  'date',
  'date-range',
  'number',
  'number-range',
  'boolean',
])

export type FilterFieldType = z.infer<typeof filterFieldTypeSchema>

export const filterFieldSchema = z.object({
  id: z.string(),
  entityFieldId: z.string(),
  label: z.string(),
  type: filterFieldTypeSchema,
  placeholder: z.string().optional(),
  options: z.array(enumValueSchema).optional(),
  defaultValue: z.unknown().optional(),
})

export type FilterField = z.infer<typeof filterFieldSchema>

// ============================================================================
// Filter Config
// ============================================================================

export const filterConfigSchema = z.object({
  enabled: z.boolean().optional(),
  fields: z.array(filterFieldSchema).optional(),
  searchable: z.boolean().optional(),
  searchPlaceholder: z.string().optional(),
  searchFields: z.array(z.string()).optional(),
})

export type FilterConfig = z.infer<typeof filterConfigSchema>

// ============================================================================
// Selection Config
// ============================================================================

export const selectionModeSchema = z.enum(['single', 'multiple', 'none'])

export type SelectionMode = z.infer<typeof selectionModeSchema>

export const selectionConfigSchema = z.object({
  mode: selectionModeSchema.optional(),
  showCheckbox: z.boolean().optional(),
  preserveOnPageChange: z.boolean().optional(),
  disableRow: expressionSchema.optional(),
})

export type SelectionConfig = z.infer<typeof selectionConfigSchema>

// ============================================================================
// List Data Source
// ============================================================================

export const listDataSourceSchema = z.object({
  type: z.enum(['api', 'static']),
  api: z
    .object({
      endpoint: z.string(),
      method: z.enum(['GET', 'POST']).optional(),
      params: z.record(z.unknown()).optional(),
    })
    .optional(),
  static: z.array(z.record(z.unknown())).optional(),
})

export type ListDataSource = z.infer<typeof listDataSourceSchema>

// ============================================================================
// Empty State Config
// ============================================================================

export const emptyStateConfigSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  action: z
    .object({
      label: z.string(),
      onClick: z.string().optional(),
    })
    .optional(),
})

export type EmptyStateConfig = z.infer<typeof emptyStateConfigSchema>

// ============================================================================
// List View Schema
// ============================================================================

export const listViewSchemaValidator = schemaMetadataSchema.extend({
  _type: z.literal('view'),
  entityRef: z.string(),
  mode: z.literal('list'),
  columns: z.array(listColumnSchema),
  dataSource: listDataSourceSchema,
  pagination: paginationConfigSchema.optional(),
  sorting: sortingConfigSchema.optional(),
  filtering: filterConfigSchema.optional(),
  selection: selectionConfigSchema.optional(),
  rowActions: z.array(rowActionSchema).optional(),
  bulkActions: z.array(bulkActionSchema).optional(),
  header: viewHeaderSchema.optional(),
  footer: viewFooterSchema.optional(),
  emptyState: emptyStateConfigSchema.optional(),
})

export type ListViewSchema = z.infer<typeof listViewSchemaValidator>
