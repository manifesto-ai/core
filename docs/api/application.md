# Application

> Create a composable manifesto, then activate exactly one runtime handle from it.

## `createManifesto(schema, effects)`

`createManifesto()` is the SDK entry point for the base runtime.

```typescript
import { createManifesto } from "@manifesto-ai/sdk";

import todoMel from "./todo.mel";
import type { TodoDomain } from "./todo-types";

const manifesto = createManifesto<TodoDomain>(todoMel, {});
const app = manifesto.activate();
```

| Parameter | Meaning |
|-----------|---------|
| `schema` | A compiled `DomainSchema` or MEL source string |
| `effects` | A record of SDK effect handlers, keyed by effect type. You can author it directly or via `@manifesto-ai/sdk/effects`. |

`createManifesto()` returns a composable object. Runtime verbs such as `dispatchAsync()` and `dispatchAsyncWithReport()`, plus reads such as `getSnapshot()`, exist only after `activate()`.

Compiler tooling artifacts such as `DomainModule` are outside this seam. If you compile through `compileMelModule()`, pass `module.schema` to `createManifesto()`, not the whole module.

## Tooling vs Runtime

```typescript
import { compileMelModule } from "@manifesto-ai/compiler";
import { createManifesto } from "@manifesto-ai/sdk";

const result = compileMelModule(melSource, { mode: "module" });
const module = result.module!;

const manifesto = createManifesto(module.schema, {});
const annotations = module.annotations;
```

- `createManifesto()` accepts MEL source or `DomainSchema`.
- `createManifesto()` does not accept `DomainModule`.
- tooling may read `module.annotations` and `module.graph`, but runtime remains annotation-blind.
- importing a `.mel` file through the default loader/bundler path still yields schema-only output, even when the MEL source uses `@meta`.

## Activation Boundary

```typescript
const app = createManifesto(schema, effects).activate();
```

Activation owns the host loop, Snapshot, subscriptions, action refs, and typed intent creation surface.

Do not activate the same composable more than once. Create a new composable if you need a separate runtime instance.

## Decorate Before Activation

Lineage and Governance wrap the composable before it is activated.

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";
import { createInMemoryGovernanceStore, withGovernance } from "@manifesto-ai/governance";

const app = withGovernance(
  withLineage(createManifesto(schema, effects), {
    store: createInMemoryLineageStore(),
  }),
  {
    governanceStore: createInMemoryGovernanceStore(),
    bindings,
    execution,
  },
).activate();
```

The MEL domain stays the same. The activated runtime verbs, and their additive report companions when present, change with the chosen composition.

## Next

- Inspect the activated handle in [Runtime Instance](./runtime)
- Dispatch work with [Intents](./intents)
- Add approval in [Governed Runtime](./governed-runtime)
