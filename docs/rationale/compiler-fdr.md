# @manifesto-ai/compiler — Foundational Design Rationale (FDR)

> **Version:** 1.0
> **Status:** Normative
> **Purpose:** Document the "Why" behind every constitutional decision in the Compiler Spec

---

## Overview

This document records the foundational design decisions that shape `@manifesto-ai/compiler`.

Each FDR entry follows the format:

- **Decision**: What was decided
- **Context**: Why this decision was needed
- **Rationale**: The reasoning behind the choice
- **Alternatives Rejected**: Other options considered and why they were rejected
- **Consequences**: What this decision enables and constrains

---

## FDR-C001: Compiler as Manifesto Application

### Decision

Compiler MUST be implemented as a Manifesto Application, not as a standalone tool or library.

```
Compiler IS:
├── DomainSchema (state, computed, actions)
├── Host (effect handlers)
└── Standard Manifesto patterns

Compiler is NOT:
├── Special-purpose runtime
├── LLM wrapper with validation
└── Separate execution model
```

### Context

The obvious approach would be to implement Compiler as a simple pipeline:

```typescript
// ❌ Naive approach
async function compile(text, schema) {
  const segments = await llm.segment(text);
  const intents = await llm.normalize(segments);
  const draft = await llm.propose(intents);
  const result = builder.validate(draft);
  return result;
}
```

This works but proves nothing about Manifesto itself.

### Rationale

**Dogfooding is the strongest validation.**

| What Compiler Proves | How |
|---------------------|-----|
| Complex state machines work | Compilation phases as state |
| Async effects work | LLM calls as Effects |
| Retry patterns work | Action + state-based loop |
| Resolution patterns work | ITL via standard mechanisms |
| Failure handling works | Terminal states |
| Traceability works | Snapshot history |

If Compiler—a complex, multi-phase, async, failure-prone system—can be modeled in Manifesto, then simpler applications certainly can.

```
"If this architecture can build a Compiler,
 what can't it build?"
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Standalone pipeline | Proves nothing about Manifesto |
| Custom runtime | Creates second execution model |
| Thin wrapper | Misses opportunity for validation |

### Consequences

- Compiler uses `defineDomain`, `createHost`, standard Effects
- Compiler state is a Snapshot
- Compiler actions follow Flow DSL rules
- All Manifesto constraints apply (re-entry safety, determinism, etc.)
- Compiler serves as reference implementation for complex apps

---

## FDR-C002: LLM as Untrusted Proposer

### Decision

LLM output MUST always be treated as an untrusted proposal. LLM MUST NOT directly determine final output.

```
LLM → DomainDraft (proposal)
         ↓
Builder.validateDomain() (judge)
         ↓
DomainSchema (verdict)
```

### Context

LLMs are probabilistic and can produce:
- Syntactically invalid JSON
- Semantically invalid schemas
- Schemas that violate Manifesto rules
- Schemas that don't match user intent

Trusting LLM output directly is unsafe.

### Rationale

**Separation of proposal and judgment.**

| Component | Role | Trust Level |
|-----------|------|-------------|
| LLM | Proposer | Untrusted |
| Builder | Judge | Trusted (deterministic) |
| Human/AITL | Arbiter (for ambiguity) | Trusted (by policy) |

This mirrors the World Protocol pattern:
- Actor proposes Intent
- Authority judges Intent
- Host executes approved Intent

Compiler applies the same pattern:
- LLM proposes Draft
- Builder judges Draft
- System uses validated Schema

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Trust LLM output directly | Unsafe, non-deterministic |
| LLM validates its own output | Untrusted validating untrusted |
| Multiple LLM consensus for validation | Still untrusted, just averaged |

### Consequences

- Every LLM output goes through Builder validation
- Invalid drafts trigger retry, not crash
- Final output is always Builder-validated
- LLM errors are contained, not propagated

---

## FDR-C003: Actor-Neutral Design (Dual-Use)

### Decision

Compiler MUST NOT distinguish between human and LLM input sources. Same rules apply to all.

```typescript
// Compiler sees only:
compile({
  text: string,      // Could be from human OR LLM
  schema: ZodSchema,
  context?: Context,
})

