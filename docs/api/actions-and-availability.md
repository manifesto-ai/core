# Actions and Availability

> Runtime availability is a read against the current Snapshot.

## `getAvailableActions()`

Returns action names whose `available when` gate passes in the current visible Snapshot.

```typescript
const available = app.getAvailableActions();

if (available.includes("clearCompleted")) {
  // Show a button or expose an agent tool for this step.
}
```

Do not cache this value for a long agent loop. Dispatch, approved proposal execution, or restore can change the next availability result.
Treat the returned names as observational reads, not capability tokens. Base `dispatchAsync()`, lineage `commitAsync()`, and governed `proposeAsync()` still re-check legality against the then-current runtime state, and a pending governed proposal can later be superseded if the visible head advances.

## `isActionAvailable(name)`

Checks one coarse action-family gate.

```typescript
if (app.isActionAvailable("decrement")) {
  await app.dispatchAsync(app.createIntent(app.MEL.actions.decrement));
}
```

## `getActionMetadata(name?)`

Reads the public action contract from the activated schema.

```typescript
const addTodo = app.getActionMetadata("addTodo");

console.log(addTodo.name);
console.log(addTodo.params);
console.log(addTodo.input);
console.log(addTodo.description);
console.log(addTodo.hasDispatchableGate);
```

Call without a name to inspect every action.

## Bound-Intent Legality

Availability does not know action input. Use intent explanation APIs when the candidate input matters.

```typescript
const intent = app.createIntent(app.MEL.actions.spend, { amount: 20 });
const blockers = app.whyNot(intent);

if (blockers) {
  console.log(blockers);
}
```

Legality order is stable:

1. action availability
2. input validation
3. dispatchability
4. admitted dry-run

The intended public caller ladder is:

1. `getAvailableActions()` / `isActionAvailable()` for the coarse current decision surface
2. `getIntentBlockers()` / `whyNot()` / `explainIntent()` for the first failing layer
3. `simulateIntent(intent)` when the candidate intent is already bound, or `simulate(action, ...input)` when it is not
4. the runtime write verb when you are ready to execute or submit

## Agent Pattern

Return fresh context after every tool call.

```typescript
function readAgentContext() {
  const snapshot = app.getSnapshot();

  return {
    data: snapshot.data,
    computed: snapshot.computed,
    availableActions: app.getAvailableActions().map((name) =>
      app.getActionMetadata(name),
    ),
  };
}
```

## Next

- Learn intent binding in [Intents](./intents)
- Use availability in the [AI Agents guide](/integration/ai-agents)
- Read MEL action gates in [Availability](/guide/essentials/availability)
