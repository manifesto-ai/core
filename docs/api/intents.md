# Intents

> Ordinary callers submit actions through action handles; raw Intents are an advanced low-level escape hatch.

## Action Handles

Use typed action handles from `app.action.*`:

```typescript
const addTodo = app.action.addTodo;
```

Do not use raw action-name strings as your ordinary app-facing write contract.
Use `inspect.action(name)` and `inspect.availableActions()` only for read-only
metadata or discovery. Static app writes stay on `app.action.*`.

Tooling-class callers that receive runtime action ids as strings use the root
dynamic resolver:

```typescript
const handle = app.getAction(actionId);

if (handle) {
  await handle.submit(...args);
}
```

`getAction(name)` is declared action lookup only. A returned handle still checks
availability, input validity, dispatchability, and the active runtime mode at
`check()`, `preview()`, or `submit()` time.

## Binding Forms

Zero-parameter action:

```typescript
const result = await app.action.clearCompleted.submit();
```

Single-parameter action:

```typescript
const result = await app.action.addTodo.submit("Write API docs");
```

Multi-parameter action:

```typescript
const result = await app.action.moveTodo.submit("todo-1", "done");
```

Object-shaped action input:

```typescript
const result = await app.action.moveTodo.submit({
  id: "todo-1",
  column: "done",
});
```

`bind(...input)` stores the same public input shape for repeated checks,
previews, or submission:

```typescript
const boundAddTodo = app.action.addTodo.bind("Write API docs");

const admission = boundAddTodo.check();
const preview = boundAddTodo.preview();
const result = await boundAddTodo.submit();
```

## Submit Result

`submit()` resolves with a mode-specific result union.

```typescript
const result = await app.action.addTodo.submit("Write API docs");

if (result.ok && result.status === "settled" && result.outcome.kind === "ok") {
  console.log(result.after.state.todos);
}
```

The action result lives in Snapshot. Do not expect a separate business return
value from the action.

Use an execution view when tooling does not need the additive report payload:

```typescript
const result = await app.with({ report: "none" }).action.addTodo.submit("Write API docs");
```

## Before Submit

```typescript
const boundAddTodo = app.action.addTodo.bind("");
const admission = boundAddTodo.check();

if (!admission.ok) {
  console.log("not admitted", admission.blockers);
} else {
  const preview = app
    .with({ diagnostics: "summary" })
    .action.addTodo
    .bind("")
    .preview();
  console.log(preview.admitted ? preview.changes : preview.admission.code);
  await boundAddTodo.submit();
}
```

## Raw Intent Escape Hatch

`BoundAction.intent()` exposes the packed raw `Intent` for low-level tooling
bridges. It is not the primary app path.

```typescript
const rawIntent = app.action.addTodo.bind("Write API docs").intent();
```

Reach for this only when an extension, integration bridge, or test needs the
serialized intent shape. App code should stay on action handles.

## Next

- Read the submit result in [Snapshots and Subscriptions](./snapshots-and-subscriptions)
- Inspect legality in [Actions and Availability](./actions-and-availability)
- Add approval only when needed in [Optional Approval/History Runtime](./governed-runtime)
