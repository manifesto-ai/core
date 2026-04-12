# Governed Todo React Example

This example shows a real governed UI flow around `waitForProposal()`.

- `addTodo`, `toggleTodo`, and `setFilter` use `proposeAsync()` but auto-approve immediately.
- `removeTodo` and `clearCompleted` also use `proposeAsync()`, but policy leaves them in `evaluating` until a reviewer decides.
- The requester calls `waitForProposal()` after every submission, so destructive actions surface as `timed_out` until the reviewer queue settles them.
- The reviewer panel then calls `approve()` or `reject()` and re-observes the same proposal with `waitForProposal()` to normalize the terminal outcome.

## Run

```bash
pnpm install
pnpm --filter @manifesto-ai/example-todo-governed-react dev
```

## What to try

1. Add a todo and watch the settlement log report `completed`.
2. Delete that todo and watch the requester side report `timed_out`.
3. Approve or reject the proposal from the reviewer panel and watch the same proposal update to `completed` or `rejected`.
