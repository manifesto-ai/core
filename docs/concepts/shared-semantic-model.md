# Shared Domain Model

> Define the domain once, then let UI, routes, scripts, and agents call the same actions and read the same Snapshot shape.

---

## The Core Idea

The important idea is not "multi-actor support" or "AI integration" as separate
features. The important idea is that there is **one domain model**, and every
consumer works against it:

- the same MEL domain declaration
- the same action names and input shapes
- the same `snapshot()` read shape
- the same deterministic transition rules

This is what makes Manifesto useful underneath app state, server routes, and
agent tools without becoming a state management library or an AI framework.

---

## One Domain, One Starting Runtime

```text
Base runtime -> activate() -> action.x.submit(...) -> next Snapshot
```

The base runtime is the place to start. It is enough for UI, backend routes,
scripts, and trusted agent tools.

The surfaces can be:

- a React UI
- a REST/GraphQL API handler
- a CLI script
- a background job
- an LLM-powered agent

The contract stays the same. In ordinary app code, every surface reads through
`snapshot()` and writes through `app.action.<name>.submit(...)`.

When the product later needs review or sealed history, you can add that runtime
around the same domain. That is a later decision, not part of the first app
path.

```text
base app -> approval/history runtime -> proposal -> settlement -> sealed Snapshot
```

---

## A Small Example

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import TodoMel from "./domain/todo.mel";

const app = createManifesto(TodoMel, {}).activate();

// UI surface
await app.action.addTodo.submit("Human-created todo");

// Agent surface - same action contract
await app.action.addTodo.submit("Agent-created todo");
```

The approval/history surface uses the same domain actions, but adds review and
history steps before the write becomes visible.

---

## Why This Matters

Without a shared domain model, teams end up with:

- one state model for UI
- another for the backend
- another for automation
- another for agents
- another for audits

Each representation is a new inconsistency opportunity. Manifesto collapses
those into one action and Snapshot contract.

---

## Optional Approval And History

Sometimes the shared domain model is enough. Sometimes you need stronger
controls:

- explicit actor identity
- approval rules
- proposal review
- audit history

Start with [When You Need Approval or History](/guides/approval-and-history).
Read [World Records](./world) only when you want the in-depth record model
behind that runtime.

---

## See Also

- [Snapshot](./snapshot) for the default app read model and advanced full-snapshot reads
- [Intent](./intent) for the unit of requested change
- [Integration: AI Agents](../integration/ai-agents) for practical agent patterns
- [When You Need Approval or History](/guides/approval-and-history) for the review/history decision point
