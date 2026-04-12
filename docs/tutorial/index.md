# Tutorial

> Learn Manifesto through the base runtime first. Open the advanced runtime track only when the project needs approval or sealed history.

## Before You Start

- Finish the [Quick Start](/guide/quick-start)
- Be comfortable reading basic TypeScript
- Have a `.mel` loader configured with `@manifesto-ai/compiler`

## Core Path

Use this path when you want the shortest route from a MEL domain to a running app.

| Step | Tutorial | Time | Outcome |
|------|----------|------|---------|
| 1 | [Your First Manifesto Instance](./01-your-first-app) | 15 min | Create a counter and learn the base runtime, subscriptions, and snapshot reads |
| 2 | [Actions and State](./02-actions-and-state) | 20 min | Work with arrays, computed values, and selector-based subscriptions |
| 3 | [Working with Effects](./03-effects) | 25 min | Connect effect declarations to real effect handlers |
| 4 | [Building a Todo App](./04-todo-app) | 30 min | Organize a small app before adding any UI framework |

If you only need a Snapshot-driven app, stop here. The SDK path is enough.

## Advanced Runtime Later

Read this only when the project now needs reviewable writes, branch history, explicit actor identity, or sealed continuity.

| Step | Tutorial | Time | Outcome |
|------|----------|------|---------|
| 5 | [Approval and History Setup](./05-governed-composition) | 20 min | Add Lineage and Governance decorators on top of the same manifesto |
| 6 | [Sealed History and Review Flow](./06-governed-sealing-and-history) | 25 min | Submit proposals, approve or reject them, and read sealed branch history |

If you are still deciding whether you need this, read [When You Need Approval or History](/guides/approval-and-history) first.

## After The Tutorial

- Go to [Guides](/guides/) when you need a concrete technique.
- Go to [Integration](/integration/) when you want React or AI-agent patterns.
- Go to [Concepts](/concepts/) when you want the vocabulary and mental model.
- Go to [Architecture](/architecture/) when you want the system-level picture.

Start with [Your First Manifesto Instance](./01-your-first-app). Open the advanced runtime track only after the base path already makes sense.
