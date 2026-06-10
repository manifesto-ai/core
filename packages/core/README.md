# @manifesto-ai/core

> **Core** is the pure semantic calculator of Manifesto. It computes state transitions deterministically with no side effects.

---

## What is Core?

Core is responsible for evaluating domain semantics. Given a schema, snapshot, intent, and context, it computes what patches and requirements should result—but never executes them.

Most app developers should start with `@manifesto-ai/sdk`, not this package.
The direct Core examples below are for custom runtime authors, test harnesses,
and developer tooling that needs the pure compute/apply boundary.

```typescript
const app = createManifesto<TodoDomain>(TodoMel, effects).activate();
await app.action.addTodo.submit("Review docs");
console.log(app.snapshot().state.todos);
```

If you are deciding where to start:

| Goal | Start Here |
|------|------------|
| Build a web app, backend route, script, or trusted agent | `@manifesto-ai/sdk` and the main Guide |
| Fulfill API/database work from MEL effects | SDK effect handlers |
| Add approval, audit history, or restore | Lineage/Governance after the base runtime works |
| Test pure domain computation or build runtime tooling | This Core package |

In the Manifesto architecture:

```
Host -> CORE -> ComputeResult
           |
    Computes patches & requirements
    (pure, no IO, deterministic)
```

---

## What Core Does

| Responsibility | Description |
|----------------|-------------|
| Compute state transitions | Given (schema, snapshot, intent, context), produce patches and requirements |
| Apply patches | Transform snapshots by applying patch operations |
| Validate schemas | Check DomainSchema structure for correctness |
| Explain values | Trace why a computed value has its current result |

---

## What Core Does NOT Do

| NOT Responsible For | Who Is |
|--------------------|--------|
| Execute effects | Host |
| Perform IO (network, filesystem) | Host |
| Persist snapshots | Host |
| Add optional approval/history protocols | `@manifesto-ai/governance` + `@manifesto-ai/lineage` |
| Handle UI/event bindings | SDK |

---

## Installation

Install Core directly only when you need direct compute fixtures, custom
runtime internals, or low-level tooling. App code gets Core through
`@manifesto-ai/sdk`.

```bash
npm install @manifesto-ai/core
# or
pnpm add @manifesto-ai/core
```

---

## Direct Core Fixture

```typescript
import { createCore, createSnapshot, createIntent } from "@manifesto-ai/core";
import type { Context, DomainSchema } from "@manifesto-ai/core";

// Create core instance
const core = createCore();

// Define a simple schema (provided by App or authored manually)
const schema: DomainSchema = {
  id: "example:counter",
  version: "1.0.0",
  hash: "example-hash",
  types: {},
  state: {
    fields: {
      count: { type: "number", required: true, default: 0 },
    },
  },
  computed: {
    fields: {
      "count": {
        deps: ["count"],
        expr: { kind: "get", path: "count" },
      },
    },
  },
  actions: {
    increment: {
      flow: {
        kind: "patch",
        op: "set",
        path: [{ kind: "prop", name: "count" }],
        value: {
          kind: "add",
          left: { kind: "get", path: "count" },
          right: { kind: "lit", value: 1 },
        },
      },
    },
  },
};

// Create owner-neutral ADR-027 context (deterministic inputs)
const context: Context = {
  runtime: { time: { timestamp: 0 }, random: { seed: "seed" } },
  external: {},
};

// Create initial snapshot
const snapshot = createSnapshot({ count: 0 }, schema.hash, context);

// Create intent
const intent = createIntent("increment", "intent-1");

// Compute result (pure, deterministic)
const result = await core.compute(schema, snapshot, intent, context);
const patched = core.apply(schema, snapshot, result.patches);
const namespaced = core.applyNamespaceDeltas(patched, result.namespaceDelta ?? []);
const next = core.applySystemDelta(namespaced, result.systemDelta);

console.log(result.status); // -> "complete"
console.log(next.state.count); // -> 1
```

> See [GUIDE.md](docs/GUIDE.md) for the full tutorial.

---

## Core API

### Main Exports

```typescript
// Factory
function createCore(): ManifestoCore;

// Core interface
interface ManifestoCore {
  compute(schema, snapshot, intent, context): Promise<ComputeResult>;
  apply(schema, snapshot, patches): Snapshot;
  validate(schema): ValidationResult;
  explain(schema, snapshot, path): ExplainResult;
}

// Key types
type DomainSchema = { id, version, hash, types, state, context?, computed, actions, meta? };
type Snapshot = { state, computed, system, input, meta, namespaces };
type Intent = { type, input?, intentId };
type Patch = { op: "set" | "unset" | "merge", path, value? };
type ComputeResult = { status, patches, namespaceDelta?, systemDelta, trace };
```

> See [core-SPEC.md](docs/core-SPEC.md) for the current living specification.

---

## Core Concepts

### Snapshot as Sole Medium

All communication between Core and Host happens through Snapshot. There is no hidden state, no suspended context, no continuation.

### Deterministic Computation

Given the same (schema, snapshot, intent, context), Core always produces the same result. This enables:
- Reliable testing without mocks
- Time-travel debugging
- Reproducible bug reports

### Effects as Declarations

When an action needs IO (API call, timer, etc.), Core doesn't execute it. Instead, it records an Effect as a Requirement in the snapshot. Host reads these and executes them.

---

## Relationship with Other Packages

```
SDK -> Host -> Core
```

| Relationship | Package | How |
|--------------|---------|-----|
| Used by | `@manifesto-ai/host` | Host calls compute() and apply() |
| Used by | `@manifesto-ai/sdk` | SDK orchestrates compute loop via Host |
| Schema from | SDK | SDK supplies DomainSchema (via MEL or direct) |

---

## When to Use Core Directly

**Most users don't need to use Core directly.**

Use Core directly when:
- Building a custom Host implementation
- Testing domain logic in isolation
- Building developer tools (debuggers, visualizers)

For typical usage, see [`@manifesto-ai/sdk`](../sdk/) — the recommended entry point. For explicit governance, see [`@manifesto-ai/lineage`](../lineage/) and [`@manifesto-ai/governance`](../governance/).

---

## Documentation

| Document | Purpose |
|----------|---------|
| [GUIDE.md](docs/GUIDE.md) | Direct Core fixture guide for tests, custom runtimes, and tooling |
| [core-SPEC.md](docs/core-SPEC.md) | Current living specification |
| [VERSION-INDEX.md](docs/VERSION-INDEX.md) | Current and historical document map |
| [FDR-v1.0.0.md](docs/FDR-v1.0.0.md) | Historical design rationale |

---

## License

[MIT](../../LICENSE)
