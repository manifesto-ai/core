# ADR-020: Intent-Level Dispatchability — `dispatchable when` Clause

> **Status:** Proposed
> **Date:** 2026-04-07
> **Deciders:** 정성우 (Architect), Manifesto Architecture Team
> **Scope:** Compiler, Core, SDK, Studio/Introspection, Docs
> **Related ADRs:** ADR-017 (Capability Decorator Pattern), ADR-018 (Public Snapshot Boundary)
> **Related SPECs:** Core SPEC v4, SDK SPEC v3.1.0, Compiler SPEC v0.8.0

---

## 1. Context

### 1.1 Current Contract

MEL's `available when` clause is an **input-free, action-level availability gate**. Its semantics are precisely defined:

- Pure expression over state/computed only (Constraint A28).
- `$input.*`, action parameters, `$meta.*`, `$system.*`, and effects are all prohibited.
- Evaluated synchronously by Core, UI, and agents **before any intent input exists**.

Core's public surface reflects this:

```typescript
isActionAvailable(schema, snapshot, actionName): boolean     // AVAIL-Q-1..7
getAvailableActions(schema, snapshot): readonly string[]      // AVAIL-Q-5
```

SDK v3.1.0 delegates to Core for these reads (§7.3) and checks availability at `dispatchAsync()` dequeue time. `simulate()` throws `ACTION_UNAVAILABLE` for unavailable actions (SIM-7).

This contract is sound. Nothing in this ADR changes it.

### 1.2 The Gap

The contract answers one question well:

> **Q1.** Is this action family currently invocable? (input-free, coarse)

It does not answer a second question that arises in every non-trivial domain:

> **Q2.** Is this specific bound intent semantically legal right now? (input-aware, fine)

**Example — Battleship.** The action `shoot` is `available when and(eq(phase, "playing"), gt(shotsRemaining, 0))`. This is a coarse gate: the game is in playing phase and shots remain. But `shoot(cellIndex: 18)` should be rejected if cell 18 has already been fired upon. Today, this input-dependent legality has no first-class MEL concept. It scatters into:

- `when` / `fail` guards inside the action body (post-dispatch, not pre-dispatch).
- Host-level validation (opaque, not inspectable by tooling).
- Defensive `onceIntent when ...` patterns that conflate idempotency with legality.

**Consequences of the gap:**

1. `getAvailableActions()` reports `shoot` as available, but specific intents silently fail.
2. Studio / SchemaGraph / `explain()` cannot describe why `shoot(18)` is blocked — the information is buried in action body flow, not in a declarative surface.
3. Agents build intents that pass coarse availability but fail at dispatch, wasting action budget (critical in ARC-AGI-3 where action efficiency is scored).

### 1.3 Why Not Extend `available when`?

The cleanest-seeming fix would be to allow `$input.*` in `available when`. This is rejected because:

- `available when` is evaluated **before input exists** (UI button enable/disable, agent action-space pruning). Allowing input would break this fundamental timing contract.
- `isActionAvailable()` and `getAvailableActions()` take `(schema, snapshot, actionName)` — no intent. Adding intent would change the Core public API signature and every downstream consumer.
- The two questions (Q1 and Q2) have different audiences and evaluation times. Merging them would conflate coarse pruning with fine admission.

---

## 2. Decision

### 2.1 Three-Layer Legality Model

Manifesto separates legality into three layers:

| Layer | Concept | Evaluates Over | Timing | Purpose |
|-------|---------|---------------|--------|---------|
| **available** | Action family coarse gate | schema + snapshot | Pre-intent (synchronous) | UI pruning, agent action-space filtering |
| **dispatchable** | Bound intent fine gate | schema + snapshot + bound input | Post-intent, pre-execution | Semantic admission control |
| **outcome** | Execution result | Full runtime | During execution | Flow narrative (`fail` / `stop` / `success`) |

### 2.2 New MEL Surface: `dispatchable when`

