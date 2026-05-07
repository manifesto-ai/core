# Runtime Instance

> The activated runtime handle is the app-facing semantic boundary.

## Base Runtime Shape

The base runtime returned by `createManifesto(...).activate()` exposes:

| API | Use For |
|-----|---------|
| `snapshot()` | Read projected app-facing state |
| `action.<name>` | Use typed action handles for `info`, `available`, `check`, `preview`, `submit`, and `bind` |
| `observe.state(selector, listener)` | React to selected projected Snapshot values |
| `observe.event(event, handler)` | Subscribe to compact `submission:*` lifecycle telemetry |
| `inspect.graph()` | Inspect the projected schema graph |
| `inspect.canonicalSnapshot()` | Read the full canonical substrate for persistence/debug tooling |
| `inspect.action(name)` | Inspect public action contract |
| `inspect.availableActions()` | Read action info values available in the current visible state |
| `inspect.schemaHash()` | Read the current canonical schema hash |
| `dispose()` | Release the runtime and stop future submit calls |

## Typical Loop

```typescript
const app = createManifesto(CounterSchema, {}).activate();

const result = await app.action.increment.submit();

if (result.ok && result.status === "settled" && result.outcome.kind === "ok") {
  console.log(result.after.state.count);
}

console.log(app.inspect.availableActions());
```

Treat `inspect.availableActions()` and `action.<name>.available()` as current-snapshot reads only. They are not durable capability tokens. The active runtime still revalidates legality when it submits work.

`action.<name>.preview(...input)` is the non-mutating dry-run step after admission checks. It returns the projected next snapshot, dry-run requirements, current action availability changes, sorted `changedPaths`, and may also expose optional inspection-only diagnostics.

## Legality Ladder

The intended public decision order is:

1. availability via `action.<name>.available()`
2. blocker reads via `action.<name>.check(...input)`
3. dry-run via `action.<name>.preview(...input)`
4. law-aware ingress via `action.<name>.submit(...input)`

`check()` preserves first-failing-layer ordering. `preview()` is non-mutating and does not publish state. `submit()` revalidates at the runtime write boundary.

## Decorated Runtimes

Decorators change the write verb:

| Runtime | Write Verb |
|---------|------------|
| Base SDK | `action.<name>.submit(...args)` returning `BaseSubmissionResult` |
| Lineage runtime | `action.<name>.submit(...args)` returning `LineageSubmissionResult` with `world` and `report` |
| Governed runtime | `action.<name>.submit(...args)` returning pending `GovernanceSubmissionResult`; observe settlement with `pending.waitForSettlement()` or `app.waitForSettlement(ref)` |

Use the base runtime until approval, continuity, restore, branch/head history, or sealing is a product requirement.

Legality query meaning is preserved across decorators. Base, lineage, and governed runtimes all use the v5 action-candidate submit path. Governance differs by returning a durable `ProposalRef` first; settlement is observed later through the result-bound waiter or the governance runtime's `waitForSettlement(ref)` re-attachment surface.

For failure observation, use report helpers for per-attempt outcomes, `snapshot.system.lastError` for the current semantic Snapshot error state, and canonical `namespaces.host` only for Host/effect diagnostics.

If a helper needs one shared runtime boundary, keep it on the v5 action-candidate surface. Execution helpers should accept `ManifestoApp<T, Mode>` or a concrete decorated runtime such as `LineageInstance<T>` instead of assuming a common root `dispatchAsync()` or historical `commitAsync()` surface.

## Next

- Build intents in [Intents](./intents)
- Read state in [Snapshots and Subscriptions](./snapshots-and-subscriptions)
- Inspect action gates in [Actions and Availability](./actions-and-availability)
