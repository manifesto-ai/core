# Architecture

> Deep-dive reading for understanding the current implementation shape.

Do not start here if you are still trying to get the first app running. Use [Quick Start](/guide/quick-start) and [Tutorial](/tutorial/) first, then come back once the runtime path already feels concrete.

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

## What Each Layer Owns

| Layer | Responsibility |
|-------|----------------|
| SDK | Public entrypoint and runtime handle |
| Lineage | Continuity, sealing, restore, branch/head history |
| Governance | Legitimacy, proposal lifecycle, approval, rejection, decisions |
| Compiler | MEL to `DomainSchema` conversion |
| Host | Effect execution and patch application loop |
| Core | Pure computation of the next semantic state |

## Read In This Order

1. [Data Flow](./data-flow)
2. [Determinism](./determinism)
3. [Failure Model](./failure-model)
4. [World Concept](/concepts/world)

## When To Read This Section

Read the architecture pages when:

- the tutorial examples make sense, but you want to know why
- you are integrating Manifesto into a larger system
- you need to decide whether to add Lineage or Governance

If you are still learning the APIs, go back to [Quick Start](/guide/quick-start) or [Tutorial](/tutorial/) first.
