# Flow

> Declarative computation expressed as data structures.

## What is Flow?

Flow describes what should happen when an Intent is processed. It's a data structure that Core interprets, not code that executes directly.

Flows are **not Turing-complete**. They always terminate in finite steps. This guarantees predictable resource usage and enables static analysis. For unbounded iteration, Host controls the loop.

The key insight: there is no suspended Flow context. When Flow declares an Effect, computation stops. Host executes the effect, applies patches, then calls `compute()` again. The Flow runs from the beginning, checking Snapshot to see what's already done.

## Structure

```typescript
type FlowNode =
  | { kind: 'seq'; steps: readonly FlowNode[] }
  | { kind: 'if'; cond: ExprNode; then: FlowNode; else?: FlowNode }
  | { kind: 'patch'; op: 'set' | 'unset' | 'merge'; path: string; value?: ExprNode }
  | { kind: 'effect'; type: string; params: Record<string, ExprNode> }
  | { kind: 'call'; flow: string }
  | { kind: 'halt'; reason?: string }
  | { kind: 'fail'; code: string; message?: ExprNode };
```

## Key Properties

- **Data, not code**: Flows are JSON-serializable structures.
- **Always terminate**: No unbounded loops or recursion.
- **Re-entry safe**: Must work correctly when run multiple times.
- **Pure**: Same Snapshot + Flow always produces same result.

## Example

### MEL (Recommended)

```mel
domain TodoDomain {
  state {
    todos: Array<Todo> = []
  }

  action addTodo(title: string, localId: string) {
    // Validation
    when eq(len(title), 0) {
      fail "EMPTY_TITLE"
    }

    // Guarded execution
    onceIntent {
      // Optimistic update
      patch todos = append(todos, {
        id: localId,
        title: title,
        syncStatus: "pending"
      })

      // API call
      effect api.createTodo {
        title: title
      }
    }
  }
}
```

### Compiled JSON (Internal Representation)

MEL compiles to JSON Flow structures that Core interprets:

```json
{
  "kind": "seq",
  "steps": [
    {
      "kind": "if",
      "cond": { "kind": "eq", "left": { "kind": "len", "arg": { "kind": "input", "path": "title" } }, "right": 0 },
      "then": { "kind": "fail", "code": "EMPTY_TITLE" }
    },
    {
      "kind": "if",
      "cond": { "kind": "isNull", "arg": { "kind": "get", "path": "$mel.guards.intent.addTodo_0" } },
      "then": {
        "kind": "seq",
        "steps": [
          {
            "kind": "patch",
            "op": "merge",
            "path": "$mel.guards.intent",
            "value": { "addTodo_0": { "kind": "meta", "field": "intentId" } }
          },
          {
            "kind": "patch",
            "op": "set",
            "path": "data.todos",
            "value": { "kind": "append", "arr": { "kind": "get", "path": "data.todos" }, "item": "..." }
          },
          {
            "kind": "effect",
            "type": "api.createTodo",
            "params": { "title": { "kind": "input", "path": "title" } }
          }
        ]
      }
    }
  ]
}
```

## Common Patterns

### Re-entry Safe Flow with `onceIntent`

```mel
// RIGHT: Uses onceIntent for automatic re-entry safety
action submit() {
  onceIntent {
    patch count = add(count, 1)
    effect api.submit({})
  }
}
```

### Re-entry Safe Flow with Manual Guard

```mel
// RIGHT: State-guarded
action submit(timestamp: number) {
  when isNull(submittedAt) {
    patch submittedAt = timestamp
    effect api.submit({})
  }
}
```

### Unsafe Flow (WRONG)

```mel
// WRONG: Runs every compute cycle - infinite loop!
action submit() {
  patch count = add(count, 1)
  effect api.submit({})
}
```

### Conditional Branching

```mel
action checkAccess() {
  when user.isAdmin {
    patch access = "full"
  }
  when not(user.isAdmin) {
    patch access = "limited"
  }
}
```

### Validation with Fail

```mel
action createUser(email: string) {
  when not(contains(email, "@")) {
    fail "INVALID_EMAIL"
  }

  onceIntent {
    effect api.createUser { email: email }
  }
}
```

### Status-Based Guards

```mel
action load() {
  when eq(status, "idle") {
    patch status = "loading"
    effect api.load({})
  }
}
```

## Flow Node Types

| Node | Purpose | MEL Syntax |
|------|---------|------------|
| `seq` | Execute steps in order | Statements in order |
| `if` | Conditional branching | `when condition { ... }` |
| `patch` | State mutation (set, unset, merge) | `patch field = value` |
| `effect` | Declare external operation | `effect type { params }` |
| `call` | Invoke another flow | (Internal) |
| `halt` | Normal termination | `stop` |
| `fail` | Error termination | `fail "CODE"` |

## How Core Interprets Flow

```
Intent arrives
      ↓
Core.compute(schema, snapshot, intent)
      ↓
Flow evaluation begins
      ↓
┌─────────────────────────────────────┐
│ For each FlowNode:                  │
│   - seq: process steps in order     │
│   - if: evaluate condition, branch  │
│   - patch: collect patch operation  │
│   - effect: add to requirements     │
│   - fail: set error, halt           │
└─────────────────────────────────────┘
      ↓
Returns: { snapshot', patches, requirements, trace }
      ↓
If requirements exist:
  Host executes effects
  Host applies patches
  Host calls compute() again
      ↓
If no requirements:
  Flow complete
```

## See Also

- [Effect](./effect.md) - External operations declared in Flow
- [Snapshot](./snapshot.md) - State that Flow reads and modifies
- [Intent](./intent.md) - What triggers Flow execution
- [Re-entry Safe Flows](/guides/reentry-safe-flows) - Guard patterns
- [MEL Syntax](/mel/SYNTAX) - Complete language reference
