# @manifesto-ai/builder — Foundational Design Rationale (FDR)

> **Version:** 1.0
> **Status:** Normative
> **Purpose:** Document the "Why" behind every constitutional decision in the Builder Spec

---

## Overview

This document records the foundational design decisions that shape `@manifesto-ai/builder`.

Each FDR entry follows the format:

- **Decision**: What was decided
- **Context**: Why this decision was needed
- **Rationale**: The reasoning behind the choice
- **Alternatives Rejected**: Other options considered and why they were rejected
- **Consequences**: What this decision enables and constrains

---

## FDR-B001: No String Paths

### Decision

Users MUST NOT write semantic paths as raw strings in normal usage. All state access uses typed `FieldRef<T>`.

```typescript
// ❌ Forbidden
get('user.profile.name')
set('items.0.status', 'done')

// ✅ Required
state.user.profile.name
flow.patch(state.items).merge({ [id]: { status: 'done' } })
```

### Context

Core v1.0 uses string paths internally:

```typescript
['get', 'user.email']
{ op: 'set', path: 'user.email', value: '...' }
```

This is fine for IR (Intermediate Representation), but terrible for DX:

| Problem | Impact |
|---------|--------|
| No autocomplete | Developer guesses path names |
| No type checking | `'user.emial'` typo compiles |
| Refactoring hell | Rename field → grep all strings |
| Cognitive load | "Is it `user.profile.name` or `profile.user.name`?" |

### Rationale

**Path strings are implementation detail. Type-safe accessors are the API.**

Zod schema defines the shape. Builder generates `StateAccessor<T>` that mirrors that shape with `FieldRef<T>` at leaves. IDE sees the types, provides autocomplete, catches typos.

```typescript
const schema = z.object({
  user: z.object({
    email: z.string(),
    age: z.number(),
  }),
});

// StateAccessor<{ user: { email: string, age: number } }>
state.user.email  // FieldRef<string>, path = 'user.email'
state.user.age    // FieldRef<number>, path = 'user.age'
state.user.emial  // ❌ Compile error
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Template literal types | `'user.${keyof User}'` — partial safety, still strings |
| Path builder functions | `path('user', 'email')` — verbose, no deep nesting |
| Keep string paths | "FE가 욕함" |

### Consequences

- All user-facing APIs accept `FieldRef`, not strings
- Internal IR still uses string paths (that's fine)
- Refactoring is IDE-assisted (rename symbol)
- Typos caught at compile time

---

## FDR-B002: Computed as Named Facts

### Decision

Computed values MUST be defined as **named facts** via `computed.define()`, producing `ComputedRef<T>`.

```typescript
const { canReceive } = computed.define({
  canReceive: expr.and(expr.not(isClosed), expr.isNull(state.receivedAt)),
});

// Usage in action
actions.define({
  receive: {
    available: canReceive,  // → references 'computed.canReceive'
    // ...
  },
});
```

### Context

Without named facts, availability contains raw expressions:

```typescript
// ❌ Raw expression in availability
available: expr.and(
  expr.not(expr.eq(state.status, 'closed')),
  expr.isNull(state.receivedAt)
)
```

When action is unavailable, Explain Graph says:

```
"receive 불가능 이유: and(not(eq(get('status'), 'closed')), isNull(get('receivedAt')))"
```

This is useless for:
- End users ("왜 접수 버튼이 비활성화죠?")
- Developers debugging
- LLM agents reasoning about state

### Rationale

**Named facts enable meaningful explanation.**

With `computed.canReceive`:

```
"receive 불가능 이유: computed.canReceive = false"
```

And if user asks "왜?", system can drill into:

```
"computed.canReceive = false because:
  - computed.isClosed = false ✓
  - receivedAt = '2025-12-30' (not null) ✗"
