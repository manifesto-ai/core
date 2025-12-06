import type { InteractionAtom, SemanticSnapshot, ToolDefinition } from './types'

interface ToolOptions {
  /**
   * If true, omit tools that are not currently available (e.g., submit when form is invalid).
   * Default: false (tools are kept but describe preconditions in the description).
   */
  readonly omitUnavailable?: boolean
}

/**
 * Convert a semantic snapshot into JSON-Schema tool definitions
 * compatible with OpenAI/Claude function calling.
 */
export const toToolDefinitions = (
  snapshot: SemanticSnapshot,
  options: ToolOptions = {}
): ToolDefinition[] => {
  const interactions = new Map(snapshot.interactions.map((i) => [i.id, i]))

  const tools: ToolDefinition[] = []

  const updateFieldChoices = availableUpdateFields(interactions)
  if (updateFieldChoices.length > 0 || !options.omitUnavailable) {
    tools.push(updateFieldTool(updateFieldChoices, options))
  }

  const submitInteraction = interactions.get('submit')
  if (submitInteraction || !options.omitUnavailable) {
    tools.push(submitTool(submitInteraction))
  }

  const resetInteraction = interactions.get('reset')
  if (resetInteraction || !options.omitUnavailable) {
    tools.push(resetTool())
  }

  const validateInteraction = interactions.get('validate')
  if (validateInteraction || !options.omitUnavailable) {
    tools.push(validateTool(snapshot, validateInteraction))
  }

  return tools.filter(Boolean)
}

const updateFieldTool = (choices: readonly string[], options: ToolOptions): ToolDefinition => {
  const unavailable = choices.length === 0
  const description =
    'Update a field value by id. Only visible/enabled fields are actionable.' +
    unavailable && options.omitUnavailable
      ? ''
      : unavailable
        ? ' Currently no fields are available to update.'
        : ''

  return {
    type: 'function',
    function: {
      name: 'updateField',
      description,
      parameters: {
        type: 'object',
        properties: {
          fieldId: {
            type: 'string',
            description: 'Field identifier to update',
            enum: choices.length > 0 ? choices : undefined,
          },
          value: {
            description: 'Value to set. Must respect field type/constraints.',
          },
        },
        required: ['fieldId', 'value'],
        additionalProperties: false,
      },
    },
  }
}

const submitTool = (interaction?: InteractionAtom): ToolDefinition => ({
  type: 'function',
  function: {
    name: 'submit',
    description:
      'Submit the form. ' +
      (interaction?.available === false
        ? `Currently blocked: ${interaction.reason ?? 'form is invalid'}.`
        : 'Will run validations before proceeding.'),
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
})

const resetTool = (): ToolDefinition => ({
  type: 'function',
  function: {
    name: 'reset',
    description: 'Reset the form to its initial values and clear errors.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
})

const validateTool = (
  snapshot: SemanticSnapshot,
  interaction?: InteractionAtom
): ToolDefinition => {
  const fieldIds = Object.keys(snapshot.state.fields)
  return {
    type: 'function',
    function: {
      name: 'validate',
      description:
        'Validate specified fields or the whole form.' +
        (interaction?.available === false ? ' Currently blocked.' : ''),
      parameters: {
        type: 'object',
        properties: {
          fieldIds: {
            type: 'array',
            items: { type: 'string', enum: fieldIds },
            description: 'Optional list of field ids to validate; defaults to all fields.',
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  }
}

type UpdateFieldInteraction = Extract<InteractionAtom, { intent: 'updateField' }>

const availableUpdateFields = (interactions: Map<string, InteractionAtom>): string[] =>
  Array.from(interactions.values())
    .filter((i): i is UpdateFieldInteraction => i.intent === 'updateField' && i.available)
    .map((i) => i.target)
