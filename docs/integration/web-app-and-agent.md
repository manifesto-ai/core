# Web App + Agent

> Put the shared runtime in one server-side module when a UI and an agent need to see the same app state.

Build the Todo domain first in [Building a Todo App](/tutorial/04-todo-app),
then set up the generated `TodoDomain` facade with
[Bundler Setup](/guides/bundler-setup) and [Code Generation](/guides/code-generation).
After that, read [React](/integration/react) for the browser-owned shape. This
page shows the next step: moving writes behind a shared server runtime so UI
and agent tools call the same app functions.

## Before This Page

You should already have:

- a `.mel` domain with the actions the UI and agent will call
- a generated `src/domain/todo.domain.ts` facade from [Bundler Setup](/guides/bundler-setup)
- a server runtime environment where provider secrets can stay private
- a route or server-function layer that both browser code and agent tools can call

Use the browser-owned [React](/integration/react) shape for local UI learning.
Use this page when the UI and agent must share one visible app state.

If you are starting from the Vite Todo example, remember that Vite's React dev
server does not create `/api` routes by itself. Keep Vite for the browser UI,
then run a small server process for the route handlers below and proxy `/api` to
that process. The development setup in this page uses the Node/tsx MEL loader so
the server can import `../domain/todo.mel` too.

The MEL domain below can still be named `TodoApp`. `TodoDomain` is the
generated TypeScript facade name used by the docs and examples, chosen by the
codegen setup. The runtime imports `todo.mel`; TypeScript imports
`todo.domain.ts`.

## Build Order

Create the shared boundary in this order:

1. Move runtime activation into `src/server/manifesto-app.ts`.
2. Define one shared Todo view and write-response contract.
3. Export small app-owned functions from `src/server/todo-actions.ts`.
4. Wire those functions to HTTP routes or server functions.
5. Let React fetch the current view and submit actions through those routes.
6. Let agent tools call the same server-side action functions.

The important rule is that UI and agent code should meet at app-owned server
functions, not at separate runtime instances.

If you already ran the [Todo React example](/guide/runnable-examples), the move
is small:

| Browser-owned example file | Server-shared version |
|----------------------------|-----------------------|
| `src/domain/todo.mel` | keep it unchanged |
| `src/domain/todo.domain.ts` | keep the generated facade |
| `src/types.ts` | replace or extend with `src/shared/todo-contract.ts` |
| `src/hooks/use-manifesto.ts` | move runtime activation into `src/server/manifesto-app.ts` |
| action helpers inside the hook | move them into `src/server/todo-actions.ts` |
| component event handlers | call `src/client/todo-api.ts` fetch helpers |
| no agent tools yet | add `src/server/todo-agent-tools.ts` over the same action functions |

## File Map

```text
src/
  domain/
    todo.mel
    todo.domain.ts        # generated facade used by TS contracts
  shared/
    todo-contract.ts       # Todo view and write-response types
  server/
    manifesto-app.ts      # owns createManifesto(...).activate()
    todo-actions.ts       # app-owned action functions
    routes/
      todos.ts            # thin HTTP adapter
    todo-agent-tools.ts   # AI SDK tools over the same action functions
  client/
    todo-api.ts           # fetch helpers used by React
```

## Choose One Runtime Owner

For a local-only UI demo, a React hook can activate the runtime in the browser.
For a web app plus agent, the simpler shared shape is:

```text
React UI -> server route -> Manifesto runtime <- agent tool
                         -> Todo view response
```

The UI and agent both call app-owned server functions. They do not create
separate runtimes and hope state lines up.

## 1. Export The Server Runtime

Create one server-side module for the runtime and the public view returned to
both UI and agent code:

```typescript
// src/server/manifesto-app.ts
import { createManifesto } from "@manifesto-ai/sdk";

import TodoMel from "../domain/todo.mel";
import type { TodoDomain } from "../domain/todo.domain";
import type { TodoView } from "../shared/todo-contract";

export const app = createManifesto<TodoDomain>(TodoMel, {}).activate();

export function readTodoView(): TodoView {
  const snapshot = app.snapshot();

  return {
    state: snapshot.state,
    computed: snapshot.computed,
    availableActions: app.inspect.availableActions(),
  };
}
```

Use this in a long-lived server process, worker, or local development server.
For serverless, multi-user, or durable products, add the persistence/runtime
ownership decision before treating this singleton as production storage.

## 2. Define The Shared Response Shape

Put the read and write response types in a shared module that can be imported by
server routes, React fetch helpers, and agent tools:

