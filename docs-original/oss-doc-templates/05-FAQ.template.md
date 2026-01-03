# Frequently Asked Questions

<!-- INSTRUCTION:
FAQ는 사실상 "비판 대응 문서"입니다.
사람들이 자주 묻는 질문, 흔한 오해, 예상되는 비판에 답합니다.
실제로 받은 질문을 기반으로 계속 업데이트하세요.
-->

> **Last Updated:** [DATE]

---

## General

### What is [PROJECT_NAME]?

[One paragraph answer. Link to README for more.]

→ See [README](./README.md)

### How is this different from [COMPETITOR/ALTERNATIVE]?

<!-- INSTRUCTION:
가장 많이 받는 질문 중 하나입니다.
객관적으로, 그러나 명확하게 차이점을 설명합니다.
-->

| Aspect | [PROJECT_NAME] | [Alternative] |
|--------|---------------|---------------|
| [Aspect 1] | [Our approach] | [Their approach] |
| [Aspect 2] | [Our approach] | [Their approach] |
| [Aspect 3] | [Our approach] | [Their approach] |

**Bottom line:** [One sentence summary of when to use which]

### Is this production-ready?

<!-- INSTRUCTION:
솔직하게 답합니다.
-->

**Current status:** [Alpha/Beta/Stable]

| Aspect | Status |
|--------|--------|
| API stability | [Stable/Unstable] |
| Documentation | [Complete/In progress] |
| Test coverage | [X%] |
| Production usage | [Yes, by X / Not yet] |

---

## Architecture & Design

### Why no `resume()` API?

<!-- INSTRUCTION:
Manifesto 특유의 설계 결정에 대한 질문.
FDR에서 가져오되, 간결하게.
-->

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

