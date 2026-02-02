# Learn Manifesto

Welcome to the Manifesto tutorial series. These step-by-step guides will teach you how to build applications with Manifesto, from simple counters to complex multi-step workflows.

---

## Understanding the Compute Loop

Before diving into tutorials, it's essential to understand how Manifesto processes actions. The **compute loop** is the heart of every Manifesto application.

### The Loop Diagram

```
compute(snapshot, intent)
        │
        ▼
    Patches[]
        │
        ▼
apply(snapshot, patches)
        │
        ▼
    snapshot'
        │
        ▼
compute(snapshot', intent)  ← Loop continues until no more changes
        │
        ▼
      ...
```

When you trigger an action:
1. **compute()** evaluates the action against the current snapshot
2. It produces **patches** (state changes to apply)
3. **apply()** creates a new snapshot with those patches
4. The loop **repeats** with the new snapshot
5. This continues **until no more patches are generated**

### Why Guards Are Needed

Without guards, patches would re-apply infinitely. Consider this naive action:

```mel
action increment() {
  patch count = add(count, 1)
}
```

What happens:
- Cycle 1: count = 0 → patch → count = 1
- Cycle 2: count = 1 → patch → count = 2
- Cycle 3: count = 2 → patch → count = 3
- ... **forever!**

The patch always applies because nothing stops it from running again.

### The Solution: Guards

For **per-intent** idempotency, use `onceIntent`. It stores guard state in the platform `$mel` namespace, so you don't need extra schema fields:

```mel
action increment() {
  onceIntent {
    patch count = add(count, 1)
  }
}
```

If you need an explicit guard field (e.g., custom conditions tied to domain state), use `once()`:

```mel
action increment() {
  // requires: state { incrementIntent: string | null = null }
  once(incrementIntent) {
    patch incrementIntent = $meta.intentId
    patch count = add(count, 1)
  }
}
```

Now:
- Cycle 1: guard passes → patch runs
- Cycle 2: guard fails → **no patches**
- Loop terminates cleanly

### Key Insight

Guards break the loop by making their condition evaluate to false after first execution. With `onceIntent`, the guard is stored in `$mel`. With `once()`, the guard field (e.g., `incrementIntent`) is stored in domain state.

This is why **every action that modifies state needs a guard**. Without it, you get infinite loops.

---

## Tutorials

| Tutorial | Time | What You'll Learn |
|----------|------|-------------------|
| [Your First App](./01-your-first-app) | 15 min | Build a counter app, learn basic patterns |
| [Actions and State](./02-actions-and-state) | 20 min | State mutations, computed values, patch operations |
| [Working with Effects](./03-effects) | 25 min | External operations, services, async patterns |
| Governance (coming soon) | - | World protocol, authority, actor permissions |
| Testing (coming soon) | - | Testing Manifesto apps without mocks |

---

## Prerequisites

Before starting these tutorials, ensure you have:

- **Node.js 18+** (or Bun)
- **Basic TypeScript knowledge** (types, async/await)
- A code editor (VS Code recommended)
- A package manager (npm, pnpm, or bun)

---

## Learning Path

### Beginner Path

If you're new to Manifesto, follow the tutorials in order:

1. **Your First App** - Build a working counter to understand the core loop
2. **Actions and State** - Learn how state changes work
3. **Effects** - Connect to external APIs and services

### Intermediate Path

Once you understand the basics:

1. **Governance** - Control who can do what
2. **Testing** - Write reliable tests without mocks

### Advanced Topics

For deeper understanding, explore these after completing the tutorials:

- [Core Concepts](/concepts/) - Detailed concept explanations
- [MEL Syntax](/mel/SYNTAX) - Complete language reference
- [Architecture](/architecture/) - How the layers work together

---

## Quick Links

| Resource | Description |
|----------|-------------|
| [Quickstart](/quickstart) | 5-minute quick start |
| [Core Concepts](/concepts/) | Concept reference |
| [MEL Syntax](/mel/SYNTAX) | Language reference |
| [API Reference](/api/app) | App package API |

---

## How These Tutorials Work

Each tutorial follows a consistent structure:

1. **Goal** - What you'll build
2. **Step-by-step instructions** - Runnable code at each step
3. **Explanation** - Why things work the way they do
4. **Exercises** - Practice what you learned

Code blocks are designed to be copy-pasted and run immediately. Each step builds on the previous one.

---

## Getting Help

If you get stuck:

- Check the [Quickstart](/quickstart) for setup troubleshooting
- Review the relevant [Core Concept](/concepts/) documentation
- Visit our [Discord community](https://discord.gg/manifesto-ai)

---

**Ready to start? Let's build your first Manifesto app.**

[Start Tutorial 1: Your First App](./01-your-first-app)
