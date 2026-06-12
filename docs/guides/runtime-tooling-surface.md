# Runtime Tooling Surface

> A curated contract map for Studio, agent adapters, and runtime-aware tools.

Use this guide when you are building a tool that reads Manifesto runtime state, explains action handles, previews transitions, or inspects lineage-backed history. The owning API and SPEC pages remain the normative source; this page connects the public seams that tooling consumers usually need together.

## Contract Map

| Need | Public Seam | Owning Docs |
|------|-------------|-------------|
| Runtime schema artifact | `DomainSchema` | [Application API](/api/application), [Current Contract](/internals/spec/current-contract) |
| Tooling-only compiler sidecars | `DomainModule` | [Compiler API](/api/compiler) |
| Computed declarations | `ComputedSpec` | [Core API](/api/core), [Public Surface Inventory](/api/public-surface) |
| Action declarations | `ActionSpec` | [Core API](/api/core), [Public Surface Inventory](/api/public-surface) |
| Runtime typing seam | `state.fieldTypes`, `action.inputType`, `action.params` | [Compiler API](/api/compiler), [Current Contract](/internals/spec/current-contract) |
| Current-snapshot legality | `action.x.available()`, `action.x.check(...)` | [Actions and Availability](/api/actions-and-availability), [SDK API](/api/sdk) |
| Current-snapshot dry-run | `action.x.preview(...)` | [Runtime Instance](/api/runtime), [SDK API](/api/sdk) |
| Arbitrary-snapshot read-only analysis | `@manifesto-ai/sdk/extensions` | [SDK API](/api/sdk) |
| Sealed world inspection | `getWorldSnapshot(worldId)` | [Lineage API](/api/lineage) |
| Replay input inspection | `computeEnvelope.intent + computeEnvelope.context` on Lineage attempts or Governance proposals | [Lineage API](/api/lineage), [Governance API](/api/governance) |
| Visible runtime resume | `restore(worldId)` | [Lineage API](/api/lineage) |

## Action Tooling Loop

Tooling should normalize a requested operation into one bound action, then reuse that same value across admission, preview, and the runtime write verb.

```typescript
const boundSpend = app.action.spend.bind({ amount: 20 });
const admission = boundSpend.check();

if (!admission.ok) {
  console.log(admission.blockers);
}

const preview = boundSpend.preview();
if (preview.admitted) {
  console.log(preview.changes);
  await boundSpend.submit();
}
```

`preview()` is the action dry-run path. Use `bind(...input)` when your tool wants to reuse the same bound action across checks and submit.

The admission order is stable:

1. availability
2. input validation
3. dispatchability

After admission, `preview()` performs a non-mutating dry-run and `submit()`
uses the active runtime's submit path.

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
| App-facing runtime snapshot | `snapshot()` | Default app-facing read model |
| Current visible internal snapshot | `inspect.canonicalSnapshot()` | Full snapshot for persistence, debugging, and extension-kernel reads |
| Stored history snapshot | `getWorldSnapshot(worldId)` | Historical full snapshot sealed by Lineage |

Use `snapshot()` for normal UI and application reads. Use
`inspect.canonicalSnapshot()` when a tool needs the full internal snapshot for
extension-kernel analysis. Use `getWorldSnapshot(worldId)` to inspect a stored
history record without changing the visible runtime.

## Lineage-Backed Inspection

For Studio-style history views, inspect stored worlds through Lineage and run read-only analysis through the SDK extension seam.

```typescript
import { getExtensionKernel } from "@manifesto-ai/sdk/extensions";

const ext = getExtensionKernel(app);
const sealed = await app.getWorldSnapshot(worldId);

if (sealed) {
  const appView = ext.projectSnapshot(sealed);
  const intent = ext.createIntent(ext.refs.actions.spend, { amount: 20 });
  const explanation = ext.explainIntentFor(sealed, intent);

  if (explanation.kind === "admitted") {
    const simulated = ext.simulateSync(sealed, intent);
    const simulatedAppView = ext.projectSnapshot(simulated.snapshot);
    console.log(appView, simulatedAppView);
  }
}
```

Use `getWorldSnapshot(worldId)` for read-only historical inspection. Use
`restore(worldId)` only when the product is intentionally resuming the visible
runtime from that sealed record. Normal tools should not call provider mutation
helpers such as visible-snapshot setters.

For deterministic replay, pair the sealed base snapshot with the recorded
`computeEnvelope.intent` and full `computeEnvelope.context`. The context is
attempt/proposal metadata, not Lineage record identity: it includes both `runtime` and
`external` partitions and does not enter `snapshotHash` or `worldId`.
Application users normally never build this envelope manually; replay and audit
tools read it from Lineage attempts or Governance proposals.

## Multi-Step Simulation

`action.<name>.preview(input)` is a single-step dry run. For multi-step
trajectory exploration without committing to the live runtime, use
`createSimulationSession()` from `@manifesto-ai/sdk/extensions`:

```typescript
import { createSimulationSession, getExtensionKernel } from "@manifesto-ai/sdk/extensions";

const ext = getExtensionKernel(app);
const root = createSimulationSession(app);

// Each next() returns a NEW immutable session one step deeper.
const step1 = root.next(ext.refs.actions.increment);
const branchA = step1.next(ext.refs.actions.increment); // count = 2
const branchB = step1.next(ext.refs.actions.add, 5);    // count = 6 — branches share step1

console.log(branchA.depth);              // 2
console.log(branchB.snapshot.state);     // projected state at this branch
console.log(branchB.trajectory.length);  // 2 recorded steps (immutable)

const final = step1.finish();            // final session view of a trajectory
```

Sessions read from the canonical snapshot and record every step in an
immutable `trajectory`; sibling branches never observe each other. Nothing a
session does reaches the live runtime.

## Observing Settlement Events

The v5 event vocabulary is `submission:*` (the v4 `dispatch:*` event names,
including `dispatch:completed`, were retired with the activation-first
surface). Subscribe through `on()`:

```typescript
app.on("submission:settled", (event) => {
  // By the time submission:settled fires, the visible runtime already
  // reflects the settled state: read fresh values from app.snapshot()
  // (or inspect.canonicalSnapshot() for substrate fields).
  console.log(event.action, event.outcome.kind, event.snapshotVersion);
  console.log(app.snapshot().state);
});
```

The payload carries correlation data (`action`, `mode`, `intentId`,
`schemaHash`, `snapshotVersion`, and for decorated runtimes `worldId` /
`proposal`), not a snapshot object — the snapshot channel stays singular:
read state from the runtime, never from event payloads.

## Naming Notes

Requests phrased as `getCanonicalSnapshotAt(worldId)` map to the existing
`getWorldSnapshot(worldId)` concept; no separate alias exists.

## Studio Boundaries

`@manifesto-ai/studio-core` is projection-first and read-only. It accepts `DomainSchema` plus optional canonical snapshot, trace, lineage, and governance overlays, then returns JSON projections. It does not execute effects, apply patches, or mutate runtime state.

Studio and agent tools should keep continuity in Lineage rather than inventing local shadow history. If a value matters to future computation, it belongs in Snapshot or a sealed lineage world, not in a private tool cache.

## Related Docs

- [Developer Tooling](/guides/developer-tooling)
- [SDK API](/api/sdk)
- [Lineage API](/api/lineage)
- [Studio Core API](/api/studio-core)
- [Current Contract](/internals/spec/current-contract)
