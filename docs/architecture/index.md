# Architecture

> Understand the current implementation shape before you dig into the lower layers.

---

## The Current Picture

For the default SDK path today, the mental model is:

```text
caller -> SDK (`createManifesto`)
       -> Compiler (if schema is MEL text)
       -> Host
       -> Core
       -> terminal Snapshot
```

If you need explicit governance, actor approval, or lineage, add `@manifesto-ai/world` as a separate integration around the same Snapshot and Intent model.

---

## What Each Layer Owns

| Layer | Responsibility |
|-------|----------------|
| SDK | Public entrypoint and runtime handle |
| Compiler | MEL to `DomainSchema` conversion |
| Host | Effect execution and patch application loop |
| Core | Pure computation of the next semantic state |
| World | Optional governance, proposals, approvals, and lineage |

The important beginner takeaway is that not every layer needs to be in your head on day one. Most onboarding work starts with SDK, Host, and Core.

---

## Architecture Principles

### Snapshot is the shared truth

State is read through Snapshot, not through hidden runtime variables.

### Core computes, Host fulfills

Core determines what should happen. Host fulfills declared work and applies resulting patches.

### Governance is explicit

World is available when you need approval and lineage semantics. It is not an implicit black box inside the current `createManifesto()` path.

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
- you need to decide whether to bring in World

If you are still learning the APIs, go back to [Tutorial](/tutorial/) first.
