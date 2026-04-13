# AI Agent Integration

> Let agents see the current Snapshot, see the actions that are available now, and submit domain changes through the runtime.
>
> **Current Contract Note:** This page uses the activation-first SDK surface: activate a `createManifesto(...)` app, then call `getSnapshot`, `getAvailableActions`, `getActionMetadata`, `createIntent`, and `dispatchAsync()`. When tooling needs in-band admission or diff data, base runtimes may use `dispatchAsyncWithReport()` and lineage runtimes may use `commitAsyncWithReport()`. Governed examples use the current `withLineage(...) -> withGovernance(...) -> activate()` surface, with optional settlement observation through `waitForProposal()` or world-anchored settlement reports through `waitForProposalWithReport()`.

An agent should not guess your domain API from prompt text. It should read the current state, read the currently legal actions, call an app-owned tool, and receive a Snapshot view back.

```text
Snapshot + getAvailableActions()
  -> agent context for this step
  -> model chooses a stable app-owned tool
  -> tool re-reads runtime availability
  -> tool creates a typed Manifesto Intent
  -> runtime dispatches or proposes
  -> fresh context returns for the next step
```

This guide uses a Todo app. Build that domain first in [Building a Todo App](/guide/essentials/todo-app).

The examples assume action-level gates are modeled with MEL `available when`. `getAvailableActions()` reflects those current-snapshot action gates. Bound-input checks still belong to `dispatchable when`, `whyNot()`, or the final runtime dispatch.
Treat `getAvailableActions()` as a present-tense observational read, not a capability token; tools still need to re-check legality at execution or proposal time.

---

## 1. Give The Agent Runtime Context

`getSnapshot()` tells the agent what is true. `getAvailableActions()` tells the agent what the domain allows now.

```typescript
import { app } from "./manifesto-app";

export function readAgentContext() {
  const snapshot = app.getSnapshot();
  const availableActionNames = app.getAvailableActions();

  return {
    data: snapshot.data,
    computed: snapshot.computed,
    availableActions: availableActionNames.map((name) =>
      app.getActionMetadata(name),
    ),
  };
}
```

This is the agent's starting point: state plus the runtime's current public action contract. Do not maintain a parallel "actions the agent may call" list in prompt text.

---

## 2. Map Runtime Actions To Tools

Start with app-owned tools. Each writer creates a typed Manifesto Intent.

```typescript
import { tool } from "ai";
import { z } from "zod";

import { app } from "./manifesto-app";
import { readAgentContext } from "./agent-context";

function isAvailable(actionName: "addTodo" | "clearCompleted") {
  return app.getAvailableActions().includes(actionName);
}

function unavailable(actionName: "addTodo" | "clearCompleted") {
  return {
    status: "blocked" as const,
    reason: `${actionName} is not available in the current Snapshot.`,
    context: readAgentContext(),
  };
}

export const todoTools = {
  readTodoContext: tool({
    description: "Read Todo Snapshot data, computed values, and available actions.",
    inputSchema: z.object({}),
    execute: async () => readAgentContext(),
  }),

  addTodo: tool({
    description: "Add one todo through the Manifesto runtime.",
    inputSchema: z.object({ title: z.string().min(1) }),
    execute: async ({ title }) => {
      if (!isAvailable("addTodo")) {
        return unavailable("addTodo");
      }

      await app.dispatchAsync(
        app.createIntent(app.MEL.actions.addTodo, title),
      );

      return {
        status: "dispatched" as const,
        context: readAgentContext(),
      };
    },
  }),

  clearCompleted: tool({
    description: "Clear completed todos when the action is available.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!isAvailable("clearCompleted")) {
        return unavailable("clearCompleted");
      }

      await app.dispatchAsync(
        app.createIntent(app.MEL.actions.clearCompleted),
      );

      return {
        status: "dispatched" as const,
        context: readAgentContext(),
      };
    },
  }),
};
```

Keep tool results fresh. A multi-step agent should receive updated `availableActions` after every tool call: read context, write, read the context returned by that write, decide the next tool.

Do not cache `getAvailableActions()` for a whole agent turn. It is a read against the current Snapshot; every dispatch or approved proposal can change it.
The runtime still checks again during dispatch, so a stale agent step cannot force an unavailable action through.

