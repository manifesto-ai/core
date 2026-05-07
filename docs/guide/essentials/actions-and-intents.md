# Actions and Intents

> An action describes a transition; an intent requests that transition.

Define actions in MEL. In TypeScript, submit typed action candidates from `app.action.*`.

## Define an Action

```mel
domain Counter {
  state {
    count: number = 0
  }

  action add(amount: number) {
    onceIntent {
      patch count = count + amount
    }
  }
}
```

## Submit an Action Candidate

```typescript
const result = await app.action.add.submit(3);

if (result.ok && result.status === "settled" && result.outcome.kind === "ok") {
  console.log(result.after.state.count);
}
```

`submit()` resolves with a mode-specific result. The requested change does not return through a hidden side channel.

## Input Shape

The public argument shape follows the action declaration. A scalar parameter stays positional:

```typescript
await app.action.add.submit(3);
```

If the action declares a single object-shaped input, submit that object directly:

```typescript
await app.action.configure.submit({ retries: 3, label: "daily" });
```

`submit()` does not wrap scalar inputs into `{ amount }`, and object-shaped inputs are not wrapped again into `{ input }`.

## Common Mistake

Do not dispatch raw string action names as your app-facing contract. Prefer `app.action.someAction.submit(input)`.

## Next

Learn what the dispatch result contains in [Reading Snapshots](./reading-snapshots). For deeper intent semantics, read [Intent](/concepts/intent).
