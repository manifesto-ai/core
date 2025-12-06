/**
 * List Generator Prompts
 *
 * ListView 생성을 위한 시스템 프롬프트 및 유저 프롬프트 빌더
 */

import type { EntitySchema } from '@manifesto-ai/schema'
import type { GeneratorContext } from '../../types'

// ============================================================================
// System Prompts
// ============================================================================

const BASE_SYSTEM_PROMPT = `You are an expert UI/UX designer specializing in data table design.
Your task is to generate an optimal list view configuration from an entity schema.

## Core Principles

1. **Smart Column Selection**
   - Select the most important fields for display (max 5-7 columns)
   - Always include identifying fields (id, name, code) first
   - Prioritize fields users need most for quick scanning
   - Exclude large text fields (descriptions, content) from main columns

2. **Column Type Mapping**
   - string → text
   - number → number (with appropriate formatting)
   - boolean → boolean (shows as Yes/No or checkmark)
   - date/datetime → date/datetime
   - enum → enum or badge (for status fields)

3. **Column Configuration**
   - Enable sorting for primary columns (name, date, status)
   - Enable filtering for enum/status fields
   - Right-align numbers, left-align text
   - Set reasonable column widths

4. **Filter Design**
   - Include filters for commonly searched fields
   - Use 'select' type for enum fields
   - Use 'date-range' for date fields
   - Use 'text' for string search

5. **Priority Assignment**
   - 1-2: Core identifiers (name, id, code)
   - 3-4: Key business data (status, amount)
   - 5-7: Secondary information
   - 8-10: Additional context

## Output Guidelines

- Generate columns in priority order (most important first)
- Include sensible defaults for sorting (usually by name or date)
- Match column types exactly to the display format needed`

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * 시스템 프롬프트 생성
 */
export const buildListSystemPrompt = (context: GeneratorContext): string => {
  let prompt = BASE_SYSTEM_PROMPT

  if (context.customPrompt) {
    prompt += `\n\n## Custom Instructions\n${context.customPrompt}`
  }

  return prompt
}

/**
 * Entity 정보를 프롬프트용 문자열로 변환
 */
const formatEntityForPrompt = (entity: EntitySchema): string => {
  const fieldsInfo = entity.fields
    .map((f) => {
      let fieldStr = `- ${f.id} (${f.dataType}): "${f.label}"`
      if (f.enumValues && f.enumValues.length > 0) {
        const values = f.enumValues.slice(0, 5).map((v) => v.label).join(', ')
        fieldStr += ` [options: ${values}${f.enumValues.length > 5 ? '...' : ''}]`
      }
      if (f.constraints?.some((c) => c.type === 'required')) {
        fieldStr += ' (required)'
      }
      return fieldStr
    })
    .join('\n')

  return `Entity: ${entity.name} (${entity.id})
${entity.description ? `Description: ${entity.description}` : ''}

Fields:
${fieldsInfo}`
}

/**
 * 유저 프롬프트 생성
 */
export const buildListUserPrompt = (input: {
  entity: EntitySchema
  purpose?: 'search' | 'overview' | 'selection' | 'report'
  maxColumns?: number
  includeFilters?: boolean
}): string => {
  const { entity, purpose = 'search', maxColumns = 7, includeFilters = true } = input

  let prompt = `Generate a list view configuration for the following entity:

${formatEntityForPrompt(entity)}

## Requirements
- Purpose: ${purpose}
- Maximum columns: ${maxColumns}
- Include filters: ${includeFilters ? 'yes' : 'no'}

Select the most relevant columns for this list view and configure them appropriately.`

  return prompt
}

// ============================================================================
// Column Type Inference
// ============================================================================

/**
 * DataType에서 ColumnType 추론
 */
export const inferColumnType = (
  dataType: string,
  fieldId: string
): 'text' | 'number' | 'date' | 'datetime' | 'boolean' | 'enum' | 'badge' => {
  // Status 필드는 badge로 표시
  if (fieldId.toLowerCase().includes('status') || fieldId.toLowerCase().includes('state')) {
    return 'badge'
  }

  switch (dataType) {
    case 'string':
      return 'text'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'date':
      return 'date'
    case 'datetime':
      return 'datetime'
    case 'enum':
      return 'enum'
    default:
      return 'text'
  }
}