```mel
action shoot(cellIndex: number)
  available when canShoot
  dispatchable when eq(at(cells, cellIndex), "unknown")
{
  onceIntent {
    patch cells = updateAt(cells, cellIndex, "pending")
    patch shotsFired = add(shotsFired, 1)
  }
}
```

**Clause ordering is fixed:** `available when` before `dispatchable when`. Both are optional. If `dispatchable when` is present without `available when`, only the fine gate applies.

### 2.3 Term Selection: Why `dispatchable`

| Candidate | Rejection Reason |
|-----------|-----------------|
| `valid` | Too broad — conflates type validity with semantic legality |
| `allowed` / `authorized` / `legal` | Governance collision — `propose` / `approve` / `reject` already own authority semantics |
| `admissible` | Unfamiliar outside academic contexts |
| `runnable` / `executable` | Implies Host execution readiness, not semantic legality |
| **`dispatchable`** | **Adopted.** SDK's canonical execution verb is `dispatchAsync()`. "Is this intent dispatchable?" maps directly to "can I pass this to `dispatchAsync()` and expect semantic admission?" |

---

## 3. Non-Goals

1. **No change to `available when` semantics.** Input, `$meta.*`, `$system.*` remain prohibited in `available when`. The existing AVAIL-Q rules are untouched.
2. **No effectful or async dispatchability.** `dispatchable when` is pure and synchronous — same purity class as `available when`, just with a wider reference scope.
3. **No governance involvement.** Dispatchability is not authority. Governance continues to own `propose` / `approve` / `reject`.
4. **No removal of body-level `when` / `fail` / `stop`.** These remain the narrative layer for execution-time outcomes. `dispatchable` does not replace them.
5. **No Host-aware predicates.** `dispatchable when` cannot reference Host state, IO readiness, or effect results.
6. **No mandatory Host-level gate.** `dispatchable` is a schema-level pure admission predicate. The base SDK enforces it as a mandatory pre-dispatch gate. Lower-level Host consumers MAY query `core.isIntentDispatchable()` directly before `host.dispatch()`, but the Host package itself is not required to enforce the gate. Whether Host adopts mandatory dispatchability checking is outside the scope of this ADR.

---

## 4. Detailed Design

### 4.1 Compiler

The compiler introduces a new expression context alongside the existing one:

**`AvailableExpr` (unchanged)**
- Allowed references: state fields, computed fields.
- Prohibited: `$input.*`, action parameters, `$meta.*`, `$system.*`, effects.
- Constraint A28 is preserved exactly.

**`DispatchableExpr` (new)**
- Allowed references: state fields, computed fields, action parameters (which compile to `$input.*`).
- Prohibited: `$meta.*`, `$system.*`, effects.
- Pure only. Synchronous evaluation.
- In MEL source, action parameters are referenced by their **bare declared name** (e.g., `cellIndex`), not by `$input.cellIndex`. The compiler resolves bare names to `$input.*` references in the compiled `ExprNode`. Direct `$input.*` syntax in MEL source is not permitted in `dispatchable when` — this is consistent with how action body expressions reference parameters.

The action AST gains an optional `dispatchable` field:

```typescript
interface ActionSpec {
  name: string;
  params?: readonly ParamSpec[];
  available?: ExprNode;       // existing — AvailableExpr scope
  dispatchable?: ExprNode;    // new — DispatchableExpr scope
  flow: FlowNode;
}
```

**Semantic check additions:**
- A new constraint (ID allocated during SPEC edit) enforces DispatchableExpr scope rules on the `dispatchable` field.
- If `dispatchable` references a name that is both a state field and an action parameter, the action parameter binding wins (consistent with existing body-scope resolution).

### 4.2 Core

**Existing surface — unchanged:**

```typescript
isActionAvailable(schema, snapshot, actionName): boolean      // AVAIL-Q-1..7
getAvailableActions(schema, snapshot): readonly string[]       // AVAIL-Q-5
```

**New surface:**

```typescript
isIntentDispatchable(schema, snapshot, intent): boolean
```

**Rules:**

