# @manifesto-ai/governance

> Decorator runtime for approval, proposal review, and governed execution.

`@manifesto-ai/governance` is the package that turns a composable Manifesto app
into an approval-gated runtime. Its canonical public entry is
`withGovernance(manifesto, config)`.

> **Current Contract Note:** The current package contract is [docs/governance-SPEC.md](docs/governance-SPEC.md). The v2.0.0 governance spec remains as the historical service-first baseline. The current runtime surface uses governance-mode `action.<name>.submit(...)` plus `waitForSettlement(ref)`.

## Canonical Runtime Path

```ts
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";
import { withGovernance } from "@manifesto-ai/governance";
import TodoMel from "./domain/todo.mel";
import type { TodoDomain } from "./domain/todo.domain";

const governed = withGovernance(
  withLineage(createManifesto<TodoDomain>(TodoMel, effects), {
    store: createInMemoryLineageStore(),
  }),
  {
    bindings,
    execution: {
      projectionId: "todo",
      deriveActor(intent) {
        return { actorId: "agent:demo", kind: "agent" };
      },
      deriveSource(intent) {
        return { kind: "agent", eventId: intent.intentId };
      },
    },
  },
).activate();

const pending = await governed.action.addTodo.submit("Review docs");
const settlement = pending.ok
  ? await pending.waitForSettlement()
  : pending;
```

## What This Package Owns

- `withGovernance()` and the activated `GovernanceInstance`
- proposal lifecycle and authority evaluation
- pending human/tribunal resolution through `approve()` / `reject()`
- additive proposal-settlement observation through `waitForSettlement()`
- governance decision records and post-commit governance events
- lineage-preserving query access such as `getWorldSnapshot()`, `getLatestHead()`, and `getBranches()`
- low-level governance stores, services, authority handlers, and intent-instance helpers via `@manifesto-ai/governance/provider`

## What Changes After Governance Activation

- direct root write verbs from earlier runtimes no longer exist
- the canonical state-change path becomes `action.x.submit() -> approve()/reject() -> waitForSettlement()`
- `waitForSettlement()` is an observation helper, not a state-change verb
- lineage must be composed before governance activation
- visible snapshots publish only after approved execution seals successfully
- `getWorldSnapshot(worldId)` remains the stored sealed canonical snapshot lookup; `restore(worldId)` remains the normalized resume path inherited from lineage

## Low-Level Surface Still Available

The provider entry point remains public for lower-level tooling and integration tests:

- `@manifesto-ai/governance/provider`
- `createGovernanceService()`
- `createGovernanceEventDispatcher()`
- `createAuthorityEvaluator()`
- authority handlers and lifecycle types

`createInMemoryGovernanceStore()` also remains available from the root package as a consumer-safe bootstrap helper.

Those are no longer the canonical application entry story.

## Docs

- [Docs Landing](docs/README.md)
- [Governance Guide](docs/GUIDE.md)
- [Governance Specification](docs/governance-SPEC.md)
- [Historical v2 Baseline](docs/governance-SPEC-2.0.0v.md)
- [Historical v1 Baseline](docs/governance-SPEC-1.0.0v.md)
- [VERSION-INDEX](docs/VERSION-INDEX.md)
