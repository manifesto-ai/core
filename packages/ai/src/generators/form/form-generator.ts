/**
 * Form Generator
 *
 * EntitySchema로부터 FormViewSchema 생성
 */

import type {
  EntitySchema,
  FormViewSchema,
  ViewSection,
  ViewField,
  LayoutConfig,
  ComponentType,
  Reaction,
} from '@manifesto-ai/schema'
import { ok, isOk } from '@manifesto-ai/schema'
import { createGenerator, type Generator } from '../base'
import type { AIClient } from '../../core/client'
import type { AIGeneratorError } from '../../types'
import { schemaValidationError, invalidInputError } from '../../types/errors'
import {
  GeneratedFormViewSchema,
  type GeneratedFormView,
  type GeneratedFormSection,
  type GeneratedFormField,
} from '../../core/schemas'
import { buildFormSystemPrompt, buildFormUserPrompt } from './prompts'
import { generateFormVisibility, type VisibilityConfig } from './visibility'

// ============================================================================
// Input/Output Types
// ============================================================================

export interface FormGeneratorInput {
  readonly entity: EntitySchema
  readonly mode: 'create' | 'edit'
  readonly maxSections?: number
  readonly columnsPerSection?: number
  readonly visibility?: VisibilityConfig
}

// ============================================================================
// Mapping Functions (LLM Output → Manifesto Schema)
// ============================================================================

/**
 * LLM이 생성한 component type을 schema 패키지의 ComponentType으로 매핑
 *
 * LLM이 생성 가능한 타입: text-input, number-input, select, multi-select,
 *   checkbox, radio, date-picker, datetime-picker, textarea, toggle, slider, autocomplete
 * schema 패키지 추가 타입: rich-editor, file-upload, image-upload, color-picker, custom
 *   (사용자가 명시적으로 지정)
 *
 * @see @manifesto-ai/schema의 ComponentType 정의
 */
const mapComponentType = (type: string): ComponentType => {
  // ComponentType의 모든 유효한 값을 매핑
  const typeMap: Record<string, ComponentType> = {
    // LLM이 생성 가능한 기본 타입
    'text-input': 'text-input',
    'number-input': 'number-input',
    select: 'select',
    'multi-select': 'multi-select',
    checkbox: 'checkbox',
    radio: 'radio',
    'date-picker': 'date-picker',
    'datetime-picker': 'datetime-picker',
    textarea: 'textarea',
    toggle: 'toggle',
    slider: 'slider',
    autocomplete: 'autocomplete',
    // 사용자가 명시적으로 지정하는 타입 (LLM은 생성 안함)
    'rich-editor': 'rich-editor',
    'file-upload': 'file-upload',
    'image-upload': 'image-upload',
    'color-picker': 'color-picker',
    custom: 'custom',
  }
  return typeMap[type] ?? 'text-input'
}

const mapField = (
  field: GeneratedFormField,
  entity: EntitySchema,
  fieldReactions?: Map<string, Reaction[]>
): ViewField => {
  const entityField = entity.fields.find((f) => f.id === field.entityFieldId)
  const reactions = fieldReactions?.get(field.entityFieldId)

  const baseField: ViewField = {
    id: field.id,
    entityFieldId: field.entityFieldId,
    component: mapComponentType(field.component),
    label: field.label ?? entityField?.label,
    placeholder: field.placeholder,
    helpText: field.helpText,
    colSpan: field.colSpan ?? 1,
    order: field.order,
    ...(reactions && reactions.length > 0 ? { reactions } : {}),
  }

  return baseField
}

const mapSection = (
  section: GeneratedFormSection,
  entity: EntitySchema,
  columnsPerSection: number,
  fieldReactions?: Map<string, Reaction[]>
): ViewSection => {
  // Sort fields by order
  const sortedFields = [...section.fields].sort((a, b) => a.order - b.order)
  const fields = sortedFields.map((f) => mapField(f, entity, fieldReactions))

  const layout: LayoutConfig = {
    type: 'grid',
    columns: section.columns ?? columnsPerSection,
    gap: '1rem',
  }

  return {
    id: section.id,
    title: section.title,
    description: section.description,
    layout,
    fields,
    collapsible: section.collapsible ?? false,
  }
}

