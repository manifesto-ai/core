# Runtime Tooling Surface

> A curated contract map for Studio, agent adapters, and runtime-aware tools.

Use this guide when you are building a tool that reads Manifesto runtime state, explains action candidates, previews transitions, or inspects lineage-backed history. The owning API and SPEC pages remain the normative source; this page connects the public seams that tooling consumers usually need together.

## Contract Map

| Need | Public Seam | Owning Docs |
|------|-------------|-------------|
| Runtime schema artifact | `DomainSchema` | [Application API](/api/application), [Current Contract](/internals/spec/current-contract) |
| Tooling-only compiler sidecars | `DomainModule` | [Compiler API](/api/compiler) |
| Computed declarations | `ComputedSpec` | [Core API](/api/core), [Public Surface Inventory](/api/public-surface) |
| Action declarations | `ActionSpec` | [Core API](/api/core), [Public Surface Inventory](/api/public-surface) |
| Runtime typing seam | `state.fieldTypes`, `action.inputType`, `action.params` | [Compiler API](/api/compiler), [Current Contract](/internals/spec/current-contract) |
| Current-snapshot legality | `actions.x.available()`, `actions.x.check(...)` | [Actions and Availability](/api/actions-and-availability), [SDK API](/api/sdk) |
| Current-snapshot dry-run | `actions.x.preview(...)` | [Runtime Instance](/api/runtime), [SDK API](/api/sdk) |
| Arbitrary-snapshot read-only analysis | `@manifesto-ai/sdk/extensions` | [SDK API](/api/sdk) |
| Sealed world inspection | `getWorldSnapshot(worldId)` | [Lineage API](/api/lineage) |
| Visible runtime resume | `restore(worldId)` | [Lineage API](/api/lineage) |

## Action-Candidate Tooling Loop

Tooling should normalize a candidate operation into one typed action candidate, then reuse that same value across admission, preview, and the runtime write verb.

```typescript
const candidate = app.actions.spend.bind({ amount: 20 });
const admission = candidate.check();

if (!admission.ok) {
  console.log(admission.blockers);
}

const preview = candidate.preview();
if (preview.admitted) {
  console.log(preview.changes);
  await candidate.submit();
}
```

`preview()` is the action-candidate dry-run path. Use `bind(...input)` when your tool wants to reuse the same candidate across checks and submit.

The legality order is stable:

1. availability
2. input validation
3. dispatchability
4. admitted dry-run
5. execution or proposal submission

Unavailable actions reject dry-run with `ACTION_UNAVAILABLE`. Available actions with invalid input reject with `INVALID_INPUT` before dispatchability. Available actions with valid input but a failing fine gate reject with `INTENT_NOT_DISPATCHABLE`.

## Runtime Typing Seam

`ActionSpec.input` is the compatibility field-shape surface. Tools that need precise type information should prefer the current runtime typing seam:

- `action.params` preserves action parameter order.
- `action.inputType` carries the exact action-input `TypeDefinition` when present.
- `state.fieldTypes` carries exact state-field `TypeDefinition` data when present.

`ComputedSpec` remains the public declaration surface for derived values. Runtime consumers read computed values through snapshots; tooling consumers inspect computed declarations through the schema and graph projections.

Runtime entry points consume `DomainSchema`. `DomainModule` sidecars, including compiler-owned annotations and source maps, are for tooling and build-time inspection only.

## Snapshot Roles

| Snapshot Role | Read With | Meaning |
|---------------|-----------|---------|
| Projected runtime snapshot | `snapshot()` | Default app-facing read model |
| Current visible canonical snapshot | `inspect.canonicalSnapshot()` | Full substrate for persistence, debugging, and extension-kernel reads |
| Stored sealed world snapshot | `getWorldSnapshot(worldId)` | Historical canonical snapshot sealed by Lineage |

Use `snapshot()` for normal UI and application reads. Use `inspect.canonicalSnapshot()` when a tool needs the full substrate for extension-kernel analysis. Use `getWorldSnapshot(worldId)` to inspect a stored lineage world without changing the visible runtime.

## Lineage-Backed Inspection

For Studio-style history views, inspect stored worlds through Lineage and run read-only analysis through the SDK extension seam.

```typescript
import { getExtensionKernel } from "@manifesto-ai/sdk/extensions";

const ext = getExtensionKernel(app);
const sealed = await app.getWorldSnapshot(worldId);

if (sealed) {
  const projected = ext.projectSnapshot(sealed);
  const intent = ext.createIntent(ext.MEL.actions.spend, { amount: 20 });
  const explanation = ext.explainIntentFor(sealed, intent);

  if (explanation.kind === "admitted") {
    const simulated = ext.simulateSync(sealed, intent);
    const simulatedProjected = ext.projectSnapshot(simulated.snapshot);
    console.log(projected, simulatedProjected);
  }
}
```

Use `getWorldSnapshot(worldId)` for read-only historical inspection. Use `restore(worldId)` only when the product is intentionally resuming the visible runtime from that world. Normal tools should not call provider mutation helpers such as visible-snapshot setters.

## Studio Boundaries

`@manifesto-ai/studio-core` is projection-first and read-only. It accepts `DomainSchema` plus optional canonical snapshot, trace, lineage, and governance overlays, then returns JSON projections. It does not execute effects, apply patches, or mutate runtime state.

Studio and agent tools should keep continuity in Lineage rather than inventing local shadow history. If a value matters to future computation, it belongs in Snapshot or a sealed lineage world, not in a private tool cache.

## Related Docs

- [Developer Tooling](/guides/developer-tooling)
- [SDK API](/api/sdk)
- [Lineage API](/api/lineage)
- [Studio Core API](/api/studio-core)
- [Current Contract](/internals/spec/current-contract)
