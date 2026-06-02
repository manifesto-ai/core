# Tutorial

> Learn Manifesto by building a small app first. Add approval or durable history only when the product needs it.

## Before You Start

- Finish the [Quick Start](/guide/quick-start)
- Skim [Project Anatomy](/guide/project-anatomy) if you want the file map first
- Be comfortable reading basic TypeScript
- Use the `.mel` loader setup from Quick Start when you run tutorial files directly

The first tutorials are deliberately no-build scripts. They use the Node/tsx MEL
loader so you can learn the runtime before adding a web build. For a typed web,
route, or agent project, add [Bundler Setup](/guides/bundler-setup) and
[Code Generation](/guides/code-generation) before React or server integration.

The tutorial scripts use the Node/tsx MEL loader when run directly:

```bash
npx tsx --loader @manifesto-ai/compiler/node-loader main.ts
```

## How To Lay Out The Files

For tutorials 1 and 2, keep the `.mel` file and `main.ts` in the same folder so
the imports match the snippets:

```text
counter.mel   # tutorial 1
todo.mel      # tutorial 2
main.ts
```

The Todo app in tutorial 4 switches to the app layout you will reuse for React
and agent work:

```text
src/
  domain/
    todo.mel
  manifesto-app.ts
  main.ts
```

## First App Path

Use this path when you want the shortest route from a MEL domain to a running app.

| Step | Tutorial | Time | Outcome |
|------|----------|------|---------|
| 1 | [Your First App](./01-your-first-app) | 15 min | Create a counter, submit actions, and read the current state |
| 2 | [Actions and State](./02-actions-and-state) | 20 min | Work with arrays, computed values, and selector-based subscriptions |
| 3 | [Building a Todo App](./04-todo-app) | 30 min | Organize a small app before adding any UI framework |

If you only need a local app or trusted server route, stop here. The SDK path
is enough.

## Add IO Later

Open [Working with Effects](./03-effects) after the Todo app when a domain needs
to call an API, database, model provider, queue, or another external system.
Effects are important, but they are not required for the first Todo path.

## Approval And History Later

Read this only when the project now needs reviewable writes, durable history, explicit actor identity, or audit trails.

| Step | Tutorial | Time | Outcome |
|------|----------|------|---------|
| 5 | [Approval and History Setup](./05-governed-composition) | 20 min | Add review and history around the same app model |
| 6 | [Sealed History and Review Flow](./06-governed-sealing-and-history) | 25 min | Submit proposals, approve or reject them, and read sealed branch history |

If you are still deciding whether you need this, read [When You Need Approval or History](/guides/approval-and-history) first.

## After The Tutorial

- Go to [Bundler Setup](/guides/bundler-setup) and [Code Generation](/guides/code-generation) before building typed React, route, or agent code from the Todo domain.
- Go to [React](/integration/react) to wire the same app model into a web UI.
- Go to [Web App + Agent](/integration/web-app-and-agent) when the UI and agent should share one server runtime.
- Go to [AI Agents](/integration/ai-agents) when you want deeper agent-only tool-loop guidance.
- Go to [Runnable Examples](/guide/runnable-examples) to compare your files with the repo example.
- Go to [Guides](/guides/) when you need a concrete technique.
- Go to [Concepts](/concepts/) when you want the vocabulary and mental model.
- Go to [Architecture](/architecture/) when you want the system-level picture.

Start with [Your First App](./01-your-first-app). Open approval/history only
after the first app path already makes sense.
