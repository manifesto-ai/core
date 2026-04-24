# Shared Semantic Model

> Manifesto is a semantic layer for deterministic domain state. Every surface reads from the same underlying snapshot substrate and speaks the same domain semantics.

---

## The Core Idea

The important idea is not "multi-actor support" or "AI integration" as separate features. The important idea is that there is **one semantic model** for your domain, and every consumer works against it:

- the same MEL domain declaration
- the same request model for asking for change
- the same snapshot substrate, exposed as projected Snapshot reads by default
- the same deterministic compute equation

This is what makes Manifesto a semantic layer rather than a state management library or an AI framework.

---

## One Semantic Core, Two Runtime Surfaces

```text
Base runtime -> activate() -> createIntent(MEL.actions.*) -> dispatchAsync() -> next Snapshot
Governed runtime -> withLineage() -> withGovernance() -> proposeAsync() -> seal -> next Snapshot
```

The semantic core is shared. The runtime surface changes based on whether you need direct dispatch or governed composition.

The surfaces can be:

- a React UI
- a REST/GraphQL API handler
- a CLI script
- a background job
- an LLM-powered agent

The contract stays the same. The same snapshot substrate is shared across surfaces, even when applications read it through the projected Snapshot boundary.

---

## A Small Example

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import TaskBoardMel from "./task-board.mel";

const app = createManifesto(TaskBoardMel, {}).activate();

// UI surface
await app.dispatchAsync(
  app.createIntent(
    app.MEL.actions.addTask,
    crypto.randomUUID(),
    "Human-created task",
  ),
);

// Agent surface - same direct-dispatch contract
await app.dispatchAsync(
  app.createIntent(
    app.MEL.actions.addTask,
    crypto.randomUUID(),
    "Agent-created task",
  ),
);
```

The governed surface uses the same domain meaning, but it adds proposal and lineage semantics before publication.

---

## Why This Matters

Without a shared semantic layer, teams end up with:

- one state model for UI
- another for the backend
- another for automation
- another for agents
- another for audits

Each representation is a new inconsistency opportunity. Manifesto collapses these into one semantic contract.

---

## Optional Governance

Sometimes the shared semantic model is enough. Sometimes you need stronger controls:

- explicit actor identity
- approval rules
- proposal review
- lineage and audit history

That is where [World Records and Governed Composition](./world) comes in. Lineage provides sealed World records, while Governance authorizes and settles legitimacy on top of the same Snapshot and request model.

---

## See Also

- [Snapshot](./snapshot) for the projected read model and canonical substrate split
- [Intent](./intent) for the unit of requested change
- [Integration: AI Agents](../integration/ai-agents) for practical agent patterns
- [World Records and Governed Composition](./world) for lineage records and governed runtime composition