```

| Aspect | Raw Expression | Named Fact |
|--------|---------------|------------|
| Explain readability | ❌ IR dump | ✅ Semantic name |
| Reusability | ❌ Copy-paste | ✅ Reference |
| Dependency tracking | ⚠️ Manual | ✅ Automatic |
| Debugging | ❌ "What is this?" | ✅ "computed.canReceive" |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Allow raw expr in availability | Loses explainability |
| Auto-generate names | `computed.anon_1` is meaningless |
| No computed, inline everything | Duplication, no explain |

### Consequences

- Availability SHOULD reference `ComputedRef`
- Raw expressions allowed but discouraged
- Explain Graph shows meaningful paths
- Computed can reference other computed (DAG)

---

## FDR-B003: Builder Produces Schema Only

### Decision

Builder MUST NOT execute computation, apply patches, or run effects. It only produces `DomainSchema`.

```typescript
const Domain = defineDomain(schema, builder);
// Domain.schema: DomainSchema (JSON-serializable)
// Domain.actions.receive.intent(): IntentBody

// ❌ Builder does NOT:
// - compute(snapshot)
// - apply(patches)
// - executeEffect(...)
```

### Context

Builder could theoretically include runtime:

```typescript
// Hypothetical all-in-one
const Domain = defineDomain(schema, builder);
Domain.execute(intent);  // runs everything
```

This would be "convenient" but architecturally wrong.

### Rationale

**Separation of concerns enables composition and testing.**

| Layer | Responsibility | Can Test Without |
|-------|----------------|------------------|
| Builder | Schema definition | Runtime, Host |
| Core | compute/apply | Builder, Host |
| Host | Execution loop | Builder |
| Bridge | UI integration | Builder, Host |

If Builder included runtime:
- Can't test schema in isolation
- Can't use schema with different hosts
- Can't serialize schema to disk/network
- Package becomes monolithic

**Builder is "compile time". Core/Host is "runtime".**

```
defineDomain() → DomainSchema (JSON)
                      ↓
              @manifesto-ai/core (compute)
                      ↓
              @manifesto-ai/host (execute)
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| All-in-one package | Monolith, can't test layers |
| Builder includes compute | Runtime leaks into definition |
| Builder executes effects | Side effects in "pure" definition |

### Consequences

- `DomainSchema` is JSON-serializable
- Schema can be validated/hashed without runtime
- Different hosts can consume same schema
- Clear package boundaries

---

## FDR-B004: Re-entry Safety Helpers

### Decision

Builder MUST provide `guard()` and `onceNull()` helpers for re-entry safe flows.

```typescript
// guard: general condition
flow.guard(expr.not(state.submitted), ({ patch, effect }) => {
  patch(state.submitted).set(true);
  effect('api.submit', { ... });
});

// onceNull: null-check shorthand
flow.onceNull(state.receivedAt, ({ patch, effect }) => {
  patch(state.receivedAt).set(timestamp);
  effect('api.receive', { ... });
});
```

### Context

Host Contract states:

> **FDR-H007**: Flow is re-invoked from the beginning on each compute cycle.

This means:

```typescript
// ❌ Dangerous: runs on EVERY cycle
flow.seq(
  flow.patch(state.status).set('received'),
  flow.effect('api.receive', { id: state.id })  // Called multiple times!
)
```

If developer forgets this, effect is called multiple times, state is overwritten repeatedly.

### Rationale

**Make the safe pattern easy, the dangerous pattern hard.**

FE developers shouldn't need to understand Host Contract internals. They should use helpers:

```typescript
// ✅ Safe: only runs when receivedAt is null
flow.onceNull(state.receivedAt, ({ patch, effect }) => {
  patch(state.receivedAt).set(timestamp);  // Now not null
  effect('api.receive', { ... });           // Called once
});
// Next cycle: receivedAt is not null → body skipped
```

| Pattern | Without Helper | With Helper |
|---------|---------------|-------------|
| Once per null | Manual if + flag | `onceNull()` |
| Conditional exec | Manual if | `guard()` |
| Risk of mistake | High | Low |
| Code readability | if/else noise | Declarative |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| No helpers, manual if | FE forgets, bugs happen |
| Auto-dedupe in Host | Host can't know intent |
| "Run once" annotation | What if condition changes? |

### Consequences

- `guard()` is general-purpose conditional
- `onceNull()` is common pattern shorthand
- FE doesn't think about re-entry
- Host Contract compatibility is structural

