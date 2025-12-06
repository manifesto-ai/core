/**
 * Form Generator Prompts
 *
 * FormView 생성을 위한 시스템 프롬프트 및 유저 프롬프트 빌더
 */

import type { EntitySchema, DataType } from '@manifesto-ai/schema'
import type { GeneratorContext } from '../../types'
import type { ComponentType } from '../../core/schemas'

// ============================================================================
// System Prompts
// ============================================================================

const BASE_SYSTEM_PROMPT = `You are an expert UI/UX designer specializing in form design.
Your task is to generate an optimal form view configuration from an entity schema.

## Core Principles

1. **Section Organization**
   - Group related fields into logical sections
   - Common patterns: Basic Info, Details, Settings, Metadata
   - Keep sections focused (3-6 fields per section)
   - Order sections by importance/workflow

2. **Component Type Mapping**
   - string → text-input (or textarea for long text)
   - number → number-input (or slider for ranges)
   - boolean → checkbox (or toggle for on/off states)
   - date → date-picker
   - datetime → datetime-picker
   - enum → select (or radio for ≤4 options)
   - reference → autocomplete

3. **Field Configuration**
   - Use appropriate placeholders
   - Add helpful helpText for complex fields
   - Set colSpan based on content width needs
   - Order fields logically within sections

4. **Layout Guidelines**
   - Default to 2 columns for forms
   - Full width (colSpan: 2) for: textarea, rich content
   - Single column for: checkboxes, toggles
   - Group related fields (e.g., firstName + lastName)

5. **Section Naming**
   - basic-info: Core identifying information
   - details: Extended information
   - settings: Configuration options
   - metadata: System fields (createdAt, updatedAt)

## Output Guidelines

- Exclude auto-generated fields (id, createdAt, updatedAt) from create forms
- Include them as read-only in edit forms
- Order fields by importance within sections
- Use meaningful section titles`

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * 시스템 프롬프트 생성
 */
export const buildFormSystemPrompt = (context: GeneratorContext): string => {
  let prompt = BASE_SYSTEM_PROMPT

  if (context.customPrompt) {
    prompt += `\n\n## Custom Instructions\n${context.customPrompt}`
  }

  return prompt
}

/**
 * Entity 정보를 프롬프트용 문자열로 변환
 */
const formatEntityForPrompt = (entity: EntitySchema, mode: 'create' | 'edit'): string => {
  const fieldsInfo = entity.fields
    .map((f) => {
      let fieldStr = `- ${f.id} (${f.dataType}): "${f.label}"`
      if (f.description) {
        fieldStr += ` - ${f.description}`
      }
      if (f.enumValues && f.enumValues.length > 0) {
        const values = f.enumValues.slice(0, 5).map((v) => v.label).join(', ')
        fieldStr += ` [options: ${values}${f.enumValues.length > 5 ? '...' : ''}]`
      }
      if (f.constraints?.some((c) => c.type === 'required')) {
        fieldStr += ' (required)'
      }
      // Mark auto-generated fields
      if (['id', 'createdAt', 'updatedAt'].includes(f.id)) {
        fieldStr += ' [auto-generated]'
      }
      return fieldStr
    })
    .join('\n')

  return `Entity: ${entity.name} (${entity.id})
${entity.description ? `Description: ${entity.description}` : ''}
Mode: ${mode}

Fields:
${fieldsInfo}`
}

/**
 * 유저 프롬프트 생성
 */
export const buildFormUserPrompt = (input: {
  entity: EntitySchema
  mode: 'create' | 'edit'
  maxSections?: number
  columnsPerSection?: number
}): string => {
  const { entity, mode, maxSections = 4, columnsPerSection = 2 } = input

  let prompt = `Generate a form view configuration for the following entity:

${formatEntityForPrompt(entity, mode)}

## Requirements
- Mode: ${mode} (${mode === 'create' ? 'new record creation' : 'existing record editing'})
- Maximum sections: ${maxSections}
- Columns per section: ${columnsPerSection}
${mode === 'create' ? '- Exclude auto-generated fields (id, createdAt, updatedAt)' : '- Include auto-generated fields as read-only reference'}

Design an intuitive form layout with logical field groupings.`

  return prompt
}

// ============================================================================
// Component Type Inference
// ============================================================================

/**
 * DataType에서 ComponentType 추론
 */
export const inferComponentType = (
  dataType: DataType,
  fieldId: string,
  enumCount?: number
): ComponentType => {
  // Special cases based on field name
  const lowerFieldId = fieldId.toLowerCase()

  if (lowerFieldId.includes('description') || lowerFieldId.includes('content') || lowerFieldId.includes('note')) {
    return 'textarea'
  }

  if (lowerFieldId.includes('email')) {
    return 'text-input'
  }

  if (lowerFieldId.includes('password')) {
    return 'text-input'
  }

  // Type-based mapping
  switch (dataType) {
    case 'string':
      return 'text-input'
    case 'number':
      return 'number-input'
    case 'boolean':
      return 'checkbox'
    case 'date':
      return 'date-picker'
    case 'datetime':
      return 'datetime-picker'
    case 'enum':
      // Use radio for small enum sets
      if (enumCount && enumCount <= 4) {
        return 'radio'
      }
      return 'select'
    case 'reference':
      return 'autocomplete'
    default:
      return 'text-input'
  }
}

/**
 * 필드 폭 추론 (colSpan)
 */
export const inferColSpan = (dataType: DataType, fieldId: string): number => {
  const lowerFieldId = fieldId.toLowerCase()

  // Full width fields
  if (
    lowerFieldId.includes('description') ||
    lowerFieldId.includes('content') ||
    lowerFieldId.includes('note') ||
    lowerFieldId.includes('address')
  ) {
    return 2
  }

  // Single column for small inputs
  if (dataType === 'boolean') {
    return 1
  }

  // Default
  return 1
}
