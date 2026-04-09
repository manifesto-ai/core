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

## Decorated Runtimes

Decorators change the write verb:

| Runtime | Write Verb |
|---------|------------|
| Base SDK | `dispatchAsync(intent)` |
| Lineage runtime | `commitAsync(intent)` |
| Governed runtime | `proposeAsync(intent)`, then `approve()` / `reject()` when policy requires review |

Use the base runtime until approval, continuity, restore, branch/head history, or sealing is a product requirement.

## Next

- Build intents in [Intents](./intents)
- Read state in [Snapshots and Subscriptions](./snapshots-and-subscriptions)
- Inspect action gates in [Actions and Availability](./actions-and-availability)