→ See [FDR-H003](./packages/host/FDR.md#fdr-h003) for full rationale.

### Why can't I use array indices in paths?

<!-- INSTRUCTION:
제약사항에 대한 질문.
왜 그런 제약이 있는지 설명.
-->

**Short answer:** Array indices are positional, not semantic. We use semantic identifiers.

**The problem with indices:**

```typescript
// Dangerous: Index-based
path: "todos[0].completed"

// What happens when:
// - Item 0 is deleted?
// - Items are reordered?
// - New item is inserted at 0?
```

**Our approach:**

```typescript
// Safe: ID-based
path: "todos.byId.abc123.completed"

// Item identity is stable regardless of order
```

→ See [Builder GUIDE](./packages/builder/GUIDE.md#array-patterns)

### Why isn't this event sourcing?

<!-- INSTRUCTION:
기술적 대안과의 비교.
-->

**Short answer:** Event sourcing stores *what happened*. We store *what was intended* and *what resulted*.

| Aspect | Event Sourcing | [PROJECT_NAME] |
|--------|---------------|----------------|
| Stored | Events (facts) | Intents + Worlds |
| Replay | Replay events | Replay intents |
| Authority | Events are authoritative | World is authoritative |
| Granularity | Per-event | Per-intent |

**When event sourcing makes sense:** Audit trails, temporal queries, CQRS

**When we make sense:** AI agent governance, deterministic computation, semantic state

---

## Usage

### How do I handle errors in effects?

<!-- INSTRUCTION:
실용적인 "어떻게" 질문.
코드 예시 포함.
-->

**Principle:** Errors are values, not exceptions.

```typescript
// ❌ Wrong: Throwing
async function fetchUserHandler(params) {
  const response = await fetch(`/users/${params.id}`);
  if (!response.ok) throw new Error('Not found');  // Don't do this!
  return response.json();
}

// ✅ Right: Return error as patch
async function fetchUserHandler(params) {
  try {
    const response = await fetch(`/users/${params.id}`);
    const user = await response.json();
    return [
      { op: 'replace', path: '/user', value: user },
      { op: 'replace', path: '/userError', value: null }
    ];
  } catch (e) {
    return [
      { op: 'replace', path: '/user', value: null },
      { op: 'replace', path: '/userError', value: e.message }
    ];
  }
}
```

→ See [Host GUIDE](./packages/host/GUIDE.md#effect-handlers)

### How do I test Flows?

**Core is pure, so testing is straightforward:**

```typescript
import { compute } from '@[org]/core';

test('flow produces expected patches', () => {
  const snapshot = createTestSnapshot({ ... });
  const intent = { type: 'addTodo', input: { title: 'Test' } };
  
  const result = compute(schema, snapshot, intent);
  
  expect(result.patches).toContainEqual({
    op: 'add',
    path: '/todos/byId/...',
    value: expect.objectContaining({ title: 'Test' })
  });
});
```

**No mocks needed for Core testing.** Effects are just declarations.

→ See [Testing Guide](./packages/core/GUIDE.md#testing)

### Can I use this with React/Vue/Svelte?

**Yes.** Core is framework-agnostic. We provide bridges:

| Framework | Package | Status |
|-----------|---------|--------|
| React | `@[org]/react` | [Stable/Beta/Planned] |
| Vue | `@[org]/vue` | [Stable/Beta/Planned] |
| Svelte | `@[org]/svelte` | [Stable/Beta/Planned] |

→ See [Bridge packages](./packages/)

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
1. Break large Flows into smaller, focused ones
2. Use computed values for expensive derivations
3. Profile before optimizing

### How does this scale?

<!-- INSTRUCTION:
확장성 질문.
솔직하게 현재 한계와 로드맵을 설명.
-->

**Current model (v1.0):** Single-writer per Snapshot lineage

| Scenario | Works Well | Consider Alternatives |
|----------|------------|----------------------|
| Single user, complex state | ✅ | - |
| Multi-user, partitioned state | ✅ | - |
| Multi-user, shared state | ⚠️ | v2.0 will address |
| High-frequency updates | ⚠️ | Batching helps |

**Roadmap:** v2.0 will introduce optional optimistic locking and merge strategies.

---

## Migration & Integration

### Can I migrate incrementally from [EXISTING_SOLUTION]?

**Yes, we recommend incremental migration:**

1. **Phase 1:** Add [PROJECT_NAME] alongside existing solution
2. **Phase 2:** Migrate one domain/feature at a time
3. **Phase 3:** Remove old solution

→ See [Migration Guide](./MIGRATION.md)

### Does this work with [DATABASE/SERVICE]?

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
// ❌ Wrong: Unconditional
{ kind: 'patch', op: 'add', path: '/item', value: {...} }

// ✅ Right: State-guarded
{
  kind: 'if',
  cond: { kind: 'not', arg: { kind: 'get', path: '/item' } },
  then: { kind: 'patch', op: 'add', path: '/item', value: {...} }
}
```

→ See [FDR-H004](./packages/host/FDR.md#fdr-h004)

### Snapshot version keeps incrementing unexpectedly

**Check:**
1. Are you clearing requirements after execution?
2. Is there an infinite loop in your Flow?
3. Are multiple Hosts running against the same Snapshot?

→ See [Host GUIDE - Troubleshooting](./packages/host/GUIDE.md#troubleshooting)

---

## Contributing

### How do I propose a new feature?

1. Check if it's already discussed in [Issues](link) or [Discussions](link)
2. If significant, open an RFC (see [GOVERNANCE.md](./GOVERNANCE.md))
3. If minor, open an issue first to discuss

### Can I implement [PROJECT_NAME] in another language?

**Yes!** The SPECs are language-agnostic.

| Language | Status | Maintainer |
|----------|--------|------------|
| TypeScript | Official | Core team |
| [Other] | [Community/Planned] | [Who] |

If you're interested in creating an implementation, please reach out!

---

## Still Have Questions?

- 💬 [Discussions](link) — General questions
- 🐛 [Issues](link) — Bug reports
- 💡 [RFCs](link) — Feature proposals
- 📧 [Email](mailto:...) — Private inquiries

---

*End of FAQ*
