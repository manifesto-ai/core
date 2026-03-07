# AI Native OS Layer

> Manifesto treats humans, agents, and systems as participants over one shared Snapshot model.

---

## What This Means in Practice

The important idea is not “AI support” as a separate feature. The important idea is that every participant can work against the same domain semantics:

- the same MEL domain
- the same Intent model
- the same Snapshot truth

That is why a human-driven UI and an AI worker can both interact with the same application model.

---

## The Shared Shape

```text
participant -> createIntent() -> dispatch()
                              -> next Snapshot
```

The participant can be:

- a React button click
- a CLI script
- a background job
- an LLM-powered agent

The runtime shape stays the same.

---

## A Small Example

```typescript
import { createManifesto, createIntent } from "@manifesto-ai/sdk";
import TaskBoardMel from "./task-board.mel";

const manifesto = createManifesto({
  schema: TaskBoardMel,
  effects: {},
});

manifesto.dispatch(
  createIntent(
    "addTask",
    { id: crypto.randomUUID(), title: "Human-created task" },
    crypto.randomUUID(),
  ),
);

manifesto.dispatch(
  createIntent(
    "addTask",
    { id: crypto.randomUUID(), title: "Agent-created task" },
    crypto.randomUUID(),
  ),
);
```

Both transitions land in the same Snapshot model.

---

## Optional Governance

Sometimes “same intent model” is enough. Sometimes you need stronger controls:

- explicit actor identity
- approval rules
- proposal review
- lineage and audit history

That is where `@manifesto-ai/world` comes in. It is an explicit higher-level integration, not an implicit part of the default `createManifesto()` path.

---

## Why This Matters

Without a shared semantic layer, teams end up with:

- one state model for UI
- another for automation
- another for agents
- another for audits

Manifesto pushes those participants back onto one contract.

---

## See Also

- [Intent](./intent) for the unit of requested change
- [Integration: AI Agents](/integration/ai-agents) for practical agent patterns
- [World](./world) for explicit governance and lineage
