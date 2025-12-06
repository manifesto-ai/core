# AI-Util Usage Examples

Practical examples for integrating `@manifesto-ai/ai-util` with AI agents.

## Table of Contents

- [Basic Setup](#basic-setup)
- [Example 1: Simple Form Assistant](#example-1-simple-form-assistant)
- [Example 2: Handling Hidden Fields](#example-2-handling-hidden-fields)
- [Example 3: Deferred Mode Workflow](#example-3-deferred-mode-workflow)
- [Example 4: OpenAI Function Calling](#example-4-openai-function-calling)
- [Example 5: Multi-Turn Conversation](#example-5-multi-turn-conversation)
- [Example 6: Complex OR Conditions](#example-6-complex-or-conditions)

---

## Basic Setup

```ts
import { createFormRuntime } from '@manifesto-ai/engine'
import {
  createInteroperabilitySession,
  toToolDefinitions,
  generateSystemPrompt,
} from '@manifesto-ai/ai-util'

// 1. Create runtime from schema
const runtime = createFormRuntime(viewSchema, {
  initialValues: { name: '', category: 'BOOK', price: 0 },
})
runtime.initialize()

// 2. Create AI session
const session = createInteroperabilitySession({
  runtime,
  viewSchema,
  defaultPolicy: 'guided',
})

// 3. Get initial context
const snapshot = session.snapshot()
const tools = toToolDefinitions(snapshot)
const systemPrompt = generateSystemPrompt(snapshot)
```

---

## Example 1: Simple Form Assistant

A basic assistant that helps fill out a product form.

```ts
import {
  createInteroperabilitySession,
  toToolDefinitions,
  generateSystemPrompt,
} from '@manifesto-ai/ai-util'

class FormAssistant {
  private session: InteroperabilitySession

  constructor(runtime: FormRuntime, viewSchema: FormViewSchema) {
    this.session = createInteroperabilitySession({
      runtime,
      viewSchema,
      defaultPolicy: 'guided',
    })
  }

  // Get context for LLM
  getContext() {
    const snapshot = this.session.snapshot()
    return {
      systemPrompt: generateSystemPrompt(snapshot),
      tools: toToolDefinitions(snapshot, { omitUnavailable: true }),
    }
  }

  // Execute tool call from LLM
  executeTool(name: string, args: Record<string, unknown>) {
    const snapshot = this.session.snapshot()

    switch (name) {
      case 'updateField':
        return this.session.dispatch({
          type: 'updateField',
          fieldId: args.fieldId as string,
          value: args.value,
        })

      case 'submit':
        return this.session.dispatch({ type: 'submit' })

      case 'validate':
        return this.session.dispatch({
          type: 'validate',
          fieldIds: args.fieldIds as string[] | undefined,
        })

      case 'reset':
        return this.session.dispatch({ type: 'reset' })

      default:
        return { _tag: 'Err', error: { type: 'UNKNOWN_TOOL' } }
    }
  }

  // Handle result and generate response
  handleResult(result: Result<AgentActionResult, AgentActionError>) {
    if (result._tag === 'Ok') {
      const { snapshot, delta, appliedPendingUpdates } = result.value

      let response = 'Action completed successfully.'

      if (appliedPendingUpdates?.length) {
        response += ` Also applied pending updates for: ${appliedPendingUpdates.join(', ')}.`
      }

      if (!snapshot.state.form.isValid) {
        const errors = Object.entries(snapshot.state.fields)
          .filter(([_, f]) => f.meta.errors.length > 0)
          .map(([id, f]) => `${id}: ${f.meta.errors.join(', ')}`)
        response += ` Validation errors: ${errors.join('; ')}`
      }

      return response
    }

    // Handle errors
    const error = result.error
    switch (error.type) {
      case 'FIELD_FORBIDDEN':
        if (error.visibilityMeta) {
          const steps = error.visibilityMeta.satisfactionPath
            ?.map(s => `${s.action} ${s.field} to ${JSON.stringify(s.targetValue)}`)
            .join(', then ')
          return `Cannot modify ${error.fieldId}: it's ${error.reason.toLowerCase()}. To enable it: ${steps}`
        }
        return `Cannot modify ${error.fieldId}: it's ${error.reason.toLowerCase()}.`

      case 'TYPE_MISMATCH':
        return `Invalid value for ${error.fieldId}: ${error.message}`

      case 'ACTION_REJECTED':
        return `Action rejected: ${error.message}`

      default:
        return `Error: ${JSON.stringify(error)}`
    }
  }
}

// Usage
const assistant = new FormAssistant(runtime, viewSchema)
const { systemPrompt, tools } = assistant.getContext()

// Send to LLM, get tool call back
const toolCall = { name: 'updateField', args: { fieldId: 'name', value: 'Widget Pro' } }
const result = assistant.executeTool(toolCall.name, toolCall.args)
const response = assistant.handleResult(result)
```

---

## Example 2: Handling Hidden Fields

Intelligent handling when agents try to modify hidden fields.

```ts
import {
  createInteroperabilitySession,
  generateVisibilityExplanation,
  generateSatisfactionGuide,
} from '@manifesto-ai/ai-util'

const session = createInteroperabilitySession({
  runtime,
  viewSchema,
  defaultPolicy: 'guided',  // Get detailed reasoning on failures
})

// User asks: "Set the digital price limit to $50"
// But priceLimit is hidden (only visible when category == 'DIGITAL')

const result = session.dispatch({
  type: 'updateField',
  fieldId: 'priceLimit',
  value: 50,
})

if (result._tag === 'Err' && result.error.type === 'FIELD_FORBIDDEN') {
  const { visibilityMeta } = result.error

  if (visibilityMeta) {
    // Generate explanation for the user
    const explanation = generateVisibilityExplanation(visibilityMeta)
    // "Field is hidden because:
    //  - category must equal "DIGITAL""

    const guide = generateSatisfactionGuide(visibilityMeta)
    // "To make this field visible:
    //  1. set category to "DIGITAL""

    // Agent can respond:
    // "I cannot set priceLimit right now because it's hidden.
    //  The field will become available once you set category to 'DIGITAL'.
    //  Would you like me to do that first?"
  }
}

// Proactive approach: Check before attempting
const snapshot = session.snapshot()
const constraint = snapshot.constraints['priceLimit']

if (constraint.hidden && constraint.visibilityMeta) {
  // Plan the required steps BEFORE attempting the action
  const steps = constraint.visibilityMeta.satisfactionPath
  // Agent can proactively ask user's permission to change category first
}
```

---

## Example 3: Deferred Mode Workflow

Automatic handling of out-of-order field updates.

```ts
import { createInteroperabilitySession } from '@manifesto-ai/ai-util'

// Deferred mode: store values for hidden fields, apply when visible
const session = createInteroperabilitySession({
  runtime,
  viewSchema,
  defaultPolicy: 'deferred',
})

// User provides all data at once, even for hidden fields
const userData = {
  name: 'Premium Widget',
  category: 'BOOK',        // priceLimit hidden when category != 'DIGITAL'
  priceLimit: 99,          // Will be deferred
  description: 'A great widget',
}

// Apply all fields - order doesn't matter
for (const [fieldId, value] of Object.entries(userData)) {
  const result = session.dispatch({
    type: 'updateField',
    fieldId,
    value,
  })

  if (result._tag === 'Ok' && result.value.snapshot.pendingUpdates) {
    console.log('Pending updates:', Object.keys(result.value.snapshot.pendingUpdates))
    // ['priceLimit'] - stored but not yet applied
  }
}

// Check pending updates
const snapshot1 = session.snapshot()
console.log(snapshot1.pendingUpdates)
// { priceLimit: { fieldId: 'priceLimit', value: 99, blockedBy: ['category'], ... } }

// Later: user changes category to DIGITAL
const result = session.dispatch({
  type: 'updateField',
  fieldId: 'category',
  value: 'DIGITAL',
})

if (result._tag === 'Ok') {
  // priceLimit was automatically applied!
  console.log(result.value.appliedPendingUpdates)
  // ['priceLimit']

  console.log(result.value.snapshot.state.values['priceLimit'])
  // 99

  console.log(result.value.snapshot.pendingUpdates)
  // undefined (all pending updates applied)
}
```

---

## Example 4: OpenAI Function Calling

Integration with OpenAI's function calling API.

```ts
import OpenAI from 'openai'
import {
  createInteroperabilitySession,
  toToolDefinitions,
  generateSystemPrompt,
} from '@manifesto-ai/ai-util'

const openai = new OpenAI()

async function runFormAssistant(userMessage: string) {
  const session = createInteroperabilitySession({
    runtime,
    viewSchema,
    defaultPolicy: 'guided',
  })

  const snapshot = session.snapshot()

  // Convert to OpenAI format
  const tools = toToolDefinitions(snapshot, { omitUnavailable: true })
    .map(tool => ({
      type: 'function' as const,
      function: tool.function,
    }))

  const systemPrompt = generateSystemPrompt(snapshot, {
    includeValues: true,
    includeVisibilityReasoning: true,
  })

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    tools,
    tool_choice: 'auto',
  })

  const message = response.choices[0].message

  if (message.tool_calls) {
    for (const toolCall of message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments)

      let result
      switch (toolCall.function.name) {
        case 'updateField':
          result = session.dispatch({
            type: 'updateField',
            fieldId: args.fieldId,
            value: args.value,
          })
          break
        case 'submit':
          result = session.dispatch({ type: 'submit' })
          break
        // ... other tools
      }

      // Process result and continue conversation...
    }
  }

  return message.content
}

