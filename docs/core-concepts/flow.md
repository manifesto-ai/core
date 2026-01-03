# Flow

> **Sources:** docs-original/GLOSSARY.md, packages/core/docs/SPEC.md, packages/core/docs/FDR.md
> **Status:** Core Concept

---

## What is Flow?

**Definition:** A declarative description of a computation sequence. Flows are evaluated by Core and may produce Patches, Effects, or both.

**In simple terms:** Flow is "how to respond to an Intent."

---

## Core Principles

```
1. Flows do NOT execute; they describe.
2. Flows do NOT return values; they modify Snapshot.
3. Flows are NOT Turing-complete; they always terminate.
4. Flows are data, not code.
5. There is no suspended Flow context.
```

---

## Structure

```typescript
type FlowNode =
  // Sequencing
  | { kind: 'seq'; steps: readonly FlowNode[] }

  // Conditional
  | { kind: 'if'; cond: ExprNode; then: FlowNode; else?: FlowNode }

  // State mutation
  | { kind: 'patch'; op: 'set' | 'unset' | 'merge'; path: SemanticPath; value?: ExprNode }

  // Requirement declaration
  | { kind: 'effect'; type: string; params: Record<string, ExprNode> }

  // Flow composition
  | { kind: 'call'; flow: string }

  // Termination
  | { kind: 'halt'; reason?: string }

  // Error
  | { kind: 'fail'; code: string; message?: ExprNode };
```

---

## Flow Node Types

### seq (Sequential Execution)

Executes steps in order. Each step sees the Snapshot as modified by previous steps.

```json
{
  "kind": "seq",
  "steps": [
    { "kind": "patch", "op": "set", "path": "a", "value": { "kind": "lit", "value": 1 } },
    { "kind": "patch", "op": "set", "path": "b", "value": { "kind": "get", "path": "a" } }
  ]
}
// Result: a = 1, b = 1
```

### if (Conditional Branching)

Evaluates condition against current Snapshot. Executes `then` or `else` branch.

```json
{
  "kind": "if",
  "cond": { "kind": "get", "path": "user.isAdmin" },
  "then": { "kind": "patch", "op": "set", "path": "access", "value": { "kind": "lit", "value": "full" } },
  "else": { "kind": "patch", "op": "set", "path": "access", "value": { "kind": "lit", "value": "limited" } }
}
```

### patch (State Mutation)

Declares a state change. Three operations:

| Operation | Description | Example |
|-----------|-------------|---------|
| `set` | Set value at path | `{ op: "set", path: "count", value: 5 }` |
| `unset` | Remove value at path | `{ op: "unset", path: "temp" }` |
| `merge` | Shallow merge object at path | `{ op: "merge", path: "user", value: {...} }` |

### effect (Requirement Declaration)

Declares that an external operation is required.

**Critical:** Effects are NOT executed by Core. They are **declarations recorded in Snapshot**.

```json
{
  "kind": "effect",
  "type": "api:createTodo",
  "params": {
    "title": { "kind": "get", "path": "input.title" }
  }
}
```

When Core encounters an effect node:
1. Core **records a Requirement** in `snapshot.system.pendingRequirements`
2. Core **terminates the current computation**
3. Core returns with `status: 'pending'`

**There is no suspended execution context.**

The Host is responsible for:
1. Executing the effect (IO, network, etc.)
2. Applying result Patches to Snapshot
3. Calling `compute()` **again** with the new Snapshot

**All continuity is expressed exclusively through Snapshot.**

### call (Flow Composition)

Invokes another Flow by name. Enables composition.

```json
{
  "kind": "call",
  "flow": "shared.validateInput"
}
```

**Important:** `call` does NOT pass arguments or return values.

- The called Flow reads from the same Snapshot
- The called Flow writes to the same Snapshot
- There is no parameter passing mechanism

If you need to pass context to a called Flow, write it to Snapshot first:

```json
{
  "kind": "seq",
  "steps": [
    { "kind": "patch", "op": "set", "path": "system.callContext",
      "value": { "kind": "get", "path": "input" } },
    { "kind": "call", "flow": "shared.processWithContext" }
  ]
}
```

### halt (Normal Termination)

Stops Flow execution normally. Not an error.

```json
{
  "kind": "if",
  "cond": { "kind": "get", "path": "alreadyProcessed" },
  "then": { "kind": "halt", "reason": "Already processed, skipping" }
}
```

### fail (Error Termination)

Stops Flow execution with an error. The error is recorded in Snapshot.

```json
{
  "kind": "if",
  "cond": { "kind": "not", "arg": { "kind": "get", "path": "computed.isValid" } },
  "then": {
    "kind": "fail",
    "code": "VALIDATION_ERROR",
    "message": { "kind": "lit", "value": "Input validation failed" }
  }
}
```

---

## Why Flows Are Not Turing-Complete

From FDR-006:

FlowSpec does NOT include unbounded loops (`while`, `for`, recursion).

### Rationale

By limiting expressiveness:

1. **Guaranteed Termination**: All Flows finish in finite steps
2. **Static Analysis**: Can verify properties without execution
3. **Complete Traces**: Trace is always finite
4. **Predictable Resources**: Bounded memory and time

For unbounded iteration, **Host controls the loop**:

```typescript
const context = { now: 0, randomSeed: "seed" };
while (needsMoreWork(snapshot)) {
  const result = await core.compute(schema, snapshot, intent, context);
  snapshot = result.snapshot;
}
```

---

## Flow Re-Entry Safety

**This is critical and often misunderstood.**

### The Problem

Because there's no `resume()` API, the same Flow will be evaluated **multiple times** for a single user action:

