/**
 * Condition Generator Prompts
 *
 * 자연어 비즈니스 규칙을 Expression AST로 변환하기 위한 프롬프트
 */

import type { ConditionTarget } from '../../core/schemas/condition.schema'

// ============================================================================
// System Prompts
// ============================================================================

const BASE_SYSTEM_PROMPT = `You are an expert at converting natural language business rules into executable expression ASTs.
Your task is to generate Mapbox-style Expression arrays from Korean or English business rule descriptions.

## Expression Format

Expressions are arrays where the first element is the operator and remaining elements are operands:
- Comparison: ["==", operand1, operand2], ["!=", ...], [">", ...], [">=", ...], ["<", ...], ["<=", ...]
- Logical: ["AND", expr1, expr2, ...], ["OR", expr1, expr2, ...], ["NOT", expr]
- Collection: ["IN", value, [array]], ["NOT_IN", ...], ["CONTAINS", arr, value], ["IS_EMPTY", value]
- Type check: ["IS_NULL", value], ["IS_NOT_NULL", value]

## Context References

Use these prefixes for dynamic values:
- \`$state.fieldId\` - Current form field value (most common)
- \`$user.property\` - User information (role, email, etc.)
- \`$context.key\` - Application context
- \`$params.key\` - URL/route parameters

## Examples

1. "VIP 고객만 보임" → ["==", "$state.status", "VIP"]
2. "금액이 100만원 이상" → [">=", "$state.amount", 1000000]
3. "이름이 비어있으면" → ["IS_EMPTY", "$state.name"]
4. "상태가 활성이고 등급이 골드일 때" → ["AND", ["==", "$state.status", "active"], ["==", "$state.grade", "gold"]]
5. "관리자 또는 매니저만" → ["OR", ["==", "$user.role", "admin"], ["==", "$user.role", "manager"]]

## Output Requirements

1. Always return valid expression arrays
2. Use $state.fieldId for form field references
3. Match field IDs exactly from the available fields list
4. Prefer simple operators over complex nested expressions
5. Use proper types: strings in quotes, numbers without quotes`

const TARGET_PROMPTS: Record<ConditionTarget, string> = {
  visibility: `
## Visibility Condition Rules

- Expression must evaluate to boolean (true = visible, false = hidden)
- Common patterns:
  - Show field when another field has specific value
  - Show section based on user role
  - Show based on entity status
- Return true/false result`,

  disabled: `
## Disabled Condition Rules

- Expression must evaluate to boolean (true = disabled, false = enabled)
- Common patterns:
  - Disable until required fields are filled
  - Disable based on status (e.g., "approved" status = read-only)
  - Disable for certain user roles
- Return true/false result`,

  validation: `
## Validation Condition Rules

- Expression must evaluate to boolean (true = valid, false = invalid)
- Common patterns:
  - Check field value ranges
  - Cross-field validation (endDate > startDate)
  - Conditional required fields
- Consider edge cases (null, empty string)`,

  reaction: `
## Reaction Condition Rules

- Expression defines when a reaction (side effect) should trigger
- Common patterns:
  - Update field when another changes
  - Calculate derived values
  - Auto-fill based on selection
- Expression triggers the reaction when true`,
}

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * 시스템 프롬프트 생성
 */
export const buildSystemPrompt = (target: ConditionTarget): string => {
  return BASE_SYSTEM_PROMPT + TARGET_PROMPTS[target]
}

/**
 * 유저 프롬프트 생성
 */
export const buildUserPrompt = (input: {
  readonly naturalLanguageRule: string
  readonly target: ConditionTarget
  readonly entityId: string
  readonly availableFields: readonly string[]
  readonly hints?: readonly string[]
}): string => {
  let prompt = `Convert the following business rule to an Expression AST:

**Rule:** ${input.naturalLanguageRule}

**Target:** ${input.target}

**Entity:** ${input.entityId}

**Available Fields:**
${input.availableFields.map(f => `- ${f}`).join('\n')}`

  if (input.hints && input.hints.length > 0) {
    prompt += `

**Additional Context:**
${input.hints.map(h => `- ${h}`).join('\n')}`
  }

  prompt += `

Generate the Expression AST and explain what fields are referenced.`

  return prompt
}

// ============================================================================
// Few-shot Examples
// ============================================================================

export const FEW_SHOT_EXAMPLES = {
  visibility: [
    {
      input: 'VIP 고객만 보임',
      availableFields: ['status', 'name', 'email', 'grade'],
      output: {
        expression: ['==', '$state.grade', 'VIP'],
        referencedFields: ['grade'],
        interpretation: 'Field is visible only when grade equals "VIP"',
      },
    },
    {
      input: '상태가 승인됨일 때 보임',
      availableFields: ['status', 'amount', 'description'],
      output: {
        expression: ['==', '$state.status', 'approved'],
        referencedFields: ['status'],
        interpretation: 'Field is visible only when status equals "approved"',
      },
    },
  ],

  comparison: [
    {
      input: '금액이 100만원 이상',
      availableFields: ['amount', 'status', 'customerId'],
      output: {
        expression: ['>=', '$state.amount', 1000000],
        referencedFields: ['amount'],
        interpretation: 'Condition is true when amount is 1,000,000 or more',
      },
    },
    {
      input: '수량이 0보다 큼',
      availableFields: ['quantity', 'price', 'productId'],
      output: {
        expression: ['>', '$state.quantity', 0],
        referencedFields: ['quantity'],
        interpretation: 'Condition is true when quantity is greater than 0',
      },
    },
  ],

  composite: [
    {
      input: '상태가 활성이고 등급이 프리미엄일 때',
      availableFields: ['status', 'grade', 'name'],
      output: {
        expression: ['AND', ['==', '$state.status', 'active'], ['==', '$state.grade', 'premium']],
        referencedFields: ['status', 'grade'],
        interpretation: 'Condition is true when status is "active" AND grade is "premium"',
      },
    },
    {
      input: '관리자이거나 매니저일 때',
      availableFields: ['role', 'name', 'email'],
      output: {
        expression: ['OR', ['==', '$state.role', 'admin'], ['==', '$state.role', 'manager']],
        referencedFields: ['role'],
        interpretation: 'Condition is true when role is "admin" OR "manager"',
      },
    },
  ],

  presence: [
    {
      input: '이름이 입력되었으면',
      availableFields: ['name', 'email', 'phone'],
      output: {
        expression: ['IS_NOT_NULL', '$state.name'],
        referencedFields: ['name'],
        interpretation: 'Condition is true when name has a value',
      },
    },
    {
      input: '설명이 비어있으면',
      availableFields: ['title', 'description', 'category'],
      output: {
        expression: ['IS_EMPTY', '$state.description'],
        referencedFields: ['description'],
        interpretation: 'Condition is true when description is empty',
      },
    },
  ],
}

/**
 * Few-shot 예제를 프롬프트 형식으로 변환
 */
export const formatFewShotExamples = (category?: keyof typeof FEW_SHOT_EXAMPLES): string => {
  const categories = category ? [category] : Object.keys(FEW_SHOT_EXAMPLES) as (keyof typeof FEW_SHOT_EXAMPLES)[]

  const examples: string[] = []

  for (const cat of categories) {
    const categoryExamples = FEW_SHOT_EXAMPLES[cat]
    for (const example of categoryExamples) {
      examples.push(`Input: "${example.input}"
Available fields: [${example.availableFields.join(', ')}]
Output:
\`\`\`json
${JSON.stringify(example.output, null, 2)}
\`\`\``)
    }
  }

  return examples.join('\n\n')
}