// Usage
await runFormAssistant("Set the product name to 'Super Widget' and price to 29.99")
```

---

## Example 5: Multi-Turn Conversation

Efficient context management across conversation turns.

```ts
import {
  createInteroperabilitySession,
  generateSystemPrompt,
  generateDeltaUpdate,
  compressSnapshot,
} from '@manifesto-ai/ai-util'

class ConversationManager {
  private session: InteroperabilitySession
  private previousSnapshot: SemanticSnapshot | null = null

  constructor(runtime: FormRuntime, viewSchema: FormViewSchema) {
    this.session = createInteroperabilitySession({
      runtime,
      viewSchema,
      defaultPolicy: 'guided',
    })
  }

  // First turn: send full context
  getInitialContext(): string {
    const snapshot = this.session.snapshot()
    this.previousSnapshot = snapshot
    return generateSystemPrompt(snapshot)
  }

  // Subsequent turns: send only delta
  getDeltaContext(): string {
    const currentSnapshot = this.session.snapshot()

    if (!this.previousSnapshot) {
      return this.getInitialContext()
    }

    const delta = generateDeltaUpdate(this.previousSnapshot, currentSnapshot)
    this.previousSnapshot = currentSnapshot

    if (delta === 'No changes') {
      return 'Form state unchanged.'
    }

    return `Form updates:\n${delta}`
  }

