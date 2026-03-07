# Typed Patch Ops

> Build patches with IDE autocomplete and compile-time value checks.

---

## Why Use `defineOps()`

Raw patch objects are always available, but they get noisy fast:

```typescript
return [
  { op: "set", path: [{ kind: "prop", name: "status" }], value: "saving" },
];
```

`defineOps<TData>()` gives you a typed helper focused on `snapshot.data`.

---

## Basic Usage

```typescript
import { defineOps } from "@manifesto-ai/sdk";

type ProfileState = {
  status: "idle" | "saving" | "error";
  user: {
    name: string;
    email: string;
  };
  draftMessage?: string;
};

const ops = defineOps<ProfileState>();

const patches = [
  ops.set("status", "saving"),
  ops.set("user.name", "Ada"),
  ops.unset("draftMessage"),
];
```

The helper gives you:

- autocomplete for valid data paths
- type checking for the value at each path
- merge restrictions to object-shaped paths

---

## `merge()` for Shallow Object Updates

```typescript
const patches = [
  ops.merge("user", { email: "ada@example.com" }),
];
```

This is useful when you want a shallow object update and the target path is known to be mergeable.

---

## `raw` for Dynamic or Platform Paths

Typed ops intentionally focus on `snapshot.data`. Use `raw` when you need a dynamic path or a platform namespace:

```typescript
const patches = [
  ops.raw.set("$host.lastError", { code: "SAVE_FAILED" }),
];
```

That keeps the common case strongly typed without blocking advanced cases.

---

## Using Typed Ops in an Effect Handler

```typescript
import { defineOps, type EffectHandler } from "@manifesto-ai/sdk";

type TodoState = {
  status: "idle" | "saving" | "error";
  errorMessage?: string;
};

const ops = defineOps<TodoState>();

export const effects = {
  "api.saveTodo": async () => {
    try {
      await saveTodo();
      return [ops.set("status", "idle"), ops.unset("errorMessage")];
    } catch (error) {
      return [
        ops.set("status", "error"),
        ops.set(
          "errorMessage",
          error instanceof Error ? error.message : "Unknown error",
        ),
      ];
    }
  },
} satisfies Record<string, EffectHandler>;
```

---

## Common Mistakes

### Using typed ops for `system.*`

Typed ops do not expose convenience methods for system mutations. Use `raw` for platform paths.

### Treating `merge()` like a deep merge

It is a shallow object merge. If you need more complex updates, compose them explicitly.

### Skipping typed ops in large handlers

The larger the handler, the more valuable path autocomplete becomes.

---

## Next

- Read [Effect Handlers](./effect-handlers) to combine typed ops with real IO
- Read [Debugging](./debugging) if a patch is not landing where you expected