```typescript
// src/shared/todo-contract.ts
import type { ActionInfo, AdmissionFailure, ExecutionOutcome } from "@manifesto-ai/sdk";
import type { TodoDomain } from "../domain/todo.domain";

export type Todo = TodoDomain["state"]["todos"][number];
export type FilterMode = TodoDomain["state"]["filterMode"];

export type TodoView = {
  readonly state: TodoDomain["state"];
  readonly computed: TodoDomain["computed"];
  readonly availableActions: readonly ActionInfo[];
};

export type TodoWriteResponse =
  | {
      readonly status: "settled";
      readonly outcome: Extract<ExecutionOutcome, { readonly kind: "ok" }>;
      readonly view: TodoView;
    }
  | {
      readonly status: "stop";
      readonly outcome: Extract<ExecutionOutcome, { readonly kind: "stop" }>;
      readonly view: TodoView;
    }
  | {
      readonly status: "fail";
      readonly outcome: Extract<ExecutionOutcome, { readonly kind: "fail" }>;
      readonly view: TodoView;
    }
  | {
      readonly status: "admission_blocked";
      readonly admission: AdmissionFailure;
      readonly view: TodoView;
    };
```

`status: "settled"` means the write reached an `ok` outcome and the returned
view is the next visible app state. `stop`, `fail`, and `admission_blocked`
are non-success outcomes that still return a fresh view for the next UI render
or agent step.

## 3. Expose Small Action Functions

Keep the HTTP layer thin. Route handlers should validate request data, call one
app-owned action function, and return a fresh view.

```typescript
// src/server/todo-actions.ts
import type { AdmissionFailure, ExecutionOutcome } from "@manifesto-ai/sdk";

import { app, readTodoView } from "./manifesto-app";
import type { FilterMode, TodoWriteResponse } from "../shared/todo-contract";

type BaseActionResult =
  | { readonly ok: true; readonly outcome: ExecutionOutcome }
  | { readonly ok: false; readonly admission: AdmissionFailure };

function toWriteResponse(result: BaseActionResult): TodoWriteResponse {
  if (!result.ok) {
    return {
      status: "admission_blocked",
      admission: result.admission,
      view: readTodoView(),
    };
  }

  if (result.outcome.kind === "ok") {
    return {
      status: "settled",
      outcome: result.outcome,
      view: readTodoView(),
    };
  }

  if (result.outcome.kind === "stop") {
    return {
      status: "stop",
      outcome: result.outcome,
      view: readTodoView(),
    };
  }

  return {
    status: "fail",
    outcome: result.outcome,
    view: readTodoView(),
  };
}

export async function addTodo(title: string): Promise<TodoWriteResponse> {
  return toWriteResponse(await app.action.addTodo.submit(title));
}

export async function toggleTodo(id: string): Promise<TodoWriteResponse> {
  return toWriteResponse(await app.action.toggleTodo.submit(id));
}

export async function removeTodo(id: string): Promise<TodoWriteResponse> {
  return toWriteResponse(await app.action.removeTodo.submit(id));
}

export async function setFilter(newFilter: FilterMode): Promise<TodoWriteResponse> {
  return toWriteResponse(await app.action.setFilter.submit(newFilter));
}

export async function clearCompleted(): Promise<TodoWriteResponse> {
  return toWriteResponse(await app.action.clearCompleted.submit());
}
```

Wire these functions to your framework's read and write routes. The route path
is app code; the important Manifesto boundary is still
`app.action.*.submit()`.

The snippets below use these route paths:

| Route | Calls |
|-------|-------|
| `GET /api/todos/view` | `getTodoView()` |
| `POST /api/todos/actions/addTodo` | `postAddTodo()` |
| `POST /api/todos/actions/toggleTodo` | `postToggleTodo()` |
| `POST /api/todos/actions/removeTodo` | `postRemoveTodo()` |
| `POST /api/todos/actions/setFilter` | `postSetFilter()` |
| `POST /api/todos/actions/clearCompleted` | `postClearCompleted()` |

For frameworks that expose Web `Request`/`Response` handlers, the adapter stays
small:

```typescript
// src/server/routes/todos.ts
import { readTodoView } from "../manifesto-app";
import {
  addTodo,
  clearCompleted,
  removeTodo,
  setFilter,
  toggleTodo,
} from "../todo-actions";

export function getTodoView() {
  return Response.json(readTodoView());
}

export async function postAddTodo(request: Request) {
  const body = await request.json() as { readonly title?: unknown };
  if (typeof body.title !== "string") {
    return Response.json({ error: "title must be a string" }, { status: 400 });
  }

  return Response.json(await addTodo(body.title));
}

export async function postToggleTodo(request: Request) {
  const body = await request.json() as { readonly id?: unknown };
  if (typeof body.id !== "string") {
    return Response.json({ error: "id must be a string" }, { status: 400 });
  }

  return Response.json(await toggleTodo(body.id));
}

export async function postRemoveTodo(request: Request) {
  const body = await request.json() as { readonly id?: unknown };
  if (typeof body.id !== "string") {
    return Response.json({ error: "id must be a string" }, { status: 400 });
  }

  return Response.json(await removeTodo(body.id));
}

export async function postSetFilter(request: Request) {
  const body = await request.json() as { readonly filter?: unknown };
  if (
    body.filter !== "all" &&
    body.filter !== "active" &&
    body.filter !== "completed"
  ) {
    return Response.json({ error: "filter must be all, active, or completed" }, { status: 400 });
  }

  return Response.json(await setFilter(body.filter));
}

export async function postClearCompleted() {
  return Response.json(await clearCompleted());
}
```

