# @manifesto-ai/runtime (Retired)

> **Status:** Retired per [ADR-010](/internals/adr/010-major-hard-cut).

The `@manifesto-ai/runtime` package has been retired. Its responsibilities have been absorbed into `@manifesto-ai/sdk` via `createManifesto()`.

## Migration

Use `@manifesto-ai/sdk` directly:

```typescript
import { createManifesto } from '@manifesto-ai/sdk';

const instance = createManifesto({
  schema: domainSchema,
  effects: { /* ... */ },
});
```

See [@manifesto-ai/sdk](./sdk) for the current API.