  // For very long conversations, use compressed format
  getCompressedContext(): string {
    const snapshot = this.session.snapshot()
    const compressed = compressSnapshot(snapshot)
    return JSON.stringify(compressed)
  }

  executeAction(action: AgentAction) {
    return this.session.dispatch(action)
  }
}

// Usage
const manager = new ConversationManager(runtime, viewSchema)

// Turn 1: Full context
const initialContext = manager.getInitialContext()
// → Full system prompt with all fields

// User: "Set name to Widget"
manager.executeAction({ type: 'updateField', fieldId: 'name', value: 'Widget' })

// Turn 2: Delta only (saves tokens!)
const deltaContext = manager.getDeltaContext()
// "Form updates:
//  ~ name: "" → "Widget"
//  ~ form validity: false → false"

// Continue conversation with minimal context...
```

---

## Example 6: Complex OR Conditions

Handling fields with multiple ways to become visible.

```ts
import {
  createInteroperabilitySession,
  analyzeVisibility,
} from '@manifesto-ai/ai-util'

// Schema: premiumFeatures is visible when:
// (plan == 'PREMIUM') OR (isEnterprise == true AND hasAddon == true)
//
// Path 1: 1 step  (set plan to PREMIUM)
// Path 2: 2 steps (set isEnterprise AND hasAddon)