1. First `compute()`: Flow runs until effect, returns `pending`
2. Host executes effect, applies patches
3. Second `compute()`: Flow runs **from the beginning**

If the Flow is not re-entrant, step 3 will duplicate the work from step 1.

### The Solution: State Guards

**Every patch and effect MUST be guarded by state conditions.**

```typescript
// WRONG: No guard (runs every compute cycle)
flow.seq(
  flow.patch(state.count).set(expr.add(state.count, 1)),
  flow.effect('api.submit', {})
)

// RIGHT: State-guarded
flow.onceNull(state.submittedAt, ({ patch, effect }) => {
  patch(state.submittedAt).set(expr.input('timestamp'));
  patch(state.count).set(expr.add(state.count, 1));
  effect('api.submit', {});
});
```

**The Pattern:**
- Before executing step X, check if X's side effect already happened
- X's effect should change some state that guards X
- Creates a feedback loop that prevents re-execution

---

## Complete Flow Example

```json
{
  "kind": "seq",
  "steps": [
    {
      "kind": "if",
      "cond": {
        "kind": "lte",
        "left": { "kind": "len", "arg": { "kind": "get", "path": "input.title" } },
        "right": { "kind": "lit", "value": 0 }
      },
      "then": { "kind": "fail", "code": "EMPTY_TITLE" }
    },
    {
      "kind": "patch",
      "op": "set",
      "path": "todos",
      "value": {
        "kind": "concat",
        "args": [
          { "kind": "get", "path": "todos" },
          [{
            "id": { "kind": "get", "path": "input.localId" },
            "title": { "kind": "get", "path": "input.title" },
            "completed": false,
            "syncStatus": "pending"
          }]
        ]
      }
    },
    {
      "kind": "effect",
      "type": "api:createTodo",
      "params": {
        "localId": { "kind": "get", "path": "input.localId" },
        "title": { "kind": "get", "path": "input.title" }
      }
    }
  ]
}
```

---

## Flow in Builder DSL

The Builder package provides a type-safe DSL for defining Flows:

```typescript
import { defineDomain } from "@manifesto-ai/builder";

const TodoDomain = defineDomain(
  TodoStateSchema,
  ({ state, actions, expr, flow }) => {
    const { addTodo } = actions.define({
      addTodo: {
        input: z.object({
          title: z.string().min(1),
          localId: z.string()
        }),
        flow: flow.seq(
          // Validation
          flow.when(
            expr.lte(expr.len(expr.input('title')), 0),
            flow.fail('EMPTY_TITLE')
          ),
          // Optimistic update
          flow.patch(state.todos).set(
            expr.append(
              state.todos,
              expr.object({
                id: expr.input('localId'),
                title: expr.input('title'),
                completed: expr.lit(false),
                syncStatus: expr.lit('pending')
              })
            )
          ),
          // API call
          flow.effect('api:createTodo', {
            localId: expr.input('localId'),
            title: expr.input('title')
          })
        )
      }
    });

    return { actions: { addTodo } };
  }
);
```

MEL equivalent:

```mel
domain TodoDomain {
  type TodoItem = {
    id: string,
    title: string,
    completed: boolean,
    syncStatus: string
  }

  state {
    todos: Array<TodoItem> = []
  }

  action addTodo(title: string, localId: string) {
    when eq(trim(title), "") {
      fail "EMPTY_TITLE"
    }

    when neq(trim(title), "") {
      patch todos = append(todos, {
        id: localId,
        title: title,
        completed: false,
        syncStatus: "pending"
      })

      effect api:createTodo({
        localId: localId,
        title: title
      })
    }
  }
}
```

---

## Flow Evaluation

Core evaluates Flows step by step:

```
┌─────────────────────────────────────────┐
│ compute(schema, snapshot, intent, context)       │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ Look up ActionSpec for intent.type      │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ Evaluate flow (FlowNode)                │
│   - For each step:                      │
│     - Evaluate expressions              │
│     - Generate patches                  │
│     - Or encounter effect → stop        │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ Return ComputeResult:                   │
│   - snapshot' (with patches applied)    │
│   - requirements[] (if effect)          │
│   - trace (what happened)               │
└─────────────────────────────────────────┘
```

---

## Common Misconceptions

### Misconception 1: "Flow has state"

**Wrong:** Flow remembers where it stopped.

**Right:** Flow is pure computation. It has no memory. State guards create the illusion of progress.

### Misconception 2: "Effect returns to Flow"

**Wrong:** After effect executes, Flow continues with the result.

**Right:** After effect executes, Flow starts **from the beginning** and checks Snapshot to see effect result.

### Misconception 3: "Flow is like async/await"

**Wrong:** Flows are like async functions with await for effects.

**Right:** Flows are declarative data structures. No execution context, no callbacks, no promises.

---

## Requirements

From SPEC.md:

- Flows MUST NOT contain unbounded loops (`while`, `for`, recursion)
- All Flow execution MUST terminate in finite steps
- `call` references MUST NOT form cycles
- `effect` MUST terminate computation (no continuation in same compute cycle)

---

## Related Concepts

- **ActionSpec** - Maps Intent to Flow
- **ExprNode** - Pure expressions used in Flows
- **Effect** - External operation declared in Flow
- **Patch** - State mutation produced by Flow

---

## See Also

- [Schema Specification](/specifications/schema-spec) - Normative specification including FlowSpec
- [Core FDR](/rationale/core-fdr) - Design rationale including Flow termination guarantees
- [Re-entry Safe Flows Guide](/guides/reentry-safe-flows) - Practical patterns
- [Effect](./effect) - Understanding effects
