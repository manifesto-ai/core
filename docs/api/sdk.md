# @manifesto-ai/sdk

> Activation-first base runtime entry point for Manifesto.

## Overview

`@manifesto-ai/sdk` owns the application-facing runtime path:

```text
createManifesto(schema, effects) -> activate() -> ManifestoApp
```

Use SDK when you want:

- the shortest path to a running base runtime
- typed action candidates through `actions.<name>`
- typed effect authoring through `@manifesto-ai/sdk/effects`
- projected Snapshot reads through `snapshot()`
- observer and event subscriptions through `observe`
- static/runtime inspection through `inspect`
- safe post-activation arbitrary-snapshot tooling through `@manifesto-ai/sdk/extensions`

Raw Intent construction remains available as an advanced protocol escape hatch
through `BoundAction.intent()`. It is not the primary app path.

## SDK-Owned Surface

- `createManifesto()`
- `activate()`
- activated base runtime:
  - `snapshot()`
  - `actions.<name>`
  - `action(name)`
  - `observe.state(selector, listener)`
  - `observe.event(event, listener)`
  - `inspect.graph()`
  - `inspect.canonicalSnapshot()`
  - `inspect.action(name)`
  - `inspect.availableActions()`
  - `inspect.schemaHash()`
  - `dispose()`
- SDK error types
- `@manifesto-ai/sdk/extensions` for safe arbitrary-snapshot read-only helpers
- `@manifesto-ai/sdk/effects` for typed effect authoring helpers
- `@manifesto-ai/sdk/provider` for decorator/provider authoring seams

## Effect Authoring Helper

The root SDK story stays centered on `createManifesto()`. If you want typed
top-level state refs when authoring effect handlers, import `defineEffects()`
from the dedicated effects subpath.

```typescript
import { defineEffects } from "@manifesto-ai/sdk/effects";
```

`defineEffects()` is an authoring helper only. It still returns a plain
`Record<string, EffectHandler>`, and handlers still return concrete `Patch[]`.

## Base Runtime Example

```typescript
import { createManifesto } from "@manifesto-ai/sdk";

const app = createManifesto<CounterDomain>(domainSchema, {}).activate();

const info = app.actions.increment.info();
const admission = app.actions.increment.check();
const preview = app.actions.increment.preview({
  __kind: "PreviewOptions",
  diagnostics: "summary",
});
const result = await app.actions.increment.submit({
  __kind: "SubmitOptions",
  report: "summary",
});

if (result.ok) {
  console.log(result.after.state.count);
}

app.actions.increment.available();
app.inspect.availableActions();
app.inspect.action("increment");
app.snapshot();
app.inspect.canonicalSnapshot();
app.inspect.graph();
console.log(info.name, admission.ok, preview.admitted);
```

## Action Candidate Binding Forms

Action handles keep argument shape typed from the domain.

```typescript
app.actions.increment.submit();
app.actions.add.submit(3);
app.actions.addTodo.submit("Review docs", "todo-1");
app.actions.configure.submit({ enabled: true, label: "Review" });
```

Rules:

- zero-parameter actions use `submit()` / `bind()`
- single-parameter actions accept the parameter value directly
- multi-parameter actions preserve ordered tuple input
- hand-authored multi-field object inputs without positional metadata are object-only bindings

`bind(...input)` returns a reusable candidate:

```typescript
const candidate = app.actions.addTodo.bind("Review docs", "todo-1");

candidate.check();
candidate.preview();
await candidate.submit();

const rawIntent = candidate.intent();
```

Treat `rawIntent` as a low-level protocol artifact. App code should prefer the
candidate methods above.

## Action Metadata And Availability

Use `info()` or `inspect.action()` when a UI, adapter, or agent needs the
runtime's public action contract without maintaining a parallel registry.

```typescript
const addTodo = app.actions.addTodo.info();
const same = app.inspect.action("addTodo");
const available = app.inspect.availableActions();

console.log(addTodo.name);
console.log(addTodo.parameters);
console.log(addTodo.description);
console.log(same.annotations);
console.log(available.map((action) => action.name));
```

`actions.<name>.available()` remains the coarse legality query.
`actions.<name>.check(...input)` is the fine bound-candidate legality surface.

Treat availability reads as current-snapshot observations, not durable
capability grants. The runtime still revalidates legality at submit time.

## Preview And Submit

Use the current-snapshot action ladder when you want one structured answer to:

- is the action available right now?
- if available, is this input admissible?
- if admitted, what would the dry-run result look like?
- if submitted, what terminal result did the active runtime law produce?

```typescript
const candidate = app.actions.spend.bind({ amount: 20 });

const admission = candidate.check();
if (!admission.ok) {
  console.log(admission.code, admission.blockers);
}

const preview = candidate.preview({ __kind: "PreviewOptions", diagnostics: "trace" });
if (preview.admitted) {
  console.log(preview.after.state);
  console.log(preview.changes);
}

const result = await candidate.submit({ __kind: "SubmitOptions", report: "full" });
```

Preview is non-mutating. Submit revalidates at the write boundary. Base,
Lineage, and Governance modes share this ladder and differ through result type:

- base returns a settled `BaseSubmissionResult`
- lineage returns a settled `LineageSubmissionResult` with sealed world data
- governance returns a pending `GovernanceSubmissionResult`; observe settlement
  with `pending.waitForSettlement()` or `app.waitForSettlement(ref)`

Use `diagnostics: "none"` and `report: "none"` when an agent/tool path needs
the smallest in-band payload.

## Observability

```typescript
const unsubscribe = app.observe.state(
  (snapshot) => snapshot.state.count,
  (next, prev) => {
    console.log(prev, next);
  },
);

const unsubscribeEvents = app.observe.event("submission:settled", (event) => {
  console.log(event.action, event.outcome.kind);
});
```

Call the returned unsubscribe functions before disposing a long-lived runtime.

## Decorator/provider authoring seam

Use `@manifesto-ai/sdk/provider` when you are composing activation-first
runtimes or authoring decorators on top of the SDK. That subpath is for package
authors, not typical app code.

The current public seam includes:

- `RuntimeKernel`
- `RuntimeKernelFactory`
- activation helpers such as `attachRuntimeKernelFactory()`,
  `getRuntimeKernelFactory()`, `getActivationState()`, and
  `activateComposable()`

App-facing runtime work should stay on `@manifesto-ai/sdk`.
`snapshot()` is the default projected read model for application code.
`inspect.canonicalSnapshot()` is the full runtime substrate for persistence,
deep debugging, and infrastructure-aware tooling.

## Extension Kernel

ADR-019 lands in the current SDK contract through
`@manifesto-ai/sdk/extensions`.

Its purpose is to give helper and tool authors a safe post-activation
arbitrary-snapshot read-only surface without exposing the full provider seam.

```typescript
import { getExtensionKernel } from "@manifesto-ai/sdk/extensions";

const ext = getExtensionKernel(app);
const root = ext.getCanonicalSnapshot();
const intent = app.actions.increment.bind().intent();

if (intent) {
  const explanation = ext.explainIntentFor(root, intent);
  const simulated = ext.simulateSync(root, intent);
  const projected = ext.projectSnapshot(simulated.snapshot);

  console.log(explanation.kind);
  console.log(projected.state);
}
```

The core analytical helpers on this seam are:

- `projectSnapshot()`
- `getAvailableActionsFor()`
- `isActionAvailableFor()`
- `isIntentDispatchableFor()`
- `explainIntentFor()`
- `simulateSync()`

Branching hypothetical futures stay on the same seam through
`createSimulationSession(app)`.
