# SDK Guide

> Practical guide for the activation-first `@manifesto-ai/sdk` path.

> **Current Contract Note:** This guide follows the current SDK v5 living
> contract. `createManifesto()` returns a composable manifesto, runtime verbs
> appear only after `activate()`, and the app-facing write path is
> `action.<name>.submit(...)`.

## 1. Build The Activation Lifecycle

```typescript
import { createManifesto } from "@manifesto-ai/sdk";

const manifesto = createManifesto<CounterDomain>(domainSchema, {});
const app = manifesto.activate();

const admission = app.action.increment.check();
const preview = app.action.increment.preview();
const result = await app.action.increment.submit();

const canIncrement = app.action.increment.available();
const available = app.inspect.availableActions();
const metadata = app.action.increment.info();
const dynamic = app.getAction("increment");
const snapshot = app.snapshot();
const canonical = app.inspect.canonicalSnapshot();
const graph = app.inspect.graph();
```

This is the normal SDK lifecycle:

1. create one composable manifesto
2. activate it once
3. submit typed action candidates from `action.*`
4. optionally query admission, availability, metadata, or preview
5. read the next terminal Snapshot

`createManifesto()` does not return a ready-to-run runtime instance. The
activated app is the canonical public surface.

`snapshot()` is the normal projected read for app code.
`inspect.canonicalSnapshot()` is the explicit full-substrate read for
persistence-aware or infrastructure-aware debugging.

---

## 2. Bind Typed Action Candidates

```typescript
await app.action.increment.submit();
await app.action.add.submit(3);
await app.action.addTodo.submit("Review docs", "todo-1");
await app.action.configure.submit({ enabled: true, label: "Review" });
```

`action.*` is typed from the activated runtime's domain surface.

Use `bind(...input)` when a tool or UI wants to reuse the same candidate:

```typescript
const candidate = app.action.addTodo.bind("Review docs", "todo-1");

candidate.check();
candidate.preview();
await candidate.submit();
```

Raw Intent access is still available for protocol bridges:

```typescript
const intent = candidate.intent();
```

Treat that as a low-level escape hatch, not as the ordinary app path.

Use root `getAction(name)` when tooling receives an action id dynamically:

```typescript
const handle = app.getAction(actionId);

if (handle) {
  await handle.submit(...argsFromTooling);
}
```

`getAction(name)` returns `undefined` only when the schema does not declare the
action. A declared but currently unavailable action still returns a handle; call
`available()`, `check()`, `preview()`, or `submit()` to evaluate current legality.

---

## 3. Inspect The Runtime Contract

```typescript
const allAvailable = app.inspect.availableActions();
const addTodo = app.action.addTodo.info();
const same = app.inspect.action("addTodo");

console.log(addTodo.parameters);
console.log(addTodo.description);
console.log(same.annotations);
```

Use `info()` or `inspect.action()` when an adapter, model-facing tool, or UI
needs the public action contract without maintaining a parallel registry.

`action.x.available()` answers “what is legal right now?”
`action.x.check(input)` answers “is this bound candidate admitted?”

---

## 4. Preview Outcomes

```typescript
const preview = app.with({ diagnostics: "summary" }).action.increment.preview();

if (preview.admitted) {
  console.log(preview.after);
  console.log(preview.changes);
  console.log(preview.newAvailableActions);
}
```

`preview()` performs a non-committing dry-run against the current canonical
snapshot and returns projected before/after snapshots, requirements, new
availability, sorted `changes`, and optional debug-grade diagnostics. Treat
`changes` and diagnostics as explanation/debug output rather than the branching
API.

---

## 5. Use Execution Views When Tooling Needs More Context

```typescript
const tenantApp = app.with({
  context: { tenantId: "acme", locale: "ko-KR" },
  report: "full",
});

const result = await tenantApp.action.increment.submit();

if (result.ok && result.status === "settled" && result.outcome.kind === "ok") {
  console.log(result.after.state);
  console.log(result.report);
}

if (!result.ok) {
  console.log(result.admission.code);
}
```

