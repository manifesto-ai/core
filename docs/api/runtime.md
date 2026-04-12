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
| `simulate(action, ...input)` | Dry-run against the current runtime state |
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

## Legality Ladder

The intended public decision order is:

1. availability via `getAvailableActions()` / `isActionAvailable()`
2. blocker or explanation reads via `getIntentBlockers()`, `whyNot()`, or `explainIntent()`
3. admitted dry-run via `simulate()`
4. execution via the runtime's write verb

## Decorated Runtimes

Decorators change the write verb:

| Runtime | Write Verb |
|---------|------------|
| Base SDK | `dispatchAsync(intent)` |
| Lineage runtime | `commitAsync(intent)` |
| Governed runtime | `proposeAsync(intent)`, then `approve()` / `reject()` when policy requires review |

Use the base runtime until approval, continuity, restore, branch/head history, or sealing is a product requirement.

Legality query meaning is preserved across decorators. Base and lineage runtimes keep event payloads plus stable rejection codes as the official machine-readable execution result surface. Governed runtimes additionally expose `waitForProposal(app, proposalOrId, options?)` from `@manifesto-ai/governance` when a caller wants a normalized proposal-settlement value such as `completed`, `failed`, `rejected`, `superseded`, `pending`, or `timed_out`.

## Next

- Build intents in [Intents](./intents)
- Read state in [Snapshots and Subscriptions](./snapshots-and-subscriptions)
- Inspect action gates in [Actions and Availability](./actions-and-availability)