// Compiler does NOT see:
// - Who wrote the text
// - What reasoning produced it
// - What authority the caller has
```

### Context

It's tempting to create separate paths:
- "Human mode" with more leniency
- "LLM mode" with stricter checks

This would create two validation systems.

### Rationale

**Natural language is already Actor-neutral.**

When Compiler receives `"When event is received, record the handler..."`, it cannot and should not determine if this came from:
- A human typing in CLI
- An LLM generating requirements
- A system producing templated text

The text is the text. The validation is the validation.

**Separate paths violate Manifesto principles:**

| Principle | Violation |
|-----------|-----------|
| Single source of truth | Two validation systems |
| Determinism | Different paths = different results |
| Auditability | "Which path was used?" questions |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Human-specific leniency | Creates privilege, breaks determinism |
| LLM-specific strictness | Creates discrimination, unnecessary |
| Caller-aware validation | Complicates validation, breaks neutrality |

### Consequences

- Same validation rules for all input
- Same resolution mechanism for all ambiguity
- No special privileges or penalties based on caller
- Input source is invisible to Compiler internals

---

## FDR-C004: ITL-Agnostic Resolution

### Decision

Compiler MUST NOT determine who or what resolves ambiguity. Resolution mechanism is external.

```
Compiler knows:
├── Resolution is needed
├── What options exist
└── What was selected

Compiler does NOT know:
├── Who selected
├── How selection was made
└── What protocol was used
```

### Context

When ambiguity arises (multiple valid interpretations), someone must decide. Options include:

- **HITL**: Human selects
- **AITL**: Another LLM selects
- **Consensus**: Multiple agents vote
- **Tribunal**: Constitutional review

Should Compiler know which mechanism is used?

### Rationale

**Resolution mechanism is a policy decision, not a Compiler concern.**

```
ITL (Intelligence in the Loop)
├── HITL (Human)
└── AITL (AI)
    ├── Single LLM
    ├── Multi-LLM consensus
    ├── Constitutional tribunal
    └── Custom protocols
```

Compiler's responsibility ends at "I need a decision." How that decision is made is external.

**Benefits of ITL-agnostic design:**

| Benefit | Explanation |
|---------|-------------|
| Flexibility | Can swap HITL ↔ AITL without changing Compiler |
| Simplicity | Compiler has single resolution interface |
| Composition | External systems can implement any protocol |
| Future-proof | New ITL mechanisms don't require Compiler changes |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Built-in HITL | Couples Compiler to UI |
| Built-in AITL | Couples Compiler to specific LLM |
| ITL type parameter | Unnecessary complexity |

### Consequences

- Compiler exposes `awaiting_resolution` state and `resolve` action
- External system subscribes to state changes
- External system implements resolution protocol
- External system calls `resolve` with selected option
- Compiler continues without knowing who resolved

---

## FDR-C005: Resolution Policy — Await vs Discard

### Decision

Compiler MUST support two resolution policies:
- `'await'`: Wait for external resolution
- `'discard'`: Immediately discard if resolution needed

Default MUST be `'discard'` (safe default).

```typescript
type CompilerResolutionPolicy = {
  onResolutionRequired: 'await' | 'discard';
};
```

### Context

When resolution is required but no resolution mechanism is configured, what should happen?

- Wait indefinitely? → System hangs
- Crash? → Bad UX
- Discard gracefully? → Safe but loses work

### Rationale

**Safe defaults prevent hanging.**

| Scenario | With 'await' | With 'discard' |
|----------|-------------|----------------|
| HITL configured | Prompts user | N/A |
| AITL configured | Calls AI | N/A |
| Nothing configured | Hangs forever | Discards gracefully |

Default `'discard'` ensures:
- No indefinite waiting
- Clear failure reason (`RESOLUTION_REQUIRED_BUT_DISABLED`)
- Caller can retry with resolution configured

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Always await | Can hang forever |
| Always discard | No resolution possible |
| Timeout-based | Arbitrary timeout is bad UX |
| Auto-select first option | Arbitrary, potentially wrong |

### Consequences

- Default policy is `'discard'`
- Explicit `'await'` required for resolution
- External system must be ready before using `'await'`
- Discarded compilations have clear reason in trace

---

## FDR-C006: Draft vs Schema Separation

### Decision

LLM output MUST be called `DomainDraft` until validated. Only Builder output is `DomainSchema`.

```
LLM → DomainDraft (unvalidated)
         ↓
