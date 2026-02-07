# Migration Playbook: Early Manifesto v2 -> Current DX

> **Audience:** Teams that started on early v2 APIs and now need to adopt the current developer experience
> **Scope:** `@manifesto-ai/app`, `@manifesto-ai/core`, `@manifesto-ai/host`, `@manifesto-ai/world`, `@manifesto-ai/compiler`, `@manifesto-ai/intent-ir`, `@manifesto-ai/translator`

---

## Release Baseline

As of **February 7, 2026**, these are the current published versions:

| Package | Version |
|---------|---------|
| `@manifesto-ai/app` | `2.2.0` |
| `@manifesto-ai/core` | `2.2.0` |
| `@manifesto-ai/host` | `2.2.0` |
| `@manifesto-ai/world` | `2.2.0` |
| `@manifesto-ai/compiler` | `1.5.0` |
| `@manifesto-ai/intent-ir` | `0.3.0` |
| `@manifesto-ai/translator` | `0.2.0` |

---

## What Changed Most

Early v2 projects typically need updates in these areas:

1. **App API is effects-first**
   - You pass `effects` directly to `createApp()`.
   - You generally no longer wire Host manually in App code.

2. **World persistence ownership moved into World layer**
   - App code should avoid direct `worldStore` plumbing in normal usage.

3. **Platform namespaces are system-managed**
   - `$host`, `$mel` are platform-reserved.
   - `onceIntent` guard state is stored in `$mel` automatically.

4. **Translator boundary is cleaner**
   - Keep translation concerns in app/translator boundary.
   - Keep Host focused on execution and patch application.

---

## 30-Minute Migration Path

### Step 1: Upgrade Dependencies

```bash
pnpm add @manifesto-ai/app@^2.2.0 @manifesto-ai/core@^2.2.0 @manifesto-ai/host@^2.2.0 @manifesto-ai/world@^2.2.0 @manifesto-ai/compiler@^1.5.0 @manifesto-ai/intent-ir@^0.3.0 @manifesto-ai/translator@^0.2.0
```

If you use npm:

```bash
npm install @manifesto-ai/app@^2.2.0 @manifesto-ai/core@^2.2.0 @manifesto-ai/host@^2.2.0 @manifesto-ai/world@^2.2.0 @manifesto-ai/compiler@^1.5.0 @manifesto-ai/intent-ir@^0.3.0 @manifesto-ai/translator@^0.2.0
```

---

### Step 2: Migrate `createApp()` Usage First

Start by migrating your app entry points, because this usually unlocks the rest.

#### Before (early v2 style)

```typescript
// legacy style (conceptual example)
const app = createApp({
  schema,
  host,
  worldStore,
  services,
});
```

#### After (current style)

```typescript
import { createApp } from "@manifesto-ai/app";

const app = createApp({
  schema,
  effects: {
    "api.save": async (params, ctx) => {
      // return Patch[]
      return [{ op: "set", path: "data.saved", value: true }];
    },
  },
});

await app.ready();
```

Key updates:
- `effects` is the primary integration surface.
- Keep handlers returning patches, not domain decisions.

---

### Step 3: Update Effect Handler Signatures (App Layer)

At App layer, handlers are `(params, ctx)`.

#### Before

```typescript
"api.save": async (type, params, ctx) => {
  // ...
  return patches;
}
```

#### After

```typescript
"api.save": async (params, ctx) => {
  // ctx.snapshot is available for read-only state access
  return patches;
}
```

If you use Host directly (`@manifesto-ai/host`), keep Host handler contracts aligned with Host types.

---

### Step 4: Remove Manual Guard Boilerplate

If old MEL flows used manual idempotency flags, migrate to `onceIntent` where possible.

#### Before

```mel
action submit() {
  when isNull(submittedAt) {
    patch submittedAt = now()
    effect api:submit({})
  }
}
```

#### After

```mel
action submit() {
  onceIntent {
    patch submittedAt = now()
    effect api:submit({})
  }
}
```

Notes:
- Guard state is handled in `$mel`.
- You should not model `$mel`/`$host` as business domain data.

---

### Step 5: Handle Custom World/Persistence (Only If Needed)

Most teams can use default internal world setup via `createApp({ schema, effects })`.

If you need custom persistence/governance wiring, create and inject a world explicitly:

```typescript
import { createApp } from "@manifesto-ai/app";
import { createManifestoWorld } from "@manifesto-ai/world";

const world = createManifestoWorld({
  schemaHash: schema.hash,
  store: myWorldStore,
});

const app = createApp({
  schema,
  effects,
  world,
});
```

---

### Step 6: Validate Behavior

Run this minimum validation set after migration:

```bash
pnpm build
pnpm test
```

Recommended smoke checks:
1. Actions still complete with expected state updates.
2. Effect handlers still return deterministic patch shapes.
3. Snapshot hashing/persistence logic ignores platform namespaces.
4. Re-entry sensitive actions run once per intent.

---

## Common Migration Failures

### 1) "Effect handler not found"

- Ensure effect keys in `effects` exactly match effect types declared in schema.
- Check typos in namespace prefixes (for example `api.save` vs `api:save`).

### 2) Re-entry loops after migration

- Replace ad-hoc guard logic with `onceIntent`.
- Re-check action conditions for state-guarded termination.

### 3) Snapshot mismatch in custom persistence

- Exclude `$`-prefixed platform namespaces from canonical persistence/hash inputs.

### 4) App compiles but runtime semantics changed

- Re-run integration tests around action ordering, effect reinjection, and retries.

---

## Recommended Rollout Strategy

1. Migrate one bounded context first (not the whole monolith).
2. Release behind a feature flag.
3. Compare state traces between old/new flows on the same test fixtures.
4. Expand rollout per module after parity checks pass.

---

## Next Documents

- [Migration API Cookbook](./migration-api-cookbook)
- [Migration Checklist](./migration-checklist)
- [Effect Handlers](./effect-handlers)
- [Re-entry Safe Flows](./reentry-safe-flows)
