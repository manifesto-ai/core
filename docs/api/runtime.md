# Runtime Instance

> The activated runtime handle is what app, route, UI, and agent code calls.

## Everyday App Surface

The base runtime returned by `createManifesto(...).activate()` is usually used
through this small surface:

| API | Use For |
|-----|---------|
| `snapshot()` | Read app-facing state |
| `action.<name>` | Submit typed actions and check current legality |
| `observe.state(selector, listener)` | React to selected Snapshot values |
| `observe.event(event, handler)` | Subscribe to compact `submission:*` lifecycle telemetry |
| `dispose()` | Release the runtime and stop future submit calls |

## Tooling And Inspection Surface

Reach for these when building UI capability lists, agent adapters, Studio-style
tools, persistence, or deep debugging:

| API | Use For |
|-----|---------|
| `getAction(name)` | Resolve a declared action handle from a runtime string action id |
| `inspect.action(name)` | Inspect public action contract |
| `inspect.availableActions()` | Read action info values available in the current visible state |
| `inspect.graph()` | Inspect the schema graph |
| `inspect.schemaHash()` | Read the current schema hash |
| `inspect.canonicalSnapshot()` | Read the full internal snapshot for persistence/debug tooling |

## Typical Loop

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import TodoMel from "./domain/todo.mel";
import type { TodoDomain } from "./domain/todo.domain";

const app = createManifesto<TodoDomain>(TodoMel, {}).activate();

const result = await app.action.addTodo.submit("Read runtime docs");

if (result.ok && result.status === "settled" && result.outcome.kind === "ok") {
  console.log(result.after.state.todos);
}

console.log(app.snapshot().computed.activeCount);
```

Treat `inspect.availableActions()` and `action.<name>.available()` as
current-snapshot reads only. They are not durable capability tokens. The active
runtime still revalidates legality when it submits work.

Use `getAction(name)` when tooling receives an action id dynamically:

```typescript
const handle = app.getAction(actionId);

if (handle) {
  await handle.submit(...argsFromTooling);
}
```

`getAction(name)` checks only whether the action is declared by the schema. It
returns `undefined` for unknown action names and returns a handle for declared
actions even when they are currently unavailable. Broad tooling runtimes still
see the nullable dynamic handle type, so guard the lookup before submitting.

`action.<name>.preview(...input)` is the non-mutating dry-run step after admission checks. It returns the next app-facing snapshot, dry-run requirements, current action availability changes, sorted `changedPaths`, and may also expose optional inspection-only diagnostics.

## Legality Ladder

The intended public decision order is:

1. availability via `action.<name>.available()`
2. blocker reads via `action.<name>.check(...input)`
3. dry-run via `action.<name>.preview(...input)`
4. write via `action.<name>.submit(...input)`

`check()` preserves first-failing-layer ordering. `preview()` is non-mutating and does not publish state. `submit()` revalidates at the runtime write boundary.

## Advanced: Approval/History Runtimes

Approval/history packages keep the same write verb but change the result type:

| Runtime | Write Verb |
|---------|------------|
| Base SDK | `action.<name>.submit(...args)` returning `BaseSubmissionResult` |
| History runtime | `action.<name>.submit(...args)` returning `LineageSubmissionResult` with `world` and `report` |
| Approval runtime | `action.<name>.submit(...args)` returning pending `GovernanceSubmissionResult`; observe settlement with `pending.waitForSettlement()` or `app.waitForSettlement(ref)` |

Use the base runtime until approval, history restore, branch/head history, or
sealing is a product requirement.

Legality query meaning is preserved across runtime modes. Base, history, and
approval runtimes all use the same action submit path. Approval differs by
returning a durable `ProposalRef` first; settlement is observed later through the
result-bound waiter or the runtime's `waitForSettlement(ref)` re-attachment
surface.

For failure observation, use report helpers for per-attempt outcomes, the
Snapshot system error field for current runtime error state, and full internal
`namespaces.host` only for Host/effect diagnostics.

If a helper needs one shared runtime, keep it on action handles and
`submit()`. Execution helpers should accept `ManifestoApp<T, Mode>` or a
concrete advanced runtime instance instead of assuming older root write verbs.

## Next

- Understand raw intent escape hatches in [Intents](./intents)
- Read state in [Snapshots and Subscriptions](./snapshots-and-subscriptions)
- Inspect action gates in [Actions and Availability](./actions-and-availability)
