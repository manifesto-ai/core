# Type-Safe Patch Operations

> **Covers:** Creating patches with IDE autocomplete and compile-time type checking
> **Purpose:** Eliminate string-path errors and wrong-type bugs at build time
> **Prerequisites:** Understanding of [Patches](/concepts/snapshot#patches) and [Effect Handlers](./effect-handlers)

---

## The Problem

Manifesto's three patch operations (`set`, `unset`, `merge`) use string paths at runtime:

```typescript
// No type checking — typos and wrong values compile silently
{ op: "set", path: "coutn", value: "not-a-number" }  // both bugs ship
```

`defineOps<T>()` solves this by injecting your domain state type, enabling your editor to catch these at write time.

---

## Quick Start

```typescript
import { defineOps } from "@manifesto-ai/sdk";

// 1. Define your domain state shape
type State = {
  count: number;
  user: { name: string; age: number };
  tags: string[];
};

// 2. Create a typed ops builder
const ops = defineOps<State>();

// 3. Build patches with full autocomplete
ops.set("count", 5);            // OK — path autocompletes, value: number
ops.set("user.name", "Alice");  // OK — nested path, value: string
ops.merge("user", { age: 30 }); // OK — partial object merge
ops.unset("tags");               // OK
```

Your editor now catches bugs before they run:

```typescript
ops.set("count", "wrong");      // TS Error — expected number
ops.set("counnt", 5);           // TS Error — path does not exist
ops.merge("count", {});         // TS Error — number is not mergeable
```

---

## API

### `defineOps<TData>()`

Creates a typed patch builder for the given state shape.

```typescript
function defineOps<TData extends Record<string, unknown>>(): TypedOps<TData>;
```

Returns a `TypedOps<TData>` object with the following methods:

| Method | Signature | Description |
|--------|-----------|-------------|
| `set` | `(path, value) → SetPatch` | Replace value at path |
| `unset` | `(path) → UnsetPatch` | Remove value at path |
| `merge` | `(path, value) → MergePatch` | Shallow merge at object path |
| `error` | `(code, message, context?) → SetPatch` | Convenience for `system.lastError` |
| `raw.set` | `(path, value) → SetPatch` | Untyped set (escape hatch) |
| `raw.unset` | `(path) → UnsetPatch` | Untyped unset (escape hatch) |
| `raw.merge` | `(path, value) → MergePatch` | Untyped merge (escape hatch) |

All methods return standard `Patch` objects — fully compatible with Core's `apply()`.

### Type Utilities

These types are exported for advanced usage:

| Type | Purpose |
|------|---------|
| `DataPaths<T>` | Union of all valid dot-separated paths from `T` |
| `ValueAt<T, P>` | Resolves the value type at path `P` in `T` |
| `ObjectPaths<T>` | Subset of `DataPaths` — only object paths (valid for merge) |

---

## Usage Patterns

### Effect Handlers

The most common use case — building patch arrays in effect handlers:

```typescript
import { createApp, defineOps } from "@manifesto-ai/sdk";
import type { Patch } from "@manifesto-ai/sdk";

type State = {
  data: { items: string[]; lastSync: string | null };
  syncStatus: "idle" | "syncing" | "success" | "error";
  errorMessage: string | null;
};

const ops = defineOps<State>();

const app = createApp({
  schema: mySchema,
  effects: {
    "api.fetchItems": async (params) => {
      try {
        const items = await fetch("/api/items").then((r) => r.json());
        return [
          ops.set("data.items", items),
          ops.set("data.lastSync", new Date().toISOString()),
          ops.set("syncStatus", "success"),
          ops.set("errorMessage", null),
        ];
      } catch (e) {
        return [
          ops.set("syncStatus", "error"),
          ops.set("errorMessage", (e as Error).message),
        ];
      }
    },
  },
});
```

### Partial Object Updates with `merge`

`merge` performs a shallow merge — only on object-typed paths:

```typescript
type State = {
  user: { name: string; age: number; email: string };
  settings: { theme: "light" | "dark"; lang: string };
  count: number;
};

const ops = defineOps<State>();

// Update only specific fields — other fields preserved
ops.merge("user", { email: "new@test.com" });
ops.merge("settings", { theme: "dark" });

// Primitives and arrays are NOT mergeable:
// ops.merge("count", {});  // TS Error
```

### Handling Nullable Fields

Fields with `| null` work naturally:

```typescript
type State = {
  error: string | null;
  selectedId: number | null;
};

const ops = defineOps<State>();

ops.set("error", "Something failed");  // OK
ops.set("error", null);                // OK — null is valid
ops.set("selectedId", 42);             // OK
ops.set("selectedId", null);           // OK
```

### System Error Convenience

`error()` creates a patch targeting `system.lastError`:

```typescript
const ops = defineOps<State>();

// In an effect handler's catch block:
return [
  ops.error("API_TIMEOUT", "Request timed out after 30s", {
    endpoint: "/api/users",
    attemptCount: 3,
  }),
];
```

---

## Design Characteristics

### Array Items Require `raw`

The typed API treats arrays as leaf values — you `set` the entire array, not individual items:

```typescript
type State = { todos: Array<{ title: string; done: boolean }> };
const ops = defineOps<State>();

// Typed — replace entire array
ops.set("todos", [{ title: "Buy milk", done: false }]);

// Individual item access — use raw escape hatch
ops.raw.set("todos.0.done", true);
ops.raw.set("todos.2.title", "Updated");
```

**Why?** Generating numeric index paths (`todos.0`, `todos.1`, ...) at the type level would explode the TypeScript union and degrade IDE performance. The `raw` escape hatch provides full flexibility when needed.

### Depth Limit: 4 Segments

Paths resolve up to 4 segments deep (root key + 3 levels of nesting):

```typescript
type State = {
  a: { b: { c: { d: { e: string } } } }
};
const ops = defineOps<State>();

ops.set("a.b.c.d", { e: "ok" });   // OK — 4 segments (limit)
// ops.set("a.b.c.d.e", "deep");   // TS Error — beyond limit

ops.raw.set("a.b.c.d.e", "deep");  // OK via escape hatch
```

**Why?** TypeScript recursive types have compile-time limits. 4 segments covers the vast majority of domain state shapes without impacting build performance.

### `Record<string, T>` Generates Wildcard Paths

Fields typed as `Record<string, T>` accept any string key:

```typescript
type State = {
  widgets: Record<string, { title: string; visible: boolean }>;
};
const ops = defineOps<State>();

// Any key is valid — Record has string index
ops.set("widgets.chart", { title: "Chart", visible: true });
ops.set("widgets.table", { title: "Table", visible: false });

// Merge to add entries without replacing
ops.merge("widgets", {
  newWidget: { title: "New", visible: true },
});
```

### Optional Fields Allow `undefined`

For optional fields (`field?: T`), the value type includes `undefined`:

```typescript
type State = { bio?: string };
const ops = defineOps<State>();

ops.set("bio", "Hello");      // OK
ops.set("bio", undefined);    // OK — but prefer unset() for clarity
ops.unset("bio");              // Recommended for removing optional values
```

### Platform and System Paths via `raw`

Typed paths cover `snapshot.data` only. For `system.*`, `input.*`, or platform namespaces (`$host.*`), use `raw`:

```typescript
const ops = defineOps<State>();

ops.raw.set("system.status", "idle");
ops.raw.set("input.amount", 100);
ops.raw.set("$host.intentSlots", { slot1: "v" });
ops.raw.merge("$host.config", { debug: true });
```

---

## Multiple Instances

Each `defineOps` call is scoped to its type parameter. Paths do not leak between instances:

```typescript
type OrderState = { orderId: string; total: number };
type UserState = { userId: string; email: string };

const orderOps = defineOps<OrderState>();
const userOps = defineOps<UserState>();

orderOps.set("orderId", "ORD-1");  // OK
userOps.set("email", "a@b.com");   // OK

// orderOps.set("email", "a@b.com");  // TS Error — "email" not in OrderState
```

---

## See Also

- **[Effect Handlers](./effect-handlers)** — Where typed ops are most commonly used
- **[Snapshot](/concepts/snapshot)** — The three patch operations explained
- **[API Reference: SDK](/api/sdk)** — Full `@manifesto-ai/sdk` API
- **[Architecture: Data Flow](/architecture/data-flow)** — How patches flow through the system
