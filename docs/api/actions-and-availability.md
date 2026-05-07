# Actions and Availability

> Runtime availability is a read against the current Snapshot.

## Action Handles

The v5 app-facing surface exposes actions through typed handles:

```typescript
const increment = app.action.increment;
```

Each handle supports:

- `info()` for action metadata
- `available()` for coarse current availability
- `check(...input)` for first-failing-layer admission
- `preview(...input)` for a non-mutating dry run after admission checks
- `submit(...input)` for law-aware runtime ingress
- `bind(...input)` for reusable candidates and advanced raw intent access

Execution view settings such as `context`, `report`, and `diagnostics` are
selected before action handle use:

```typescript
await app.with({ report: "summary" }).action.increment.submit();
```

## Coarse Availability

`available()` checks the action-family gate in the current visible Snapshot.

```typescript
if (app.action.decrement.available()) {
  await app.action.decrement.submit();
}
```

Do not cache this value for a long agent loop. A submit, approved governed
settlement, or restore can change the next availability result.

Use `inspect.availableActions()` when tooling needs the currently available
action contracts:

```typescript
const available = app.inspect.availableActions();
```

Treat returned action info as observational reads, not capability tokens. Base,
lineage, and governed `action.<name>.submit()` calls still re-check legality
against the then-current runtime state.

## Action Metadata

Reads the public action contract from the activated schema.

```typescript
const addTodo = app.action.addTodo.info();
const same = app.inspect.action("addTodo");

console.log(addTodo.name);
console.log(addTodo.parameters);
console.log(addTodo.description);
```

## Bound-Candidate Legality

Availability does not know action input. Use `check()` when the candidate input
matters.

```typescript
const admission = app.action.spend.check({ amount: 20 });

if (!admission.ok) {
  console.log(admission.code);
  console.log(admission.blockers);
}
```

Legality order is stable:

1. action availability
2. input validation
3. dispatchability

The intended public caller ladder is:

1. `action.<name>.available()` or `inspect.availableActions()`
2. `action.<name>.check(...input)`
3. `action.<name>.preview(...input)`
4. `action.<name>.submit(...input)`

## Agent Pattern

Return fresh context after every tool call.

```typescript
function readAgentContext() {
  const snapshot = app.snapshot();

  return {
    state: snapshot.state,
    computed: snapshot.computed,
    availableActions: app.inspect.availableActions(),
  };
}
```

## Next

- Learn action binding in [Intents](./intents)
- Use availability in the [AI Agents guide](/integration/ai-agents)
- Read MEL action gates in [Availability](/guide/essentials/availability)
