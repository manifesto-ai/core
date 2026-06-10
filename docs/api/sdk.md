# @manifesto-ai/sdk

> Base runtime entry point for Manifesto apps.

## Overview

`@manifesto-ai/sdk` owns the application-facing runtime path:

```text
createManifesto(schema, effects) -> activate() -> ManifestoApp
```

Use SDK when you want:

- the shortest path to a running base runtime
- typed actions through `action.<name>`
- typed effect authoring through `@manifesto-ai/sdk/effects`
- app-facing Snapshot reads through `snapshot()`
- typed field reads through `state.<name>` and `computed.<name>`
- observer and event subscriptions through `observe`

It also exposes tooling reads when you need them:

- dynamic tooling action lookup through `getAction(name)`
- static/runtime inspection through `inspect`
- low-level post-activation simulation helpers through `@manifesto-ai/sdk/extensions`

Raw Intent construction remains available as an advanced low-level escape hatch
through `BoundAction.intent()`. It is not the primary app path.

## Everyday SDK Surface

- `createManifesto()`
- `activate()`
- activated base runtime:
  - `snapshot()`
  - `action.<name>`
  - `state.<name>.value()`
  - `state.<name>.observe(listener)`
  - `computed.<name>.value()`
  - `computed.<name>.observe(listener)`
  - `observe.state(selector, listener)`
  - `observe.event(event, listener)`
  - `dispose()`
- SDK error types
- `@manifesto-ai/sdk/effects` for typed effect authoring helpers

## Tooling And Advanced Surface

- `context()`
- `injectContext(next)`
- `updateContext(updater)`
- `with(view)`
- `getAction(name)`
- `inspect.graph()`
- `inspect.canonicalSnapshot()` for full internal snapshot reads
- `inspect.action(name)`
- `inspect.availableActions()`
- `inspect.schemaHash()`
- `@manifesto-ai/sdk/extensions` for low-level read-only simulation helpers
- `@manifesto-ai/sdk/provider` for package-author runtime seams

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
import TodoMel from "./domain/todo.mel";
import type { TodoDomain } from "./domain/todo.domain";

const app = createManifesto<TodoDomain>(TodoMel, {}).activate();

const admission = app.action.addTodo.check("Review docs");
const result = await app.action.addTodo.submit("Review docs");

if (result.ok && result.status === "settled" && result.outcome.kind === "ok") {
  console.log(result.after.state.todos);
}

app.action.clearCompleted.available();
app.state.todos.value();
app.computed.activeCount.value();
app.state.todos.observe((next, prev) => {
  console.log(prev, next);
});
app.snapshot();
console.log(admission.ok);
```

Add inspection and report detail when building UI capability lists, model-facing
tools, or debugging infrastructure:

```typescript
const info = app.action.addTodo.info();
const dynamic = app.getAction("addTodo");
const preview = app.with({ diagnostics: "summary" }).action.addTodo.preview("Review docs");
const resultWithReport = await app.with({ report: "summary" }).action.addTodo.submit("Review docs");

app.inspect.availableActions();
app.inspect.action("addTodo");
app.inspect.graph();
console.log(info.name, dynamic?.info().name, preview.admitted, resultWithReport.ok);
```

## Action Binding Forms

Action handles keep argument shape typed from the domain.

```typescript
app.action.clearCompleted.submit();
app.action.addTodo.submit("Review docs");
app.action.setFilter.submit("active");
app.action.configureProject.submit({ enabled: true, label: "Review" });
```

Rules:

- zero-parameter actions use `submit()` / `bind()`
- single-parameter actions accept the parameter value directly
- multi-parameter actions preserve ordered tuple input
- hand-authored multi-field object inputs without positional metadata are object-only bindings

`bind(...input)` returns a reusable bound action:

```typescript
const boundAddTodo = app.action.addTodo.bind("Review docs");

boundAddTodo.check();
boundAddTodo.preview();
await boundAddTodo.submit();

const rawIntent = boundAddTodo.intent();
```

Treat `rawIntent` as a low-level record. App code should prefer the bound action
methods above.

## Action Metadata And Availability

Use `info()` or `inspect.action()` when a UI, adapter, or agent needs the
runtime's public action contract without maintaining a parallel registry.

```typescript
const addTodo = app.action.addTodo.info();
const same = app.inspect.action("addTodo");
const available = app.inspect.availableActions();

