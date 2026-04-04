# Architecture

> Understand the current implementation shape before you dig into the lower layers.

---

## The Current Picture

For the default SDK path today, the mental model is:

```text
caller -> SDK (`createManifesto` -> `activate`)
       -> Compiler (if schema is MEL text)
       -> Host
       -> Core
       -> terminal Snapshot
```

If you need explicit governance, actor approval, or lineage, decorate the same manifesto with Lineage and Governance before activation.

---

## What Each Layer Owns

| Layer | Responsibility |
|-------|----------------|
| SDK | Public entrypoint and runtime handle |
| Lineage | Continuity, sealing, restore, branch/head history |
| Governance | Legitimacy, proposal lifecycle, approval, rejection, decisions |
| Compiler | MEL to `DomainSchema` conversion |
| Host | Effect execution and patch application loop |
| Core | Pure computation of the next semantic state |

The important beginner takeaway is that not every layer needs to be in your head on day one. Most onboarding work starts with SDK, Host, and Core.

---

## Architecture Principles

### Snapshot is the shared read model

State is read through Snapshot rather than hidden runtime variables. At the SDK boundary this means the projected read model from `getSnapshot()`. At the Core/Host boundary, the underlying canonical Snapshot substrate remains the single communication medium.

### Core computes, Host fulfills

Core determines what should happen. Host fulfills declared work and applies resulting patches.

### Governance is explicit

Lineage and Governance are explicit decorators. They are not implicit black boxes inside the current `createManifesto()` path.

---

## Recommended Reading Order

1. [Data Flow](./data-flow)
2. [Determinism](./determinism)
3. [Failure Model](./failure-model)
4. [World Concept](/concepts/world)

That order matches how most new developers encounter real problems.

---

## When to Read This Section

Read the architecture pages when:

- the tutorial examples make sense, but you want to know why
- you are integrating Manifesto into a larger system
- you need to decide whether to add Lineage or Governance

If you are still learning the APIs, go back to [Tutorial](/tutorial/) first.
