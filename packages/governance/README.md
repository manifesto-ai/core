# @manifesto-ai/governance

> Decorator runtime for legitimacy, approval, and governed execution.

`@manifesto-ai/governance` is the package that turns a composable manifesto into a governed world. Its canonical public entry is `withGovernance(manifesto, config)`.

> **Current Contract Note:** The truthful current package contract is [docs/governance-SPEC-v3.0.0-draft.md](docs/governance-SPEC-v3.0.0-draft.md). The v2.0.0 governance spec remains as the historical service-first baseline.

## Canonical Runtime Path

```ts
import { createManifesto } from "@manifesto-ai/sdk";
import { withGovernance } from "@manifesto-ai/governance";

const governed = withGovernance(
  createManifesto<CounterDomain>(schema, effects),
  {
    lineage: { store },
    bindings,
    execution: {
      projectionId: "counter",
      deriveActor(intent) {
        return { actorId: "agent:demo", kind: "agent" };
      },
      deriveSource(intent) {
        return { kind: "agent", eventId: intent.intentId };
      },
    },
  },
).activate();

const proposal = await governed.proposeAsync(
  governed.createIntent(governed.MEL.actions.increment),
);
```

## What This Package Owns

- `withGovernance()` and the activated `GovernanceInstance`
- proposal lifecycle and authority evaluation
- pending human/tribunal resolution through `approve()` / `reject()`
- governance decision records and post-commit governance events
- low-level governance stores, services, authority handlers, and intent-instance helpers

## What Changes After Governance Activation

- direct `dispatchAsync` no longer exists
- the canonical state-change path becomes `proposeAsync() -> approve()/reject()`
- lineage is guaranteed at runtime
- visible snapshots publish only after approved execution seals successfully

## Low-Level Surface Still Available

The service-first exports remain public for lower-level tooling and protocol tests:

- `createGovernanceService()`
- `createGovernanceEventDispatcher()`
- `createInMemoryGovernanceStore()`
- `createAuthorityEvaluator()`
- authority handlers and lifecycle types

Those are no longer the canonical application entry story.

## Docs

- [Docs Landing](docs/README.md)
- [Governance Guide](docs/GUIDE.md)
- [Governance Specification](docs/governance-SPEC-v3.0.0-draft.md)
- [Historical v2 Baseline](docs/governance-SPEC-2.0.0v.md)
- [Historical v1 Baseline](docs/governance-SPEC-1.0.0v.md)
- [VERSION-INDEX](docs/VERSION-INDEX.md)
