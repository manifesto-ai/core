# Runnable Examples

> Use the examples when you want to see the docs path as a working app.

Read this after the Todo tutorial and React guide, or use it earlier as a peek
at the finished app. You do not need to understand every file before running it.

## Todo React

The repo includes a React Todo example that matches the main learning path. Its
local README is `examples/todo-react/README.md`.

```text
examples/todo-react/
  src/
    domain/
      todo.mel
      todo.domain.ts
    types.ts
    hooks/
      use-manifesto.ts
    components/
      todo-input.tsx
      todo-list.tsx
      todo-footer.tsx
      runtime-panel.tsx
    app.tsx
```

It demonstrates:

- a MEL Todo domain
- current sugar-first MEL source (`count + 1`, `field != value`, ternaries)
- generated `todo.domain.ts` facade output
- a small `types.ts` re-export layer for app-owned aliases such as `Todo` and `FilterMode`
- one activated SDK runtime inside a React hook
- `app.action.*.submit()` helpers
- `snapshot`, `state`, `computed`, `preview`, action availability, and runtime events

The MEL source is named `domain TodoApp`. The generated TypeScript facade is
named `TodoDomain` because the example Vite config passes
`createDomainPlugin({ interfaceName: "TodoDomain" })`. The names can differ:
MEL names the domain, codegen names the app-facing TypeScript interface.

## Run It

From the repo root:

```bash
pnpm install
pnpm --filter @manifesto-ai/example-todo-react dev
```

Vite prints a local URL. Open it and try adding, toggling, filtering, and
clearing todos. The runtime panel shows the same concepts used throughout the
docs: current state, computed values, available actions, preview, write report,
and lifecycle events.

## Check It

Use the example as a quick sanity check after changing docs or runtime code:

```bash
pnpm --filter @manifesto-ai/example-todo-react typecheck
pnpm --filter @manifesto-ai/example-todo-react build
```

The typecheck proves the generated domain facade and React hook still agree.
The build proves the MEL Vite plugin, code generation, SDK runtime, and React
app still fit together.

## What To Inspect First

| File | Why It Matters |
|------|----------------|
| `src/domain/todo.mel` | The same domain model used in the tutorial path |
| `src/domain/todo.domain.ts` | Generated TypeScript facade for app code |
| `src/types.ts` | App-owned aliases derived from the generated facade |
| `src/hooks/use-manifesto.ts` | Runtime activation, subscriptions, preview, and submit helpers |
| `src/app.tsx` | React rendering against Manifesto state and computed values |
| `vite.config.ts` | MEL compiler and codegen integration |

## How It Maps To The Docs

| Example Area | Read |
|--------------|------|
| File layout | [Project Anatomy](./project-anatomy) |
| Domain shape | [Building a Todo App](/tutorial/04-todo-app) |
| Generated facade | [Code Generation](/guides/code-generation) |
| Hook and components | [React](/integration/react) |
| UI plus agent server boundary | [Web App + Agent](/integration/web-app-and-agent) |

The example is intentionally still a browser-owned runtime. When an agent or
server route must share the same state, move the runtime owner to the server
shape described in [Web App + Agent](/integration/web-app-and-agent).

## Turning This Into A UI + Agent App

Use the Todo React example as the UI half, then make these changes:

1. Keep `todo.mel` and the generated `todo.domain.ts` facade as the shared
   domain contract.
2. Move `createManifesto<TodoDomain>(TodoMel, {}).activate()` from
   `src/hooks/use-manifesto.ts` into `src/server/manifesto-app.ts`.
3. Move action helpers such as `addTodo`, `toggleTodo`, and `clearCompleted`
   into `src/server/todo-actions.ts`.
4. Let React call those functions through `src/client/todo-api.ts` fetch
   helpers and routes or server actions.
5. Let agent tools call the same `todo-actions.ts` functions instead of
   creating another runtime.

That keeps the browser UI and agent loop on one app state.

[Web App + Agent](/integration/web-app-and-agent) shows the target file map,
shared response types, route adapter, fetch helpers, agent tools, and a Vite
prototype setup with a small API server plus `/api` proxy.

## Next

- Follow the [Tutorial](/tutorial/) to build the same shape from scratch.
- Use [React](/integration/react) when you are wiring your own component tree.
- Use [Web App + Agent](/integration/web-app-and-agent) when the UI and agent
  need one shared server runtime.