const session = createInteroperabilitySession({
  runtime,
  viewSchema,
  defaultPolicy: 'guided',
})

const snapshot = session.snapshot()
const constraint = snapshot.constraints['premiumFeatures']

if (constraint.hidden && constraint.visibilityMeta) {
  // The analyzer automatically selected the optimal path
  console.log(constraint.visibilityMeta.satisfactionPath)
  // [{ field: 'plan', action: 'set', targetValue: 'PREMIUM', order: 1 }]
  // (NOT the 2-step path)

  // Agent can suggest the easiest path to the user
  const suggestion = constraint.visibilityMeta.satisfactionPath
    ?.map(s => `${s.action} ${s.field} to ${JSON.stringify(s.targetValue)}`)
    .join(', then ')

  // "To access premium features, you can set plan to "PREMIUM"."
}

// Direct visibility analysis for custom logic
const expression = [
  'OR',
  ['==', '$state.plan', 'PREMIUM'],
  ['AND', ['==', '$state.isEnterprise', true], ['==', '$state.hasAddon', true]],
]

const result = analyzeVisibility(expression, evaluationContext, {
  computeSatisfactionPath: true,
})

if (result._tag === 'Ok' && !result.value.satisfied) {
  // Get all failed dependencies
  console.log(result.value.failedDependencies)
  // Only the optimal path's dependencies (1 step, not 2)

  // Get satisfaction steps
  console.log(result.value.satisfactionPath)
  // Optimal path steps
}
```

---

## Tips for Production

### 1. Use Field-Level Policies

```ts
const session = createInteroperabilitySession({
  runtime,
  viewSchema,
  defaultPolicy: 'strict',  // Safe default
  fieldPolicies: [
    { fieldId: 'optionalField', policy: 'deferred' },   // Allow out-of-order
    { fieldId: 'importantField', policy: 'guided' },    // Explain why blocked
  ],
})
```

### 2. Cache Tool Definitions

```ts
// Tool definitions only change when interactions change
let cachedTools = null
let lastInteractionHash = null

function getTools(snapshot) {
  const currentHash = JSON.stringify(snapshot.interactions)
  if (currentHash !== lastInteractionHash) {
    cachedTools = toToolDefinitions(snapshot)
    lastInteractionHash = currentHash
  }
  return cachedTools
}
```

### 3. Handle Token Limits

```ts
// For forms with many fields
const MAX_DETAILED_FIELDS = 10

const prompt = generateSystemPrompt(snapshot, {
  maxDetailedFields: MAX_DETAILED_FIELDS,
  compact: true,  // Use compact format
})

// Or use compressed JSON for very large forms
if (Object.keys(snapshot.state.fields).length > 50) {
  const compressed = compressSnapshot(snapshot)
  // Send compressed JSON instead of markdown prompt
}
```

### 4. Error Recovery

```ts
function handleDispatchError(error: AgentActionError): string {
  switch (error.type) {
    case 'FIELD_NOT_FOUND':
      return `Field "${error.fieldId}" does not exist. Check available fields.`

    case 'FIELD_FORBIDDEN':
      if (error.visibilityMeta?.satisfactionPath) {
        return generateSatisfactionGuide(error.visibilityMeta)
      }
      return `Field "${error.fieldId}" is ${error.reason.toLowerCase()}.`

    case 'TYPE_MISMATCH':
      return `Invalid type for "${error.fieldId}". Expected ${error.expectedType}.`

    case 'INVALID_ENUM_VALUE':
      return `Invalid value. Valid options: ${error.validValues.join(', ')}`

    case 'ACTION_REJECTED':
      return error.message

    default:
      return 'An error occurred. Please try again.'
  }
}
```

---

## Related Documentation

- [AI-Util API Reference](../api-reference/ai.md) — Complete API documentation
- [AI Interaction Policy Guide](./ai-interaction-policy.md) — Policy modes in detail
- [AI Interoperability Protocol](../ai-interoperability.md) — Core protocol design
