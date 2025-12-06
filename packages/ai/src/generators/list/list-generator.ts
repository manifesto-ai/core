/**
 * List Generator
 *
 * EntitySchema로부터 ListViewSchema 생성
 */

import type {
  EntitySchema,
  ListViewSchema,
  ListColumn,
  FilterField,
  FilterConfig,
  PaginationConfig,
  SortingConfig,
  ListDataSource,
  ColumnType,
} from '@manifesto-ai/schema'
import { ok, isOk } from '@manifesto-ai/schema'
import { createGenerator, type Generator } from '../base'
import type { AIClient } from '../../core/client'
import type { AIGeneratorError } from '../../types'
import { schemaValidationError, invalidInputError } from '../../types/errors'
import {
  GeneratedListViewSchema,
  type GeneratedListView,
  type GeneratedListColumn,
  type GeneratedFilterField,
} from '../../core/schemas'
import { buildListSystemPrompt, buildListUserPrompt } from './prompts'

// ============================================================================
// Input/Output Types
// ============================================================================

export interface ListGeneratorInput {
  readonly entity: EntitySchema
  readonly purpose?: 'search' | 'overview' | 'selection' | 'report'
  readonly maxColumns?: number
  readonly includeFilters?: boolean
  readonly apiEndpoint?: string
}

// ============================================================================
// Mapping Functions (LLM Output → Manifesto Schema)
// ============================================================================

/**
 * LLM이 생성한 column type을 schema 패키지의 ColumnType으로 매핑
 *
 * LLM이 생성 가능한 타입: text, number, date, datetime, boolean, enum, badge
 * schema 패키지 추가 타입: link, image, actions, custom (사용자가 명시적으로 지정)
 *
 * @see @manifesto-ai/schema의 ColumnType 정의
 */
const mapColumnType = (type: string): ColumnType => {
  // ColumnType의 모든 유효한 값을 매핑
  const typeMap: Record<string, ColumnType> = {
    // LLM이 생성 가능한 기본 타입
    text: 'text',
    number: 'number',
    date: 'date',
    datetime: 'datetime',
    boolean: 'boolean',
    enum: 'enum',
    badge: 'badge',
    // 사용자가 명시적으로 지정하는 타입 (LLM은 생성 안함)
    link: 'link',
    image: 'image',
    actions: 'actions',
    custom: 'custom',
  }
  return typeMap[type] ?? 'text'
}

const mapColumn = (col: GeneratedListColumn, entity: EntitySchema): ListColumn => {
  const entityField = entity.fields.find((f) => f.id === col.entityFieldId)

  const baseColumn: ListColumn = {
    id: col.id,
    entityFieldId: col.entityFieldId,
    type: mapColumnType(col.type),
    label: col.label,
    sortable: col.sortable ?? true,
    filterable: col.filterable ?? false,
    align: col.align ?? (col.type === 'number' ? 'right' : 'left'),
  }

  // Add width if specified
  if (col.width) {
    return { ...baseColumn, width: col.width }
  }

  // Add format if specified
  if (col.format || entityField?.enumValues) {
    const enumMap =
      col.format?.enumMap ??
      (entityField?.enumValues
        ? Object.fromEntries(entityField.enumValues.map((ev) => [String(ev.value), ev.label]))
        : undefined)

    const format: ListColumn['format'] = {
      ...(col.format?.dateFormat && { dateFormat: col.format.dateFormat }),
      ...(col.format?.numberFormat && { numberFormat: col.format.numberFormat }),
      ...(enumMap && { enumMap }),
    }

    if (Object.keys(format).length > 0) {
      return { ...baseColumn, format }
    }
  }

  return baseColumn
}

const mapFilterField = (filter: GeneratedFilterField, entity: EntitySchema): FilterField => {
  const entityField = entity.fields.find((f) => f.id === filter.entityFieldId)

  const baseFilter: FilterField = {
    id: filter.id,
    entityFieldId: filter.entityFieldId,
    label: filter.label,
    type: filter.type,
  }

  // Add options for select type from entity enum values
  if (filter.type === 'select' && entityField?.enumValues) {
    return {
      ...baseFilter,
      options: entityField.enumValues,
    }
  }

  return baseFilter
}

