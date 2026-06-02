# Introduction

> Manifesto gives apps and agents one shared domain model.

Manifesto lets you define a domain once in MEL, run that domain through the
SDK, and expose the same actions and snapshots to frontend code, backend
services, and agents.

It is not a state management library, an AI framework, a database, or a
workflow engine. It is the domain runtime underneath those surfaces.

## Why Manifesto?

### Deterministic by design

Domain rules are pure. External work is declared explicitly. Given the same
domain, current snapshot, and action input, Manifesto computes the same next
snapshot.

### Frontend, backend, and agents

UI components, server routes, scripts, jobs, and agents can all submit actions against the same domain model.

You do not need one state contract for UI, another for automation, and another for audit.

### One app state

Submit an action, then read the updated app state. Effect results come back
through the same state model instead of a second side channel.

That keeps the visible result in one place.

## The Base Runtime Path

Start here:

```text
MEL domain -> createManifesto() -> activate() -> action.<name>.submit() -> Snapshot
```

The base SDK runtime is the normal app path. It is the right default for
learning, UI integration, backend routes, scripts, and trusted agent tools.

## Two Tracks, One Domain

The docs use two tracks on purpose:

| Track | Use It For | What Comes Next |
|-------|------------|-----------------|
| No-build learning | Quick Start and the first Todo tutorials | Learn MEL, `createManifesto()`, `submit()`, and `snapshot()` with the Node/tsx loader |
| Typed app building | React, server routes, and agent tools | Add Bundler Setup and Code Generation so app code imports the generated `TodoDomain` facade |

Do not carry the tutorial's small local TypeScript shapes into a real web or
agent app. Once more than one app file needs domain types, use the generated
facade from the same `.mel` file.

## Learning Path

Follow this order when you are new to Manifesto:

| Step | Read | You Can Do Afterward |
|------|------|----------------------|
| 1 | [Quick Start](./quick-start) | Run one MEL domain through the SDK runtime |
| 2 | [Project Anatomy](./project-anatomy) | Know where the domain, runtime, UI, and agent files live |
| 3 | [MEL Domain Basics](./essentials/mel-domain-basics), [MEL For App Developers](./essentials/mel-for-app-developers), then [Creating an App](./essentials/creating-an-app) | Model state, computed values, actions, and the app runtime |
| 4 | [Tutorial](/tutorial/) | Build a small Todo app without a UI framework |
| 5 | [Bundler Setup](/guides/bundler-setup) and [Code Generation](/guides/code-generation) | Use the generated Todo facade from the same `.mel` file |
| 6 | [React](/integration/react) and [Runnable Examples](./runnable-examples) | Connect that app model to a web UI and compare with a working app |
| 7 | [Web App + Agent](/integration/web-app-and-agent) | Put the UI and agent behind one shared server runtime |
| 8 | [AI Agents](/integration/ai-agents) | Go deeper on agent-only tool loops and server workers |
| 9 | [When You Need Approval or History](/guides/approval-and-history) | Decide whether review or history belongs in the product |

You do not need low-level package APIs to build the first web app or trusted
agent integration. Open those pages when you are building custom runtime
tooling or adding reviewable history.

## Learning Checkpoints

Move forward when the current checkpoint is true:

| Checkpoint | Done When |
|------------|-----------|
| Quick Start | `counter.mel` runs and `snapshot().state.count` prints `1` |
| Todo domain | `src/domain/todo.mel` has add, toggle, remove, filter, and clear actions |
| Generated facade | `src/domain/todo.domain.ts` exists and exports `TodoDomain` |
| React UI | the browser can add, toggle, filter, remove, and clear todos |
| UI + agent | React fetch helpers and agent tools call the same server-side action functions |

## Choose The Next Page By Goal

| Goal | Read |
|------|------|
| I want the smallest running thing | [Quick Start](./quick-start) |
| I want to know where files go | [Project Anatomy](./project-anatomy) |
| I want to run an existing example | [Runnable Examples](./runnable-examples) |
| I want to understand the domain file | [MEL Domain Basics](./essentials/mel-domain-basics) |
| I want the minimum MEL syntax for an app | [MEL For App Developers](./essentials/mel-for-app-developers) |
| I want a small app before a framework | [Tutorial](/tutorial/) |
| I want to import `.mel` files in my app | [Bundler Setup](/guides/bundler-setup) |
| I want TypeScript types from my domain | [Code Generation](/guides/code-generation) |
| I want browser UI wiring | [React](/integration/react) |
| I want one UI and one agent sharing state | [Web App + Agent](/integration/web-app-and-agent) |
| I want a deeper agent-only tool loop | [AI Agents](/integration/ai-agents) |

Stay on the shortest path that matches the product you are building. You can
skip concepts, architecture, API reference, and approval/history until a page
above points you there.

## Add Approval Or History Later

When writes need review, actor identity, durable history, or audit queries, add
those layers around the same app model. They are not prerequisites for your
first app.

## Next

Start with [Quick Start](./quick-start), then skim [Project Anatomy](./project-anatomy). Continue through [MEL Domain Basics](./essentials/mel-domain-basics), [MEL For App Developers](./essentials/mel-for-app-developers), and [Creating an App](./essentials/creating-an-app). Use [Runnable Examples](./runnable-examples) after React when you want to compare your app with a finished version.