---

## FDR-B005: guard() Over onceFalse()

### Decision

Builder provides `guard(condition, body)` as the general form, not `onceFalse(field, body)`.

```typescript
// ✅ Explicit guard
flow.guard(expr.not(state.submitted), ({ patch }) => {
  patch(state.submitted).set(true);  // Developer explicitly sets flag
});

// ❌ Rejected: implicit flag setting
flow.onceFalse(state.submitted, () => {
  // Implicitly sets submitted = true?
});
```

### Context

Original spec proposed `onceFalse()`:

```typescript
onceFalse(field, steps)
// "if (field === false) { steps + set(field, true?) }"
```

The question: should `onceFalse` automatically set the field to `true`?

### Rationale

**Implicit side effects are dangerous.**

If `onceFalse(state.submitted, ...)` automatically sets `submitted = true`:
- What if the field isn't boolean?
- What if "true" isn't the right value?
- What if developer expects it NOT to auto-set?
- Magic behavior is hard to debug

`guard()` is explicit:

```typescript
flow.guard(expr.not(state.submitted), ({ patch }) => {
  // Developer decides what to set
  patch(state.submitted).set(true);
  // Or maybe: patch(state.submittedAt).set(timestamp);
});
```

| Aspect | onceFalse (implicit) | guard (explicit) |
|--------|---------------------|------------------|
| Auto side-effect | ⚠️ Magic | ✅ None |
| Flexibility | ❌ Boolean only | ✅ Any condition |
| Readability | ⚠️ Hidden behavior | ✅ Visible |
| Debugging | ❌ "Why is it true?" | ✅ "I set it" |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| onceFalse with auto-set | Magic, inflexible |
| onceFalse without auto-set | Then it's just `guard(not(field))` |
| Both guard and onceFalse | Redundant, confusing |

### Consequences

- `guard(condition, body)` is the universal pattern
- `onceNull()` is kept (common, unambiguous)
- No hidden side effects
- Developer controls all state changes

---

## FDR-B006: ActionRef.intent() Returns IntentBody Only

### Decision

`ActionRef.intent()` returns `IntentBody`, NOT `IntentInstance`.

```typescript
const body = actions.receive.intent({ requesterId: 'user-123' });
// Returns: { type: 'receive', input: { requesterId: 'user-123' } }

// Does NOT return:
// { body: {...}, intentId: '...', intentKey: '...', meta: { origin: {...} } }
```

### Context

Intent & Projection Spec defines:

```typescript
IntentBody = { type, input?, scopeProposal? }
IntentInstance = { body, intentId, intentKey, meta }
```

Who creates IntentInstance?
- `intentId`: UUID, unique per attempt
- `intentKey`: SHA-256 of body (JCS)
- `meta.origin`: projectionId, source, actor

### Rationale

**Builder doesn't know runtime context.**