Builder.validateDomain()
         ↓
DomainSchema (validated, canonical)
```

### Context

Using same term for both creates confusion:
- "Is this Schema validated?"
- "Can I trust this Schema?"
- "Where did this Schema come from?"

### Rationale

**Naming reflects trust level.**

| Term | Source | Validated | Trust |
|------|--------|-----------|-------|
| `DomainDraft` | LLM | No | Untrusted |
| `DomainSchema` | Builder | Yes | Trusted |

Clear naming prevents accidental use of unvalidated output.

```typescript
// Clear what you have
const draft: DomainDraft = await llm.propose(intents);
const schema: DomainSchema = builder.validate(draft).schema;

// vs. Confusing
const schema = await llm.propose(intents);  // Is this validated??
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Both called Schema | Ambiguous trust level |
| ProposedSchema / ValidatedSchema | Verbose |
| Untyped JSON | No type safety |

### Consequences

- State has `currentDraft: DomainDraft | null`
- State has `result: DomainSchema | null`
- Type system enforces the distinction
- Code clearly shows validation boundary

---

## FDR-C007: Timestamps from Effect Handlers

### Decision

Timestamps MUST be provided by effect handlers, NOT computed in expressions.

```typescript
// ❌ WRONG: Non-deterministic
timestamp: expr.now()

// ✅ CORRECT: From effect handler
timestamp: expr.input('timestamp')
```

### Context

Recording when attempts occurred is useful for debugging and tracing. Where should timestamp come from?

Option A: Expression like `expr.now()`
Option B: Effect handler provides timestamp

### Rationale

**Snapshot determinism requires stable expressions.**

Core Spec states: same input → same output. If expression includes `expr.now()`:

```
compute() at T1 → timestamp: 1000
compute() at T2 → timestamp: 1001  // Different!
```

This breaks determinism. Same Snapshot could compute to different results depending on when `compute()` is called.

**Effect handlers are the boundary for non-determinism.**

Effects are already non-deterministic (LLM calls, I/O). Timestamps belong there:

