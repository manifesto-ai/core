# Tutorial

> Learn Manifesto through the base runtime first. Only open the advanced runtime track when the project needs approval or sealed history.

These tutorials are for developers who know TypeScript but are new to Manifesto. The learning path is split on purpose:

- Tutorials `01` through `04` are the normal first path
- Tutorials `05` and `06` are an optional advanced runtime add-on

---

## Before You Start

- Finish the [Quickstart](/quickstart)
- Be comfortable reading basic TypeScript
- Have a `.mel` loader configured with `@manifesto-ai/compiler`

---

## The Mental Model

Manifesto applications should usually start one way:

1. Base runtime apps use `createManifesto()`, `activate()`, and typed runtime intents

Later, if the project needs approval, branch history, or auditability, add the advanced runtime layers without changing the domain model.

---

## Core Path

Use this path when you want the shortest route from a MEL domain to a running app.

| Step | Tutorial | Time | Outcome |
|------|----------|------|---------|
| 1 | [Your First Manifesto Instance](./01-your-first-app) | 15 min | Create a counter and learn the base runtime, subscriptions, and snapshot reads |
| 2 | [Actions and State](./02-actions-and-state) | 20 min | Work with arrays, computed values, and selector-based subscriptions |
| 3 | [Working with Effects](./03-effects) | 25 min | Connect effect declarations to real effect handlers |
| 4 | [Building a Todo App](./04-todo-app) | 30 min | Organize a small app before adding any UI framework |

If you only need a Snapshot-driven app, stop here. The SDK path is enough.

---

## Optional Advanced Runtime

Read this only when the project now needs reviewable writes, branch history, explicit actor identity, or sealed continuity.

| Step | Tutorial | Time | Outcome |
|------|----------|------|---------|
| 5 | [Approval and History Setup](./05-governed-composition) | 20 min | Add Lineage and Governance decorators on top of the same manifesto |
| 6 | [Sealed History and Review Flow](./06-governed-sealing-and-history) | 25 min | Submit proposals, approve or reject them, and read sealed branch history |

If you are still deciding whether you need this, read [When You Need Approval or History](/guides/approval-and-history) first.

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

Start with [Your First Manifesto Instance](./01-your-first-app). Open the advanced runtime track only after the base path already makes sense.
