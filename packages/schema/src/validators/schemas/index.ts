/**
 * Zod Schemas - Public exports
 *
 * Zod 스키마만 내보냄 (타입은 types/에서 정의)
 * 타입 충돌을 피하기 위해 스키마 이름에 'Schema' 접미사 사용
 */

import { z } from 'zod'

// ============================================================================
// Common Schemas
// ============================================================================

export { schemaVersionSchema, schemaMetadataSchema } from './common'

// ============================================================================
// Expression Schemas
// ============================================================================

export {
  operatorSchema,
  literalSchema,
  contextReferenceSchema,
  expressionSchema,
} from './expression'

// ============================================================================
// Entity Layer Schemas
// ============================================================================

export {
  dataTypeSchema,
  constraintTypeSchema,
  constraintSchema,
  enumValueSchema,
  cascadeTypeSchema,
  referenceConfigSchema,
  entityFieldSchema,
  relationTypeSchema,
  relationSchema,
  indexConfigSchema,
  entitySchemaValidator,
} from './entity'

// ============================================================================
// View Layer Schemas
// ============================================================================

export {
  layoutTypeSchema,
  layoutConfigSchema,
  componentTypeSchema,
  styleConfigSchema,
  dataSourceTypeSchema,
  apiDataSourceSchema,
  dataSourceSchema,
  setValueActionSchema,
  setOptionsActionSchema,
  updatePropActionSchema,
  validateActionSchema,
  navigateActionSchema,
  emitActionSchema,
  reactionActionSchema,
  reactionTriggerSchema,
  reactionSchema,
  viewFieldSchema,
  viewSectionSchema,
  confirmConfigSchema,
  actionReferenceTypeSchema,
  actionReferenceSchema,
  buttonVariantSchema,
  viewActionSchema,
  viewHeaderSchema,
  viewFooterSchema,
  formViewSchemaValidator,
} from './view'

// ============================================================================
// List View Layer Schemas
// ============================================================================

export {
  columnTypeSchema,
  numberFormatSchema,
  badgeVariantSchema,
  badgeConfigSchema,
  columnFormatSchema,
  columnSummaryTypeSchema,
  columnSummarySchema,
  rowActionSchema,
  bulkActionSchema,
  columnAlignSchema,
  listColumnSchema,
  paginationConfigSchema,
  sortDirectionSchema,
  sortingConfigSchema,
  filterFieldTypeSchema,
  filterFieldSchema,
  filterConfigSchema,
  selectionModeSchema,
  selectionConfigSchema,
  listDataSourceSchema,
  emptyStateConfigSchema,
  listViewSchemaValidator,
} from './list'

// ============================================================================
// Action Layer Schemas
// ============================================================================

export {
  actionTriggerTypeSchema,
  actionTriggerSchema,
  transformOperationSchema,
  transformStepSchema,
  transformPipelineSchema,
  adapterTypeSchema,
  adapterConfigSchema,
  httpMethodSchema,
  apiCallStepSchema,
  setStateStepSchema,
  navigationStepSchema,
  actionStepSchema,
  actionSchemaValidator,
} from './action'

// ============================================================================
// Unified Schemas
// ============================================================================

import { formViewSchemaValidator } from './view'
import { listViewSchemaValidator } from './list'
import { entitySchemaValidator } from './entity'
import { actionSchemaValidator } from './action'

/**
 * ViewSchema는 FormView와 ListView의 union
 * 둘 다 _type: 'view'를 사용하므로 discriminatedUnion 대신 union 사용
 */
export const viewSchemaValidator = z.union([formViewSchemaValidator, listViewSchemaValidator])

/**
 * 전체 스키마 validator
 * View는 mode 필드로 구분: 'list' vs 'create'|'edit'|'view'
 * discriminatedUnion 대신 union 사용 (_type: 'view'가 중복되므로)
 */
export const unifiedSchemaValidator = z.union([
  entitySchemaValidator,
  viewSchemaValidator,
  actionSchemaValidator,
])
