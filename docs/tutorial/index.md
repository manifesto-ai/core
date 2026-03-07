# Tutorial

> Build up from one `ManifestoInstance` to a small app, one step at a time.

These tutorials are for developers who know TypeScript but are new to Manifesto. They assume the current SDK surface:

- `createManifesto()` creates a ready-to-use instance
- `dispatch()` enqueues an `Intent`
- `subscribe()` and `on()` let you observe what happened
- `getSnapshot()` gives you the latest terminal snapshot

---

## Before You Start

- Finish the [Quickstart](/quickstart)
- Be comfortable reading basic TypeScript
- Have a `.mel` loader configured with `@manifesto-ai/compiler`

---

## The Mental Model

Manifesto applications start with the same three pieces:

1. A MEL domain that defines state, computed values, actions, and effects
2. A `ManifestoInstance` created with `createManifesto()`
3. A small helper that turns `dispatch()` + telemetry events into an awaitable workflow when you need one

If you keep those three pieces clear, the rest of the learning path gets much easier.

---

## Learning Path

| Step | Tutorial | Time | Outcome |
|------|----------|------|---------|
| 1 | [Your First Manifesto Instance](./01-your-first-app) | 15 min | Create a counter and learn `dispatch`, `subscribe`, `getSnapshot` |
| 2 | [Actions and State](./02-actions-and-state) | 20 min | Work with arrays, computed values, and selector-based subscriptions |
| 3 | [Working with Effects](./03-effects) | 25 min | Connect effect declarations to real effect handlers |
| 4 | [Building a Todo App](./04-todo-app) | 30 min | Organize a small app before adding any UI framework |

---

## Common Beginner Mistakes

### Expecting `dispatch()` to return the result

`dispatch()` only enqueues work. Read the next state through `subscribe()` or `getSnapshot()`, or use a small `dispatchAsync()` helper built on top of `on()`.

### Forgetting `onceIntent`

If an action can re-enter during the compute loop, an unguarded patch or effect can run more than once. Use `onceIntent` unless you are intentionally building a state-driven loop.

### Mutating a snapshot directly

Snapshots are read models. You do not change them in place. You dispatch intents and let Manifesto compute the next snapshot.

### Treating effects like returned values

Effect handlers do not feed values back through a hidden return channel. They return patches, and those patches become part of the next snapshot.

---

## After the Tutorials

- Go to [How-to Guides](/guides/) when you need a concrete technique
- Go to [Integration](/integration/) when you want React or AI-agent patterns
- Go to [Core Concepts](/concepts/) when you want a deeper model of Snapshot, Intent, Flow, and Effect
- Go to [Architecture](/architecture/) when you want the system-level picture

---

Start with [Your First Manifesto Instance](./01-your-first-app).
