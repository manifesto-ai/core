# Frequently Asked Questions

> **Last Updated:** 2025-12

---

## General

### What is Manifesto?

Manifesto is a semantic state layer for building AI-governed applications with deterministic computation and full accountability. It separates pure computation (Core) from effect execution (Host) and governance (World).

> See [README](../README.md)

### How is this different from Redux/Zustand?

| Aspect | Manifesto | Redux/Zustand |
|--------|-----------|---------------|
| **Computation** | Pure, deterministic | Mixed with side effects |
| **Effects** | Explicit declarations | Thunks/middleware |
| **Governance** | Built-in authority system | Not included |
| **AI-native** | Designed for AI agents | Not specifically |
| **Accountability** | Full audit trail | Not built-in |

**Bottom line:** Use Redux/Zustand for simple UI state. Use Manifesto when you need deterministic computation, AI governance, or full accountability.

### Is this production-ready?

**Current status:** Beta

| Aspect | Status |
|--------|--------|
| API stability | Mostly stable |
| Documentation | In progress |
| Test coverage | High |
| Production usage | Early adopters |

---

## Architecture & Design

### Why no `resume()` API?

**Short answer:** `resume()` implies hidden suspended execution context. We don't have hidden state.

**Longer answer:** Traditional effect systems suspend execution and resume later:

```typescript
// Traditional (not us)
const continuation = core.computeUntilEffect(snapshot, intent);
const result = await executeEffect(continuation.effect);
core.resume(continuation, result);  // ← Hidden state!
```

Our model has no suspended context:

```typescript
// Manifesto
result = compute(schema, snapshot, intent);  // Complete
// ... execute effects, apply patches ...
result = compute(schema, snapshot, intent);  // Fresh evaluation
```

**Why this matters:**
- Crash recovery is trivial (no continuation to lose)
- Debugging is easier (no hidden execution stack)
- Serialization is simple (just Snapshot)

> See [FDR-003](./packages/core/FDR.md#fdr-003) for full rationale.

### Why can't I use array indices in paths?

**Short answer:** Array indices are positional, not semantic. We recommend using semantic identifiers.

**The problem with indices:**

```typescript
// Dangerous: Index-based
path: "/data/todos/0/completed"

// What happens when:
// - Item 0 is deleted?
// - Items are reordered?
// - New item is inserted at 0?
```

**Our recommended approach:**

```typescript
// Safe: ID-based (using record)
state: {
  todos: z.record(z.string(), TodoSchema)
}
path: "/data/todos/abc123/completed"

// Item identity is stable regardless of order
```

### Why isn't this event sourcing?

**Short answer:** Event sourcing stores *what happened*. We store *what was intended* and *what resulted*.

| Aspect | Event Sourcing | Manifesto |
|--------|---------------|-----------|
| Stored | Events (facts) | Intents + Worlds |
| Replay | Replay events | Replay intents |
| Authority | Events are authoritative | World is authoritative |
| Granularity | Per-event | Per-intent |

**When event sourcing makes sense:** Audit trails, temporal queries, CQRS

**When Manifesto makes sense:** AI agent governance, deterministic computation, semantic state

### Why separate Core from Host?

**Short answer:** Testability, determinism, and separation of concerns.

**Benefits:**
- Core can be tested without mocks (it's pure)
- Same Core works in browser, Node, edge
- Effects are explicit and auditable
- Crash recovery is trivial (just re-run Core)

---

## Usage

### How do I handle errors in effects?

**Principle:** Errors are values, not exceptions.

```typescript
// Wrong: Throwing
async function fetchUserHandler(params) {
  const response = await fetch(`/users/${params.id}`);
  if (!response.ok) throw new Error('Not found');  // Don't do this!
  return { ok: true, patches: [] };
}

// Right: Return error as result
async function fetchUserHandler(params) {
  try {
    const response = await fetch(`/users/${params.id}`);
    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}`,
        patches: [
          { op: 'set', path: '/data/error', value: `Failed: ${response.status}` }
        ],
      };
    }
    const user = await response.json();
    return {
      ok: true,
      patches: [
        { op: 'set', path: '/data/user', value: user },
        { op: 'set', path: '/data/error', value: null }
      ],
    };
  } catch (e) {
    return {
      ok: false,
      error: e.message,
      patches: [{ op: 'set', path: '/data/error', value: e.message }],
    };
  }
}
```

> See [Host GUIDE](./packages/host/GUIDE.md)

### How do I test Flows?

**Core is pure, so testing is straightforward:**

```typescript
import { createCore, createSnapshot } from '@manifesto-ai/core';

