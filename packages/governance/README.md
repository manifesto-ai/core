# @manifesto-ai/governance

> Split-native governance protocol for legitimacy, authority, and proposal lifecycle.

`@manifesto-ai/governance` is the package to use when you need to reason about proposal legitimacy directly. It owns the governance lifecycle and composes with `@manifesto-ai/lineage` when you need branch-aware sealing.

> **Current Contract Note:** The current public package contract is documented in [docs/governance-SPEC-2.0.0v.md](docs/governance-SPEC-2.0.0v.md). The v1.0.0 governance spec remains available as the historical split-era baseline.

## What This Package Owns

- proposal lifecycle and status changes
- actor and authority binding
- execution-key policy and context
- governance events and event dispatch
- in-memory governance storage
- intent-instance helpers

## When to Use It

Use `@manifesto-ai/governance` directly when you want:

- custom governance evaluation or policy logic
- isolated tests for proposal lifecycle behavior
- explicit control over authority and event dispatch
- a lower-level building block for `@manifesto-ai/world`

## Quick Start

```typescript
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createInMemoryGovernanceStore,
} from "@manifesto-ai/governance";
import { createLineageService, createInMemoryLineageStore } from "@manifesto-ai/lineage";

const lineageStore = createInMemoryLineageStore();
const lineage = createLineageService(lineageStore);
const governanceStore = createInMemoryGovernanceStore();
const governance = createGovernanceService(governanceStore, {
  lineageService: lineage,
});
const eventDispatcher = createGovernanceEventDispatcher({ service: governance });
```

## Docs

- [Docs Landing](docs/README.md)
- [Governance Guide](docs/GUIDE.md)
- [Governance Specification](docs/governance-SPEC-2.0.0v.md)
- [Historical v1 Baseline](docs/governance-SPEC-1.0.0v.md)
- [VERSION-INDEX](docs/VERSION-INDEX.md)