| Rule ID | Level | Description |
|---------|-------|-------------|
| DISP-Q-1 | MUST | `isIntentDispatchable()` MUST evaluate `ActionSpec.dispatchable` with the intent's bound input substituted into the expression context. |
| DISP-Q-2 | MUST | If `ActionSpec.dispatchable` is undefined, `isIntentDispatchable()` MUST return `true`. |
| DISP-Q-3 | MUST | `isIntentDispatchable()` MUST be pure and side-effect-free. No snapshot mutation, no SystemDelta, no patches, no trace entries. |
| DISP-Q-4 | MUST | If the action is not available (`isActionAvailable() === false`), `isIntentDispatchable()` MUST return `false` without evaluating the dispatchable expression. Available is a precondition of dispatchable. |
| DISP-Q-5 | MUST | The evaluation logic MUST be shared with the expression evaluator used by `compute()`, not duplicated. |
| DISP-Q-6 | MUST NOT | `isIntentDispatchable()` MUST NOT require `HostContext`. It is pure over schema + snapshot + intent. |

**Invariant — evaluation ordering:**

```
available == false  →  dispatchable is not evaluated, returns false
available == true   →  dispatchable is evaluated against bound input
dispatchable == true  →  does NOT guarantee outcome (body may still fail/stop)
```

This ordering is normative. `available` is a **precondition** of `dispatchable`, not a peer.

### 4.3 SDK

**Existing surface — unchanged:**

- `getAvailableActions()` — delegates to Core, returns coarse action-level availability.
- `isActionAvailable(actionName)` — delegates to Core.
- `getActionMetadata(actionName)` — read-only contract inspection.

**New surface:**

```typescript
isIntentDispatchable(actionRef, ...args): boolean
getIntentBlockers(actionRef, ...args): readonly DispatchBlocker[]
```

Both accept the same signature shape as `createIntent()` for ergonomic consistency.

`isIntentDispatchable()` is the boolean gate. `getIntentBlockers()` is the explanation surface — it returns a structured list of blockers that prevented dispatch admission. If the intent is dispatchable, the list is empty.

```typescript
type DispatchBlocker = {
  readonly layer: "available" | "dispatchable";
  readonly expression: ExprNode;          // the failing predicate
  readonly evaluatedResult: unknown;      // what the expression evaluated to
  readonly description?: string;          // human-readable explanation if derivable
};
```

This fulfills Manifesto's promise that semantic legality is **readable, not opaque**. The explanation is an SDK-layer projection (consistent with ADR-018), not a Core concern — Core provides `isIntentDispatchable()` only.

**Execution semantics update:**

`dispatchAsync()` dequeue-time check is extended:

| Step | Current (v3.1.0) | Proposed |
|------|-----------------|----------|
| 1 | Check `isActionAvailable()` | Check `isActionAvailable()` |
| 2 | — | Check `isIntentDispatchable()` |
| 3 | Execute via Host | Execute via Host |

If dispatchability fails at dequeue time:

- `dispatchAsync()` MUST reject without mutating the visible snapshot.
- `dispatchAsync()` MUST emit `dispatch:rejected` with a distinguishable rejection reason.
- The rejection event MUST include a machine-readable code that separates `ACTION_UNAVAILABLE` from `INTENT_NOT_DISPATCHABLE`.

**`simulate()` update:**

`simulate()` currently throws `ACTION_UNAVAILABLE` when the action is unavailable (SIM-7). The proposed extension:

| Rule ID | Level | Description |
|---------|-------|-------------|
| SIM-7 | MUST | (unchanged) Throw `ManifestoError` code `ACTION_UNAVAILABLE` if action is unavailable. |
| SIM-9 | MUST | Throw `ManifestoError` code `INTENT_NOT_DISPATCHABLE` if the action is available but the bound intent fails the `dispatchable` check. |

### 4.4 Studio / SchemaGraph / Explain

**SchemaGraph — no structural change.**

The existing graph represents static coarse structure: `state → computed → action` via `feeds`, `mutates`, `unlocks` edges. `dispatchable` is input-dependent and therefore cannot be represented as a static edge. Adding it would violate the graph's nature as a schema-derived (not snapshot-derived) artifact.