test('flow produces expected patches', async () => {
  const core = createCore();
  const snapshot = createSnapshot(schema);
  const intent = { type: 'addTodo', input: { title: 'Test' }, intentId: 'i_1' };

  const result = await core.compute(schema, snapshot, intent);

  expect(result.patches).toContainEqual(
    expect.objectContaining({
      op: 'add',
      path: expect.stringContaining('/todos'),
    })
  );
});
```

**No mocks needed for Core testing.** Effects are just declarations.

### Can I use this with React/Vue/Svelte?

**Yes.** Core is framework-agnostic. We provide React bindings:

| Framework | Package | Status |
|-----------|---------|--------|
| React | `@manifesto-ai/react` | Stable |
| Vue | - | Planned |
| Svelte | - | Planned |

For Vue/Svelte, use `@manifesto-ai/bridge` directly.

---

## Performance

### Is re-evaluating the entire Flow on every compute expensive?

**It depends, but usually no.**

**Why it's often fine:**
- Flows are declarative data, not imperative code
- State-guarded conditions short-circuit quickly
- Computed values are cached within a single compute

**When it might matter:**
- Very deep Flows (100+ nodes)
- Very frequent intents (1000+/sec)

**Mitigation strategies:**
1. Use guards to short-circuit early
2. Break large Flows into smaller, focused ones
3. Use computed values for expensive derivations
4. Profile before optimizing

### How does this scale?

**Current model (v1.0):** Single-writer per Snapshot lineage

| Scenario | Works Well | Consider Alternatives |
|----------|------------|----------------------|
| Single user, complex state | Yes | - |
| Multi-user, partitioned state | Yes | - |
| Multi-user, shared state | Carefully | Use optimistic locking |
| High-frequency updates | Carefully | Batch patches |

---

## Migration & Integration

### Can I migrate incrementally from Redux?

**Yes, we recommend incremental migration:**

1. **Phase 1:** Add Manifesto alongside Redux
2. **Phase 2:** Migrate one domain/feature at a time
3. **Phase 3:** Remove Redux

```typescript
// Coexistence example
function App() {
  return (
    <ReduxProvider store={reduxStore}>
      <ManifestoApp.Provider>
        {/* Some components use Redux, some use Manifesto */}
        <LegacyFeature />  {/* Redux */}
        <NewFeature />     {/* Manifesto */}
      </ManifestoApp.Provider>
    </ReduxProvider>
  );
}
```

### Does this work with any database?

**Core doesn't care about persistence.** Host handles all IO.

You can use:
- PostgreSQL, MongoDB, DynamoDB, etc.
- REST APIs, GraphQL, gRPC
- Local storage, IndexedDB
- Anything that your effect handlers can talk to

---

## Troubleshooting

### My Flow runs twice / produces duplicate effects

**This is expected behavior.** Flows are re-entrant by design.

**Solution:** Guard your patches and effects with state conditions:

```typescript
// Wrong: Unconditional
flow: () => flow.effect("api.init", {})

// Right: State-guarded
flow: ({ state }) =>
  guard(expr.not(state.initialized), [
    flow.patch("set", "/data/initialized", true),
    flow.effect("api.init", {}),
  ])
```

> See [Host FDR](../packages/host/docs/FDR.md)

### Snapshot version keeps incrementing unexpectedly

**Check:**
1. Are you clearing requirements after execution?
2. Is there an infinite loop in your Flow?
3. Are multiple Hosts running against the same Snapshot?

**Debug:**

```typescript
host.registerEffect("*", async ({ params, requirement }) => {
  console.log("Effect executed:", requirement.effect.type);
  return { ok: true, patches: [] };
});
```

### Effect handler not being called

**Check:**
1. Is the effect type registered exactly as declared?
2. Is the effect being declared in the Flow?
3. Are there pending requirements?

**Debug:**

```typescript
const result = await core.compute(schema, snapshot, intent);
console.log("Requirements:", result.requirements);
// Should show your effect
```

---

## Contributing

### How do I propose a new feature?

1. Check if it's already discussed in [Issues](https://github.com/manifesto-ai/core/issues)
2. If significant, open an RFC (see [GOVERNANCE.md](./GOVERNANCE.md))
3. If minor, open an issue first to discuss

### Can I implement Manifesto in another language?

**Yes!** The SPECs are language-agnostic.

| Language | Status | Maintainer |
|----------|--------|------------|
| TypeScript | Official | Core team |
| Python | Planned | - |
| Rust | Planned | - |

If you're interested in creating an implementation, please reach out!

---

## Still Have Questions?

- [GitHub Issues](https://github.com/manifesto-ai/core/issues) — Bug reports
- [GitHub Discussions](https://github.com/manifesto-ai/core/discussions) — General questions

---

*End of FAQ*
