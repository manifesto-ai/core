/**
 * Entity Generator
 *
 * 자연어 설명으로부터 EntitySchema 생성
 */

import type { EntitySchema, EntityField, Constraint, EnumValue, Relation } from '@manifesto-ai/schema'
import { ok, isOk } from '@manifesto-ai/schema'
import { createGenerator, type Generator } from '../base'
import type { AIClient } from '../../core/client'
import type { GeneratorContext, AIGeneratorError } from '../../types'
import { schemaValidationError } from '../../types/errors'
import { GeneratedEntitySchema, type GeneratedEntity, type GeneratedField } from '../../core/schemas'
import { buildSystemPrompt, buildUserPrompt } from './prompts'

// ============================================================================
// Input/Output Types
// ============================================================================

export interface EntityGeneratorInput {
  readonly domainDescription: string
  readonly hints?: readonly string[]
  readonly relatedEntities?: readonly string[]
}

// ============================================================================
// Mapping Functions (LLM Output → Manifesto Schema)
// ============================================================================

const mapConstraints = (field: GeneratedField): readonly Constraint[] => {
  const constraints: Constraint[] = []

  if (field.required) {
    constraints.push({
      type: 'required',
      message: `${field.label} is required`,
    })
  }

  if (field.constraints) {
    for (const c of field.constraints) {
      constraints.push({
        type: c.type,
        value: c.value,
        message: c.message,
      })
    }
  }

  return constraints
}

const mapEnumValues = (field: GeneratedField): readonly EnumValue[] | undefined => {
  if (field.dataType !== 'enum' || !field.enumValues) {
    return undefined
  }

  return field.enumValues.map((ev) => ({
    value: ev.value,
    label: ev.label,
    description: ev.description,
  }))
}

const mapField = (field: GeneratedField): EntityField => {
  const constraints = mapConstraints(field)
  const enumValues = mapEnumValues(field)

  const baseField: EntityField = {
    id: field.id,
    dataType: field.dataType,
    label: field.label,
    description: field.description,
    defaultValue: field.defaultValue,
    ...(constraints.length > 0 && { constraints }),
    ...(enumValues && { enumValues }),
  }

  if (field.dataType === 'reference' && field.reference) {
    return {
      ...baseField,
      reference: {
        entity: field.reference.entity,
        displayField: field.reference.displayField,
        valueField: field.reference.valueField,
      },
    }
  }

  return baseField
}

const mapRelations = (entity: GeneratedEntity): readonly Relation[] | undefined => {
  if (!entity.relations || entity.relations.length === 0) {
    return undefined
  }

  return entity.relations.map((rel) => ({
    type: rel.type,
    target: rel.target,
    foreignKey: rel.foreignKey,
    through: rel.through,
  }))
}

const mapToEntitySchema = (generated: GeneratedEntity): EntitySchema => {
  const fields = generated.fields.map(mapField)
  const relations = mapRelations(generated)

  return {
    _type: 'entity',
    id: generated.id,
    version: '0.1.0',
    name: generated.name,
    description: generated.description,
    fields,
    ...(relations && { relations }),
    ...(generated.tags && { tags: generated.tags }),
  }
}

// ============================================================================
// Validation
// ============================================================================

const validateGeneratedEntity = (entity: GeneratedEntity): AIGeneratorError | null => {
  // ID 필드 존재 확인
  const hasId = entity.fields.some((f) => f.id === 'id')
  if (!hasId) {
    return schemaValidationError(['fields'], 'Entity must have an "id" field')
  }

  // 중복 필드 ID 확인
  const fieldIds = new Set<string>()
  for (const field of entity.fields) {
    if (fieldIds.has(field.id)) {
      return schemaValidationError(['fields', field.id], `Duplicate field ID: ${field.id}`)
    }
    fieldIds.add(field.id)
  }

  // enum 타입 필드에 enumValues 확인
  for (const field of entity.fields) {
    if (field.dataType === 'enum' && (!field.enumValues || field.enumValues.length === 0)) {
      return schemaValidationError(
        ['fields', field.id, 'enumValues'],
        `Enum field "${field.id}" must have enumValues`
      )
    }
  }

  return null
}

// ============================================================================
// Entity Generator
// ============================================================================

export const entityGenerator: Generator<EntityGeneratorInput, EntitySchema> = createGenerator(
  'EntityGenerator',
  async (input, context, client, options) => {
    const systemPrompt = buildSystemPrompt(context)
    const userPrompt = buildUserPrompt(input)

    const result = await client.generateObject({
      schema: GeneratedEntitySchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      schemaName: 'EntitySchema',
      schemaDescription: 'A database entity schema with fields and relations',
    })

    if (!isOk(result)) {
      return result
    }

    const generated = result.value.value

    // Validation (if enabled)
    if (options.validate) {
      const validationError = validateGeneratedEntity(generated)
      if (validationError) {
        return { _tag: 'Err', error: validationError }
      }
    }

    // Map to Manifesto EntitySchema
    const entitySchema = mapToEntitySchema(generated)

    return ok({
      value: entitySchema,
      metadata: result.value.metadata,
    })
  },
  {
    temperature: 0.3, // Lower temperature for consistent schema generation
    validate: true,
  }
)

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * 간단한 Entity 생성 헬퍼
 *
 * @example
 * ```typescript
 * const result = await generateEntity(
 *   client,
 *   'A customer entity for an e-commerce platform with name, email, and address',
 *   { industry: { type: 'commerce' } }
 * )
 * ```
 */
export const generateEntity = async (
  client: AIClient,
  description: string,
  context: GeneratorContext = {}
): Promise<EntitySchema | AIGeneratorError> => {
  const result = await entityGenerator.generate({ domainDescription: description }, context, client)

  if (isOk(result)) {
    return result.value.value
  }

  return result.error
}
