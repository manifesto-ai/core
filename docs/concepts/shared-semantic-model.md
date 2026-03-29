# Shared Semantic Model

> Manifesto is a semantic layer for deterministic domain state. Every surface reads from the same Snapshot and speaks the same domain semantics.

---

## The Core Idea

The important idea is not "multi-actor support" or "AI integration" as separate features. The important idea is that there is **one semantic model** for your domain, and every consumer works against it:

- the same MEL domain declaration
- the same request model for asking for change
- the same Snapshot as single source of truth
- the same deterministic compute equation

This is what makes Manifesto a semantic layer rather than a state management library or an AI framework.

---

## One Semantic Core, Two Runtime Surfaces

```text
SDK surface -> createIntent() -> dispatch() -> next Snapshot
World surface -> createIntentInstance() -> proposal -> seal -> next Snapshot
```

The semantic core is shared. The runtime surface changes based on whether you need direct dispatch or governed composition.

The surfaces can be:

- a React UI
- a REST/GraphQL API handler
- a CLI script
- a background job
- an LLM-powered agent

The contract stays the same. The Snapshot is the shared truth.

---

## A Small Example

```typescript
import { createManifesto, createIntent } from "@manifesto-ai/sdk";
import TaskBoardMel from "./task-board.mel";

const manifesto = createManifesto({
  schema: TaskBoardMel,
  effects: {},
});

// UI surface
manifesto.dispatch(
  createIntent(
    "addTask",
    { id: crypto.randomUUID(), title: "Human-created task" },
    crypto.randomUUID(),
  ),
);

// Agent surface - same direct-dispatch contract
manifesto.dispatch(
  createIntent(
    "addTask",
    { id: crypto.randomUUID(), title: "Agent-created task" },
    crypto.randomUUID(),
  ),
);
```

The governed surface uses the same domain meaning, but it wraps the request in proposal and lineage metadata before sealing.

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

That is where [World](./world) comes in. It is an explicit governance layer that composes on top of the same Snapshot and request model.

---

## See Also

- [Snapshot](./snapshot) for the single source of truth
- [Intent](./intent) for the unit of requested change
- [Integration: AI Agents](../integration/ai-agents) for practical agent patterns
- [World](./world) for explicit governance and lineage
