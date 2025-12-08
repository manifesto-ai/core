# @manifesto-ai/ai-util API Reference

> **⚠️ Deprecation Notice**: This package is being superseded by `@manifesto-ai/view-snapshot`.
>
> - `SemanticSnapshot` → Use `PageSnapshot`, `FormSnapshot` from view-snapshot
> - `AgentAction` → Use `ViewIntent` from view-snapshot
> - `createInteroperabilitySession` → Use `createViewSnapshotEngine` from view-snapshot
>
> See the [ViewSnapshot Architecture](/docs/architectures/view-snapshot.md) for the new API.

Utilities for AI interoperability: semantic snapshots, visibility reasoning, interaction policies, LLM prompt optimization, and intent-safe dispatch.

## Installation

```bash
pnpm add @manifesto-ai/ai-util

# New: ViewSnapshot package (recommended)
pnpm add @manifesto-ai/view-snapshot
```

---

## Session Management

### createInteroperabilitySession (Deprecated)

> **Deprecated**: Use `createViewSnapshotEngine` from `@manifesto-ai/view-snapshot` instead.

Bridge a `FormRuntime` into an AI-facing session that exposes semantic snapshots and safe action dispatch.

```ts
import { createInteroperabilitySession } from '@manifesto-ai/ai-util'

const session = createInteroperabilitySession({
  runtime,                    // FormRuntime (initialized)
  viewSchema,                 // FormViewSchema
  entitySchema,               // optional EntitySchema
  defaultPolicy: 'guided',    // 'strict' | 'deferred' | 'guided'
  fieldPolicies: [            // optional field-level overrides
    { fieldId: 'priceLimit', policy: 'deferred' },
  ],
})

const snapshot = session.snapshot()
const result = session.dispatch({ type: 'updateField', fieldId: 'name', value: 'Alice' })
```

**Methods:**
- `snapshot()` → `SemanticSnapshot`: Current form state with topology, constraints, interactions
- `dispatch(action)` → `Result<AgentActionResult, AgentActionError>`: Execute action with guard rails

**AgentActionResult:**
```ts
interface AgentActionResult {
  snapshot: SemanticSnapshot
  delta: SemanticDelta
  appliedPendingUpdates?: readonly string[]  // Deferred mode: auto-applied fields
}
```

---

## Tool Definitions

### toToolDefinitions

Generate OpenAI/Claude-compatible function-call definitions from a snapshot.

```ts
import { toToolDefinitions } from '@manifesto-ai/ai-util'

const tools = toToolDefinitions(snapshot, { omitUnavailable: true })
// Tools: updateField, submit, reset, validate
// updateField.enum contains only visible/enabled fields
```

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `omitUnavailable` | `false` | Hide blocked tools instead of describing why blocked |

---

## Visibility Analysis

### analyzeVisibility

Analyze why a field is hidden and how to make it visible.

```ts
import { analyzeVisibility } from '@manifesto-ai/ai-util'

const result = analyzeVisibility(expression, evaluationContext, {
  includeExpression: true,
  computeSatisfactionPath: true,
})

if (result._tag === 'Ok') {
  console.log(result.value.failedDependencies)
  // [{ field: 'category', currentValue: 'BOOK', expectedValue: 'DIGITAL', ... }]

  console.log(result.value.satisfactionPath)
  // [{ field: 'category', action: 'set', targetValue: 'DIGITAL', order: 1 }]
}
```

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `includeExpression` | `false` | Include original expression in result |
| `computeSatisfactionPath` | `false` | Calculate steps to make field visible |

**OR Condition Optimization:**
When multiple paths can satisfy an OR condition, the analyzer automatically selects the optimal path based on:
- Number of steps (fewer is better)
- Operator complexity (`==` < `!=` < range operators)

### generateVisibilityExplanation

Generate human-readable explanation of why a field is hidden.

```ts
import { generateVisibilityExplanation } from '@manifesto-ai/ai-util'

const explanation = generateVisibilityExplanation(visibilityMeta)
// "Field is hidden because:
//  - category must equal "DIGITAL""
```

### generateSatisfactionGuide

Generate step-by-step guide to make a hidden field visible.

