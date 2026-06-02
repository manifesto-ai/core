# AI Agent Integration

> Let agents read current app state, see the actions available now, and submit domain changes through the runtime.

An agent should not guess your domain API from prompt text. It should read the
current state, read the currently legal action contracts, call an app-owned
tool, and receive a Snapshot view back.

```text
Snapshot + inspect.availableActions()
  -> agent context for this step
  -> model chooses a stable app-owned tool
  -> tool re-reads runtime availability
  -> tool submits an action
  -> fresh context returns for the next step
```

This guide uses a Todo app. Build that domain first in
[Building a Todo App](/tutorial/04-todo-app), then emit the generated
`TodoDomain` facade with [Bundler Setup](/guides/bundler-setup) and
[Code Generation](/guides/code-generation).

If you are coming from the React path and want UI plus agent writes in one
product, read [Web App + Agent](./web-app-and-agent) first. Use this page when
you want the deeper server-worker or agent-only tool-loop shape.

## Install Agent Dependencies

The examples below use the Vercel AI SDK tool shape. Install the AI SDK
packages and `zod`, then set your provider credentials and model name in the
environment:

```bash
npm install ai @ai-sdk/openai zod
```

```bash
export OPENAI_API_KEY="..."
export OPENAI_MODEL="..."
```

Run these tools from a server route, worker, CLI, or MCP server. Do not expose
provider credentials to browser components.

The examples assume action-level gates are modeled with MEL `available when`.
`inspect.availableActions()` reflects those current-snapshot action gates.
Bound-input checks still belong to `dispatchable when` and `action.x.check()`.
Treat availability as a present-tense observational read, not a capability
token; tools still re-check legality at submit time.

---

## 1. Create The Agent Runtime Boundary

Run agent tools in a server route, worker, CLI, or MCP server. Keep one runtime
module there:

```typescript
// src/server/manifesto-app.ts
import { createManifesto } from "@manifesto-ai/sdk";

import TodoMel from "../domain/todo.mel";
import type { TodoDomain } from "../domain/todo.domain";

export const app = createManifesto<TodoDomain>(TodoMel, {}).activate();
```

For serverless, multi-user, or durable products, decide persistence and runtime
ownership before treating this singleton as production storage.

If this server process imports `.mel` directly, run it through a bundler with the
MEL plugin or through the Node/tsx MEL loader:

```bash
npx tsx --loader @manifesto-ai/compiler/node-loader src/server/agent-worker.ts
```

---

## 2. Give The Agent Runtime Context

`snapshot()` tells the agent what is true. `inspect.availableActions()` tells
the agent what the domain allows now.

```typescript
// src/server/agent-context.ts
import type { ActionInfo, AdmissionFailure, ExecutionOutcome } from "@manifesto-ai/sdk";
import type { TodoDomain } from "../domain/todo.domain";
import { app } from "./manifesto-app";

export type TodoAgentContext = {
  readonly state: TodoDomain["state"];
  readonly computed: TodoDomain["computed"];
  readonly availableActions: readonly ActionInfo[];
};

export type TodoWriteResponse =
  | {
      readonly status: "settled";
      readonly outcome: Extract<ExecutionOutcome, { readonly kind: "ok" }>;
      readonly context: TodoAgentContext;
    }
  | {
      readonly status: "stop";
      readonly outcome: Extract<ExecutionOutcome, { readonly kind: "stop" }>;
      readonly context: TodoAgentContext;
    }
  | {
      readonly status: "fail";
      readonly outcome: Extract<ExecutionOutcome, { readonly kind: "fail" }>;
      readonly context: TodoAgentContext;
    }
  | {
      readonly status: "admission_blocked";
      readonly admission: AdmissionFailure;
      readonly context: TodoAgentContext;
    };

export function readAgentContext(): TodoAgentContext {
  const snapshot = app.snapshot();

  return {
    state: snapshot.state,
    computed: snapshot.computed,
    availableActions: app.inspect.availableActions(),
  };
}

export function blocked(admission: AdmissionFailure): TodoWriteResponse {
  return {
    status: "admission_blocked",
    admission,
    context: readAgentContext(),
  };
}

export function toWriteResponse(result: {
  readonly ok: true;
  readonly outcome: ExecutionOutcome;
} | {
  readonly ok: false;
  readonly admission: AdmissionFailure;
}): TodoWriteResponse {
  if (!result.ok) {
    return blocked(result.admission);
  }

  if (result.outcome.kind === "ok") {
    return {
      status: "settled",
      outcome: result.outcome,
      context: readAgentContext(),
    };
  }

  if (result.outcome.kind === "stop") {
    return {
      status: "stop",
      outcome: result.outcome,
      context: readAgentContext(),
    };
  }

  return {
    status: "fail",
    outcome: result.outcome,
    context: readAgentContext(),
  };
}
```

