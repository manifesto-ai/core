# Intent

> A request to perform a domain action.

## What is Intent?

Intent represents what a user (or agent) wants to happen. It's a proposal for state change, not a command. The system decides whether to approve and execute it.

An Intent has a type (which action to perform) and optional input data. When submitted, it flows through World Protocol for authority evaluation before Host executes it.

Think of Intent as a customer's order. The order describes what they want; the kitchen (Flow) defines how to make it; the restaurant (World) decides whether to accept it.

## Structure

### IntentBody

The command structure itself:

```typescript
type IntentBody = {
  /** The action to perform (matches an ActionSpec) */
  readonly type: string;

  /** Optional input data */
  readonly input?: unknown;
};
```

### IntentInstance

A specific invocation with unique identity:

```typescript
type IntentInstance = {
  readonly body: IntentBody;
  readonly intentId: string;      // Unique per invocation
  readonly intentKey: string;     // Content-addressable
  readonly meta: {
    readonly origin?: string;
    readonly timestamp?: number;
  };
};
```

## Key Properties

- **Typed**: Intent type must match a defined Action.
- **Stateless**: Intent carries only input; all other state comes from Snapshot.
- **Traceable**: Every Intent has a unique `intentId` for audit trails.
- **Validated**: Input is validated against ActionSpec before execution.

## Example

```typescript
// Simple intent
const intent: IntentBody = {
  type: "addTodo",
  input: { title: "Buy milk" }
};

// Creating an IntentInstance
import { createIntent } from "@manifesto-ai/core";

const instance = createIntent(
  "addTodo",
  { title: "Buy milk", priority: "high" },
  "intent-123"  // intentId
);
```

### MEL Equivalent

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

## Common Patterns

### Dispatching Intents (React)

```typescript
import { createManifestoApp } from "@manifesto-ai/react";

const Todo = createManifestoApp(TodoDomain, { initialState });

function AddTodoButton() {
  const { addTodo } = Todo.useActions();

  return (
    <button onClick={() => addTodo({ title: "New task" })}>
      Add Todo
    </button>
  );
}
```

### Dispatching Intents (Host)

```typescript
import { createHost } from "@manifesto-ai/host";
import { createIntent } from "@manifesto-ai/core";

const host = createHost(schema, { initialData: {} });

const result = await host.dispatch(
  createIntent("addTodo", { title: "Buy milk" }, "intent-1")
);

console.log(result.status); // "complete" | "pending" | "error"
```

### Conditional Availability

```typescript
// Action only available when condition is met
actions.define({
  clearCompleted: {
    available: expr.gt(computed.completedCount, 0),
    flow: flow.patch(state.todos).set(
      expr.filter(state.todos, (t) => expr.not(t.completed))
    )
  }
});
```

## Intent vs Event

| Concept | Nature | Timing |
|---------|--------|--------|
| **Intent** | Command (request) | Future: "Make this happen" |
| **Event** | Fact (notification) | Past: "This happened" |

## See Also

- [Flow](./flow.md) - How intents are executed
- [World](./world.md) - How intents are governed
- [Snapshot](./snapshot.md) - Where intent results appear
