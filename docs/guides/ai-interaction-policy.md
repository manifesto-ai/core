# AI Interaction Policy Guide

**How AI agents interact with hidden and conditional UI elements** — defining policies for when agents attempt to modify fields that are not currently visible or accessible.

## Table of Contents

- [The Problem](#the-problem)
- [Visibility Reasoning](#visibility-reasoning)
  - [Proactive Mode (Snapshot)](#proactive-mode-snapshot)
  - [Reactive Mode (Dispatch)](#reactive-mode-dispatch)
- [Interaction Policies](#interaction-policies)
- [Usage Examples](#usage-examples)
- [API Reference](#api-reference)

---

## The Problem

In traditional form UIs, hidden fields are simply invisible to users. But AI agents operate differently:

1. **Agents see the schema**, not just the rendered UI
2. **Agents may attempt to set values** on fields that are conditionally hidden
3. **Users expect intelligent behavior**: "Why can't I set this?" should have an answer

### Example Scenario

```
Schema: ProductForm
  - category: enum (DIGITAL, PHYSICAL, BOOK)
  - priceLimit: number (hidden unless category == "DIGITAL")
  - discountEnabled: boolean
```

When an agent tries to set `priceLimit` while `category` is "BOOK":
- **Old behavior**: `FIELD_FORBIDDEN` error with no explanation
- **New behavior**: Rich reasoning about *why* it's hidden and *how* to make it visible

---

## Visibility Reasoning

The engine can now analyze visibility conditions and explain them.

### VisibilityMeta Structure

```ts
interface VisibilityMeta {
  conditionType: 'simple' | 'compound'
  satisfied: boolean
  expression?: Expression           // Original condition (optional)
  failedDependencies: FailedDependency[]
  satisfactionPath?: SatisfactionStep[]
}

interface FailedDependency {
  field: string                     // e.g., "category"
  currentValue: unknown             // e.g., "BOOK"
  operator: string                  // e.g., "=="
  expectedValue: unknown            // e.g., "DIGITAL"
  description: string               // e.g., "category must equal \"DIGITAL\""
}

interface SatisfactionStep {
  field: string
  action: 'set' | 'clear'
  targetValue: unknown
  order: number
}
```

### Proactive Mode (Snapshot)

**Recommended approach.** When calling `session.snapshot()`, hidden fields automatically include `visibilityMeta` in their constraints. This allows agents to understand visibility conditions **before** attempting any action.

```ts
const snapshot = session.snapshot()

// Inspect why priceLimit is hidden
const constraint = snapshot.constraints.priceLimit
if (constraint.hidden && constraint.visibilityMeta) {
  const { failedDependencies, satisfactionPath } = constraint.visibilityMeta

  console.log('Hidden because:')
  failedDependencies.forEach(dep => {
    console.log(`  - ${dep.description}`)
  })
  // Hidden because:
  //   - category must equal "DIGITAL"

  console.log('To make visible:')
  satisfactionPath?.forEach(step => {
    console.log(`  ${step.order}. ${step.action} ${step.field} to ${step.targetValue}`)
  })
  // To make visible:
  //   1. set category to DIGITAL
}
```

This enables intelligent planning without trial-and-error:

> Agent: "I see that `priceLimit` is hidden. To set it, I first need to change `category` to 'DIGITAL'. Would you like me to do that?"

### Reactive Mode (Dispatch)

When an agent attempts to modify a hidden field, the error response includes `visibilityMeta` (when using `guided` or `strict` policy with expressions available).

```ts
import { analyzeVisibility, generateVisibilityExplanation } from '@manifesto-ai/ai-util'

const expression = ['AND',
  ['==', '$state.category', 'DIGITAL'],
  ['==', '$state.discountEnabled', true]
]

const context = {
  state: { category: 'BOOK', discountEnabled: false },
  // ... other context
}

const result = analyzeVisibility(expression, context, {
  computeSatisfactionPath: true
})

if (result._tag === 'Ok') {
  console.log(generateVisibilityExplanation(result.value))
  // Output:
  // Field is hidden because:
  // - category must equal "DIGITAL"
  // - discountEnabled must equal true
}
```

---

## Interaction Policies

Three policy modes control how the engine responds when agents access hidden fields.

### Policy Overview

| Policy | Behavior | Use Case |
|--------|----------|----------|
| `strict` | Immediately reject with error | Default, safest option |
| `deferred` | Store value, apply when visible | Workflow automation |
| `guided` | Reject with reasoning + path | AI assistant scenarios |

### 1. Strict Mode (Default)

Rejects any attempt to modify hidden fields immediately.

```ts
const session = createInteroperabilitySession({
  runtime,
  viewSchema,
  defaultPolicy: 'strict',  // or omit - this is the default
})

const result = session.dispatch({
  type: 'updateField',
  fieldId: 'priceLimit',
  value: 100,
})

// result._tag === 'Err'
// result.error.type === 'FIELD_FORBIDDEN'
// result.error.reason === 'HIDDEN'
// result.error.policy === 'strict'
```

### 2. Deferred Mode

Stores the update as "pending" until the field becomes visible, then **automatically applies** when conditions are met.

```ts
const session = createInteroperabilitySession({
  runtime,
  viewSchema,
  defaultPolicy: 'deferred',
})

// Attempt to set hidden field - stored as pending
const result = session.dispatch({
  type: 'updateField',
  fieldId: 'priceLimit',
  value: 100,
})

// result._tag === 'Ok' (success, but value is pending)
// session.snapshot().pendingUpdates['priceLimit'] exists
```

#### Auto-Apply Behavior

When the blocking field changes and the hidden field becomes visible, pending updates are **automatically applied**:

```ts
// priceLimit is hidden (blocked by category != 'DIGITAL')
session.dispatch({ type: 'updateField', fieldId: 'priceLimit', value: 100 })
// → Stored as pending

// Later: change category to DIGITAL
const result = session.dispatch({
  type: 'updateField',
  fieldId: 'category',
  value: 'DIGITAL',
})

// priceLimit is now visible, pending update auto-applied!
if (result._tag === 'Ok') {
  console.log(result.value.appliedPendingUpdates)
  // ['priceLimit']

  console.log(result.value.snapshot.state.values['priceLimit'])
  // 100 (automatically applied)

  console.log(result.value.snapshot.pendingUpdates?.['priceLimit'])
  // undefined (no longer pending)
}
```

This enables seamless workflow automation where agents can set values in any order.

### 3. Guided Mode

Rejects but provides detailed reasoning and a path to make the field visible.

```ts
const session = createInteroperabilitySession({
  runtime,
  viewSchema,
  defaultPolicy: 'guided',
})

const result = session.dispatch({
  type: 'updateField',
  fieldId: 'priceLimit',
  value: 100,
})

// result._tag === 'Err'
// result.error.type === 'FIELD_FORBIDDEN'
// result.error.policy === 'guided'
// result.error.visibilityMeta.failedDependencies:
//   [{ field: 'category', currentValue: 'BOOK', expectedValue: 'DIGITAL', ... }]
// result.error.visibilityMeta.satisfactionPath:
//   [{ field: 'category', action: 'set', targetValue: 'DIGITAL', order: 1 }]
```

This enables AI agents to respond intelligently:

> "I cannot set priceLimit right now because it's hidden. To make it visible, I need to:
> 1. Set category to "DIGITAL"
>
> Would you like me to do that first?"

---

## Usage Examples

### Field-Level Policy Override

Different fields can have different policies:

```ts
const session = createInteroperabilitySession({
  runtime,
  viewSchema,
  defaultPolicy: 'strict',
  fieldPolicies: [
    { fieldId: 'priceLimit', policy: 'guided' },
    { fieldId: 'advancedSettings', policy: 'deferred' },
  ],
})
```

### Complete AI Assistant Flow

```ts
import {
  createInteroperabilitySession,
  generateVisibilityExplanation,
  generateSatisfactionGuide,
} from '@manifesto-ai/ai-util'

const session = createInteroperabilitySession({
  runtime,
  viewSchema,
  defaultPolicy: 'guided',
})

// Agent attempts to set a hidden field
const result = session.dispatch({
  type: 'updateField',
  fieldId: 'priceLimit',
  value: 100,
})

if (result._tag === 'Err' && result.error.type === 'FIELD_FORBIDDEN') {
  const { visibilityMeta } = result.error

  if (visibilityMeta) {
    // Generate human-readable explanation
    const explanation = generateVisibilityExplanation(visibilityMeta)
    const guide = generateSatisfactionGuide(visibilityMeta)

    console.log(explanation)
    // Field is hidden because:
    // - category must equal "DIGITAL"

    console.log(guide)
    // To make this field visible:
    // 1. set category to "DIGITAL"
  }
}
```

### Checking Pending Updates

```ts
const snapshot = session.snapshot()

if (snapshot.pendingUpdates) {
  for (const [fieldId, pending] of Object.entries(snapshot.pendingUpdates)) {
    console.log(`${fieldId}: ${pending.value} (blocked by: ${pending.blockedBy.join(', ')})`)
  }
}
```

---

## API Reference

### Types

```ts
type InteractionPolicy = 'strict' | 'deferred' | 'guided'

interface FieldPolicyConfig {
  fieldId: string
  policy: InteractionPolicy
}

interface InteroperabilitySessionOptions {
  runtime: FormRuntime
  viewSchema: FormViewSchema
  entitySchema?: EntitySchema
  actions?: readonly ActionSchema[]
  defaultPolicy?: InteractionPolicy      // Default: 'strict'
  fieldPolicies?: readonly FieldPolicyConfig[]
}

interface PendingUpdate {
  fieldId: string
  value: unknown
  blockedBy: readonly string[]           // Fields that need to change
  createdAt: number
}
```

### Extended Error Types

```ts
type AgentActionError =
  | { type: 'FIELD_FORBIDDEN'
      fieldId: string
      reason: 'HIDDEN' | 'DISABLED'
      policy?: InteractionPolicy
      visibilityMeta?: VisibilityMeta }
  | { type: 'UPDATE_DEFERRED'
      fieldId: string
      pendingUpdate: PendingUpdate }
  // ... other error types
```

### Functions

```ts
// Analyze a visibility expression
analyzeVisibility(
  expression: Expression,
  context: EvaluationContext,
  options?: {
    includeExpression?: boolean
    computeSatisfactionPath?: boolean
  }
): Result<VisibilityMeta, AnalyzerError>

// Generate human-readable explanation
generateVisibilityExplanation(meta: VisibilityMeta): string

// Generate step-by-step guide
generateSatisfactionGuide(meta: VisibilityMeta): string
```

---

## OR Condition Path Optimization

When a field's visibility depends on an OR condition with multiple branches, the analyzer automatically selects the **optimal path** (easiest to satisfy).

### How It Works

```ts
// Field is visible when: (category == 'DIGITAL' AND isActive == true) OR (isPremium == true)
// Path 1: 2 steps (change category AND isActive)
// Path 2: 1 step (change isPremium)

const snapshot = session.snapshot()
const constraint = snapshot.constraints['specialFeature']

// Analyzer chooses Path 2 (fewer steps)
console.log(constraint.visibilityMeta?.satisfactionPath)
// [{ field: 'isPremium', action: 'set', targetValue: true, order: 1 }]
```

### Path Cost Calculation

The analyzer uses weighted costs:

| Operator | Weight | Reason |
|----------|--------|--------|
| `==`, `IS_NULL`, `IS_NOT_NULL` | 1.0 | Clear target value |
| `!=`, `IN`, `NOT_IN` | 1.5 | Multiple valid options |
| `>`, `>=`, `<`, `<=` | 2.0 | Requires range understanding |

This ensures agents take the most efficient path to enable hidden fields.

---

## LLM Integration

### Generating System Prompts

Use `generateSystemPrompt()` to create comprehensive context for LLM agents:

```ts
import { generateSystemPrompt, compressSnapshot } from '@manifesto-ai/ai-util'

// Full prompt with all details
const fullPrompt = generateSystemPrompt(snapshot, {
  includeValues: true,
  includeVisibilityReasoning: true,
})

// Compact prompt for token efficiency
const compactPrompt = generateSystemPrompt(snapshot, { compact: true })
```

### Multi-Turn Conversations

Use `generateDeltaUpdate()` to efficiently update context between turns:

```ts
import { generateDeltaUpdate } from '@manifesto-ai/ai-util'

// After user action
const delta = generateDeltaUpdate(previousSnapshot, currentSnapshot)
// "~ category: "BOOK" → "DIGITAL"
//  ~ priceLimit: now visible"

// Send only the delta to the LLM instead of full context
```

### Token-Efficient Serialization

For very large forms, use `compressSnapshot()`:

```ts
import { compressSnapshot, serializeCompressed } from '@manifesto-ai/ai-util'

const compressed = compressSnapshot(snapshot)
const jsonContext = serializeCompressed(compressed)
// Minimal JSON representation for token efficiency
```

---

## Best Practices

1. **Prefer proactive reasoning** — Check `snapshot.constraints[fieldId].visibilityMeta` before attempting to modify hidden fields
2. **Use `strict` for production** unless you have a specific need for other modes
3. **Use `guided` for AI assistants** that need to explain why actions fail
4. **Use `deferred` for workflows** — pending updates auto-apply when conditions are met
5. **Combine with tool definitions** — `toToolDefinitions()` respects visibility constraints
6. **Use delta updates** — For multi-turn conversations, send only changes to reduce token usage
7. **Trust OR optimization** — The analyzer automatically selects the easiest path

---

## Related Documentation

- [AI Interoperability Protocol](../ai-interoperability.md) — Core protocol design
- [AI-Util API Reference](../api-reference/ai.md) — Complete API documentation
- [Dynamic Conditions](./dynamic-conditions.md) — How visibility expressions work
- [Schema Authoring Guide](../schema-authoring-guide.md) — Defining visibility conditions