This is the agent's starting point: state plus the runtime's current public
action contract. Do not maintain a parallel "actions the agent may call" list
in prompt text.

When you later add a browser UI, move the shared read shape into
`src/shared/todo-contract.ts` as a `TodoView`, rename write-response
`context` fields to `view`, and keep those write responses beside the read
shape. [Web App + Agent](./web-app-and-agent) shows that shared layout.

---

## 3. Map Runtime Actions To Tools

Start with app-owned tools. Each writer submits a typed Manifesto action.

```typescript
import { tool } from "ai";
import { z } from "zod";

import type { TodoDomain } from "../domain/todo.domain";
import { app } from "./manifesto-app";
import { blocked, readAgentContext, toWriteResponse } from "./agent-context";

type FilterMode = TodoDomain["state"]["filterMode"];

export const todoTools = {
  readTodoContext: tool({
    description: "Read Todo state, computed values, and available actions.",
    inputSchema: z.object({}),
    execute: async () => readAgentContext(),
  }),

  addTodo: tool({
    description: "Add one todo through the Manifesto runtime.",
    inputSchema: z.object({ title: z.string().min(1) }),
    execute: async ({ title }) => {
      const admission = app.action.addTodo.check(title);
      if (!admission.ok) {
        return blocked(admission);
      }

      const result = await app.with({ report: "none" }).action.addTodo.submit(title);
      return toWriteResponse(result);
    },
  }),

  toggleTodo: tool({
    description: "Toggle one todo through the Manifesto runtime.",
    inputSchema: z.object({ id: z.string().min(1) }),
    execute: async ({ id }) => {
      const admission = app.action.toggleTodo.check(id);
      if (!admission.ok) {
        return blocked(admission);
      }

      const result = await app.with({ report: "none" }).action.toggleTodo.submit(id);
      return toWriteResponse(result);
    },
  }),

  removeTodo: tool({
    description: "Remove one todo through the Manifesto runtime.",
    inputSchema: z.object({ id: z.string().min(1) }),
    execute: async ({ id }) => {
      const admission = app.action.removeTodo.check(id);
      if (!admission.ok) {
        return blocked(admission);
      }

      const result = await app.with({ report: "none" }).action.removeTodo.submit(id);
      return toWriteResponse(result);
    },
  }),

  setFilter: tool({
    description: "Set the Todo filter through the Manifesto runtime.",
    inputSchema: z.object({
      filter: z.enum(["all", "active", "completed"]),
    }),
    execute: async ({ filter }) => {
      const nextFilter: FilterMode = filter;
      const admission = app.action.setFilter.check(nextFilter);
      if (!admission.ok) {
        return blocked(admission);
      }

      const result = await app.with({ report: "none" }).action.setFilter.submit(nextFilter);
      return toWriteResponse(result);
    },
  }),

  clearCompleted: tool({
    description: "Clear completed todos when the action is available.",
    inputSchema: z.object({}),
    execute: async () => {
      const admission = app.action.clearCompleted.check();
      if (!admission.ok) {
        return blocked(admission);
      }

      const result = await app.with({ report: "none" }).action.clearCompleted.submit();
      return toWriteResponse(result);
    },
  }),
};
```

