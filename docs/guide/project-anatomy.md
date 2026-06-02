# Project Anatomy

> A Manifesto project is one domain file, one place where the runtime lives, and the app surfaces that call it.

Read this after [Quick Start](./quick-start). It gives you the file map before
you move into the Todo tutorial, React, or agent wiring.

If you are brand new, read only [The Smallest Shape](#the-smallest-shape) first.
The generated types, React, agent, and effects sections are maps for later steps
in the learning path.

## The Smallest Shape

For a script or small local app:

```text
src/
  domain/
    counter.mel
  manifesto-app.ts
  main.ts
```

| File | Owns |
|------|------|
| `src/domain/counter.mel` | State, computed values, and actions |
| `src/manifesto-app.ts` | `createManifesto(...).activate()` and the exported runtime |
| `src/main.ts` | App code that submits actions and reads snapshots |

The runtime module is intentionally small:

```typescript
// src/manifesto-app.ts
import { createManifesto } from "@manifesto-ai/sdk";

import CounterMel from "./domain/counter.mel";

export const app = createManifesto(CounterMel, {}).activate();
```

App code imports that runtime and stays on action handles:

```typescript
// src/main.ts
import { app } from "./manifesto-app";

await app.action.increment.submit();
console.log(app.snapshot().state.count);
```

## When You Add Generated Types

Generated files are build-time helpers. They should remove repeated TypeScript
shape declarations; they should not change the runtime path.

```text
src/
  domain/
    todo.mel
    todo.domain.ts
  manifesto-app.ts
```

Runtime code still starts from the MEL domain and submits actions:

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import TodoMel from "./domain/todo.mel";
import type { TodoDomain } from "./domain/todo.domain";

export const app = createManifesto<TodoDomain>(TodoMel, {}).activate();
```

Read [Bundler Setup](/guides/bundler-setup) and
[Code Generation](/guides/code-generation) before following the typed React or
agent integration docs.

## When You Add React

For a local browser-owned runtime, keep the runtime inside one hook and let
components render snapshots:

```text
src/
  domain/
    todo.mel
  hooks/
    use-manifesto.ts
  app.tsx
```

The hook owns activation, subscription, and cleanup. Components call helpers
such as `addTodo(title)` instead of constructing runtime requests themselves.

Use this shape for prototypes, local demos, or browser-only state. If a server
route or agent must see the same Snapshot, move the runtime owner to the
server shape below.

## When You Add An Agent

After the Todo path, generated facade, and React shape are clear, put the
runtime in one server-side module for a UI plus agent product:

```text
src/
  domain/
    todo.mel
    todo.domain.ts
  shared/
    todo-contract.ts
  server/
    manifesto-app.ts
    todo-actions.ts
    todo-agent-tools.ts
  client/
    todo-api.ts
    app.tsx
```

| File | Owns |
|------|------|
| `domain/todo.mel` | The shared domain rules |
| `domain/todo.domain.ts` | Generated TypeScript facade |
| `shared/todo-contract.ts` | The `TodoView` and write-response types |
| `server/manifesto-app.ts` | The shared runtime and `readTodoView()` |
| `server/todo-actions.ts` | App-owned action functions such as `addTodo(title)` |
| `server/todo-agent-tools.ts` | Agent tools that call those same action functions |
| `client/todo-api.ts` | Fetch helpers for the UI |
| `client/app.tsx` | Rendering the latest server response |

That keeps UI writes and agent writes meeting at the same runtime owner:

```text
React UI -> server action -> Manifesto runtime <- agent tool
                         -> fresh Todo view response
```

Read [Web App + Agent](/integration/web-app-and-agent) when you reach this
shape.

## When You Add Effects

Add an effects module only when the MEL domain declares external work such as
API calls, database writes, model calls, queues, or email.

```text
src/
  domain/
    user-profile.mel
  effects.ts
  manifesto-app.ts
  main.ts
```

```typescript
// src/manifesto-app.ts
import { createManifesto } from "@manifesto-ai/sdk";

import UserProfileMel from "./domain/user-profile.mel";
import { effects } from "./effects";

export const app = createManifesto(UserProfileMel, effects).activate();
```

Effect handlers return patches. They do not return a separate business payload
to the action caller. Read [Effect Handlers](/guides/effect-handlers) when the
first app path already works and the domain needs IO.

## What Not To Split Too Early

- Do not introduce approval/history packages until the product needs review,
  durable history, or audit records.
- Do not make a generic string dispatcher for app code. Prefer named helpers
  that call `app.action.<name>.submit(...)`.
- Do not keep one browser runtime and one agent runtime when both should affect
  the same state.
- Do not mirror domain rules in React, routes, or prompts. Put rules in MEL
  actions and computed values.

## Next

- Continue to [MEL Domain Basics](./essentials/mel-domain-basics) to learn the
  domain file.
- Follow the [Tutorial](/tutorial/) to build the Todo domain and runtime.
- Add [Bundler Setup](/guides/bundler-setup) and
  [Code Generation](/guides/code-generation) before typed UI or agent work.
- Use [React](/integration/react) for browser UI wiring.
- Run [Runnable Examples](./runnable-examples) after React when you want to
  compare your files with the finished Todo app.
- Use [Web App + Agent](/integration/web-app-and-agent) when UI and agent need
  one shared server runtime.
