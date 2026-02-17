# Migrate from `@manifesto-ai/app` to `@manifesto-ai/sdk`

## Why

`@manifesto-ai/sdk` is now the canonical public entry point.
The legacy facade package `@manifesto-ai/app` was removed in R2.

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
    "@manifesto-ai/sdk": "^1.1.0"
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
- The script skips files that use app-only symbols not exported by SDK (for example `createSilentPolicyService`) and exits non-zero so you can fix them manually.
- This safety check also covers namespace/default usage such as `import * as app from "@manifesto-ai/app"` and `const app = require("@manifesto-ai/app")`.
- Run the script from repository root so it can load `packages/sdk/src/index.ts` for allowlist validation.
- If you intentionally want raw path replacement anyway, use `--allow-unsafe`.
- Historical ADR/FDR references may intentionally keep `@manifesto-ai/app` strings.
- Re-run tests/build after migration.
