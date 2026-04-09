# Intents

> An intent is a typed request to run one MEL action.

## Action Refs

Use typed action refs from `app.MEL.actions.*`.

```typescript
const action = app.MEL.actions.addTodo;
```

Do not use raw action-name strings as your app-facing dispatch contract.

## `createIntent(action, ...input)`

Zero-parameter action:

```typescript
const intent = app.createIntent(app.MEL.actions.clearCompleted);
```

Single-parameter action:

```typescript
const intent = app.createIntent(app.MEL.actions.addTodo, "Write API docs");
```

Multi-parameter action:

```typescript
const intent = app.createIntent(
  app.MEL.actions.moveTodo,
  "todo-1",
  "done",
);
```

Keyed binding:

```typescript
const intent = app.createIntent(app.MEL.actions.moveTodo, {
  id: "todo-1",
  column: "done",
});
```

Keyed binding is useful when parameter order would be hard to read.

## `dispatchAsync(intent)`

Dispatch commits an intent through the base runtime and resolves with the next terminal projected Snapshot.

```typescript
const snapshot = await app.dispatchAsync(
  app.createIntent(app.MEL.actions.addTodo, "Write API docs"),
);

console.log(snapshot.data.todos);
```

The action result lives in Snapshot. Do not expect a separate business return value from the action.

## Before Dispatch

```typescript
const intent = app.createIntent(app.MEL.actions.addTodo, "");
const blockers = app.whyNot(intent);

if (blockers) {
  console.log("not admitted", blockers);
} else {
  await app.dispatchAsync(intent);
}
```

## Next

- Read the dispatch result in [Snapshots and Subscriptions](./snapshots-and-subscriptions)
- Inspect legality in [Actions and Availability](./actions-and-availability)
- Upgrade writes in [Governed Runtime](./governed-runtime)
