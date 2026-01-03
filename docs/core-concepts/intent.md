# Intent

> **Sources:** docs-original/GLOSSARY.md, docs-original/ARCHITECTURE.md, packages/core/docs/SPEC.md
> **Status:** Core Concept

---

## What is Intent?

**Definition:** A command requesting a domain action. An Intent has a type, optional input, and metadata about its origin.

**In simple terms:** Intent is "what the user (or agent) wants to happen."

---

## Structure

### IntentBody

The command structure itself:

```typescript
type IntentBody = {
  /** The action to perform (must match an ActionSpec) */
  readonly type: string;

  /** Optional input data for the action */
  readonly input?: unknown;
};
```

Example:
```typescript
const intent: IntentBody = {
  type: "addTodo",
  input: {
    title: "Buy milk",
    priority: "high"
  }
};
```

### IntentInstance

A specific invocation with unique identity:

```typescript
type IntentInstance = {
  /** The command */
  readonly body: IntentBody;

  /** Unique identifier for this invocation */
  readonly intentId: string;

  /** Content-addressable key */
  readonly intentKey: string;

  /** Metadata */
  readonly meta: {
    readonly origin?: string;
    readonly timestamp?: number;
  };
};
```

---

## Intent vs Action

| Concept | What It Is | Who Creates It |
|---------|------------|----------------|
| **Intent** | Request to perform an action | User, Agent, System |
| **Action** | Definition of how to handle Intent | Domain author (via Builder) |

**Analogy:**
- Intent = "Customer's order"
- Action = "Recipe for fulfilling that order"

Example:
```typescript
// Intent (what user wants)
{ type: "addTodo", input: { title: "Buy milk" } }

// Action (how to do it)
actions.define({
  addTodo: {
    input: z.object({ title: z.string() }),
    flow: flow.patch(state.todos).set(
      expr.append(state.todos, expr.input('title'))
    )
  }
})
```

MEL equivalent (action):

```mel
domain TodoDomain {
  state {
    todos: Array<string> = []
  }

  action addTodo(title: string) {
    patch todos = append(todos, title)
  }
}
```

---

## Intent Lifecycle

```
┌─────────────────────────────────────────┐
│ 1. User Action                          │
│    "Click 'Add Todo' button"            │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ 2. IntentBody Created                   │
│    { type: "addTodo", input: {...} }    │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ 3. IntentInstance Generated             │
│    + intentId: "uuid-..."               │
│    + intentKey: "hash-..."              │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ 4. World Protocol                       │
│    Wraps in Proposal (+ Actor)          │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ 5. Authority Evaluation                 │
│    Approved → Host executes             │
│    Rejected → No execution              │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ 6. Core Computation                     │
│    Flow execution → Patches + Effects   │
└─────────────────────────────────────────┘
```

---

## Intent Identity (intentId)

Every Intent MUST carry a stable `intentId` that uniquely identifies a processing attempt.

### Why intentId Matters

**Without intentId:**
- How do we distinguish "re-entry" from "new request"?
- How do we correlate Requirements to their originating action?
- How do we implement at-most-once semantics?

**With intentId:**
```typescript
// User clicks "Save"
// → Generate intentId: "abc-123"
// → compute(snapshot, { type: 'save', intentId: 'abc-123' }, context)
// → Effect required, pending
// → Execute effect
// → compute(snapshot, { type: 'save', intentId: 'abc-123' }, context) // Same intentId!
// → Complete

// User clicks "Save" again
// → Generate intentId: "def-456" // New intentId!
// → compute(snapshot, { type: 'save', intentId: 'def-456' }, context)
```

### Rules for intentId

From FDR-H006 (Host Contract):

- Host MUST generate unique intentId per user action
- Host MUST preserve intentId across re-invocations
- Requirement.id can be derived from intentId
- Audit logs can trace full intent lifecycle

---

## Intent Input Validation

Intents can specify input requirements via ActionSpec:

```typescript
// In domain definition
actions.define({
  addTodo: {
    input: z.object({
      title: z.string().min(1, "Title required"),
      priority: z.enum(["low", "medium", "high"]).optional()
    }),
    flow: (...)
  }
})
```

MEL equivalent:

```mel
domain TodoDomain {
  state {
    todos: Array<string> = []
  }

  action addTodo(title: string, priority: "low" | "medium" | "high" | null) {
    when eq(trim(title), "") {
      fail "TITLE_REQUIRED"
    }

    patch todos = append(todos, title)
  }
}
```

