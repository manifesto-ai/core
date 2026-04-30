# Actions and Intents

> An action describes a transition; an intent requests that transition.

Define actions in MEL. In TypeScript, submit typed action candidates from `app.actions.*`.

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
const result = await app.actions.add.submit(3);

if (result.ok) {
  console.log(result.after.state.count);
}
```

`submit()` resolves with a mode-specific result. The requested change does not return through a hidden side channel.

## Object-Style Binding

When it is clearer for your app code, use the keyed form:

```typescript
await app.actions.add.submit({ amount: 3 });
```

## Common Mistake

Do not dispatch raw string action names as your app-facing contract. Prefer `app.actions.someAction.submit(input)`.

## Next

Learn what the dispatch result contains in [Reading Snapshots](./reading-snapshots). For deeper intent semantics, read [Intent](/concepts/intent).