```typescript
// Effect handler
async function validateHandler(params, context) {
  const result = validate(params.draft);
  return {
    ...result,
    timestamp: context.requirement.createdAt,  // Deterministic from HostContext
  };
}

// Action receives timestamp as input
flow.patch(state.attempts).set(
  expr.append(
    state.attempts,
    expr.object({
      timestamp: expr.input('timestamp'),  // Deterministic
    })
  )
)
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| `expr.now()` | Breaks determinism |
| No timestamps | Loses valuable trace info |
| Timestamps in separate log | Splits data, harder to trace |

### Consequences

- No `expr.now()` in Compiler domain
- Effect handlers provide all timestamps
- Action input schemas include timestamp fields
- Snapshot remains deterministic

---

## FDR-C008: Single Retry Counter Increment Point

### Decision

`attemptCount` MUST be incremented at exactly one point: when retry is triggered after validation failure.

```typescript
// ONLY place attemptCount increases:
// receiveValidation → failure → canRetry → increment → proposing
```

### Context

Earlier draft had multiple increment points:
- In `receiveIntents` (before first proposal)
- In `receiveValidation` (on retry)

This caused confusion: "What does attemptCount mean?"

### Rationale

**Single increment point ensures clear semantics.**

`attemptCount` means: "How many times have we tried to propose after a failure?"

| Event | attemptCount |
|-------|-------------|
| Initial proposal | 0 |
| First validation failure → retry | 1 |
| Second validation failure → retry | 2 |
| Third failure, max=3 → discard | 3 (final) |

If increment happened in multiple places:
- Count could exceed max
- Count meaning becomes unclear
- Off-by-one errors likely

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Increment on every proposal | Counts initial as retry |
| Increment in multiple places | Unclear semantics |
| No counter, use attempts.length | Breaks when traceDrafts=false |

### Consequences

- `attemptCount` increments only in validation failure → retry path
- Initial proposal doesn't increment (it's attempt 0)
- `canRetry` compares `attemptCount < maxRetries`
- Clear, predictable loop behavior

---

## FDR-C009: Optional Trace Storage (Memory Protection)

### Decision

Full draft storage in `attempts` array MUST be optional, controlled by `traceDrafts` flag. Default MUST be `false`.

```typescript
{
  traceDrafts: false,  // Default: don't store drafts
  attempts: [],        // Empty even after retries
  attemptCount: 3,     // Count is always tracked
}
```

### Context

Storing every failed draft is useful for debugging but expensive:
- DomainDraft can be large (complex domains)
- Multiple retries = multiple copies
- Memory-constrained environments (16GB MacBooks)

### Rationale

**Opt-in for expensive features.**

| Mode | Storage | Use Case |
|------|---------|----------|
| `traceDrafts: false` | Count only | Production, memory-constrained |
| `traceDrafts: true` | Full drafts | Debugging, analysis |

Even without full drafts, we track:
- `attemptCount`: How many retries
- `diagnostics`: Last failure reason
- `draftHash`: Lightweight identifier (always stored)

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Always store | Memory issues |
| Never store | Loses debugging capability |
| Automatic based on memory | Complex, unpredictable |

### Consequences

- Default: memory-safe, no draft storage
- Explicit opt-in for full traces
- `draftHash` always available for correlation
- Memory usage predictable

---

## FDR-C010: Builder as Judge

### Decision

Builder.validateDomain() MUST be the sole judge of DomainDraft validity. Compiler MUST NOT implement validation logic.

```
Compiler → draft → Builder.validateDomain() → verdict
                        ↑
                   Single source of truth
```

### Context

Could Compiler do its own validation?
- Quick checks before calling Builder?
- Caching validation results?
- Parallel validation paths?

### Rationale

**Single source of truth for validation.**

| Aspect | Compiler Validation | Builder Only |
|--------|--------------------| -------------|
| Consistency | ⚠️ Two sources | ✅ One source |
| Maintenance | ⚠️ Duplicate logic | ✅ Single point |
| Updates | ⚠️ Sync required | ✅ Auto-updated |
| Trust | ⚠️ Which is right? | ✅ Builder is right |

Builder is the "constitution" for DomainSchema. Compiler is a "citizen" subject to that constitution. Citizens don't interpret the constitution—they submit to it.

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Compiler pre-validation | Duplicates Builder logic |
| Compiler caches results | Cache invalidation complexity |
| Compiler extends validation | Breaks single source of truth |

### Consequences

- All validation goes through Builder
- Compiler has no validation logic
- Compiler evolves independently of validation rules
- Builder updates automatically apply to Compiler

---

## FDR-C011: Effect Handler Abstraction

### Decision

LLM interactions MUST be abstracted as effect handlers, not direct calls.

```typescript
// ✅ Effect-based
flow.effect('llm:propose', { intents, schema, history })

