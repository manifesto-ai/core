# Runtime Instance

> The activated runtime handle is the app-facing semantic boundary.

## Base Runtime Shape

The base runtime returned by `createManifesto(...).activate()` exposes:

| API | Use For |
|-----|---------|
| `MEL` | Typed refs for actions, state, and computed values |
| `schema` | The activated `DomainSchema` |
| `createIntent(action, ...input)` | Build a typed intent |
| `dispatchAsync(intent)` | Commit an intent through the base runtime |
| `dispatchAsyncWithReport(intent)` | Get the same base execution outcome as a typed report union |
| `getSnapshot()` | Read projected app-facing state |
| `getCanonicalSnapshot()` | Read the full canonical substrate for persistence/debug tooling |
| `subscribe(selector, listener)` | React to selected Snapshot values |
| `getAvailableActions()` | Read action names available in the current Snapshot |
| `isActionAvailable(name)` | Check coarse action availability |
| `getActionMetadata(name?)` | Inspect public action contract |
| `isIntentDispatchable(action, ...input)` | Check a bound-intent gate |
| `getIntentBlockers(action, ...input)` | Inspect the first failing legality layer |
| `explainIntent(intent)` / `why(intent)` | Explain availability, dispatchability, or dry-run admission |
| `whyNot(intent)` | Return blockers, or `null` when admitted |
| `simulate(action, ...input)` | Dry-run against the current runtime state, with optional debug-grade `diagnostics.trace` |
| `simulateIntent(intent)` | Dry-run an existing typed intent without unpacking or rebinding input |
| `on(event, handler)` | Subscribe to runtime dispatch events |
| `dispose()` | Release the runtime and stop future dispatch |

## Typical Loop

```typescript
const app = createManifesto(CounterSchema, {}).activate();

const intent = app.createIntent(app.MEL.actions.increment);
const next = await app.dispatchAsync(intent);

console.log(next.data.count);
console.log(app.getAvailableActions());
```

Treat `getAvailableActions()` and `isActionAvailable()` as current-snapshot reads only. They are not durable capability tokens. The active runtime still revalidates legality when it executes or submits work.

`simulateIntent(intent)` is the admitted dry-run step when your caller already has a typed intent from `createIntent()`. `simulate(action, ...input)` remains the convenience form that binds and dry-runs in one call. Both return the projected next snapshot, dry-run requirements, new available actions, sorted `changedPaths`, and may also expose optional inspection-only `diagnostics.trace` derived from the same dry-run compute pass. SDK dry-run surfaces may normalize volatile host-time fields such as trace-node timestamps or duration so repeated reads stay stable.

## Legality Ladder

The intended public decision order is:

1. availability via `getAvailableActions()` / `isActionAvailable()`
2. blocker or explanation reads via `getIntentBlockers()`, `whyNot()`, or `explainIntent()`
3. admitted dry-run via `simulateIntent()` or `simulate()`
4. execution via the runtime's write verb

`getIntentBlockers(action, ...input)` is the pre-bind blocker read. `whyNot(intent)` is the bound-intent convenience read. They preserve the same first-failing-layer ordering, but invalid input still rejects through the explanation path before blocker projection.

## Decorated Runtimes

Decorators change the write verb:

| Runtime | Write Verb |
|---------|------------|
| Base SDK | `dispatchAsync(intent)` with additive `dispatchAsyncWithReport(intent)` |
| Lineage runtime | `commitAsync(intent)` with additive `commitAsyncWithReport(intent)` |
| Governed runtime | `proposeAsync(intent)`, then `approve()` / `reject()` when policy requires review; observe settlement with `waitForProposal()` or `waitForProposalWithReport()` |

Use the base runtime until approval, continuity, restore, branch/head history, or sealing is a product requirement.

Legality query meaning is preserved across decorators. Base and lineage runtimes now expose first-party additive write-report companions for machine-readable call results, while event payloads remain the streaming lifecycle channel. Governed runtimes intentionally do not add a direct write-report companion on the runtime itself; they use root helpers from `@manifesto-ai/governance`: `waitForProposal()` for normalized settlement state and `waitForProposalWithReport()` for stored-world settlement outcome reports.

If a helper needs one shared runtime boundary, keep it on legality/preparation reads only. SDK now exports `ManifestoLegalityRuntime<T>` for that purpose. Execution helpers should stay verb-specific and use `ManifestoDispatchRuntime<T>`, `LineageCommitRuntime<T>`, or `GovernanceProposalRuntime<T>` instead of assuming a common `dispatchAsync()` surface.

## Next

- Build intents in [Intents](./intents)
- Read state in [Snapshots and Subscriptions](./snapshots-and-subscriptions)
- Inspect action gates in [Actions and Availability](./actions-and-availability)
