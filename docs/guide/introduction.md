# Introduction

> Manifesto is a semantic layer for deterministic domain state.

Manifesto lets you define a domain once in MEL, run that domain through the SDK, and expose the same semantics to frontend code, backend services, and agents.

It is not a state management library, an AI framework, a database, or a workflow engine. It is the semantic model underneath those surfaces.

## Why Manifesto?

### Deterministic by design

Core computation is pure. Effects are explicit declarations. Given the same schema, snapshot, and intent, Manifesto computes the same transition.

### Frontend, backend, and agents

UI components, server routes, scripts, jobs, and agents can all submit typed intents against the same domain model.

You do not need one state contract for UI, another for automation, and another for audit.

### Snapshot-first state

Dispatch an intent, then observe the next Snapshot. Effect results also return as patches into Snapshot.

That keeps the visible result in one place.

## The Base Runtime Path

Start here:

```text
MEL domain -> createManifesto() -> activate() -> createIntent() -> dispatchAsync() -> Snapshot
```

The base SDK runtime is the normal app path. It is the right default for learning, UI integration, backend routes, scripts, and trusted agent turns.

## Add Governance Later

When writes need review, branch continuity, explicit actor identity, or sealed history, compose the same manifesto before activation:

```text
createManifesto() -> withLineage() -> withGovernance() -> activate()
```

Governance and lineage add legitimacy and continuity around the same semantic core. They are not prerequisites for your first app.

## Next

Start with [Quick Start](./quick-start), then continue through [First App](/tutorial/01-your-first-app) and [Actions and State](/tutorial/02-actions-and-state).