If a tool needs first-party admission data, before/after snapshots, or projected diffs in-band, switch the write call to the additive companion instead of layering custom wrappers on top:

```typescript
const result = await app.dispatchAsyncWithReport(
  app.createIntent(app.MEL.actions.addTodo, title),
);

if (result.kind !== "completed") {
  return result;
}

return {
  status: "dispatched" as const,
  changedPaths: result.outcome.projected.changedPaths,
  context: readAgentContext(),
};
```

That keeps the tool on the first-party runtime contract while avoiding `try/catch` as control flow for ordinary rejected writes.

---

## 3. Run A Multi-Step AI SDK Turn

Pass the current context to the model. Pass stable tools that re-check runtime availability during `execute`.

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
      "Do not claim a write happened unless a tool returns status='dispatched'.",
    prompt: JSON.stringify({
      userRequest: prompt,
      manifestoContext: context,
    }, null, 2),
    tools: todoTools,
    stopWhen: stepCountIs(4),
  });
}
```

The same pattern fits a backend route, worker, CLI, MCP server, or another agent framework. Keep the binding small: model loop outside, domain transition inside Manifesto.

---

## 4. Add HITL With Governance

When the agent's writes need review, swap the activated runtime. The MEL domain and typed action refs stay the same.

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";
import {
  createInMemoryGovernanceStore,
  waitForProposal,
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

Now writer tools propose instead of dispatching.

```typescript
const addTodoForReview = tool({
  description: "Propose a todo. A human reviewer must approve before it changes state.",
  inputSchema: z.object({ title: z.string().min(1) }),
  execute: async ({ title }) => {
    const proposal = await app.proposeAsync(
      app.createIntent(app.MEL.actions.addTodo, title),
    );

    if (proposal.status === "evaluating") {
      return {
        status: "needs_review" as const,
        proposalId: proposal.proposalId,
        context: readAgentContext(),
      };
    }

    const settlement = await waitForProposal(app, proposal);

    return {
      status: settlement.kind,
      proposalId: proposal.proposalId,
      context: readAgentContext(),
    };
  },
});
```

With `mode: "hitl"`, the proposal remains `evaluating` and the visible Snapshot does not change until a reviewer approves it.

```typescript
export async function approveAgentProposal(proposalId: string) {
  const proposal = await app.approve(proposalId);

  return {
    proposal,
    context: readAgentContext(),
  };
}
```

That is the upgrade path: direct tools use `dispatchAsync()`. Reviewable tools use `proposeAsync()`, optionally observe settlement with `waitForProposal()`, optionally inspect a stored-world settlement outcome with `waitForProposalWithReport()`, and a reviewer calls `approve()` when policy requires it.

---

## What Manifesto Adds To Agents

- **Live capability discovery:** `getAvailableActions()` tells the agent which domain actions are legal against the current Snapshot.
- **Runtime-owned writes:** tools translate model requests into `createIntent(app.MEL.actions.*)`; the model never mutates state directly.
- **Snapshot feedback:** tool results return selected `snapshot.data`, `snapshot.computed`, and updated availability.
- **Simple HITL escalation:** `withGovernance()` turns a write tool into a proposal tool without rewriting the MEL domain.

---

## Common Mistakes

### Describing actions only in the system prompt

Use `getAvailableActions()` and `getActionMetadata()` as the source for agent-facing capabilities. Prompt text can explain behavior, but the runtime owns action availability.

### Letting the agent edit state directly

Do not let the agent write storage rows, React state, Redux slices, or serialized snapshots as its domain command. Call a tool that dispatches or proposes an Intent.

### Hiding approval logic in prompt text

If a write requires review, use Governance or application policy. A prompt instruction like "ask me first" is not an auditable decision record.

### Returning effect results as the action outcome

Effects report back through patches. Actions and tools should read the resulting Snapshot view.

---

## Next

- Build the domain first in [Building a Todo App](/guide/essentials/todo-app)
- Connect the same runtime to a UI with [React](./react)
- Learn action inspection in [SDK API](/api/sdk)
- Read [When You Need Approval or History](/guides/approval-and-history) before adding sealed history to the product
- Use [`@manifesto-ai/studio-mcp`](/api/studio-mcp) when an agent should inspect graph, findings, trace, lineage, or governance over MCP