console.log(addTodo.name);
console.log(addTodo.parameters);
console.log(addTodo.description);
console.log(same.annotations);
console.log(available.map((action) => action.name));
```

`action.<name>.available()` remains the coarse legality query.
`action.<name>.check(...input)` is the fine input-specific legality surface.

Treat availability reads as current-snapshot observations, not durable
capability grants. The runtime still revalidates legality at submit time.

## Preview And Submit

Use the current-state action ladder when you want one structured answer to:

- is the action available right now?
- if available, is this input admissible?
- if admitted, what would the dry-run result look like?
- if submitted, what result did the active runtime mode produce?

```typescript
const addTodo = app.action.addTodo.bind("Review docs");

const admission = addTodo.check();
if (!admission.ok) {
  console.log(admission.code, admission.blockers);
}

const preview = app
  .with({ diagnostics: "trace" })
  .action.addTodo
  .bind("Review docs")
  .preview();
if (preview.admitted) {
  console.log(preview.after.state);
  console.log(preview.changes);
}

const result = await app
  .with({ report: "full" })
  .action.addTodo
  .bind("Review docs")
  .submit();
```

Preview is non-mutating. Submit revalidates immediately before the write. The
base runtime uses this ladder directly. Optional history and approval extensions
keep the same action-handle shape and differ through result type:

- base returns a settled `BaseSubmissionResult`
- history returns a settled `LineageSubmissionResult` with sealed world data
- approval returns a pending `GovernanceSubmissionResult`; observe settlement
  with `pending.waitForSettlement()` or `app.waitForSettlement(ref)`

Use `diagnostics: "none"` and `report: "none"` when an agent/tool path needs
the smallest in-band payload.
Use `with({ report: "full" })` when the write result should carry execution
diagnostics in addition to the summary report fields.

## Observability

For top-level app-facing fields, use read handles when you want a typed current
value or direct field observer:

```typescript
const todos = app.state.todos.value();

const unsubscribeTodos = app.state.todos.observe((next, prev) => {
  console.log(prev, next);
});
```

Read handles are app-facing and read-only. Writes still go through
`action.<name>.submit(...)`.

Use `observe.state()` when you need a custom selector:

```typescript
const unsubscribe = app.observe.state(
  (snapshot) => snapshot.computed.activeCount,
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

Use `@manifesto-ai/sdk/provider` when you are composing runtime decorators on
top of the SDK. That subpath is for package
authors, not typical app code.

The current public seam includes:

- `RuntimeKernel`
- `RuntimeKernelFactory`
- activation helpers such as `attachRuntimeKernelFactory()`,
  `getRuntimeKernelFactory()`, `getActivationState()`, and
  `activateComposable()`

App-facing runtime work should stay on `@manifesto-ai/sdk`.
`snapshot()` is the default app-facing read model for application code.
`inspect.canonicalSnapshot()` is the full internal runtime snapshot for persistence,
deep debugging, and infrastructure-aware tooling.

## Extension Kernel

`@manifesto-ai/sdk/extensions` is the advanced read-only simulation surface.

Its purpose is to give helper and tool authors a safe read-only surface after
activation without exposing the full provider seam.

```typescript
import { getExtensionKernel } from "@manifesto-ai/sdk/extensions";

const ext = getExtensionKernel(app);
const root = ext.getCanonicalSnapshot();
const intent = app.action.addTodo.bind("Review docs").intent();

if (intent) {
  const explanation = ext.explainIntentFor(root, intent);
  const simulated = ext.simulateSync(root, intent);
  const appSnapshot = ext.projectSnapshot(simulated.snapshot);

  console.log(explanation.kind);
  console.log(appSnapshot.state);
}
```

The core analytical helpers on this seam are:

- `projectSnapshot()`
- `getAvailableActionsFor()`
- `isActionAvailableFor()`
- `isIntentDispatchableFor()`
- `explainIntentFor()`
- `simulateSync()`

Branching hypothetical futures stay on the same surface through
`createSimulationSession(app)`.