const mapToListViewSchema = (
  generated: GeneratedListView,
  entity: EntitySchema,
  apiEndpoint?: string
): ListViewSchema => {
  // Sort columns by priority
  const sortedColumns = [...generated.columns].sort((a, b) => a.priority - b.priority)
  const columns = sortedColumns.map((col) => mapColumn(col, entity))

  // Build filter config
  const filterConfig: FilterConfig | undefined = generated.filters?.length
    ? {
        enabled: true,
        fields: generated.filters.map((f) => mapFilterField(f, entity)),
        searchable: generated.searchable ?? true,
        searchPlaceholder: `Search ${entity.name}...`,
      }
    : generated.searchable
      ? {
          enabled: true,
          searchable: true,
          searchPlaceholder: `Search ${entity.name}...`,
        }
      : undefined

  // Build pagination config
  const pagination: PaginationConfig = {
    enabled: true,
    pageSize: generated.pageSize ?? 20,
    pageSizeOptions: [10, 20, 50, 100],
    showTotal: true,
    showPageSize: true,
  }

  // Build sorting config
  const sorting: SortingConfig | undefined = generated.defaultSort
    ? {
        enabled: true,
        defaultSort: {
          field: generated.defaultSort.field,
          direction: generated.defaultSort.direction,
        },
      }
    : { enabled: true }

  // Build data source
  const dataSource: ListDataSource = {
    type: 'api',
    api: {
      endpoint: apiEndpoint ?? `/api/${entity.id}`,
      method: 'GET',
    },
  }

  return {
    _type: 'view',
    id: generated.id,
    version: '0.1.0',
    name: generated.name,
    description: generated.description,
    entityRef: entity.id,
    mode: 'list',
    columns,
    dataSource,
    pagination,
    sorting,
    filtering: filterConfig,
    header: {
      title: generated.name,
    },
  }
}

// ============================================================================
// Validation
// ============================================================================

const validateGeneratedListView = (
  generated: GeneratedListView,
  entity: EntitySchema
): AIGeneratorError | null => {
  // Check that all column entityFieldIds exist in entity
  for (const col of generated.columns) {
    const fieldExists = entity.fields.some((f) => f.id === col.entityFieldId)
    if (!fieldExists) {
      return schemaValidationError(
        ['columns', col.id, 'entityFieldId'],
        `Field "${col.entityFieldId}" does not exist in entity "${entity.id}"`
      )
    }
  }

  // Check filter fields exist
  if (generated.filters) {
    for (const filter of generated.filters) {
      const fieldExists = entity.fields.some((f) => f.id === filter.entityFieldId)
      if (!fieldExists) {
        return schemaValidationError(
          ['filters', filter.id, 'entityFieldId'],
          `Filter field "${filter.entityFieldId}" does not exist in entity "${entity.id}"`
        )
      }
    }
  }

  // Check default sort field exists
  if (generated.defaultSort) {
    const fieldExists = entity.fields.some((f) => f.id === generated.defaultSort!.field)
    if (!fieldExists) {
      return schemaValidationError(
        ['defaultSort', 'field'],
        `Sort field "${generated.defaultSort.field}" does not exist in entity "${entity.id}"`
      )
    }
  }

  return null
}

// ============================================================================
// List Generator
// ============================================================================

export const listGenerator: Generator<ListGeneratorInput, ListViewSchema> = createGenerator(
  'ListGenerator',
  async (input, context, client, options) => {
    const { entity, purpose = 'search', maxColumns = 7, includeFilters = true, apiEndpoint } = input

    // Validate input
    if (!entity || !entity.fields || entity.fields.length === 0) {
      return {
        _tag: 'Err',
        error: invalidInputError('entity', 'Entity must have at least one field'),
      }
    }

    const systemPrompt = buildListSystemPrompt(context)
    const userPrompt = buildListUserPrompt({ entity, purpose, maxColumns, includeFilters })

    const result = await client.generateObject({
      schema: GeneratedListViewSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      schemaName: 'ListViewSchema',
      schemaDescription: 'A list view configuration with columns and filters',
    })

    if (!isOk(result)) {
      return result
    }

    const generated = result.value.value

    // Validation (if enabled)
    if (options.validate) {
      const validationError = validateGeneratedListView(generated, entity)
      if (validationError) {
        return { _tag: 'Err', error: validationError }
      }
    }

    // Map to Manifesto ListViewSchema
    const listViewSchema = mapToListViewSchema(generated, entity, apiEndpoint)

    return ok({
      value: listViewSchema,
      metadata: result.value.metadata,
    })
  },
  {
    temperature: 0.3,
    validate: true,
  }
)

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * 간단한 ListView 생성 헬퍼
 */
export const generateListView = async (
  client: AIClient,
  entity: EntitySchema,
  options: Omit<ListGeneratorInput, 'entity'> = {}
): Promise<ListViewSchema | AIGeneratorError> => {
  const result = await listGenerator.generate(
    { entity, ...options },
    {},
    client
  )

  if (isOk(result)) {
    return result.value.value
  }

  return result.error
}
