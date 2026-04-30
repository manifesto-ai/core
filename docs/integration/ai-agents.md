# AI Agent Integration

> Let agents see the current Snapshot, see the actions that are available now, and submit domain changes through the runtime.

An agent should not guess your domain API from prompt text. It should read the
current state, read the currently legal action contracts, call an app-owned
tool, and receive a Snapshot view back.

```text
Snapshot + inspect.availableActions()
  -> agent context for this step
  -> model chooses a stable app-owned tool
  -> tool re-reads runtime availability
  -> tool submits an action candidate
  -> fresh context returns for the next step
```

This guide uses a Todo app. Build that domain first in [Building a Todo App](/guide/essentials/todo-app).

The examples assume action-level gates are modeled with MEL `available when`.
`inspect.availableActions()` reflects those current-snapshot action gates.
Bound-input checks still belong to `dispatchable when` and `actions.x.check()`.
Treat availability as a present-tense observational read, not a capability
token; tools still re-check legality at submit time.

---

## 1. Give The Agent Runtime Context

`snapshot()` tells the agent what is true. `inspect.availableActions()` tells
the agent what the domain allows now.

```typescript
import { app } from "./manifesto-app";

export function readAgentContext() {
  const snapshot = app.snapshot();

  return {
    state: snapshot.state,
    computed: snapshot.computed,
    availableActions: app.inspect.availableActions(),
  };
}
```

This is the agent's starting point: state plus the runtime's current public
action contract. Do not maintain a parallel "actions the agent may call" list
in prompt text.

---

## 2. Map Runtime Actions To Tools

Start with app-owned tools. Each writer submits a typed Manifesto action
candidate.

```typescript
import { tool } from "ai";
import { z } from "zod";

import { app } from "./manifesto-app";
import { readAgentContext } from "./agent-context";

function unavailable(actionName: "addTodo" | "clearCompleted") {
  return {
    status: "blocked" as const,
    reason: `${actionName} is not available in the current Snapshot.`,
    context: readAgentContext(),
  };
}

export const todoTools = {
  readTodoContext: tool({
    description: "Read Todo Snapshot state, computed values, and available actions.",
    inputSchema: z.object({}),
    execute: async () => readAgentContext(),
  }),

  addTodo: tool({
    description: "Add one todo through the Manifesto runtime.",
    inputSchema: z.object({ title: z.string().min(1) }),
    execute: async ({ title }) => {
      const admission = app.actions.addTodo.check(title);
      if (!admission.ok) {
        return unavailable("addTodo");
      }

      const result = await app.actions.addTodo.submit(
        title,
        { __kind: "SubmitOptions", report: "none" },
      );

      return {
        status: result.ok ? "submitted" as const : "blocked" as const,
        admission: result.ok ? undefined : result.admission,
        context: readAgentContext(),
      };
    },
  }),

  clearCompleted: tool({
    description: "Clear completed todos when the action is available.",
    inputSchema: z.object({}),
    execute: async () => {
      const admission = app.actions.clearCompleted.check();
      if (!admission.ok) {
        return unavailable("clearCompleted");
      }

      const result = await app.actions.clearCompleted.submit({
        __kind: "SubmitOptions",
        report: "none",
      });

      return {
        status: result.ok ? "submitted" as const : "blocked" as const,
        admission: result.ok ? undefined : result.admission,
        context: readAgentContext(),
      };
    },
  }),
};
```

Keep tool results fresh. A multi-step agent should receive updated
`availableActions` after every tool call: read context, write, read the context
returned by that write, decide the next tool.

Do not cache `inspect.availableActions()` for a whole agent turn. It is a read
against the current Snapshot; every submit or approved proposal can change it.
The runtime still checks again during submit, so a stale agent step cannot force
an unavailable action through.

If a tool needs first-party admission data, before/after snapshots, or projected
diffs in-band, keep the default report detail:

```typescript
const result = await app.actions.addTodo.submit(
  title,
  { __kind: "SubmitOptions", report: "full" },
);

if (!result.ok) {
  return result;
}

return {
  status: "submitted" as const,
  changedPaths: result.report?.changes,
  context: readAgentContext(),
};
```

