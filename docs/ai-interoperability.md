# AI Interoperability Protocol

**A White Box contract for AI agents** — letting agents read and act on the application’s brain and nervous system directly through semantic data, not pixels or DOM guessing.

## Table of Contents

- [Vision](#vision)
- [Atomic & Monadic Model](#atomic--monadic-model)
- [Protocol Loop](#protocol-loop)
- [Data Contracts](#data-contracts)
- [Operational Modes](#operational-modes)
- [Safety Rails](#safety-rails)
  - [Visibility Reasoning](#visibility-reasoning)
  - [Interaction Policies](#interaction-policies)
- [Package Surface](#package-surface)

---

## Vision

### White Box over Black Box
- **Black Box**: Agents stare at DOM/pixels and guess intent → meaning is lost, error rate climbs.
- **White Box**: The engine exposes a **Semantic Snapshot** → agents read structure, rules, state, and valid transitions directly.

### Interoperability as a First-Class Citizen
- Humans converse via UI; agents converse via **protocol**.
- The protocol is the semantic layer bridging natural language ↔ machine intent, owned and enforced by the engine.

---

## Atomic & Monadic Model

### Atomic (minimal, complete units)
- **State Atom**: `value + meta (valid, dirty, touched, hidden, disabled, errors)` as the smallest state unit.
- **Rule Atom**: Minimal propositions expressing validation/visibility/dependency.
- **Interaction Atom**: Intent-level actions (`updateField`, `submit`, `reset`, `validate`), not low-level click/input events.

### Monadic (safe, chainable transitions)
- Every action is wrapped in a `Result` monad: only `Ok` or `Err`; failures short-circuit the chain.
- **Fail-Fast**: If a precondition fails, the engine rejects without side effects.
- **Deterministic**: Same input/context → same output. Agents can plan reliably.
- **Rollback-Friendly**: On failure, the previous snapshot remains intact.

---

## Protocol Loop

```
[Context Injection] → [Reasoning by AI] → [Action Dispatch] → [Delta Feedback]
         ▲                                                       │
         └───────────────────── Continuous Snapshots ────────────┘
```

1. **Context Injection**: Engine refines the UI into a graph-like snapshot
   - Topology: section/field hierarchy
   - State Vector: value, validity, visibility, enablement
   - Constraint Map: what is blocked and why
   - Interactions: available intents and their allow/deny reasons
2. **Reasoning**: Agent plans the next action from the snapshot
3. **Action Dispatch**: Agent calls abstract tools (`updateField`, `submit`, `reset`, `validate`), not DOM events
4. **Delta Feedback**: Engine returns state deltas, not just Success/Fail, so agents learn causality
5. **LLM Tool Export**: Convert current interactions into JSON-Schema tools for OpenAI/Claude and keep them in sync via snapshots

---

## Data Contracts

> Types are shipped in `@manifesto-ai/ai-util`. All shapes are JSON-serializable and LLM-safe.

```ts
type SemanticSnapshot = {
  topology: {
    viewId: string
    entityRef: string
    mode: 'create' | 'edit' | 'view'
    sections: { id: string; title?: string; fields: string[] }[]
  }
  state: {
    form: { isValid: boolean; isDirty: boolean; isSubmitting: boolean }
    fields: Record<string, FieldStateAtom>
    values: Record<string, unknown>
  }
  constraints: Record<string, FieldConstraint>
  interactions: InteractionAtom[]
  pendingUpdates?: Record<string, PendingUpdate>  // deferred mode only
}

type FieldStateAtom = {
  id: string
  entityFieldId: string
  label?: string
  value: unknown
  meta: {
    valid: boolean
    dirty: boolean
    touched: boolean
    hidden: boolean
    disabled: boolean
    errors: string[]
  }
}

type InteractionAtom =
  | { id: `updateField:${string}`; intent: 'updateField'; target: string; available: boolean; reason?: string }
  | { id: 'submit' | 'reset' | 'validate'; intent: 'submit' | 'reset' | 'validate'; available: boolean; reason?: string }

type FieldConstraint = {
  hidden: boolean
  disabled: boolean
  reason?: string
  visibilityMeta?: VisibilityMeta  // proactive reasoning for hidden fields
  policy?: InteractionPolicy
}

type VisibilityMeta = {
  conditionType: 'simple' | 'compound'
  satisfied: boolean
  failedDependencies: FailedDependency[]
  satisfactionPath?: SatisfactionStep[]  // steps to make field visible
}

type AgentAction =
  | { type: 'updateField'; fieldId: string; value: unknown }
  | { type: 'submit' }
  | { type: 'reset' }
  | { type: 'validate'; fieldIds?: string[] }

type AgentActionResult = {
  snapshot: SemanticSnapshot
  delta: SemanticDelta
}
```

### Delta Feedback

```ts
type SemanticDelta = {
  form?: Partial<{ isValid: boolean; isDirty: boolean; isSubmitting: boolean }>
  fields?: Record<
    string,
    Partial<{
      value: unknown
      valid: boolean
      dirty: boolean
      touched: boolean
      hidden: boolean
      disabled: boolean
      errors: string[]
    }>
  >
  interactions?: Record<string, Partial<{ available: boolean; reason?: string }>>
}
```

---

## Operational Modes

### Exploration Mode
Ask “what can I do here?” on first contact.

```ts
import { createInteroperabilitySession } from '@manifesto-ai/ai-util'

const session = createInteroperabilitySession({
  runtime,          // FormRuntime (already initialized)
  viewSchema,       // FormViewSchema
  entitySchema,     // optional EntitySchema
  actions: [],      // future: workflow actions
})

const snapshot = session.snapshot()
// snapshot.interactions: intents with allow/deny reasons
```

Example summary:
- Context: `ProductCreate`
- Fields: `Name`, `Price`, `Category`
- Submit: disabled because `Name` is empty

#### Proactive Visibility Reasoning

Hidden fields include `visibilityMeta` in their constraints, allowing agents to understand *why* fields are hidden **before** attempting any action:

```ts
const snapshot = session.snapshot()

// Check why priceLimit is hidden
const constraint = snapshot.constraints.priceLimit
if (constraint.hidden && constraint.visibilityMeta) {
  console.log(constraint.visibilityMeta.failedDependencies)
  // [{ field: 'category', currentValue: 'BOOK', expectedValue: 'DIGITAL', ... }]

  console.log(constraint.visibilityMeta.satisfactionPath)
  // [{ field: 'category', action: 'set', targetValue: 'DIGITAL', order: 1 }]
}
```

This enables agents to plan multi-step actions intelligently without trial-and-error.

### Execution Mode
Execute “set it to a digital product.”

```ts
const result = session.dispatch({
  type: 'updateField',
  fieldId: 'category',
  value: 'DIGITAL',
})

if (result._tag === 'Ok') {
  const { snapshot, delta } = result.value
  // delta.fields.shipping.hidden === true → shipping section is now hidden
}
```

---

## Safety Rails

- **Hallucination Firewall**: Access to unknown fields, type mismatches, or hidden/disabled fields returns `Err` without mutating state.
- **Atomic Rollback**: On failure, the prior snapshot is preserved.
- **Deterministic Contracts**: Responses are serializable; same input yields the same snapshot/delta.

### Visibility Reasoning

When agents attempt to access hidden fields, the engine can explain *why* the field is hidden and *how* to make it visible.

```ts
const result = session.dispatch({
  type: 'updateField',
  fieldId: 'priceLimit',  // hidden unless category == 'DIGITAL'
  value: 100,
})

if (result._tag === 'Err' && result.error.type === 'FIELD_FORBIDDEN') {
  // result.error.visibilityMeta contains:
  // - failedDependencies: which conditions failed
  // - satisfactionPath: steps to make the field visible
}
```

### Interaction Policies

Three policy modes control behavior when accessing hidden fields:

| Policy | Behavior |
|--------|----------|
| `strict` | Reject immediately (default) |
| `deferred` | Store as pending, apply when visible |
| `guided` | Reject with reasoning and path to visibility |

```ts
const session = createInteroperabilitySession({
  runtime,
  viewSchema,
  defaultPolicy: 'guided',  // Enable AI-friendly responses
  fieldPolicies: [
    { fieldId: 'advancedSettings', policy: 'deferred' },
  ],
})
```

See [AI Interaction Policy Guide](./guides/ai-interaction-policy.md) for detailed usage.

---

## Package Surface

`@manifesto-ai/ai-util` exposes a minimal, extensible API:

```ts
import { createInteroperabilitySession } from '@manifesto-ai/ai-util'

const session = createInteroperabilitySession({ runtime, viewSchema, entitySchema })

// 1) Read semantic snapshot (Exploration)
const snapshot = session.snapshot()

// 2) Dispatch agent actions (Execution)
const outcome = session.dispatch({ type: 'submit' })

if (outcome._tag === 'Err') {
  // Rejection with reason, no side effect applied
}
```

Extension points:
- **Action tools**: add intents like `upload`, `bulkUpdate`, `navigate`
- **Rule Atom trace**: expose which expression produced hidden/disabled/validation states
- **Delta serializer**: stream or compress for LLM context windows

### LLM Adapter Utility

`toToolDefinitions(snapshot, options?)` turns a `SemanticSnapshot` into OpenAI/Claude-compatible JSON-Schema tools.

```ts
import { createInteroperabilitySession, toToolDefinitions } from '@manifesto-ai/ai-util'

const session = createInteroperabilitySession({ runtime, viewSchema })
const snapshot = session.snapshot()
const tools = toToolDefinitions(snapshot, { omitUnavailable: true })
// tools now includes updateField/submit/reset/validate function specs with enums for actionable fields
```

### LLM Prompt Utilities

Generate optimized prompts and compress snapshots for token efficiency:

```ts
import {
  generateSystemPrompt,
  compressSnapshot,
  generateFieldSummary,
  generateDeltaUpdate,
} from '@manifesto-ai/ai-util'

// Generate comprehensive system prompt
const prompt = generateSystemPrompt(snapshot, {
  includeValues: true,
  includeVisibilityReasoning: true,
  compact: false,
})

// Compress for token efficiency
const compressed = compressSnapshot(snapshot)
// { form: 'valid+dirty', fields: [...], actions: [...], hidden: [...] }

// Multi-turn delta updates
const delta = generateDeltaUpdate(beforeSnapshot, afterSnapshot)
// "~ price: 100 → 200"
```

The module works alongside `@manifesto-ai/engine` and `@manifesto-ai/schema`, and remains framework-agnostic for agents.
