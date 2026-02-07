# @manifesto-ai/app Examples

Runnable CLI examples for the App package API.

## Prerequisites

```bash
# From monorepo root
pnpm install
pnpm build
```

## Running

```bash
cd packages/app
pnpm exec tsx examples/<example>/main.ts
```

## Examples

| # | Name | Concepts | Difficulty |
|---|------|----------|------------|
| 01 | [Counter](./01-counter/main.ts) | `createApp`, `act()`, `getState()`, `ready()`/`dispose()` | Beginner |
| 02 | [Todo List](./02-todo/main.ts) | Types, Array state, `computed`, action parameters, `$item` iteration | Beginner-Intermediate |
| 03 | [Effects](./03-effects/main.ts) | Effect handlers, error-as-patches pattern, async operations | Intermediate |
| 04 | [Subscriptions](./04-subscriptions/main.ts) | `subscribe()`, selector functions, computed subscriptions, unsubscribe | Beginner-Intermediate |
