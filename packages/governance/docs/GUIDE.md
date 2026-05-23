# Governance Guide

## 1. Compose Governance On A Manifesto

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";
import { withGovernance } from "@manifesto-ai/governance";
import TodoMel from "./domain/todo.mel";
import type { TodoDomain } from "./domain/todo.domain";

const app = withGovernance(
  withLineage(createManifesto<TodoDomain>(TodoMel, effects), {
    store: createInMemoryLineageStore(),
  }),
  {
    bindings: [
      {
        actorId: "agent:demo",
        authorityId: "authority:auto",
        policy: { mode: "auto_approve" },
      },
    ],
    execution: {
      projectionId: "todo",
      deriveActor(intent) {
        return { actorId: "agent:demo", kind: "agent", meta: { action: intent.type } };
      },
      deriveSource(intent) {
        return { kind: "agent", eventId: `action:${String(intent.type)}` };
      },
    },
  },
).activate();
```

Governance only accepts a manifesto that has already been composed with
`withLineage()`. Governance uses that explicit lineage setup and does not create
lineage on behalf of the caller.

## 2. Submit To Governance

```typescript
const pending = await app.action.addTodo.submit("Review docs");
```

Governance-mode `submit()` creates or enters the proposal path. It does not mean
direct execution, and it does not expose direct-write shortcuts around the
approval flow.

The initial successful result is always pending:

```typescript
if (pending.ok) {
  console.log(pending.mode); // "governance"
  console.log(pending.status); // "pending"
  console.log(pending.proposal); // durable ProposalRef
}
```

Auto-approved policies still produce a proposal record for audit. Settlement
timing is observed through `waitForSettlement()`.

## 3. Observe Settlement

```typescript
const settlement = await pending.waitForSettlement();

if (settlement.ok && settlement.status === "settled" && settlement.outcome.kind === "ok") {
  console.log(settlement.after.state.todos);
  console.log(settlement.world.worldId);
}
```

The same proposal can be re-attached later from its durable `ProposalRef`:

```typescript
const ref = pending.proposal;
const settlement = await app.waitForSettlement(ref);
```

`waitForSettlement()` observes settlement. It does not approve, reject, execute,
seal, or publish by itself.

Settlement results use these statuses:

- `settled`
- `rejected`
- `superseded`
- `expired`
- `cancelled`
- `settlement_failed`

For settled execution, `before` and `after` are projected snapshots anchored on
`proposal.baseWorld -> resultWorld`, not arbitrary current visible head reads.

## 4. Pending Human Resolution

HITL and tribunal policies keep proposals pending until a governance control
surface resolves them.

```typescript
const pending = await app.action.addTodo.submit("Review docs");

if (pending.ok) {
  await app.approve(pending.proposal);
  // or:
  // await app.reject(pending.proposal, "manual stop");
}
```

`approve()` and `reject()` are governance control methods. They operate on
proposal records and are not action submission verbs.

## 5. Lineage Semantics Stay Available

Governed runtimes still expose lineage-owned continuity query and restore
methods through the lineage composition:

- `restore(worldId)`
- `getWorld(worldId)`
- `getWorldSnapshot(worldId)`
- `getLatestHead()`
- `getHeads()`
- `getBranches()`
- `getActiveBranch()`
- `switchActiveBranch(branchId)`
- `createBranch(name, fromWorldId?)`

If you are migrating from older docs, do not follow old root proposal helpers.
Current app code stays on action handles, then observes settlement through
`pending.waitForSettlement()` or `app.waitForSettlement(ref)`.

## 6. Failure Observation

Failure observation comes from the terminal Snapshot's
`system.lastError` and pending requirements. Canonical
`namespaces.host.lastError` is Host-owned diagnostic state for deep debugging
and is not merged into governance settlement `ErrorInfo`.

## 7. Low-Level Governance APIs

The provider entry point exists for package testing and lower-level
composition:

- `@manifesto-ai/governance/provider`
- `createGovernanceService()`
- `createGovernanceEventDispatcher()`
- `createAuthorityEvaluator()`

`createInMemoryGovernanceStore()` remains available from the root package for
simple bootstrap and tests.

Those are useful when testing lifecycle invariants directly. They are not the
package's primary application story.

## Related Docs

- [Governance README](../README.md)
- [Governance Specification](governance-SPEC.md)
- [Historical v2 Baseline](governance-SPEC-2.0.0v.md)
- [Governance Version Index](VERSION-INDEX.md)
