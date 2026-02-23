# @manifesto-ai/app (Removed)

> **Status:** Removed in R2 (ADR-008).
> **Replacement:** `@manifesto-ai/sdk`

## Migration

The `@manifesto-ai/app` package was retired. All imports should point to `@manifesto-ai/sdk`.

```typescript
// BEFORE (removed)
import { createApp } from '@manifesto-ai/app';

// AFTER
import { createApp } from '@manifesto-ai/sdk';
```

Most public APIs carry over unchanged, but some App-only symbols (e.g. `createSilentPolicyService`) are not exported by SDK. See the [Migration Guide](../../../docs/guides/migrate-app-to-sdk.md) for the full list of differences, and `@knowledge/packages/sdk.md` for the current SDK API reference.

## Historical References

- [ADR-007: SDK/Runtime Split Kickoff](../../../docs/internals/adr/007-sdk-runtime-split-kickoff.md)
- [ADR-008: SDK-First Transition and App Retirement](../../../docs/internals/adr/008-sdk-first-transition-and-app-retirement.md)
- [Migration Guide](../../../docs/guides/migrate-app-to-sdk.md)