**Explain surface — new layer.**

The `explain()` / introspection surface gains a second explanation level:

- **Availability blockers** (existing): Why is this action family locked? References state/computed values.
  - Example: `phase != "playing"`, `shotsRemaining == 0`

- **Dispatchability blockers** (new): Why is this specific intent rejected? References state/computed + bound input.
  - Example: `at(cells, 18) != "unknown"` → cell 18 was already fired upon.

This explanation is an SDK-layer concern, not Core. Core provides `isIntentDispatchable()` as the boolean gate. SDK owns the explanation surface via `getIntentBlockers()` (§4.3), consistent with ADR-018's principle that projection is an SDK-layer responsibility.

**`getActionMetadata()` extension:**

`getActionMetadata()` SHOULD include a `hasDispatchableGate: boolean` flag so tooling can distinguish actions with fine-grained admission from those relying solely on body-level validation.

---

## 5. Semantic Invariants

### INV-1: Purity

`dispatchable when` MUST be a pure expression. No effects, no IO, no Host state.

### INV-2: Determinism

Given identical `(schema, snapshot, intent)`, `isIntentDispatchable()` MUST always return the same result.

### INV-3: Separation from Governance

`dispatchable` is semantic admission, not authority. Governance (`propose` / `approve` / `reject`) remains orthogonal.

### INV-4: Coarse/Fine Split

`available` is the action-family coarse gate. `dispatchable` is the bound-intent fine gate. Their scopes MUST NOT be merged.

### INV-5: Outcome Independence

`dispatchable == true` does not guarantee `success`. The action body may still `fail` or `stop`. `dispatchable` is admission, not outcome.

### INV-6: Backward Compatibility of `available`

`available when` retains its current A28 constraints exactly. No input, no `$meta.*`, no `$system.*`.

### INV-7: Available Precedes Dispatchable

If `isActionAvailable()` returns `false`, `isIntentDispatchable()` MUST return `false` without evaluating the dispatchable expression. Evaluation order is: available first, dispatchable second. This is normative, not an optimization.

### INV-8: `$meta.*` Exclusion

`dispatchable when` MUST NOT reference `$meta.*`. Lineage context (epoch, version, timestamp) is not part of semantic admission. This prevents evaluation-time coupling to metadata that varies across branches or replay.

---

## 6. Consequences

### Positive

1. **Action explosion prevention.** Battleship-class domains no longer need 64 separate actions to encode cell-level legality. One parameterized action with a `dispatchable when` clause replaces them.
2. **Pre-dispatch explainability.** Agents and UI can ask "why can't I dispatch `shoot(18)`?" and receive a declarative answer from the schema, not a runtime exception.
3. **ARC-AGI-3 action efficiency.** Agents can filter invalid intents *before* spending action budget, directly improving scored efficiency.
4. **`dispatchAsync()` semantic alignment.** The SDK verb `dispatchAsync` now has a matching schema concept `dispatchable` — the naming is self-documenting.
5. **Coarse gate preservation.** `getAvailableActions()` remains fast and input-free for UI button states and agent action-space pruning.

### Trade-offs

1. **One more legality concept.** Users must learn the available/dispatchable distinction. Mitigation: the Battleship example makes the distinction intuitive, and the default (`true`) means simple domains never see it.
2. **Compiler/Core/SDK surface expansion.** Three packages gain new API surface. Mitigation: the new surface is small (one expression scope, one Core function, one SDK method).
3. **Documentation update scope.** Core SPEC, SDK SPEC, Compiler SPEC, MEL language docs, and Studio docs all require updates. This is manageable as a single coordinated release.

---

## 7. Migration Strategy

### Before (current pattern)

```mel
action shoot(cellIndex: number) available when canShoot {
  when neq(at(cells, cellIndex), "unknown") {
    fail "CELL_NOT_SHOOTABLE" with "This cell has already been targeted"
  }

  onceIntent {
    patch cells = updateAt(cells, cellIndex, "pending")
    patch shotsFired = add(shotsFired, 1)
  }
}
```