When Intent is dispatched:
1. Core validates input against ActionSpec.input
2. If invalid → error
3. If valid → flow execution

---

## Intent vs Event

**Common Confusion:** "Aren't Intents just Events?"

| Concept | Nature | Timing | Examples |
|---------|--------|--------|----------|
| **Intent** | Command (request) | Future | "addTodo", "deleteTodo" |
| **Event** | Fact (notification) | Past | "todoAdded", "todoDeleted" |

**Intent:** "Make this happen"
**Event:** "This happened"

In Manifesto:
- Users/agents dispatch **Intents**
- Intents produce state changes
- State changes can trigger **SourceEvents** (in Bridge layer)

---

## Intent Availability

Actions can specify when they're available:

```typescript
actions.define({
  clearCompleted: {
    // Only available when there are completed todos
    available: expr.gt(computed.completedCount, 0),
    flow: (...)
  }
})
```

MEL equivalent:

```mel
domain Example {
  state {
    completedCount: number = 0
  }

  action clearCompleted() available when gt(completedCount, 0) {
    patch completedCount = 0
  }
}
```

If unavailable Intent is dispatched:
- Core returns error
- Flow is not executed

---

## Common Misconceptions

### Misconception 1: "Intent carries state"

**Wrong:** Intent contains all the data needed for the action.

**Right:** Intent contains only **input** for the action. All other state comes from Snapshot.

```typescript
// WRONG
{ type: "addTodo", todos: currentTodos, newTodo: {...} }

// RIGHT
{ type: "addTodo", input: { title: "Buy milk" } }
// Flow reads current todos from Snapshot
```

### Misconception 2: "Intent execution is atomic"

**Wrong:** Intent executes start to finish without interruption.

**Right:** Intent execution may pause for effects, then resume.

```typescript
// Flow declares effect
compute(snapshot, intent, context) → status: 'pending', requirements: [effect]

// Host executes effect, applies patches
snapshot' = apply(snapshot, patches, context)

// Flow continues
compute(snapshot', intent, context) → status: 'complete'
```

### Misconception 3: "Intent has return value"

**Wrong:** Intents return results.

**Right:** Intents modify Snapshot. Results are in the new Snapshot.

```typescript
// WRONG
const result = await dispatch(intent);
console.log(result.data); // What data?

// RIGHT
await dispatch(intent);
const snapshot = getSnapshot();
console.log(snapshot.data); // State is here
```

---

## Intent in Code

### Creating an Intent (Builder)

```typescript
import { createManifestoApp } from "@manifesto-ai/react";

const Todo = createManifestoApp(TodoDomain, { initialState });

// In component
const { addTodo } = Todo.useActions();

// Dispatch intent
addTodo({ title: "Buy milk" });
// Internally creates: { type: "addTodo", input: { title: "Buy milk" } }
```

### Processing an Intent (Host)

```typescript
import { createHost } from "@manifesto-ai/host";
import { createIntent } from "@manifesto-ai/core";

const host = createHost(schema, {
  initialData: {},
  context: { now: () => Date.now() },
});

// Dispatch intent
const result = await host.dispatch(
  createIntent("addTodo", { title: "Buy milk" }, crypto.randomUUID())
);

console.log(result.status); // "complete" | "pending" | "error"
console.log(result.snapshot.data); // Updated state
```

---

## Intent and Governance

In World Protocol, Intent is wrapped in **Proposal**:

```typescript
type Proposal = {
  proposalId: string;
  actor: ActorRef;        // WHO wants to do this
  intent: IntentInstance; // WHAT they want to do
  baseWorld: WorldId;     // WHERE they want to do it
  submittedAt: number;    // WHEN
};
```

This enables:
- Routing to correct Authority (based on Actor)
- Audit trail (who did what when)
- Accountability (agent X caused problem Y)
- Policy enforcement (agent X can't do action Y)

---

## Related Concepts

- **ActionSpec** - Defines how to handle an Intent
- **Proposal** - Accountability envelope wrapping Intent + Actor
- **Flow** - The execution logic for an Intent
- **Requirement** - Effects declared during Intent execution

---

## See Also

- [Schema Specification](/specifications/schema-spec) - Normative specification including ActionSpec
- [World FDR](/rationale/world-fdr) - Design rationale including Proposal accountability
- [Flow](./flow) - How Intents are executed
- [World](./world) - How Intents are governed