### Run The Routes From A Vite Prototype

If your app is still the Vite Todo example, add a tiny development API server and
let Vite proxy browser calls to it.

Install a small Web `Request`/`Response` server:

```bash
npm install hono @hono/node-server
```

Create `src/server/dev-server.ts`:

```typescript
import { serve } from "@hono/node-server";
import { Hono } from "hono";

import {
  getTodoView,
  postAddTodo,
  postClearCompleted,
  postRemoveTodo,
  postSetFilter,
  postToggleTodo,
} from "./routes/todos";

const app = new Hono();

app.get("/api/todos/view", () => getTodoView());
app.post("/api/todos/actions/addTodo", (context) => postAddTodo(context.req.raw));
app.post("/api/todos/actions/toggleTodo", (context) => postToggleTodo(context.req.raw));
app.post("/api/todos/actions/removeTodo", (context) => postRemoveTodo(context.req.raw));
app.post("/api/todos/actions/setFilter", (context) => postSetFilter(context.req.raw));
app.post("/api/todos/actions/clearCompleted", () => postClearCompleted());

serve({ fetch: app.fetch, port: 8787 });
```

Run it with the MEL loader:

```bash
npx tsx --loader @manifesto-ai/compiler/node-loader src/server/dev-server.ts
```

Then add a proxy to the Vite config used by the browser app:

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createCompilerCodegen, createDomainPlugin } from "@manifesto-ai/codegen";
import { melPlugin } from "@manifesto-ai/compiler/vite";

export default defineConfig({
  server: {
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  plugins: [
    melPlugin({
      codegen: createCompilerCodegen({
        plugins: [createDomainPlugin({ interfaceName: "TodoDomain" })],
      }),
    }),
    react(),
  ],
});
```

Production apps can use their framework's route system instead. The rule is the
same: server code that imports `.mel` must run through a bundler/plugin or the
Node/tsx MEL loader.

## 4. Let React Call The Server Boundary

React can now use ordinary fetch calls. It renders the returned view instead
of owning the runtime directly.

```typescript
import type { FilterMode, TodoView, TodoWriteResponse } from "../shared/todo-contract";

export async function readView(): Promise<TodoView> {
  const response = await fetch("/api/todos/view");
  return response.json() as Promise<TodoView>;
}

export async function addTodo(title: string): Promise<TodoView> {
  const response = await fetch("/api/todos/actions/addTodo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title }),
  });
  const body = await response.json() as TodoWriteResponse;
  if (body.status !== "settled") {
    console.warn("Todo write did not settle as ok", body);
  }
  return body.view;
}

export async function toggleTodo(id: string): Promise<TodoView> {
  const response = await fetch("/api/todos/actions/toggleTodo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const body = await response.json() as TodoWriteResponse;
  if (body.status !== "settled") {
    console.warn("Todo write did not settle as ok", body);
  }
  return body.view;
}

export async function removeTodo(id: string): Promise<TodoView> {
  const response = await fetch("/api/todos/actions/removeTodo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const body = await response.json() as TodoWriteResponse;
  if (body.status !== "settled") {
    console.warn("Todo write did not settle as ok", body);
  }
  return body.view;
}

export async function setFilter(filter: FilterMode): Promise<TodoView> {
  const response = await fetch("/api/todos/actions/setFilter", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filter }),
  });
  const body = await response.json() as TodoWriteResponse;
  if (body.status !== "settled") {
    console.warn("Todo write did not settle as ok", body);
  }
  return body.view;
}

export async function clearCompleted(): Promise<TodoView> {
  const response = await fetch("/api/todos/actions/clearCompleted", {
    method: "POST",
  });
  const body = await response.json() as TodoWriteResponse;
  if (body.status !== "settled") {
    console.warn("Todo write did not settle as ok", body);
  }
  return body.view;
}
```

The component state is just the last view returned by the server:

```tsx
import { useEffect, useState } from "react";

import type { FilterMode, TodoView } from "../shared/todo-contract";
import {
  addTodo,
  clearCompleted,
  readView,
  removeTodo,
  setFilter,
  toggleTodo,
} from "./todo-api";
import { TodoScreen } from "./todo-screen";

