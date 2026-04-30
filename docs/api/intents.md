# Intents

> In v5, ordinary callers work with action candidates; raw Intents are an advanced protocol escape hatch.

## Action Candidates

Use typed action handles from `app.actions.*`:

```typescript
const addTodo = app.actions.addTodo;
```

Do not use raw action-name strings as your app-facing write contract. Use
`app.action(name)` only when you need dynamic lookup from a known action name.

## Binding Forms

Zero-parameter action:

```typescript
const result = await app.actions.clearCompleted.submit();
```

Single-parameter action:

```typescript
const result = await app.actions.addTodo.submit("Write API docs");
```

Multi-parameter action:

```typescript
const result = await app.actions.moveTodo.submit("todo-1", "done");
```

Object-shaped action input:

```typescript
const result = await app.actions.moveTodo.submit({
  id: "todo-1",
  column: "done",
});
```

`bind(...input)` stores the same public input shape for repeated checks,
previews, or submission:

```typescript
const candidate = app.actions.addTodo.bind("Write API docs");

const admission = candidate.check();
const preview = candidate.preview();
const result = await candidate.submit();
```

## Submit Result

`submit()` resolves with a mode-specific result union.

```typescript
const result = await app.actions.addTodo.submit("Write API docs");

if (result.ok) {
  console.log(result.after.state.todos);
}
```

The action result lives in Snapshot. Do not expect a separate business return
value from the action.

Use submit options when tooling does not need the additive report payload:

```typescript
const result = await app.actions.addTodo.submit(
  "Write API docs",
  { __kind: "SubmitOptions", report: "none" },
);
```

## Before Submit

```typescript
const candidate = app.actions.addTodo.bind("");
const admission = candidate.check();

if (!admission.ok) {
  console.log("not admitted", admission.blockers);
} else {
  const preview = candidate.preview({ __kind: "PreviewOptions", diagnostics: "summary" });
  console.log(preview.admitted ? preview.changes : preview.admission.code);
  await candidate.submit();
}
```

## Raw Intent Escape Hatch

`BoundAction.intent()` exposes the packed raw `Intent` for low-level protocol
bridges. It is not the primary app path.

```typescript
const rawIntent = app.actions.addTodo.bind("Write API docs").intent();
```

Reach for this only when an extension, protocol bridge, or test needs the
serialized intent shape. App code should stay on action candidates.

## Next

- Read the submit result in [Snapshots and Subscriptions](./snapshots-and-subscriptions)
- Inspect legality in [Actions and Availability](./actions-and-availability)
- Upgrade writes in [Governed Runtime](./governed-runtime)
