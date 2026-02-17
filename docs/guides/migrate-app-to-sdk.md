# Migrate from `@manifesto-ai/app` to `@manifesto-ai/sdk`

## Why

`@manifesto-ai/sdk` is now the canonical public entry point.
The legacy facade package `@manifesto-ai/app` is deprecated in R1 and scheduled for removal in R2.

- Decision: [ADR-008](/internals/adr/008-sdk-first-transition-and-app-retirement)

## Manual Migration

Replace import paths:

```typescript
// Before
import { createApp } from "@manifesto-ai/app";

// After
import { createApp } from "@manifesto-ai/sdk";
```

Update dependency declarations:

```json
{
  "dependencies": {
    "@manifesto-ai/sdk": "^1.0.0"
  }
}
```

## Automated Migration Script

Use the repository migration helper:

```bash
node scripts/migrate/app-to-sdk.mjs
```

This runs in dry-run mode by default.

Apply changes:

```bash
node scripts/migrate/app-to-sdk.mjs --write
```

Target specific paths:

```bash
node scripts/migrate/app-to-sdk.mjs --write src docs
```

## Notes

- The script skips `node_modules`, `dist`, `coverage`, `.git`, and `.turbo` directories.
- Historical ADR/FDR references may intentionally keep `@manifesto-ai/app` strings.
- Re-run tests/build after migration.