`context()` returns the current flat external context. `injectContext(next)`
and `updateContext(updater)` full-replace it for future transitions without
triggering computation by themselves. `with({ context })` creates a request-local
execution view without mutating the source runtime.

`with({ report: "none" })` suppresses the additive report payload.
`with({ report: "summary" })` and `with({ report: "full" })` let tooling keep
first-party write context in band without building custom before/after wrappers.

SDK users never pass Core's nested `{ runtime, external }` context envelope.
The runtime maps public context values to `Context.external` and materializes
`Context.runtime` at preview/submit call-entry.

For failure observation, keep the surfaces distinct:

- use the submit result for this execution attempt
- use `snapshot().system.lastError` for the current semantic error state
- use canonical `namespaces.host.lastError` only for deep Host/effect diagnostics

---

## 6. Observe And Read

```typescript
const off = app.observe.state(
  (snapshot) => snapshot.state.count,
  (next, prev) => {
    console.log("Count changed:", prev, next);
  },
);

const offSettled = app.observe.event("submission:settled", (event) => {
  console.log("Settled action:", event.action);
});
```

State observers are the main render path. Telemetry events are the main
lifecycle path. Together they cover most v5 submit integrations.

If you need effect-level instrumentation, keep the effect handlers small and
let them return patches that describe the visible result.

---

## 7. Activation Is One-Shot

```typescript
const manifesto = createManifesto<CounterDomain>(domainSchema, {});
const app = manifesto.activate();
```

After activation:

- runtime verbs exist on `app`
- the composable manifesto cannot be activated again
- there is no path back to the pre-activation phase

---

## 8. `@manifesto-ai/sdk/extensions`

The current post-activation extension seam is:

```typescript
import { getExtensionKernel } from "@manifesto-ai/sdk/extensions";

const ext = getExtensionKernel(app);
const root = ext.getCanonicalSnapshot();
const intent = app.action.increment.bind().intent();

if (intent) {
  const simulated = ext.simulateSync(root, intent);
  const projected = ext.projectSnapshot(simulated.snapshot);
  console.log(projected.state);
}
```

Use this seam when you need:

- arbitrary-snapshot dry-runs after activation
- availability checks against hypothetical canonical snapshots
- pure projection of hypothetical canonical snapshots back to public `Snapshot`
- helper/tool authoring without importing the full provider seam

The first-party `createSimulationSession(app)` helper is built directly on this
seam.

---

## 9. Decorator / provider authoring seam

Use `@manifesto-ai/sdk/provider` only when you are composing new decorators or
provider-level runtime wrappers.

The stable authoring seam is the activation/runtime composition layer:

- `RuntimeKernel`
- `RuntimeKernelFactory`
- `attachRuntimeKernelFactory()`
- `createBaseRuntimeInstance()`
- `getRuntimeKernelFactory()`
- `getActivationState()`
- `activateComposable()`
- `assertComposableNotActivated()`

For decorators that need hypothetical planning or availability checks against
non-live state, `RuntimeKernel` also exposes pure arbitrary-snapshot helpers.
These operate on caller-provided canonical snapshots. They do not publish,
commit, or mutate the runtime's visible snapshot.

App-facing integrations should stay on `@manifesto-ai/sdk`.

---

## 10. Governed Composition Direction

Stay on the SDK when:

- you need the present-only base runtime
- Snapshot reads, observers, availability queries, and action metadata inspection are enough
- you do not need lineage or governance semantics

The public direction for governed composition is:

`createManifesto() -> withLineage() -> withGovernance() -> activate()`

Those runtime contracts belong to the owning Lineage and Governance packages.
This guide intentionally focuses on the landed base SDK contract.

---

## 11. Related Docs

- [SDK README](../README.md)
- [SDK Specification](sdk-SPEC.md)
- [SDK Version Index](VERSION-INDEX.md)
- [SDK API](../../../docs/api/sdk.md)
- [API Index](../../../docs/api/index.md)
- [World Records and Governed Composition](../../../docs/concepts/world.md)
- [Tutorial](../../../docs/tutorial/)