// ❌ Direct call
const draft = await llm.propose(intents, schema, history)
```

### Context

Compiler needs to call LLMs for segmentation, normalization, and proposal. How should these calls be structured?

### Rationale

**Effects enable standard Manifesto patterns.**

| Aspect | Direct Calls | Effect-Based |
|--------|-------------|--------------|
| Re-entry safety | ⚠️ Manual | ✅ Automatic |
| Testability | ⚠️ Mock LLM | ✅ Mock effect |
| Observability | ⚠️ Custom logging | ✅ Standard tracing |
| Composition | ⚠️ Ad-hoc | ✅ Standard patterns |

Effects also enable:
- **Replay**: Record effects, replay for debugging
- **Substitution**: Different LLM backends without code changes
- **Rate limiting**: Host-level effect management
- **Caching**: Effect-level response caching

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Direct LLM calls in flow | Breaks effect model |
| Hybrid approach | Inconsistent patterns |
| LLM as special primitive | Creates non-standard concept |

### Consequences

- All LLM calls are `llm:*` effects
- Builder validation is `builder:validate` effect
- Standard effect patterns apply (idempotency concerns, etc.)
- Easy to swap LLM implementations

---

## FDR-C012: Compilation Phases as State

### Decision

Compilation phases MUST be represented as `status` enum values, not implicit pipeline stages.

```typescript
status: z.enum([
  'idle',
  'segmenting',
  'normalizing',
  'proposing',
  'validating',
  'awaiting_resolution',
  'success',
  'discarded',
])
```

### Context

A compilation pipeline could be:
- Implicit (code flow determines stage)
- Explicit (state field determines stage)

### Rationale

**Explicit state enables standard Manifesto patterns.**

| Aspect | Implicit Pipeline | Explicit Status |
|--------|------------------|-----------------|
| Observability | ⚠️ Need debugger | ✅ Read status |
| Persistence | ⚠️ Complex | ✅ Serialize state |
| Resume | ⚠️ Checkpoint logic | ✅ Natural |
| UI binding | ⚠️ Custom events | ✅ Subscribe to state |

With explicit status:
- UI can show current phase
- Compilation can be paused/resumed
- State can be serialized/deserialized
- External systems know exactly where Compiler is

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Implicit pipeline | Not observable |
| Event-based stages | Non-standard pattern |
| Nested state machines | Unnecessary complexity |

### Consequences

- Status is always explicit in state
- Computed values derive from status
- Actions check status for availability
- External systems can react to status changes

---

## Summary Table

| FDR | Decision | Key Principle |
|-----|----------|---------------|
| C001 | Compiler as Manifesto App | Dogfooding validates architecture |
| C002 | LLM as untrusted proposer | Separate proposal from judgment |
| C003 | Actor-neutral design | Same rules for all input sources |
| C004 | ITL-agnostic resolution | Resolution mechanism is external |
| C005 | Await vs Discard policy | Safe defaults prevent hanging |
| C006 | Draft vs Schema naming | Naming reflects trust level |
| C007 | Timestamps from handlers | Preserve snapshot determinism |
| C008 | Single retry increment | Clear counter semantics |
| C009 | Optional trace storage | Memory protection by default |
| C010 | Builder as judge | Single source of validation truth |
| C011 | Effect handler abstraction | Standard Manifesto patterns |
| C012 | Phases as state | Explicit, observable, resumable |

---

## Cross-Reference: Related FDRs

### From Core FDR

| Core FDR | Relevance to Compiler |
|----------|----------------------|
| Snapshot determinism | Why timestamps from handlers |
| Expression is pure | Why no expr.now() |
| Effect is declaration | How LLM calls are structured |

### From Builder FDR

| Builder FDR | Relevance to Compiler |
|-------------|----------------------|
| Computed as named facts | Compiler uses same pattern |
| Re-entry safety | Compiler flows follow same rules |
| Diagnostics are mandatory | Compiler consumes diagnostics |

### From World Protocol FDR

| World FDR | Relevance to Compiler |
|-----------|----------------------|
| Actor as first-class | Compiler is Actor-neutral |
| Proposal lifecycle | Draft follows similar pattern |
| Authority judgment | Builder plays judge role |

### From Intent & Projection FDR

| IP FDR | Relevance to Compiler |
|--------|----------------------|
| Intent is command | Draft is proposal |
| Issuer responsibility | External system responsibility |

---

*End of @manifesto-ai/compiler FDR*