---

## 3. Run A Multi-Step AI SDK Turn

Pass the current context to the model. Pass stable tools that re-check runtime
availability during `execute`.

```typescript
import { openai } from "@ai-sdk/openai";
import { generateText, stepCountIs } from "ai";

import { readAgentContext } from "./agent-context";
import { todoTools } from "./todo-agent-tools";

export async function runTodoAgent(prompt: string) {
  const context = readAgentContext();

  return generateText({
    model: openai("gpt-5.2"),
    system:
      "You are a Todo agent. Use the provided context and tools. " +
      "Tool results include fresh Manifesto context. " +
      "Check availableActions after each write. " +
      "Do not claim a write happened unless a tool returns status='submitted'.",
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

## 4. Add HITL With Governance

When the agent's writes need review, swap the activated runtime. The MEL domain
and action-candidate calls stay the same.

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";
import {
  createInMemoryGovernanceStore,
  withGovernance,
} from "@manifesto-ai/governance";

export const app = withGovernance(
  withLineage(createManifesto(todoSchema, {}), {
    store: createInMemoryLineageStore(),
  }),
  {
    governanceStore: createInMemoryGovernanceStore(),
    bindings: [
      {
        actorId: "actor:todo-agent",
        authorityId: "authority:human-reviewer",
        policy: {
          mode: "hitl",
          delegate: {
            actorId: "actor:reviewer",
            kind: "human",
            name: "Reviewer",
          },
        },
      },
    ],
    execution: {
      projectionId: "todo-agent",
      deriveActor: () => ({ actorId: "actor:todo-agent", kind: "agent" }),
      deriveSource: (intent) => ({ kind: "agent", eventId: intent.intentId }),
    },
  },
).activate();
```

Now writer tools submit and receive a pending proposal result.

```typescript
const addTodoForReview = tool({
  description: "Propose a todo. A human reviewer must approve before it changes state.",
  inputSchema: z.object({ title: z.string().min(1) }),
  execute: async ({ title }) => {
    const pending = await app.actions.addTodo.submit(title);

    if (!pending.ok) {
      return {
        status: "blocked" as const,
        admission: pending.admission,
        context: readAgentContext(),
      };
    }

    return {
      status: "needs_review" as const,
      proposalId: pending.proposal,
      context: readAgentContext(),
    };
  },
});
```

With `mode: "hitl"`, the proposal remains pending and the visible Snapshot does
not change until a reviewer approves it.

```typescript
export async function approveAgentProposal(proposalId: string) {
  await app.approve(proposalId);
  const settlement = await app.waitForSettlement(proposalId);

  return {
    settlement,
    context: readAgentContext(),
  };
}
```

That is the upgrade path: direct tools use `actions.x.submit()`. Reviewable
tools use the same call shape and receive a `ProposalRef`; a reviewer calls
`approve()` when policy requires it, then observes settlement through
`pending.waitForSettlement()` or `app.waitForSettlement(ref)`.

---

## What Manifesto Adds To Agents

- `inspect.availableActions()` exposes current action availability.
- Tools submit typed action candidates.
- Tool results return fresh Snapshot context.
- `withGovernance()` adds review without changing the MEL domain.

---

## Common Mistakes

### Describing actions only in the system prompt

Use `inspect.availableActions()` and `actions.x.info()` as the capability
surface.

### Letting the agent edit state directly

Do not let the agent write state directly. Submit an action candidate.

### Hiding approval logic in prompt text

Use Governance or app policy for review. Do not rely on prompt text.

### Returning effect results as the action outcome

Read the resulting Snapshot. Effects report back through patches.

---

## Next

- Build the domain first in [Building a Todo App](/guide/essentials/todo-app)
- Connect the same runtime to a UI with [React](./react)
- Learn action inspection in [SDK API](/api/sdk)
- Read [When You Need Approval or History](/guides/approval-and-history) before adding sealed history to the product
- Use [`@manifesto-ai/studio-mcp`](/api/studio-mcp) when an agent should inspect graph, findings, trace, lineage, or governance over MCP