Keep tool results fresh. A multi-step agent should receive updated
`availableActions` after every tool call: read context, write, read the context
returned by that write, decide the next tool.

Do not cache `inspect.availableActions()` for a whole agent turn. It is a read
against the current Snapshot; every successful submit can change it. If you add
review later, reviewer decisions can change it too. The runtime still
checks again during submit, so a stale agent step cannot force an unavailable
action through.

If a tool needs first-party admission data, before/after snapshots, or change
details in-band, keep the default report detail:

```typescript
const result = await app.with({ report: "full" }).action.addTodo.submit(title);

return {
  ...toWriteResponse(result),
  changedPaths: result.ok ? result.report?.changes ?? [] : [],
};
```

---

## 4. Run A Multi-Step AI SDK Turn

Pass the current context to the model. Pass stable tools that re-check runtime
availability during `execute`.

```typescript
import { openai } from "@ai-sdk/openai";
import { generateText, stepCountIs } from "ai";

import { readAgentContext } from "./agent-context";
import { todoTools } from "./todo-agent-tools";

export async function runTodoAgent(prompt: string) {
  const context = readAgentContext();
  const modelName = process.env.OPENAI_MODEL;
  if (!modelName) {
    throw new Error("Set OPENAI_MODEL before running the Todo agent.");
  }

  return generateText({
    model: openai(modelName),
    system:
      "You are a Todo agent. Use the provided context and tools. " +
      "Tool results include fresh Manifesto context. " +
      "Check availableActions after each write. " +
      "Do not claim a write succeeded unless a tool returns status='settled' with an ok outcome. " +
      "Treat stop, fail, and admission_blocked outcomes as non-success.",
    prompt: JSON.stringify({
      userRequest: prompt,
      manifestoContext: context,
    }, null, 2),
    tools: todoTools,
    stopWhen: stepCountIs(4),
  });
}
```

The same pattern fits a backend route, worker, CLI, MCP server, or another
agent framework. Keep the binding small: model loop outside, domain transition
inside Manifesto.

---

## 5. Keep Review Out Of The First Agent

Start with direct action submission. Add human review only when the product
needs an agent to propose changes instead of applying them immediately.

When that happens, keep the same MEL domain and app-owned tool names. The
runtime behind `app` changes, and tool results should report that a write is
waiting for review instead of claiming the Snapshot changed.

Read [When You Need Approval or History](/guides/approval-and-history) when
one of these becomes true:

- agent writes must wait for a human reviewer
- actor attribution or decision records are product requirements
- the team needs durable history or audit queries

Do not build a private audit log into prompts or tool return values. Let the
runtime own review and history when the product reaches that point.

---

## What Manifesto Adds To Agents

- `inspect.availableActions()` exposes current action availability.
- Tools submit typed actions.
- Tool results return fresh Snapshot context.
- Review can be added later without changing the MEL domain.
- The same tool names can stay stable as the runtime grows.

---

## Common Mistakes

### Describing actions only in the system prompt

Use `inspect.availableActions()` and `action.x.info()` as the capability
surface.

### Letting the agent edit state directly

Do not let the agent write state directly. Submit an action.

### Hiding approval logic in prompt text

Model simple allow/deny checks in MEL with `available when` and
`dispatchable when`, then re-check with `action.x.check()` in tools. Add the
approval/history runtime when writes need durable review. Do not rely on prompt
text.

### Returning effect results as the action outcome

Read the resulting Snapshot. Effects report back through patches.

---

## Next

- Build the domain first in [Building a Todo App](/tutorial/04-todo-app)
- Connect the same runtime to a UI with [React](./react)
- Share one server-side runtime with [Web App + Agent](./web-app-and-agent)
- Learn action inspection in [SDK API](/api/sdk)
- Read [When You Need Approval or History](/guides/approval-and-history) before adding durable history to the product
- Use [Developer Tooling](/guides/developer-tooling) when an agent or CLI should inspect the domain before writing