### After (proposed pattern)

```mel
action shoot(cellIndex: number)
  available when canShoot
  dispatchable when eq(at(cells, cellIndex), "unknown")
{
  onceIntent {
    patch cells = updateAt(cells, cellIndex, "pending")
    patch shotsFired = add(shotsFired, 1)
  }
}
```

**Migration guidance:**

- **Action-level coarse preconditions** stay in `available when`.
- **Input-dependent semantic legality** moves to `dispatchable when`.
- **Execution-time narrative** (`fail` for business rule violations, `stop` for early termination) stays in the action body.
- **Existing actions without `dispatchable when`** behave identically — the default is `true`.

This is a syntactically additive change. No existing MEL source requires modification, and actions without `dispatchable when` behave identically. However, when an action **adopts** `dispatchable when` by migrating body-level `when`/`fail` guards into the new clause, invalid intents will shift from body-level failure (post-execution, with snapshot mutation) to pre-dispatch rejection (no execution, no snapshot mutation). This is an observable behavioral change for the adopting action — intentional and beneficial, but not invisible.

---

## 8. Open Questions

### OQ-1: `getActionMetadata()` dispatchable expression exposure

Should `getActionMetadata()` expose the raw `dispatchable` expression AST for agent consumption?

**Leaning:** Yes. Agents benefit from reading the admission predicate to construct valid intents proactively rather than trial-and-error. This is consistent with Manifesto's principle that legality should be readable, not opaque.

### OQ-2: SchemaGraph input node kind

Should SchemaGraph eventually introduce an `input` node kind to represent `dispatchable` dependencies?

**Leaning:** Not in v1. The graph is schema-derived and static. Input nodes are intent-instance-specific. Defer until concrete tooling demand emerges (per "separate by evidence, not speculation").

### OQ-3: Compound dispatchable expressions

Should `dispatchable when` support `and()` / `or()` composition for multi-condition admission?

**Leaning:** Yes, naturally — it uses the same `ExprNode` system as `available when`. No special handling needed. The compiler already supports arbitrary pure expression composition.

---

## 9. SPEC Diff Summary

This section summarizes the normative changes required across package SPECs if this ADR is accepted.

### Compiler SPEC

- Add `DispatchableExpr` context definition (§13.1 companion).
- Add constraint for `dispatchable when` scope rules (next free constraint ID).
- Extend `ActionDecl` grammar: `AvailableClause? DispatchableClause?`.
- Add `ActionSpec.dispatchable?: ExprNode` to compiled output.

### Core SPEC

- Add `isIntentDispatchable()` function (§16.6 companion).
- Add rules DISP-Q-1 through DISP-Q-6.
- Clarify that `compute()` initial invocation checks availability only (not dispatchability) — dispatchability is a pre-`compute()` gate owned by the caller (SDK/Host).

### SDK SPEC

- Add `isIntentDispatchable()` and `getIntentBlockers()` to activated base surface (§7 extension).
- Extend `dispatchAsync()` dequeue semantics to include dispatchability check.
- Add `INTENT_NOT_DISPATCHABLE` error code.
- Extend `simulate()` with SIM-9.
- Extend `getActionMetadata()` with `hasDispatchableGate` flag.

### MEL Language Docs

- Document `dispatchable when` syntax and semantics.
- Add Battleship example as canonical illustration.
- Clarify the three-layer legality model.

---

## 10. Summary

> **`available` is a word for actions. `dispatchable` is a word for intents.**

Manifesto's legality model becomes:

```
available    →  "Can this action family be considered right now?"
                (input-free, coarse, synchronous, UI/agent pruning)

dispatchable →  "Can this specific intent be dispatched right now?"
                (input-aware, fine, synchronous, semantic admission)

outcome      →  "What happened when the intent actually ran?"
                (full runtime, narrative, fail/stop/success)
```

This is the smallest possible extension that closes the gap between coarse action availability and fine intent legality, without breaking any existing contract or invariant. Adopting actions gain pre-dispatch admission control; non-adopting actions are unaffected.

*End of ADR-020 v1*
