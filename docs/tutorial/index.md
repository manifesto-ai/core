# Tutorial

Build a Manifesto application in 4 steps. Each tutorial builds on the previous one.

---

## Understanding the Compute Loop

Before diving in, understand the core mechanism. When you trigger an action:

```
compute(snapshot, intent)
        |
        v
    Patches[]
        |
        v
apply(snapshot, patches)
        |
        v
    snapshot'
        |
        v
compute(snapshot', intent)  <- Loop continues until no more changes
```

1. **compute()** evaluates the action against the current snapshot
2. It produces **patches** (state changes)
3. **apply()** creates a new snapshot
4. The loop **repeats** until no more patches are generated

### Why Guards Matter

Without guards, patches re-apply infinitely:

```mel
action increment() {
  patch count = add(count, 1)  // runs every cycle!
}
```

Use `onceIntent` to run exactly once per intent:

```mel
action increment() {
  onceIntent {
    patch count = add(count, 1)
  }
}
```

---

## Tutorials

| # | Tutorial | Time | What You'll Build |
|---|----------|------|-------------------|
| 1 | [Your First App](./01-your-first-app) | 15 min | Counter app with MEL |
| 2 | [Actions and State](./02-actions-and-state) | 20 min | State mutations, computed values |
| 3 | [Working with Effects](./03-effects) | 25 min | External operations, async patterns |
| 4 | [Building a Todo App](./04-todo-app) | 45 min | Full CRUD app with filtering |

**Total time:** ~2 hours

---

## Prerequisites

- **Node.js 18+** (or Bun)
- **Basic TypeScript knowledge** (types, async/await)
- A code editor (VS Code recommended)
- `@manifesto-ai/sdk` and `@manifesto-ai/compiler` installed

---

## Common Beginner Mistakes

### Missing `onceIntent` Guard

```mel
// WRONG: Runs every compute cycle!
action increment() {
  patch count = add(count, 1)
}

// RIGHT: Runs only once per intent
action increment() {
  onceIntent {
    patch count = add(count, 1)
  }
}
```

### Mutating Snapshots Directly

```typescript
// WRONG: Direct mutation does nothing!
const state = app.getState();
state.data.count = 5;

// RIGHT: Use actions
await app.act("setCount", { value: 5 }).done();
```

### Expecting Effects to Return Values

```typescript
// WRONG: Effects don't return values to actions
const user = await someEffect();

// RIGHT: Effects write to Snapshot, read it after
await app.act("fetchUser", { id: "123" }).done();
const user = app.getState().data.user;
```

---

## After the Tutorials

Once you've completed all 4 tutorials, explore:

- **[How-to Guides](/guides/)** -- Solve specific problems (debugging, re-entry safety, etc.)
- **[Integration](/integration/)** -- Connect with React, AI agents
- **[Core Concepts](/concepts/)** -- Deep-dive into Snapshot, Intent, Flow, Effect, World
- **[MEL Syntax](/mel/SYNTAX)** -- Complete language reference

---

**Ready? Start with [Your First App](./01-your-first-app).**
