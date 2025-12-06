import { openai } from '@ai-sdk/openai'
import { streamText, tool } from 'ai'
import { z } from 'zod'
import { toToolDefinitions, type SemanticSnapshot } from '@manifesto-ai/ai-util'

const SYSTEM_PROMPT = `You are the "Form Logic Engine" for the Manifesto DSL Playground.
You must bridge the gap between User Intent (Natural Language) and System Logic (Schema/IDs).

### 1. STRICT TRANSLATION LAYER (The Golden Rule)
You must effectively separate "Speaking" from "Acting".
- **WHEN SPEAKING (Output)**:
  - **NEVER** mention raw IDs like \`companyName\` or \`accountType\`.
  - **ALWAYS** use the human-readable **Labels/Titles** defined in the ViewSchema (e.g., "Company Name", "Account Type").
  - If a user says "Company", you must internally map it to the schema value (e.g., \`"business"\`).
- **WHEN ACTING (Tools)**:
  - **ALWAYS** use raw IDs and Logical Values (e.g., \`fieldId: "accountType", value: "business"\`).
  - **NEVER** use labels in tool parameters.

### 2. VISIBLE-FIRST STRATEGY (Causal Reasoning)
When a user asks to interact with a field (e.g., "I want to enter the Company Name"):
1. **Check Visibility**: Is the field currently visible in the ViewSchema?
   - Look at the \`visible\` expression (e.g., \`['==', '$state.accountType', 'business']\`).
2. **Handle Hidden Fields**:
   - If hidden, **DO NOT** ask for the value of the hidden field yet.
   - Instead, explain the **Dependency**: "To see the **Company Name**, you must first select **Business** in the **Account Type**."
   - **Propose the Action**: Ask if they want to set the controlling field (Account Type) to the required value (Business).
3. **Handle Visible Fields**:
   - Only if the field is visible, proceed to ask for the value or update it.

### 3. SMART VALUE MAPPING
- Users will say "Company" (Label). You must find the matching \`option\` in the schema where \`label: "Company"\` and use its \`value\` (e.g., \`"business"\`).
- Do NOT inject the label "Company" as a value unless the schema explicitly allows it.

### Summary of Behavior
User: "I can't see the Company Name field."
BAD AI: "The \`companyName\` field exists. It is hidden because \`accountType\` is empty."
GOOD AI: "The **Company Name** field is currently hidden. It only appears when you select **Company** for the **Account Type**. Would you like me to set that for you?"`

// Tool result types
export type UpdateFieldResult = {
  type: 'updateField'
  fieldId: string
  value: unknown
  success: boolean
  error?: string
}
export type ValidateResult = { type: 'validate'; fieldIds?: string[] }
export type ResetResult = { type: 'reset' }
export type SubmitResult = { type: 'submit' }
export type ToolResult = UpdateFieldResult | ValidateResult | ResetResult | SubmitResult

/**
 * Validate value against field's dataType and enumValues
 */
function validateFieldValue(
  value: unknown,
  field: { dataType?: string; enumValues?: readonly { value: string | number }[] }
): string | null {
  // Empty values pass (required is a separate constraint)
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (!field.dataType) {
    return null
  }

  switch (field.dataType) {
    case 'string':
      if (typeof value !== 'string') {
        return 'Expected a string value'
      }
      break

    case 'number':
      if (typeof value === 'string') {
        const num = Number(value)
        if (isNaN(num)) {
          return 'Expected a number value'
        }
      } else if (typeof value !== 'number' || isNaN(value)) {
        return 'Expected a number value'
      }
      break

    case 'boolean':
      if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
        return 'Expected true or false'
      }
      break

    case 'date':
    case 'datetime':
      if (typeof value === 'string') {
        const date = new Date(value)
        if (isNaN(date.getTime())) {
          return 'Invalid date format'
        }
      }
      break

    case 'enum':
      if (field.enumValues && field.enumValues.length > 0) {
        const validValues = field.enumValues.map((e) => e.value)
        if (!validValues.includes(value as string | number)) {
          const labels = validValues.join(', ')
          return `Invalid option. Valid options: ${labels}`
        }
      }
      break

    case 'array':
      if (!Array.isArray(value)) {
        return 'Expected an array'
      }
      break

    case 'object':
      if (typeof value !== 'object' || Array.isArray(value)) {
        return 'Expected an object'
      }
      break

    case 'reference':
      // reference는 보통 string 또는 number ID
      if (typeof value !== 'string' && typeof value !== 'number') {
        return 'Expected a valid reference value (string or number)'
      }
      break
  }

  return null
}

