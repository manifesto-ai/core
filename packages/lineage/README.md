# @manifesto-ai/lineage

> Split-native lineage protocol for identity, history, and sealing.

`@manifesto-ai/lineage` is the package to use when you need deterministic world identity, branch history, and snapshot sealing directly. It is the lower substrate that `@manifesto-ai/governance` and `@manifesto-ai/world` build on.

> **Current Contract Note:** The current public package contract is documented in [docs/lineage-SPEC-1.0.1v.md](docs/lineage-SPEC-1.0.1v.md). The projected ADR-015 + ADR-016 rewrite lives in [docs/lineage-SPEC-2.0.0v.md](docs/lineage-SPEC-2.0.0v.md) as draft only.

## What This Package Owns

- snapshot and world identity computation
- branch, head, and epoch reads
- seal protocol and prepared commits
- lineage persistence and replay
- in-memory lineage storage

## When to Use It

Use `@manifesto-ai/lineage` directly when you want:

- world history without governance
- deterministic identity and resume support
- custom persistence or replay tooling
- isolated tests for hashing, branch, and sealing behavior

## Quick Start

```typescript
import {
  createInMemoryLineageStore,
  createLineageService,
} from "@manifesto-ai/lineage";

const store = createInMemoryLineageStore();
const lineage = createLineageService(store);
```

## Docs

- [Docs Landing](docs/README.md)
- [Lineage Guide](docs/GUIDE.md)
- [Lineage Specification](docs/lineage-SPEC-1.0.1v.md)
- [Projected Next-Major Draft](docs/lineage-SPEC-2.0.0v.md)
- [VERSION-INDEX](docs/VERSION-INDEX.md)
