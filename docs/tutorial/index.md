# Tutorial

> Learn Manifesto through the base runtime first, then add governed composition when the app needs it.

These tutorials are for developers who know TypeScript but are new to Manifesto. The learning path is split on purpose:

- Tutorials `01` through `04` stay focused on the SDK base runtime
- Tutorials `05` and `06` introduce governed composition with Lineage and Governance decorators

---

## Before You Start

- Finish the [Quickstart](/quickstart)
- Be comfortable reading basic TypeScript
- Have a `.mel` loader configured with `@manifesto-ai/compiler`

---

## The Mental Model

Manifesto applications can start in two different ways:

1. Base runtime apps use `createManifesto()`, `activate()`, and typed runtime intents
2. Governed apps add Lineage and Governance before activation

The domain model stays the same in both paths. The difference is where approval, branch history, and audit live.

---

## Direct-Dispatch Track

Use this path when you want the shortest route from a MEL domain to a running app.

| Step | Tutorial | Time | Outcome |
|------|----------|------|---------|
| 1 | [Your First Manifesto Instance](./01-your-first-app) | 15 min | Create a counter and learn the base runtime, subscriptions, and snapshot reads |
| 2 | [Actions and State](./02-actions-and-state) | 20 min | Work with arrays, computed values, and selector-based subscriptions |
| 3 | [Working with Effects](./03-effects) | 25 min | Connect effect declarations to real effect handlers |
| 4 | [Building a Todo App](./04-todo-app) | 30 min | Organize a small app before adding any UI framework |

If you only need a Snapshot-driven app, stop here. The SDK path is enough.

---

## Governed Track

Use this path when you need branch history, explicit actor identity, approval, or post-commit lineage.

| Step | Tutorial | Time | Outcome |
|------|----------|------|---------|
| 5 | [Governed Composition](./05-governed-composition) | 20 min | Compose Lineage and Governance decorators on top of the same manifesto |
| 6 | [Governed Sealing and History](./06-governed-sealing-and-history) | 25 min | Submit proposals, approve or reject them, and read sealed branch history |

This track builds on the same semantics as the SDK path, but it makes the governance seams explicit.

---

## Common Beginner Mistakes

### Expecting state changes before activation

Runtime verbs do not exist until you call `activate()`. Create the composable manifesto first, then activate it.

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
- Go to [Core Concepts](/concepts/) when you want a deeper model of Snapshot, Intent, Effect, and World
- Go to [Architecture](/architecture/) when you want the system-level picture

---

Start with [Your First Manifesto Instance](./01-your-first-app) for the SDK path, or jump to [Governed Composition](./05-governed-composition) when you need explicit lineage and approval.
