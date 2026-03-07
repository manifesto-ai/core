# Legacy App Migration

> Historical guide for repositories that still depend on `@manifesto-ai/app`.

`@manifesto-ai/app` is retired. The current SDK surface is `createManifesto()` from `@manifesto-ai/sdk`.

---

## What This Guide Covers

- Replacing legacy package imports
- Updating call sites that still assume `createApp()`
- Using the repo migration script as a first pass

This guide is intentionally narrow. If you are starting new work, skip it and use the [Tutorial](/tutorial/) instead.

---

## 1. Replace the Package Import

```typescript
// Before
import { createApp } from "@manifesto-ai/app";

// After
import { createManifesto } from "@manifesto-ai/sdk";
```

---

## 2. Update the Public API Usage

The important migration is not just the import path. The public shape changed.

| Legacy App Facade | Current SDK |
|-------------------|-------------|
| `createApp({ schema, effects })` | `createManifesto({ schema, effects })` |
| `await app.ready()` | Not needed |
| `app.act("type", input)` | `manifesto.dispatch(createIntent("type", input, intentId))` |
| `await handle.done()` | `on()` events or a `dispatchAsync()` helper |
| `app.getState()` | `manifesto.getSnapshot()` |

---

## 3. Use the Migration Script Carefully

```bash
node scripts/migrate/app-to-sdk.mjs
```

Apply changes:

```bash
node scripts/migrate/app-to-sdk.mjs --write
```

The script is a first pass only. It helps with import-path replacement. You still need to review code that assumed the old App facade API.

---

## 4. Manual Review Checklist

- Replace `createApp` with `createManifesto`
- Remove `ready()`
- Replace `act()` flows with `dispatch()` plus telemetry or a helper
- Replace `getState()` with `getSnapshot()`
- Re-run tests and docs build

---

## Notes

- Historical ADR/FDR pages may intentionally keep legacy names
- The migration script skips generated folders and exits non-zero when it finds unsupported app-only symbols
- If the old code relied on App-only abstractions, rewrite those call sites manually
