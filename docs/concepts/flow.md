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

### Builder DSL

```typescript
import { defineDomain } from "@manifesto-ai/builder";

const TodoDomain = defineDomain(schema, ({ state, flow, expr }) => ({
  actions: {
    addTodo: {
      input: z.object({ title: z.string() }),
      flow: flow.seq(
        // Validation
        flow.when(
          expr.eq(expr.len(expr.input('title')), 0),
          flow.fail('EMPTY_TITLE')
        ),
        // Optimistic update
        flow.patch(state.todos).set(
          expr.append(state.todos, {
            id: expr.input('localId'),
            title: expr.input('title'),
            syncStatus: 'pending'
          })
        ),
        // API call
        flow.effect('api:createTodo', {
          title: expr.input('title')
        })
      )
    }
  }
}));
```

### MEL Equivalent

```mel
action addTodo(title: string, localId: string) {
  when eq(len(title), 0) {
    fail "EMPTY_TITLE"
  }

  patch todos = append(todos, {
    id: localId,
    title: title,
    syncStatus: "pending"
  })

  effect api:createTodo({
    title: title
  })
}
```

### Raw JSON

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
      "kind": "patch",
      "op": "set",
      "path": "todos",
      "value": { "kind": "append", "arr": { "kind": "get", "path": "todos" }, "item": "..." }
    },
    {
      "kind": "effect",
      "type": "api:createTodo",
      "params": { "title": { "kind": "input", "path": "title" } }
    }
  ]
}
```

## Common Patterns

### Re-entry Safe Flow

```typescript
// WRONG: Runs every compute cycle
flow.seq(
  flow.patch(state.count).set(expr.add(state.count, 1)),
  flow.effect('api.submit', {})
)

// RIGHT: State-guarded
flow.onceNull(state.submittedAt, ({ patch, effect }) => {
  patch(state.submittedAt).set(expr.now());
  effect('api.submit', {});
});
```

### Conditional Branching

```typescript
flow.when(
  expr.get(state.user.isAdmin),
  flow.patch(state.access).set('full'),
  flow.patch(state.access).set('limited')
)
```

### Flow Composition

```typescript
// Define reusable flow
const validateInput = flow.when(
  expr.eq(expr.len(expr.input('title')), 0),
  flow.fail('EMPTY_TITLE')
);

// Use in action
flow.seq(
  flow.call('validateInput'),
  flow.patch(state.todos).set(...)
)
```

## Flow Node Types

| Node | Purpose |
|------|---------|
| `seq` | Execute steps in order |
| `if` | Conditional branching |
| `patch` | State mutation (set, unset, merge) |
| `effect` | Declare external operation |
| `call` | Invoke another flow |
| `halt` | Normal termination |
| `fail` | Error termination |

## See Also

- [Effect](./effect.md) - External operations declared in Flow
- [Snapshot](./snapshot.md) - State that Flow reads and modifies
- [Intent](./intent.md) - What triggers Flow execution
