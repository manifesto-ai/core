# Architecture

> Manifesto's conceptual core is MEL -> Core -> Host.

Do not start here if you are still trying to get the first app running. Use [Quick Start](/guide/quick-start) and [Tutorial](/tutorial/) first, then come back once the runtime path already feels concrete.

## The Current Picture

Manifesto computes deterministic domain state transitions. The system-level
mental model is:

```text
MEL source -> Compiler -> DomainSchema
DomainSchema + Snapshot + Intent + Context -> Core.compute()
Core result -> Host effect loop -> terminal Snapshot
SDK -> application-facing actions, reads, observe, inspect
```

MEL declares domain transition rules. Core computes semantic transitions. Host
fulfills declared effects and converges snapshots. The SDK exposes that runtime
to apps, UIs, backend routes, and agents.

If you need review, audit history, restore, or approval policies, read [When
You Need Approval or History](/guides/approval-and-history) before adding those
extensions.

## What Each Layer Owns

| Layer | Responsibility |
|-------|----------------|
| Compiler | MEL to `DomainSchema` conversion |
| Core | Pure computation of the next semantic state |
| Host | Effect execution and patch application loop |
| SDK | Public application-facing runtime handle |
| Lineage | Optional history, sealing, restore, branch/head history |
| Governance | Optional proposal lifecycle, approval, rejection, decisions |

## Read In This Order

1. [Data Flow](./data-flow)
2. [Determinism](./determinism)
3. [Failure Model](./failure-model)
4. [When You Need Approval or History](/guides/approval-and-history)
5. [Lineage Records](/concepts/lineage-records), only after that decision guide says you need it

## When To Read This Section

Read the architecture pages when:

- the tutorial examples make sense, but you want to know why
- you are integrating Manifesto into a larger system
- you need to decide whether to add approval, audit history, or restore

If you are still learning the APIs, go back to [Quick Start](/guide/quick-start) or [Tutorial](/tutorial/) first.