const mapToFormViewSchema = (
  generated: GeneratedFormView,
  entity: EntitySchema,
  columnsPerSection: number,
  fieldReactions?: Map<string, Reaction[]>
): FormViewSchema => {
  // Sort sections by order
  const sortedSections = [...generated.sections].sort((a, b) => a.order - b.order)
  const sections = sortedSections.map((s) => mapSection(s, entity, columnsPerSection, fieldReactions))

  const layout: LayoutConfig = {
    type: 'form',
    columns: columnsPerSection,
  }

  return {
    _type: 'view',
    id: generated.id,
    version: '0.1.0',
    name: generated.name,
    description: generated.description,
    entityRef: entity.id,
    mode: generated.mode,
    layout,
    sections,
    header: {
      title: generated.name,
    },
    footer: {
      actions: [
        {
          id: 'cancel',
          label: generated.cancelLabel ?? 'Cancel',
          variant: 'secondary',
          action: { type: 'cancel' },
        },
        {
          id: 'submit',
          label: generated.submitLabel ?? (generated.mode === 'create' ? 'Create' : 'Save'),
          variant: 'primary',
          action: { type: 'submit' },
        },
      ],
    },
  }
}

// ============================================================================
// Validation
// ============================================================================

const validateGeneratedFormView = (
  generated: GeneratedFormView,
  entity: EntitySchema
): AIGeneratorError | null => {
  // Check that all field entityFieldIds exist in entity
  for (const section of generated.sections) {
    for (const field of section.fields) {
      const fieldExists = entity.fields.some((f) => f.id === field.entityFieldId)
      if (!fieldExists) {
        return schemaValidationError(
          ['sections', section.id, 'fields', field.id, 'entityFieldId'],
          `Field "${field.entityFieldId}" does not exist in entity "${entity.id}"`
        )
      }
    }
  }

  // Check for duplicate field IDs across sections
  const allFieldIds = new Set<string>()
  for (const section of generated.sections) {
    for (const field of section.fields) {
      if (allFieldIds.has(field.id)) {
        return schemaValidationError(
          ['sections', section.id, 'fields', field.id],
          `Duplicate field ID: "${field.id}"`
        )
      }
      allFieldIds.add(field.id)
    }
  }

  return null
}

// ============================================================================
// Form Generator
// ============================================================================

export const formGenerator: Generator<FormGeneratorInput, FormViewSchema> = createGenerator(
  'FormGenerator',
  async (input, context, client, options) => {
    const { entity, mode, maxSections = 4, columnsPerSection = 2, visibility } = input

    // Validate input
    if (!entity || !entity.fields || entity.fields.length === 0) {
      return {
        _tag: 'Err',
        error: invalidInputError('entity', 'Entity must have at least one field'),
      }
    }

    const systemPrompt = buildFormSystemPrompt(context)
    const userPrompt = buildFormUserPrompt({ entity, mode, maxSections, columnsPerSection })

    const result = await client.generateObject({
      schema: GeneratedFormViewSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      schemaName: 'FormViewSchema',
      schemaDescription: 'A form view configuration with sections and fields',
    })

    if (!isOk(result)) {
      return result
    }

    const generated = result.value.value

    // Validation (if enabled)
    if (options.validate) {
      const validationError = validateGeneratedFormView(generated, entity)
      if (validationError) {
        return { _tag: 'Err', error: validationError }
      }
    }

    // Generate visibility reactions if config is provided
    let fieldReactions: Map<string, Reaction[]> | undefined
    if (visibility) {
      fieldReactions = await generateFormVisibility(entity, visibility, client, context)
    }

    // Map to Manifesto FormViewSchema
    const formViewSchema = mapToFormViewSchema(generated, entity, columnsPerSection, fieldReactions)

    return ok({
      value: formViewSchema,
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
 * 간단한 FormView 생성 헬퍼
 */
export const generateFormView = async (
  client: AIClient,
  entity: EntitySchema,
  mode: 'create' | 'edit',
  options: Omit<FormGeneratorInput, 'entity' | 'mode'> = {}
): Promise<FormViewSchema | AIGeneratorError> => {
  const result = await formGenerator.generate(
    { entity, mode, ...options },
    {},
    client
  )

  if (isOk(result)) {
    return result.value.value
  }

  return result.error
}
