# @manifesto-ai/governance

> Legitimacy protocol for governed Manifesto composition.

## Overview

`@manifesto-ai/governance` owns the proposal, authority, decision, and post-commit event model used by governed deployments.

Use this package directly when you want:

- proposal lifecycle types and helpers
- authority handlers and evaluator composition
- governance-only tests or tooling
- direct access to governance stores and services without going through `@manifesto-ai/world`

If you are assembling a full governed runtime, top-level `@manifesto-ai/world` remains the canonical package because it re-exports governance together with lineage and the facade-owned coordinator/store surface.

## Main Runtime Surface

```typescript
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  InMemoryGovernanceStore,
} from "@manifesto-ai/governance";
```

## What This Package Owns

- `GovernanceStore` and `InMemoryGovernanceStore`
- `GovernanceService` and `createGovernanceService()`
- proposal lifecycle types such as `Proposal`, `ProposalStatus`, `DecisionRecord`
- authority handlers such as `AutoApproveHandler`, `PolicyRulesHandler`, `HITLHandler`, and `TribunalHandler`
- intent-instance helpers: `createIntentInstance()`, `createIntentInstanceSync()`, `computeIntentKey()`
- post-commit event dispatch helpers through `createGovernanceEventDispatcher()`

## Relationship to World

```text
@manifesto-ai/world
  -> re-exports @manifesto-ai/governance
  -> adds facade-owned store/coordinator composition
```

Use `@manifesto-ai/governance` directly when you need legitimacy rules by themselves. Use `@manifesto-ai/world` when you need governed runtime assembly.

## Related Docs

- [World API](./world.md)
- [Lineage API](./lineage.md)
- [Specifications](/internals/spec/)
