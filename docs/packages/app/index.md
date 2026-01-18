# @manifesto-ai/app

> The user-friendly facade for building Manifesto applications

`@manifesto-ai/app` is the high-level orchestration layer that brings together the Manifesto protocol stack into a simple, intuitive API. It provides everything you need to build accountable, AI-ready applications without dealing with low-level protocol details.

---

## What is @manifesto-ai/app?

`@manifesto-ai/app` is a **facade package** that combines:

- **Core** — Pure semantic computation
- **Host** — Effect execution engine
- **World** — Governance and lineage tracking
- **Memory** — Semantic recall system (optional)

Into a single, cohesive API centered around the `App` interface.

```typescript
import { createApp } from "@manifesto-ai/app";
import TodoMel from "./todo.mel";

const app = createApp(TodoMel, {
  services: {
    "api.loadTodos": async () => {
      const todos = await fetch("/api/todos").then((r) => r.json());
      return [{ op: "set", path: "todos", value: todos }];
    },
  },
});

await app.ready();
app.act("addTodo", { title: "Learn Manifesto" });
```

---

## Key Features

### Simple API

Create an app with `createApp()`, execute actions with `act()`, and subscribe to state changes with `subscribe()`. No boilerplate, no ceremony.

### MEL-First

Define your domain logic in MEL (Manifesto Expression Language), a declarative DSL designed for AI-readable, human-auditable state management.

```mel
domain TodoApp {
  state {
    todos: Array<Todo> = []
  }

  action addTodo(title: string) {
    once(addTodoIntent) {
      patch addTodoIntent = $meta.intentId
      patch todos = append(todos, {
        id: $system.uuid,
        title: title,
        completed: false
      })
    }
  }
}
```

### Full Accountability

Every state change is recorded with:
- **Who** — Actor identity
- **What** — Intent type and input
- **When** — Timestamp
- **Why** — Authority decision

### World Event Hub

App owns **World governance event** subscriptions. Provide a WorldEventHub as the World
event sink, then subscribe to governance events from App (not from World).

```typescript
import { createWorldEventHub } from "@manifesto-ai/app";
import { createManifestoWorld } from "@manifesto-ai/world";

const worldEvents = createWorldEventHub();
const world = createManifestoWorld({
  schemaHash: "my-app-v1",
  eventSink: worldEvents,
});

worldEvents.subscribe((event) => {
  if (event.type === "proposal:decided") {
    console.log("Decision:", event.decision);
  }
});
```

### Effect Handlers as Services

Side effects (API calls, database operations) are handled by **services** — simple async functions that return patches.

### Branch Management

Fork application state into branches for A/B testing, undo/redo, or speculative execution.

### Memory Integration

Optional semantic memory system for AI-powered recall and context injection. Includes memory maintenance for GDPR-compliant data management (v0.4.9+).

---

## Quick Start

### Installation

```bash
npm install @manifesto-ai/app @manifesto-ai/compiler
# or
pnpm add @manifesto-ai/app @manifesto-ai/compiler
```

### Basic Usage

```typescript
import { createApp } from "@manifesto-ai/app";

// 1. Define domain in MEL
const counterMel = `
domain Counter {
  state {
    count: number = 0
  }

  action increment() {
    once(incrementIntent) {
      patch incrementIntent = $meta.intentId
      patch count = add(count, 1)
    }
  }
}
`;

// 2. Create app
const app = createApp(counterMel);

// 3. Initialize
await app.ready();

// 4. Execute actions
await app.act("increment").done();
console.log(app.getState().data.count); // 1

// 5. Subscribe to changes
app.subscribe(
  (state) => state.data.count,
  (count) => console.log("Count:", count)
);

await app.act("increment").done();
// → Count: 2
```

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Getting Started](./getting-started) | Step-by-step tutorial for your first app |
| [API Reference](./api-reference) | Complete API documentation |
| [Service Handlers](./services) | How to write effect handlers |
| [Subscriptions](./subscriptions) | Reactive state subscription patterns |
| [Actions](./actions) | Action lifecycle and execution |
| [Branch Management](./branches) | Forking and branch switching |
| [Advanced Topics](./advanced) | Sessions, memory, memory maintenance, hooks, and plugins |
| [Examples](./examples) | Real-world application examples |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Your Code                            │
│  createApp() → act() → subscribe() → getState()             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    @manifesto-ai/app                        │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐ │
│  │   App     │  │  Branch   │  │  Session  │  │  Memory  │ │
│  └───────────┘  └───────────┘  └───────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌───────────────────┐
│ @manifesto-ai │   │  @manifesto-ai  │   │   @manifesto-ai   │
│     /core     │   │      /host      │   │      /world       │
│ (computation) │   │   (execution)   │   │   (governance)    │
└───────────────┘   └─────────────────┘   └───────────────────┘
```

---

## When to Use @manifesto-ai/app

**Use @manifesto-ai/app when:**
- Building user-facing applications
- You want a simple, batteries-included API
- You need action tracking and subscriptions
- You're building with React or other UI frameworks

**Use lower-level packages when:**
- Building custom infrastructure (use `@manifesto-ai/core` + `@manifesto-ai/host`)
- Implementing custom governance (use `@manifesto-ai/world`)
- Creating custom memory providers (use `@manifesto-ai/memory`)

---

## Next Steps

Ready to build? Start with the [Getting Started](./getting-started) guide.
