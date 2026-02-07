# Migration API Cookbook

> **Goal:** Copy-paste oriented migration reference for early v2 projects
> **Use this with:** [Migration Playbook](./migration-from-v2-early)

---

## Fast Audit: Find Legacy Patterns

Use these commands in your app repository:

```bash
grep -R "worldStore" -n src
grep -R "services:" -n src
grep -R "createHost(" -n src
grep -R "registerEffect(" -n src
grep -R "onceNull(" -n src
grep -R "ctx.app.act(" -n src
```

---

## Pattern 1: `createApp` Config

### Legacy Pattern

```typescript
const app = createApp({
  schema,
  host,
  worldStore,
  services,
});
```

### Current Pattern

```typescript
const app = createApp({
  schema,
  effects,
});
```

### Notes

- Move service wiring into `effects` map.
- Keep orchestration logic in App/World, not in effect handlers.

---

## Pattern 2: Service Map -> Effects Map

### Legacy Pattern

```typescript
const services = {
  "api.fetch": async (params, ctx) => {
    // ...
    return patches;
  },
};
```

### Current Pattern

```typescript
const effects = {
  "api.fetch": async (params, ctx) => {
    // ...
    return patches;
  },
};

const app = createApp({ schema, effects });
```

### Notes

- Return `Patch[]` only.
- Put domain semantics in schema/flow, not handler code.

---

## Pattern 3: Effect Handler Signature at App Layer

### Legacy Pattern

```typescript
"api.save": async (type, params, ctx) => {
  return [{ op: "set", path: "data.saved", value: true }];
}
```

### Current Pattern

```typescript
"api.save": async (params, ctx) => {
  return [{ op: "set", path: "data.saved", value: true }];
}
```

### Notes

- At App layer, effect type is already encoded in the map key.
- `ctx.snapshot` is read-only context for state-dependent IO.

---

## Pattern 4: Manual Re-entry Flags -> `onceIntent`

### Legacy Pattern

```mel
state {
  submitted: boolean = false
}

action submit() {
  when not(submitted) {
    patch submitted = true
    effect api:submit({})
  }
}
```

### Current Pattern

```mel
action submit() {
  onceIntent {
    effect api:submit({})
  }
}
```

### Notes

- `onceIntent` is the preferred default for idempotent action bodies.
- Guard material is tracked by platform state (`$mel`).

---

## Pattern 5: Custom Persistence Wiring

### Legacy Pattern

```typescript
const app = createApp({
  schema,
  host,
  worldStore,
  services,
});
```

### Current Pattern

```typescript
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

### Notes

- Use custom world injection only when you need custom governance or storage behavior.
- Default world setup is usually enough for most apps.

---

## Pattern 6: Host Direct Usage (Advanced Only)

If your project intentionally uses Host directly, keep this separate from App-level APIs.

```typescript
import { ManifestoHost } from "@manifesto-ai/host";

const host = new ManifestoHost(schema, {
  initialData,
  runtime: {
    now: () => Date.now(),
    microtask: (fn) => queueMicrotask(fn),
    yield: () => Promise.resolve(),
  },
});
```

Use Host direct only for runtime-level control or custom orchestration requirements.

---

## Pattern 7: Hook Re-entry Safety

### Risky Pattern

```typescript
app.hooks.on("action:completed", (_payload, ctx) => {
  ctx.app.act("audit.log", {}).done();
});
```

### Safer Pattern

```typescript
app.hooks.on("action:completed", (_payload, ctx) => {
  ctx.app.enqueueAction("audit.log", {});
});
```

This avoids immediate recursive execution in hook paths.

---

## Migration Diff Template

Use this as a PR checklist block:

```markdown
## Migration Diff Summary
- [ ] Replaced legacy `createApp` config with effects-first config
- [ ] Migrated service map to `effects`
- [ ] Updated app-level effect handler signatures
- [ ] Replaced manual re-entry guards with `onceIntent` where applicable
- [ ] Validated custom persistence/world wiring (if used)
- [ ] Ran build/tests and smoke scenario replay
```

---

## Next Documents

- [Migration Playbook](./migration-from-v2-early)
- [Migration Checklist](./migration-checklist)