```ts
import { generateSatisfactionGuide } from '@manifesto-ai/ai-util'

const guide = generateSatisfactionGuide(visibilityMeta)
// "To make this field visible:
//  1. set category to "DIGITAL""
```

---

## LLM Prompt Utilities

### generateSystemPrompt

Generate comprehensive system prompt for LLM agents.

```ts
import { generateSystemPrompt } from '@manifesto-ai/ai-util'

const prompt = generateSystemPrompt(snapshot, {
  includeValues: true,
  includeErrors: true,
  includeVisibilityReasoning: true,
  includePendingUpdates: true,
  compact: false,
})
```

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `includeValues` | `true` | Include current field values |
| `includeErrors` | `true` | Include validation errors |
| `includeVisibilityReasoning` | `true` | Include hidden field reasoning |
| `includePendingUpdates` | `true` | Include pending updates info |
| `maxDetailedFields` | `20` | Max fields to show in detail |
| `compact` | `false` | Token-efficient compact mode |

**Output Example (compact: false):**
```markdown
## Form Context: product-form
Mode: create

### Form Status
Valid: No | Dirty: Yes | Submitting: No | Fields: 3 | Errors: 1

### Fields
**name** (Product Name) = ""
  ⚠ Required
**price** (Price) = 100
**category** (Category) = "BOOK"

### Hidden Fields
- **priceLimit**: category must equal "DIGITAL" (to show: set category to "DIGITAL")

### Available Actions
**Available:**
- updateField:name
- updateField:price
- reset
**Blocked:**
- submit: form is invalid
```

### compressSnapshot

Compress snapshot for token efficiency.

```ts
import { compressSnapshot, serializeCompressed } from '@manifesto-ai/ai-util'

const compressed = compressSnapshot(snapshot)
// {
//   form: 'invalid+dirty',
//   fields: [{ id: 'name', status: 'error', errors: ['Required'] }, ...],
//   actions: ['updateField:name', 'reset'],
//   hidden: ['priceLimit'],
//   pending: []
// }

const json = serializeCompressed(compressed)  // JSON string
```

### generateFieldSummary

Generate one-line field status summary.

```ts
import { generateFieldSummary } from '@manifesto-ai/ai-util'

const summary = generateFieldSummary(snapshot.state.fields, snapshot.constraints)
// "Visible: 3 | Errors: 1 | Hidden: 1 | Disabled: 0"
```

### generateDeltaUpdate

Generate delta-based context update for multi-turn conversations.

```ts
import { generateDeltaUpdate } from '@manifesto-ai/ai-util'

const delta = generateDeltaUpdate(beforeSnapshot, afterSnapshot)
// "~ price: 100 → 200
//  ~ category: "BOOK" → "DIGITAL"
//  ~ priceLimit: now visible
//  ✓ name: errors cleared"
```

---

## Policy Engine

### createPolicyEngine

Create a policy engine for custom policy evaluation.

```ts
import { createPolicyEngine } from '@manifesto-ai/ai-util'

const engine = createPolicyEngine({
  defaultPolicy: 'guided',
  fieldPolicies: [
    { fieldId: 'sensitiveField', policy: 'strict' },
  ],
})

const decision = engine.evaluate(action, {
  snapshot,
  evaluationContext,
  visibilityExpressions,
})
// decision.type: 'allow' | 'deny' | 'defer' | 'guide'
```

### PendingUpdateManager

Manage deferred updates for hidden fields.

```ts
const manager = engine.getPendingManager()

// Check applicable pending updates after a field change
const applicable = manager.checkApplicable('category', (fieldId) => isFieldVisible(fieldId))

// Apply a pending update
const applied = manager.apply('priceLimit')
// { fieldId: 'priceLimit', value: 100, appliedAt: 1699999999999 }
```

---

## Types

### Core Types

