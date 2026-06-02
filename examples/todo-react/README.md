# Manifesto Todo React Example

> Runnable React Todo app for the main Manifesto docs path.

This example shows the browser-owned runtime shape described in the docs:

```text
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

The Todo domain uses the same sugar-first MEL surface taught in the guide:
operators, field access, ternaries, and direct `app.action.*.submit()` helpers
instead of legacy helper-heavy snippets.

`src/domain/todo.mel` declares `domain TodoApp`. The generated TypeScript
facade is named `TodoDomain` because `vite.config.ts` chooses that interface
name with `createDomainPlugin({ interfaceName: "TodoDomain" })`.

## Run It

From the repository root:

```bash
pnpm install
pnpm --filter @manifesto-ai/example-todo-react dev
```

Vite prints a local URL. Open it, then add, toggle, filter, remove, and clear
todos first. The optional runtime panel is there for inspection when you want
to see current Manifesto state, computed values, available actions, preview
output, write reports, and lifecycle events.

## Check It

```bash
pnpm --filter @manifesto-ai/example-todo-react typecheck
pnpm --filter @manifesto-ai/example-todo-react build
```

`typecheck` verifies the generated domain facade and React hook agree. `build`
verifies the Vite MEL plugin, code generation, SDK runtime, and React app still
fit together.

## File Map

| File | Purpose |
|------|---------|
| `src/domain/todo.mel` | Domain state, computed values, and actions |
| `src/domain/todo.domain.ts` | Generated TypeScript facade |
| `src/types.ts` | App-owned aliases derived from the generated facade |
| `src/hooks/use-manifesto.ts` | Runtime activation, subscriptions, preview, and submit helpers |
| `src/components/*.tsx` | React-only rendering components |
| `src/app.tsx` | Todo UI composition |
| `vite.config.ts` | MEL compiler and codegen setup |

## Related Docs

- [Runnable Examples](../../docs/guide/runnable-examples.md)
- [Building a Todo App](../../docs/tutorial/04-todo-app.md)
- [React Integration](../../docs/integration/react.md)
- [Code Generation](../../docs/guides/code-generation.md)
- [Web App + Agent](../../docs/integration/web-app-and-agent.md)

Use the [Web App + Agent](../../docs/integration/web-app-and-agent.md) shape
when a UI and an agent must share the same server-side runtime. This example
keeps the runtime in the browser for local UI learning.

To evolve it into a UI + agent app, move runtime activation out of
`src/hooks/use-manifesto.ts` and into `src/server/manifesto-app.ts`. Move the
hook's action helpers into `src/server/todo-actions.ts`, then have both React
fetch helpers and agent tools call those same server-side functions. The
[Web App + Agent](../../docs/integration/web-app-and-agent.md) guide includes a
small API server and Vite `/api` proxy for this prototype path.