// Build tools based on semantic snapshot
function buildTools(snapshot: SemanticSnapshot | null) {
  // Get available field IDs from snapshot interactions
  const availableFieldIds: string[] = []

  if (snapshot?.interactions) {
    for (const interaction of snapshot.interactions) {
      if (interaction.intent === 'updateField' && interaction.available && interaction.target) {
        availableFieldIds.push(interaction.target)
      }
    }
  } else if (snapshot?.state?.fields) {
    availableFieldIds.push(...Object.keys(snapshot.state.fields))
  }

  // Generate tool definitions from semantic snapshot for description enhancement
  let toolDescriptions: Record<string, string> = {}

  if (snapshot) {
    try {
      const toolDefs = toToolDefinitions(snapshot)
      for (const def of toolDefs) {
        if (def.function.description) {
          toolDescriptions[def.function.name] = def.function.description
        }
      }
    } catch {
      // Fallback to default descriptions
    }
  }

  return {
    updateField: tool({
      description:
        toolDescriptions['updateField'] ||
        'Update a form field value. Use this when the user asks to fill in or change a field.',
      parameters: z.object({
        fieldId:
          availableFieldIds.length > 0
            ? z.enum(availableFieldIds as [string, ...string[]]).describe('The field ID to update')
            : z.string().describe('The field ID to update'),
        value: z.any().describe('The new value for the field'),
      }),
      execute: async ({ fieldId, value }) => {
        // Get field info from snapshot for validation
        const field = snapshot?.state.fields[fieldId]

        if (field) {
          // Validate value against field type
          const error = validateFieldValue(value, field)
          if (error) {
            return {
              type: 'updateField' as const,
              fieldId,
              value,
              success: false,
              error,
            }
          }
        }

        return { type: 'updateField' as const, fieldId, value, success: true }
      },
    }),
    validate: tool({
      description:
        toolDescriptions['validate'] || 'Validate form fields. Use this to check if form data is valid.',
      parameters: z.object({
        fieldIds: z
          .array(z.string())
          .optional()
          .describe('Specific field IDs to validate, or omit for all fields'),
      }),
      execute: async ({ fieldIds }) => {
        return { type: 'validate' as const, fieldIds }
      },
    }),
    reset: tool({
      description: toolDescriptions['reset'] || 'Reset the form to its initial values.',
      parameters: z.object({}),
      execute: async () => {
        return { type: 'reset' as const }
      },
    }),
    submit: tool({
      description:
        toolDescriptions['submit'] ||
        'Submit the form. Only use when the form is valid and user explicitly asks to submit.',
      parameters: z.object({}),
      execute: async () => {
        return { type: 'submit' as const }
      },
    }),
  }
}

// Build context info from schema and form state
function buildContextInfo(
  schemaContext: { viewId?: string; entityId?: string } | undefined,
  snapshot: SemanticSnapshot | null
): string {
  let contextInfo = ''

  if (schemaContext) {
    contextInfo += `\n\nCurrent schema: Entity="${schemaContext.entityId || 'none'}", View="${schemaContext.viewId || 'none'}"`
  }

  if (snapshot) {
    contextInfo += `\n\nForm state: isValid=${snapshot.state.form.isValid}, isDirty=${snapshot.state.form.isDirty}`
    contextInfo += `\n\nCurrent values: ${JSON.stringify(snapshot.state.values, null, 2)}`
    contextInfo += `\n\nAvailable fields: ${Object.keys(snapshot.state.fields).join(', ')}`
  }

  return contextInfo
}

// Form Agent configuration
export interface FormAgentConfig {
  snapshot: SemanticSnapshot | null
  schemaContext?: { viewId?: string; entityId?: string }
}

// Create a streaming response using streamText
export function createFormAgentStream(
  config: FormAgentConfig,
  messages: Array<{ role: string; content: string }>
) {
  const { snapshot, schemaContext } = config
  const contextInfo = buildContextInfo(schemaContext, snapshot)
  const tools = buildTools(snapshot)

  return streamText({
    model: openai('gpt-4o-mini'),
    system: SYSTEM_PROMPT + contextInfo,
    messages: messages as Parameters<typeof streamText>[0]['messages'],
    tools,
    toolCallStreaming: true,
  })
}