```ts
// Snapshot of form state for AI consumption
interface SemanticSnapshot {
  topology: SchemaTopology
  state: {
    form: { isValid: boolean; isDirty: boolean; isSubmitting: boolean }
    fields: Record<string, FieldStateAtom>
    values: Record<string, unknown>
  }
  constraints: Record<string, FieldConstraint>
  interactions: InteractionAtom[]
  pendingUpdates?: Record<string, PendingUpdate>
}

// Changes between snapshots
interface SemanticDelta {
  form?: Partial<{ isValid: boolean; isDirty: boolean; isSubmitting: boolean }>
  fields?: Record<string, Partial<FieldStateAtom['meta'] & { value: unknown }>>
  interactions?: Record<string, Partial<{ available: boolean; reason: string }>>
}

// Agent actions
type AgentAction =
  | { type: 'updateField'; fieldId: string; value: unknown }
  | { type: 'submit' }
  | { type: 'reset' }
  | { type: 'validate'; fieldIds?: readonly string[] }
```

### Visibility Types

```ts
interface VisibilityMeta {
  conditionType: 'simple' | 'compound'
  satisfied: boolean
  expression?: Expression
  failedDependencies: readonly FailedDependency[]
  satisfactionPath?: readonly SatisfactionStep[]
}

interface FailedDependency {
  field: string
  currentValue: unknown
  operator: string
  expectedValue: unknown
  description: string
}

interface SatisfactionStep {
  field: string
  action: 'set' | 'clear'
  targetValue: unknown
  order: number
}
```

### Policy Types

```ts
type InteractionPolicy = 'strict' | 'deferred' | 'guided'

interface FieldPolicyConfig {
  fieldId: string
  policy: InteractionPolicy
}

interface PendingUpdate {
  fieldId: string
  value: unknown
  blockedBy: readonly string[]
  createdAt: number
}
```

### Error Types

```ts
type AgentActionError =
  | { type: 'FIELD_NOT_FOUND'; fieldId: string }
  | { type: 'FIELD_FORBIDDEN'; fieldId: string; reason: 'HIDDEN' | 'DISABLED'; policy?: InteractionPolicy; visibilityMeta?: VisibilityMeta }
  | { type: 'UPDATE_DEFERRED'; fieldId: string; pendingUpdate: PendingUpdate }
  | { type: 'TYPE_MISMATCH'; fieldId: string; expectedType: DataType; message: string }
  | { type: 'INVALID_ENUM_VALUE'; fieldId: string; validValues: readonly (string | number)[] }
  | { type: 'ACTION_REJECTED'; reason: 'FORM_INVALID' | 'NOT_ALLOWED'; message: string }
  | { type: 'RUNTIME_ERROR'; message: string }
```

---

## Migration to ViewSnapshot

### Quick Migration Guide

```typescript
// Before (deprecated)
import { createInteroperabilitySession, type SemanticSnapshot } from '@manifesto-ai/ai-util'

const session = createInteroperabilitySession({ runtime, viewSchema })
const snapshot = session.snapshot()
session.dispatch({ type: 'updateField', fieldId: 'name', value: 'John' })

// After (recommended)
import { createViewSnapshotEngine, type PageSnapshot } from '@manifesto-ai/view-snapshot'

const engine = createViewSnapshotEngine({ pageId: 'my-page' })
engine.registerFormRuntime('form-1', runtime, viewSchema)
const snapshot = engine.getViewSnapshot()
await engine.dispatchIntent({ type: 'setFieldValue', nodeId: 'form-1', fieldId: 'name', value: 'John' })
```

### Key Differences

| ai-util (deprecated) | view-snapshot (new) |
|---------------------|---------------------|
| `SemanticSnapshot` | `PageSnapshot`, `FormSnapshot`, `TableSnapshot` |
| `AgentAction` | `ViewIntent` (16+ intent types) |
| Form-only support | Form + Table + Tabs + Overlay support |
| `fieldId` only | `nodeId` + `fieldId` (multi-form support) |
| `session.dispatch()` | `engine.dispatchIntent()` (async) |

---

## Related Documentation

- [ViewSnapshot Architecture](../architectures/view-snapshot.md) — New architecture specification
- [AI Interoperability Protocol](../ai-interoperability.md) — Core protocol design
- [AI Interaction Policy Guide](../guides/ai-interaction-policy.md) — Detailed policy usage
- [Expression DSL](../schema-reference/expression-dsl.md) — Visibility condition syntax
