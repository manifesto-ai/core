# @manifesto-ai/app (Deprecated Compatibility)

> **Status:** Deprecated compatibility package (available in R1).
> **Decision:** [ADR-008](/internals/adr/008-sdk-first-transition-and-app-retirement)

---

## Current Status

`@manifesto-ai/app` was the legacy facade package used during the SDK/Runtime split transition.

As of Phase 2 (R1):
- Canonical public entry point is `@manifesto-ai/sdk`
- `@manifesto-ai/app` remains available for compatibility
- Hard removal is scheduled for R2 (next regular release)

---

## Migration

Replace imports from `@manifesto-ai/app` with `@manifesto-ai/sdk`.

```typescript
// Before
import { createApp } from "@manifesto-ai/app";

// After
import { createApp } from "@manifesto-ai/sdk";
```

For automated migration support:
- [Migration Guide: app → sdk](/guides/migrate-app-to-sdk)

---

## Historical Context

- Kickoff policy and staged locking: [ADR-007](/internals/adr/007-sdk-runtime-split-kickoff)
- Transition and retirement decision: [ADR-008](/internals/adr/008-sdk-first-transition-and-app-retirement)

This page documents the compatibility package during the R1 transition window.