| Field | Requires | Builder Knows? |
|-------|----------|---------------|
| type | Schema definition | ✅ Yes |
| input | Action input | ✅ Yes |
| intentId | Runtime generation | ❌ No |
| intentKey | Hash algorithm | ❌ No (could, but shouldn't) |
| origin.projectionId | Projection instance | ❌ No |
| origin.actor | Runtime actor | ❌ No |

Builder is "compile time". Issuer/Bridge is "runtime".

```
Builder: ActionRef.intent() → IntentBody
Bridge:  Issuer.issue(body) → IntentInstance
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Builder generates intentId | Couples to runtime |
| Builder computes intentKey | Duplicates Issuer logic |
| Builder sets origin | Doesn't know runtime context |

### Consequences

- Clear separation: Builder (schema) vs Bridge (runtime)
- Same ActionRef usable from any projection
- Intent & Projection Spec alignment
- Issuance is single responsibility of Issuer

---

## FDR-B007: Zod-First Typing

### Decision

State schema MUST be defined with Zod. Builder infers TypeScript types from Zod schema.

```typescript
const schema = z.object({
  user: z.object({
    email: z.string(),
    age: z.number().optional(),
  }),
});

// Type inferred: { user: { email: string, age?: number } }
const Domain = defineDomain(schema, ({ state }) => {
  state.user.email  // FieldRef<string>
  state.user.age    // FieldRef<number | undefined>
});
```

### Context

Options for schema definition:

1. Raw TypeScript types + separate validation
2. JSON Schema + codegen
3. Zod (or similar runtime validators)
4. Custom DSL

### Rationale

**Zod provides types + validation + ecosystem.**

| Aspect | TypeScript Only | JSON Schema | Zod |
|--------|----------------|-------------|-----|
| Runtime validation | ❌ None | ✅ Via ajv | ✅ Built-in |
| Type inference | ✅ Native | ⚠️ Codegen | ✅ `z.infer<>` |
| IDE support | ✅ | ⚠️ | ✅ |
| Ecosystem | N/A | Medium | Large |
| Learning curve | Low | Medium | Low |
| Composability | ⚠️ | ⚠️ | ✅ Excellent |

Zod is already widely adopted in FE ecosystem (tRPC, React Hook Form, etc.). FE developers know it.

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| TypeScript types only | No runtime validation |
| JSON Schema | Codegen step, less ergonomic |
| Custom DSL | Learning curve, no ecosystem |
| io-ts / yup | Less popular than Zod |

### Consequences

- `@manifesto-ai/builder` depends on Zod
- State schema is both typed and validated
- Familiar to FE developers
- Can leverage Zod ecosystem (transformers, refinements)

---

## FDR-B008: Record-by-ID Over Array Index

### Decision

Builder RECOMMENDS `Record<string, T>` pattern for mutable collections, not array index paths.

```typescript
// ❌ Discouraged
const schema = z.object({
  items: z.array(z.object({ id: z.string(), done: z.boolean() }))
});
// Problem: How to patch items[2].done?

// ✅ Recommended
const schema = z.object({
  items: z.record(z.string(), z.object({ done: z.boolean() }))
});
// patch(state.items).merge({ 'item-123': { done: true } })
```

### Context

Core v1.0 explicitly forbids array index paths:

> **MUST NOT use array index paths**
> ```typescript
> // WRONG
> get('items.0.name')
> set('items.0.status', 'done')
> ```

Why? Array indices are unstable. If item at index 0 is removed, index 1 becomes index 0. Dependencies break.

### Rationale

**ID-based access is stable across mutations.**

| Aspect | Array Index | Record by ID |
|--------|-------------|--------------|
| Stability | ❌ Index shifts | ✅ ID is stable |
| Dependencies | ❌ `items.0` → what? | ✅ `items.abc123` |
| Explain | ❌ "items.0.done" | ✅ "items.abc123.done" |
| Patch | ⚠️ Complex | ✅ `merge({ id: {...} })` |

Real-world data almost always has IDs:
```typescript
// Database returns
[{ id: 'abc', name: 'Alice' }, { id: 'def', name: 'Bob' }]

// Model as
{ 'abc': { name: 'Alice' }, 'def': { name: 'Bob' } }
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Support array indices | Unstable, breaks deps |
| Array helpers in v1.0 | Complex, defer to v1.1 |
| Force arrays everywhere | Doesn't match data reality |

### Consequences

- v1.0 has no array index paths
- Record-by-ID is the blessed pattern
- v1.1 may add array expression helpers
- FE must transform array data to record (common pattern anyway)

---

## FDR-B009: Builder-Core Separation

### Decision

`@manifesto-ai/builder` and `@manifesto-ai/core` are separate packages with one-way dependency.

```
@manifesto-ai/builder
        │
        ▼ (types only)
@manifesto-ai/core
```

### Context

Could have been one package:

```typescript
// Hypothetical @manifesto-ai/all-in-one
export { defineDomain, expr, flow } from './builder';
export { compute, apply } from './core';
export { createHost } from './host';
```

### Rationale

**Different concerns, different change rates, different consumers.**

| Package | Consumer | Changes When |
|---------|----------|-------------|
| Core | Host, internals | IR changes, compute logic |
| Builder | App developers | DX improvements |
| Host | Runtime | Execution model changes |
| Bridge | UI frameworks | Framework updates |

If Builder and Core were merged:
- Core changes affect Builder users
- Builder DX changes require Core release
- Can't use Core without Builder (or vice versa)
- Test matrix explodes

Separation means:
- Core can be tiny, stable, pure
- Builder can iterate on DX freely
- Different teams can own different packages

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Monolithic package | Change coupling |
| Core depends on Builder | Inverted dependency |
| No type sharing | Duplication, drift |

### Consequences

- Builder imports Core types only
- Core has no knowledge of Builder
- Can release independently
- Clear ownership boundaries

---

## FDR-B010: Diagnostics Are Mandatory

### Decision

Builder MUST validate schemas and return diagnostics. Invalid schemas MUST NOT be silently emitted.

```typescript
const { schema, diagnostics } = Domain;

if (!diagnostics.valid) {
  console.error(diagnostics.errors);
  // In production: throw
}
```

### Context

What if developer defines invalid schema?

```typescript
computed.define({
  a: expr.eq(b, 1),  // b doesn't exist yet
  b: expr.eq(a, 2),  // circular!
});
```

Options:
1. Silently emit broken schema
2. Throw immediately
3. Return diagnostics, let consumer decide

### Rationale

**Fail fast with actionable information.**

| Approach | DX | Debuggability |
|----------|-----|---------------|
| Silent emit | ❌ Fails at runtime | ❌ "Why is compute broken?" |
| Throw immediately | ⚠️ Stops cold | ⚠️ One error at a time |
| Diagnostics | ✅ Full report | ✅ All issues listed |

Diagnostics provide:
- All errors, not just first
- Path to problematic definition
- Suggestions for fixes
- Warnings (non-fatal issues)

```typescript
diagnostics: {
  valid: false,
  errors: [
    { code: 'CIRCULAR_COMPUTED', path: 'computed.a', message: 'Circular dependency: a → b → a' },
    { code: 'MISSING_DEPENDENCY', path: 'computed.a', message: 'Reference to undefined: b' },
  ],
  warnings: [
    { code: 'UNREACHABLE_CODE', path: 'actions.foo.flow', message: 'Code after halt() is unreachable' },
  ],
}
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Silent failure | Debugging nightmare |
| Throw on first error | Developer fixes one, finds another |
| No validation | Invalid schemas break runtime |

### Consequences

- `defineDomain` always validates
- `diagnostics` always present in result
- Production mode throws on errors
- Development mode logs warnings

---

## Summary Table

| FDR | Decision | Key Principle |
|-----|----------|---------------|
| B001 | No string paths | Type safety via FieldRef |
| B002 | Computed as named facts | Explainability |
| B003 | Builder produces schema only | Separation of concerns |
| B004 | Re-entry safety helpers | Make safe pattern easy |
| B005 | guard() over onceFalse() | Explicit over implicit |
| B006 | intent() returns IntentBody | Builder ≠ Issuer |
| B007 | Zod-first typing | Ecosystem + validation |
| B008 | Record-by-ID over array | Stable dependencies |
| B009 | Builder-Core separation | Independent evolution |
| B010 | Mandatory diagnostics | Fail fast with info |

---

## Cross-Reference: Related FDRs

### From Core FDR

| Core FDR | Relevance to Builder |
|----------|---------------------|
| Expression is pure IR | Builder produces Expression IR |
| Patch is only mutation | Builder produces Patch IR |
| Explain via Explain Engine | Named facts enable good explain |

### From Host Contract FDR

| Host FDR | Relevance to Builder |
|----------|---------------------|
| FDR-H007 (Re-entry) | Why guard/onceNull exist |
| FDR-H006 (Intent Identity) | Why intent() returns body only |

### From Intent & Projection FDR

| IP FDR | Relevance to Builder |
|--------|---------------------|
| FDR-IP001 (Intent is Command) | ActionRef.intent() creates command |
| FDR-IP010 (Issuer Role) | Builder ≠ Issuer separation |

---

*End of @manifesto-ai/builder FDR*
