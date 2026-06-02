# SDK Guide

> Practical guide for the current `@manifesto-ai/sdk` app path.

> **Current Contract Note:** This guide follows the current SDK v5 living
> contract. `createManifesto()` returns an app definition, runtime verbs
> appear only after `activate()`, and the app-facing write path is
> `action.<name>.submit(...)`.

## 1. Build The Activation Lifecycle

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import TodoMel from "./domain/todo.mel";
import type { TodoDomain } from "./domain/todo.domain";

const manifesto = createManifesto<TodoDomain>(TodoMel, {});
const app = manifesto.activate();

const admission = app.action.addTodo.check("Review docs");
const preview = app.action.addTodo.preview("Review docs");
const result = await app.action.addTodo.submit("Review docs");

const canClearCompleted = app.action.clearCompleted.available();
const snapshot = app.snapshot();
```

This is the normal SDK lifecycle:

1. create one app definition
2. activate it once
3. submit typed action handles from `action.*`
4. optionally query admission, availability, metadata, or preview
5. read the next terminal Snapshot

`createManifesto()` does not return a ready-to-run runtime instance. The
activated app is the public surface your app calls.

`snapshot()` is the normal read for app code.
`inspect.canonicalSnapshot()` is the explicit full internal snapshot read for
persistence-aware or infrastructure-aware debugging.

Keep normal app code on `action.*`, `snapshot()`, and `observe.*`. Add
inspection reads when you are building UI capability lists, model-facing tools,
or debugging infrastructure:

```typescript
const available = app.inspect.availableActions();
const metadata = app.action.addTodo.info();
const dynamic = app.getAction("addTodo");
const fullSnapshot = app.inspect.canonicalSnapshot();
const graph = app.inspect.graph();
```

---

## 2. Bind Typed Actions

```typescript
await app.action.clearCompleted.submit();
await app.action.addTodo.submit("Review docs");
await app.action.setFilter.submit("active");
await app.action.configureProject.submit({ enabled: true, label: "Review" });
```

`action.*` is typed from the activated runtime's domain surface.

Use `bind(...input)` when a tool or UI wants to reuse the same action input:

```typescript
const boundAddTodo = app.action.addTodo.bind("Review docs");

boundAddTodo.check();
boundAddTodo.preview();
await boundAddTodo.submit();
```

Raw Intent access is still available for tooling bridges:

```typescript
const intent = boundAddTodo.intent();
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
`action.x.check(input)` answers “is this bound input admitted?”

---

## 4. Preview Outcomes

```typescript
const preview = app.with({ diagnostics: "summary" }).action.addTodo.preview("Review docs");

if (preview.admitted) {
  console.log(preview.after);
  console.log(preview.changes);
  console.log(preview.newAvailableActions);
}
```

`preview()` performs a non-committing dry-run against the current runtime
state and returns before/after snapshots, requirements, new
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

const result = await tenantApp.action.addTodo.submit("Review docs");

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
- use the app-facing Snapshot's system error field for current runtime error state
- use the full internal `namespaces.host.lastError` only for deep Host/effect diagnostics

---

## 6. Observe And Read

```typescript
const off = app.observe.state(
  (snapshot) => snapshot.computed.activeCount,
  (next, prev) => {
    console.log("Active count changed:", prev, next);
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
const manifesto = createManifesto<TodoDomain>(TodoMel, {});
const app = manifesto.activate();
```

After activation:

- runtime verbs exist on `app`
- the app definition cannot be activated again
- there is no path back to the pre-activation phase

---

## 8. `@manifesto-ai/sdk/extensions`

The current post-activation extension seam is:

```typescript
import { getExtensionKernel } from "@manifesto-ai/sdk/extensions";

const ext = getExtensionKernel(app);
const root = ext.getCanonicalSnapshot();
const intent = app.action.addTodo.bind("Review docs").intent();

if (intent) {
  const simulated = ext.simulateSync(root, intent);
  const appSnapshot = ext.projectSnapshot(simulated.snapshot);
  console.log(appSnapshot.state);
}
```

Use this seam when you need:

- dry-runs against a caller-provided snapshot after activation
- availability checks against hypothetical full internal snapshots
- pure projection of hypothetical full internal snapshots back to public `Snapshot`
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
non-live state, `RuntimeKernel` also exposes pure caller-provided snapshot
helpers.
These operate on caller-provided full internal snapshots. They do not publish,
commit, or mutate the runtime's visible snapshot.

App-facing integrations should stay on `@manifesto-ai/sdk`.

---

## 10. Governed Composition Direction

Stay on the SDK when:

- you need the present-only base runtime
- Snapshot reads, observers, availability queries, and action metadata inspection are enough
- you do not need approval or durable history behavior

The public direction for approval/history composition is:

`createManifesto() -> withLineage() -> withGovernance() -> activate()`

Those runtime contracts belong to the owning approval/history packages.
This guide intentionally focuses on the landed base SDK contract.

---

## 11. Related Docs

- [SDK README](../README.md)
- [SDK Specification](sdk-SPEC.md)
- [SDK Version Index](VERSION-INDEX.md)
- [SDK API](../../../docs/api/sdk.md)
- [API Index](../../../docs/api/index.md)
- [When You Need Approval or History](../../../docs/guides/approval-and-history.md)
- [Tutorial](../../../docs/tutorial/)