export function TodoApp() {
  const [view, setView] = useState<TodoView | null>(null);

  useEffect(() => {
    void readView().then(setView);
  }, []);

  async function onAdd(title: string) {
    setView(await addTodo(title));
  }

  async function onToggle(id: string) {
    setView(await toggleTodo(id));
  }

  async function onRemove(id: string) {
    setView(await removeTodo(id));
  }

  async function onSetFilter(filter: FilterMode) {
    setView(await setFilter(filter));
  }

  async function onClearCompleted() {
    setView(await clearCompleted());
  }

  if (!view) {
    return <div>Loading...</div>;
  }

  return (
    <TodoScreen
      view={view}
      onAdd={onAdd}
      onToggle={onToggle}
      onRemove={onRemove}
      onSetFilter={onSetFilter}
      onClearCompleted={onClearCompleted}
    />
  );
}
```

`TodoScreen` is your existing React component tree. Its job is still ordinary UI
rendering: receive a `TodoView` plus the handlers above.

If an agent writes while the browser is open, the browser will not learn about
that write by magic. Pick one app-level refresh path: poll `readView()`, push an
SSE/WebSocket invalidation event, or call `readView()` after the agent turn
finishes. The shared runtime makes the state consistent; your web framework
still owns how the browser hears about server-side writes.

Use the direct React runtime hook from [React](/integration/react) when the app
is local-only. Use the server shape above when UI and agent writes must meet in
the same visible app state.

## 5. Let Agent Tools Use The Same Boundary

Agent tools should call the same server-side runtime module, not a second domain
copy.

The snippet below uses the Vercel AI SDK tool shape:

```bash
npm install ai zod
```

```typescript
import { tool } from "ai";
import { z } from "zod";

import {
  addTodo,
  clearCompleted,
  removeTodo,
  setFilter,
  toggleTodo,
} from "./todo-actions";
import { readTodoView } from "./manifesto-app";

export const todoTools = {
  readTodoView: tool({
    description: "Read current Todo state and available actions.",
    inputSchema: z.object({}),
    execute: async () => readTodoView(),
  }),

  addTodo: tool({
    description: "Add one todo through the shared Manifesto runtime.",
    inputSchema: z.object({ title: z.string().min(1) }),
    execute: async ({ title }) => addTodo(title),
  }),

  toggleTodo: tool({
    description: "Toggle one todo through the shared Manifesto runtime.",
    inputSchema: z.object({ id: z.string().min(1) }),
    execute: async ({ id }) => toggleTodo(id),
  }),

  removeTodo: tool({
    description: "Remove one todo through the shared Manifesto runtime.",
    inputSchema: z.object({ id: z.string().min(1) }),
    execute: async ({ id }) => removeTodo(id),
  }),

  setFilter: tool({
    description: "Set the Todo filter through the shared Manifesto runtime.",
    inputSchema: z.object({
      filter: z.enum(["all", "active", "completed"]),
    }),
    execute: async ({ filter }) => setFilter(filter),
  }),

  clearCompleted: tool({
    description: "Clear completed todos through the shared Manifesto runtime.",
    inputSchema: z.object({}),
    execute: async () => clearCompleted(),
  }),
};
```

Now the UI and agent both observe the view produced by the same server runtime.

## Done Checklist

You have the shared shape when these are true:

- the browser no longer calls `createManifesto(...).activate()`
- `src/server/manifesto-app.ts` is the only runtime owner
- React fetch helpers and agent tools both call `src/server/todo-actions.ts`
- every read and write returns a `TodoView`
- the browser has one refresh path for writes that happen outside React

## What Should Stay Shared

Keep these shared:

- the MEL domain
- the activated runtime owner
- app-owned action functions
- Todo view returned after reads and writes

Keep these separate:

- React components and browser state
- model-provider calls and prompts
- HTTP route parsing and validation
- optional approval/history setup

That split lets the UI remain ordinary React and the agent remain an ordinary
tool loop while Manifesto owns the domain transitions.

## When To Add More

- Add [Effect Handlers](/guides/effect-handlers) when server actions need IO.
- Add [When You Need Approval or History](/guides/approval-and-history) when
  agent writes need human review or durable history.

## Common Mistakes

### Creating one browser runtime and one agent runtime

That gives each side its own app state. Put the runtime behind a shared server
module when both sides need to affect the same state.

### Sending provider credentials to the browser

Run model calls in a server route, worker, CLI, or MCP server. Browser code
should call your app route, not the model provider directly.

### Returning only "success" from action routes

Return a fresh view after every action. The next UI render and next agent step
should both read the current app state.

## Next

- Use [React](/integration/react) for local browser-owned runtimes.
- Use [AI Agents](/integration/ai-agents) for deeper agent-only tool-loop guidance.
- Run the browser-owned [Todo React example](/guide/runnable-examples) before
  moving its runtime into the server module.
- Use [Code Generation](/guides/code-generation) when you customize generated
  facade output.
