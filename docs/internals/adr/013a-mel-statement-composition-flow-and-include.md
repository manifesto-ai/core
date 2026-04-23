# ADR-013a: MEL Statement Composition — `flow` and `include`

> **Status:** Implemented
> **Date:** 2026-03-24
> **Deciders:** Manifesto Architecture Team
> **Scope:** `@manifesto-ai/compiler` (MEL language surface)
> **Depends On:** Compiler SPEC v0.6.0, FDR-MEL-061 (Call Exposure Policy), Core SPEC v3.0.0 §8.4.5
> **Triggered By:** Repeated validation/guard/fail patterns across actions (F-004 family)
> **Related:** ADR-013b (Entity Collection Primitives — separate approval gate)
> **Supersedes:** ADR-013 (Withdrawn — mixed three independent decisions)
> **Breaking:** No — additive syntax via contextual keywords; runtime layers unchanged
> **Implemented In:** Compiler current contract ([SPEC-v1.2.0](https://github.com/manifesto-ai/core/blob/main/packages/compiler/docs/SPEC-v1.2.0.md)), `packages/compiler/src/analyzer/flow-composition.ts`, analyzer/generator/integration/compliance test suites

---

## 1. Context

### 1.1 The Validation Repetition Problem

In `Array<Entity>` domains, multiple actions repeat identical validation-and-fail patterns:

```mel
action softDeleteTask(id: string) {
  when isNull(at(taskIndex, id)) {
    fail "NOT_FOUND" with concat("Task not found: ", id)
  }
  onceIntent { /* ... */ }
}

action restoreTask(id: string) {
  when isNull(at(taskIndex, id)) {
    fail "NOT_FOUND" with concat("Task not found: ", id)
  }
  onceIntent { /* ... */ }
}

action moveTask(taskId: string, newStatus: string) {
  when isNull(at(taskIndex, taskId)) {
    fail "NOT_FOUND" with concat("Task not found: ", taskId)
  }
  onceIntent { /* ... */ }
}
```

3 lines × 3 actions = 9 lines of pure repetition. As domains grow, the same validation gets copy-pasted across 10+ actions.

This is not unique to TaskFlow. Guard-and-fail patterns such as "required field validation," "resource existence check then fail," and "permission check then stop" recur across every domain.

### 1.2 Current MEL Reuse Units and the Gap

| Unit | Reusable? | Parameters? | Contains guards? | Scope |
|------|-----------|-------------|-----------------|-------|
| `computed` | ✅ | ❌ | ❌ | expression |
| `action` | ❌ no inter-action calls | ✅ input | ✅ | statement sequence |
| `type` | ✅ | ❌ | ❌ | type level |

**The gap**: There is no reuse unit that accepts parameters and can hold guard/fail/stop patterns.

`computed` cannot contain guards (expression only). `action` cannot be called from another action (Intent boundary — see §5).

### 1.3 Prior Decision in FDR-MEL-061

FDR-MEL-061 decided to hide Core's `call` FlowNode from MEL while keeping compile-time inlining as a future path:

> "call exists in Core but is not exposed in MEL v0.3.3. MEL uses flat flows with potential **compile-time inlining** in future versions."
> — FDR-MEL-061 Canonical Statement

Compiler SPEC v0.6.0 §13.4 Future Consideration also outlined a concrete syntax:

```mel
// POTENTIAL v0.4+ syntax (NOT in v0.3.3)
flow validateUser() {
  when isNull(userId) {
    fail "MISSING_USER"
  }
}

action createPost() {
  include validateUser()  // Compile-time inline, no FlowNode call
  // ...
}
```

This ADR realizes the future path that FDR-MEL-061 left open.

### 1.4 Existing Semantics of Core `call`

Core SPEC v3.0.0 §8.4.5 and FDR-008 define `call` semantics as follows:

> "`call` means 'continue with another Flow on the same Snapshot.' Nothing more."
> — FDR-008 Canonical Statement

- The called Flow reads from the same Snapshot.
- The called Flow writes to the same Snapshot.
- **There is no parameter passing mechanism.**
- `call` references MUST NOT form cycles (Core SPEC §8.6).

`include` is a **compiler-only form that follows the same composition direction as Core `call` — "continue reading and writing on the same Snapshot."** It does not produce a `call` node in Core IR and does not introduce a new computation model.

**Note**: A `flow` declaration is validated even if it is never included. The Flow Declaration Validation pass (§6.1 pass 2) verifies parameter types, body expressions, guard condition type correctness, and cycle freedom for **all** `flow` declarations before expansion strips them from the AST. Issuing a warning for unused flows is SHOULD.

### 1.5 Why a New ADR Instead of the Withdrawn ADR-013

The original ADR-013 mixed three independent decisions into one:

1. Exposing expression-level `map`/`filter` on the MEL surface (A6 violation risk)
2. `define` — expression macros
3. `flow` + `include` — statement composition

More critically, the motivating example (`define updateById(...) = map(tasks, cond(...))`) was a **compile error** under current MEL. `map`/`filter` are not MEL expression builtins (Compiler SPEC §8.2), and `$item` is only permitted in effect args context (FDR-MEL-068).

This ADR addresses only `flow` + `include` — the axis with the strongest constitutional justification and the narrowest impact surface.

---

## 2. Decision

### 2.1 `flow` — Reusable Guard Statement Sequence

```ebnf
FlowDecl = "flow" Identifier "(" ParamList? ")" FlowBody

FlowBody = "{" { FlowGuardedStmt } "}"
```

A `flow` is declared at the top level of a domain block. The statements permitted in a `flow` body are: `when` guards (containing `fail`/`stop`), and `include` of other flows (enabling flow-to-flow composition).

```mel
flow requirePresent(value: string | null, fieldName: string) {
  when isNull(value) {
    fail "REQUIRED" with concat(fieldName, " is required")
  }
}

flow requireTask(taskId: string) {
  when isNull(at(taskIndex, taskId)) {
    fail "NOT_FOUND" with concat("Task not found: ", taskId)
  }
}

flow rejectIfArchived(taskId: string) {
  when isNotNull(at(taskIndex, taskId).archivedAt) {
    stop "Task is archived, no action needed"
  }
}
```

### 2.2 `include` — Compile-Time Inline

```ebnf
IncludeStmt = "include" Identifier "(" ArgList? ")"
```

`include` is permitted **only in GuardedStmt position** — i.e., at the top level of an action body or a flow body.

```mel
action softDeleteTask(id: string) {
  include requireTask(id)            // GuardedStmt position ✅
  onceIntent {
    patch tasks = /* ... */
  }
}
```

**Compilation result**: The flow body is inlined at the `include` site. The generated Core IR contains no `FlowNode` `call` — only the ordinary `ExprNode` calls (`isNull`, `at`, `concat`, etc.) that were already present in the flow body. Core is unaware that `flow` exists.

### 2.3 Positional Restrictions on `include` — v1 is GuardedStmt Only

| Position | Allowed? | Rationale |
|----------|----------|-----------|
| Action body top-level (GuardedStmt) | ✅ | Validation/fail/stop reuse |
| Inside a guard (InnerStmt) | ❌ compile error | Prevents statement category mixing |
| Computed expression | ❌ not applicable | flow is not an expression |
| Inside another flow body | ✅ | Flow-to-flow composition (acyclic) |

Why InnerStmt is forbidden in v1: If flows could contain `patch`/`effect`, statement category verification would become complex, and expanded results inside guards could compromise re-entry safety. v1 starts at the most conservative point; expansion is deferred to follow-up ADRs.

---

## 3. Design Constraints

### 3.1 Core IR Invariance — Absolute Principle

| Constraint | Rationale |
|------------|-----------|
| No new node kinds are added to Core IR | Core purity preservation (ADR-001) |
| `flow` is invisible to Core | Compiler-internal concept |
| Expanded IR must be byte-identical to manual unrolling | Verifiability. "Manual unrolling" means writing the flow body's statements directly at the include site with parameter names replaced. The comparison covers FlowNode structure and ExprNode structure alike — the only claim is that `include` does not introduce any IR node that would not exist in the hand-written equivalent |

### 3.2 Non-Turing-Complete Guarantee Preserved

| Constraint | Mechanism |
|------------|-----------|
| `flow` cannot recursively include itself | Compiler validates dependency graph; cycle = compile error |
| A flow may include other flows, but the graph must be acyclic | DAG enforcement |
| Expansion depth ceiling (16) | Guards against accidental deep expansion |

### 3.3 Guard Restrictions Inside `flow` — v1 Conservative Policy

| Construct | Allowed in flow? | Rationale |
|-----------|-----------------|-----------|
| `when` | ✅ | Primary content of a flow |
| `fail` (inside when) | ✅ | Core of validation |
| `stop` (inside when) | ✅ | Early exit reuse |
| `once()` | ❌ compile error | Requires domain schema marker — conflicts with reuse unit (§3.3.1) |
| `onceIntent` | ❌ compile error | Idempotency boundary must be owned by the action (§3.3.2) |
| `patch` (inside when) | ❌ compile error | v1 flows are guard+fail/stop only |
| `effect` | ❌ compile error | Same as above |

#### 3.3.1 Why `once()` Is Forbidden

`once(marker)` requires a domain schema state field as its marker (FDR-MEL-021, FDR-MEL-044). If a flow contains `once(step1)`, every domain that includes this flow must have a `step1` state field. This violates the **domain non-intrusion** principle of a reuse unit.

#### 3.3.2 Why `onceIntent` Is Forbidden

`onceIntent` guards are stored in `$mel.guards.intent.<guardId>` (FDR-MEL-074). guardId is generated as `hash(actionName + blockIndex + guardType)` (ADR-002 §2.8). If a flow containing `onceIntent` is included from multiple actions, the actionName differs at each site, so collision does not occur.

However, a more fundamental issue remains: **the idempotency boundary must be owned by the action.** `onceIntent` means "this block in this action executes at most once per intent." If that authority disperses into flows, one can no longer reason about idempotency guarantees by reading the action alone. This harms the readability of the "all mutations are guarded" principle (FDR-MEL-020).

By restricting v1 flows to guard+fail/stop only, a flow becomes a **pure precondition validator.** Idempotency and state mutation live exclusively in actions. This separation simplifies debugging and code review.

### 3.4 Parameter Semantics — Name Substitution

Core `call` has no argument passing mechanism (FDR-008). `include` parameters are not a runtime concept; the compiler substitutes parameter names with the arguments at the call site — **name substitution**.

```mel
// Definition
flow requireTask(taskId: string) {
  when isNull(at(taskIndex, taskId)) {    // 'taskId' = parameter name
    fail "NOT_FOUND" with concat("Task not found: ", taskId)
  }
}

// Call site
action softDeleteTask(id: string) {
  include requireTask(id)                 // 'id' substitutes 'taskId'
  // ...
}

// After expansion (compiler internal)
action softDeleteTask(id: string) {
  when isNull(at(taskIndex, id)) {        // 'taskId' → 'id'
    fail "NOT_FOUND" with concat("Task not found: ", id)
  }
  // ...
}
```

Name substitution is not C-style textual substitution (`#define`) but **AST-level identifier replacement**: every occurrence of the parameter name as an identifier is replaced with the call-site argument. This preserves type-checkability.

**Parameter name collision rules**:

| Rule ID | Level | Description |
|---------|-------|-------------|
| FLOW-PARAM-1 | MUST | Parameter names MUST NOT collide with domain top-level identifiers (state root keys, computed names, type names) — compile error |
| FLOW-PARAM-2 | MUST NOT | Nested field paths (e.g., `Task.id`) are NOT collision targets |

Rationale for collision prohibition: If a parameter name matches a state root key, substitution at the call site could produce an unintended state reference. Checking top-level identifiers is sufficient.

**Include call-site signature rules**:

| Rule ID | Level | Description |
|---------|-------|-------------|
| FLOW-CALL-1 | MUST | The number of arguments at an `include` call site MUST exactly match the number of parameters declared by the target flow |
| FLOW-CALL-2 | MUST | Each argument's type MUST be assignable to the corresponding parameter's declared type |

These rules are enforced during Flow Declaration Validation (pass 2, §6.1) — before expansion. This ensures that a flow's typed signature is a real contract, not decoration. Without call-site validation, parameter types would be partially ornamental: an unused parameter with a type mismatch at the call site could silently pass through expansion and never be caught.

```mel
flow requireTask(id: string) {
  when isNull(at(taskIndex, id)) {
    fail "NOT_FOUND"
  }
}

// ❌ E023: Wrong number of arguments
action test1() {
  include requireTask()                // 0 args, expected 1
}

// ❌ E024: Argument type mismatch
action test2() {
  include requireTask(123)             // number, expected string
}

// ✅ Correct
action test3() {
  include requireTask(taskId)          // string → string ✓
}
```

---

## 4. Grammar Changes

### 4.1 Modified EBNF

```ebnf
(* FlowDecl added to domain block *)
DomainBody      = "{" { TypeDecl | StateDecl | ComputedDecl | ActionDecl | FlowDecl } "}"

(* New declaration *)
FlowDecl        = "flow" Identifier "(" ParamList? ")" FlowBody
FlowBody        = "{" { FlowGuardedStmt } "}"

(* Flow-specific GuardedStmt — excludes once/onceIntent *)
FlowGuardedStmt = FlowWhenStmt | IncludeStmt
FlowWhenStmt    = "when" Expression "{" { FlowInnerStmt } "}"
FlowInnerStmt   = FailStmt | StopStmt | FlowWhenStmt   (* nested when allowed *)

(* IncludeStmt added to action's GuardedStmt *)
GuardedStmt     = WhenStmt | OnceStmt | OnceIntentStmt | IncludeStmt
IncludeStmt     = "include" Identifier "(" ArgList? ")"
```

### 4.2 Keyword Strategy — Contextual Keywords

`flow` and `include` are introduced as **contextual keywords**, following the same strategy as `onceIntent` (FDR-MEL-077). They are NOT reserved keywords.

The current Compiler SPEC Appendix B reserved words list does not contain `flow` or `include`, and existing code may legitimately use them as identifiers (action names, state fields, computed names, object fields, paths, import identifiers, etc.). Adding them as reserved keywords would silently break such code, contradicting the "Breaking: No" declaration above.

Introducing them as contextual keywords preserves existing code parseability, making this a **non-breaking additive syntax** change.

#### 4.2.1 `flow` — Contextual Recognition Rule

| Context | Token Sequence | Interpretation |
|---------|----------------|----------------|
| Domain member start position | `flow` `Identifier` `(` | FlowDecl (keyword) |
| All other contexts | `flow` | Identifier |

```mel
// ✅ Parsed as FlowDecl (domain member start + Identifier + '(')
flow requireTask(taskId: string) {
  when isNull(at(taskIndex, taskId)) {
    fail "NOT_FOUND"
  }
}

// ✅ Parsed as identifier (existing code compatible)
state { flow: string = "default" }
computed flow = "value"
action doSomething(flow: string) { /* ... */ }
```

#### 4.2.2 `include` — Contextual Recognition Rule

| Context | Token Sequence | Interpretation |
|---------|----------------|----------------|
| GuardedStmt / FlowGuardedStmt start position | `include` `Identifier` `(` | IncludeStmt (keyword) |
| All other contexts | `include` | Identifier |

```mel
// ✅ Parsed as IncludeStmt (GuardedStmt start + Identifier + '(')
action softDeleteTask(id: string) {
  include requireTask(id)
  onceIntent { /* ... */ }
}

// ✅ Parsed as identifier (existing code compatible)
state { include: boolean = false }
when eq(include, true) { /* ... */ }
patch include = true
```

#### 4.2.3 Consistency with `onceIntent` Precedent

| Keyword | Recognition position | Lookahead | Precedent |
|---------|---------------------|-----------|-----------|
| `onceIntent` | statement start | `{` or `when` | FDR-MEL-077 |
| `flow` | domain member start | `Identifier` `(` | This ADR |
| `include` | GuardedStmt start | `Identifier` `(` | This ADR |

All three follow the pattern: **"keyword only in a specific position, identifier everywhere else."** The parser change is a localized lookahead rule.

### 4.3 Keyword Name Rationale

| Keyword | Alternatives | Rationale |
|---------|-------------|-----------|
| `flow` | `fragment`, `mixin`, `partial`, `guard` | FDR-MEL-061 already uses `flow`. Consistent with prior decision. `guard` would be misleading if flows are later extended beyond v1 scope |
| `include` | `use`, `call`, `inline`, `apply` | `call` conflicts with Core's runtime concept (FDR-MEL-061 decision). `include` clearly communicates compile-time inlining. Mental model similar to C's `#include` |

---

## 5. What This Does NOT Include

### 5.1 InnerStmt-Position Include (v2+ Consideration)

```mel
// ❌ Forbidden in v1
action example() {
  onceIntent {
    include someHelper()    // compile error
    patch x = 1
  }
}
```

Use cases requiring InnerStmt include (e.g., common patch pattern reuse) are addressed by ADR-013b entity collection primitives or the subsequent ADR-013c `define` macro.

### 5.2 Action-Action Composition

An action is an **Intent boundary**. One `dispatch()` = one action = one terminal snapshot. This is a core invariant of Manifesto (SDK SPEC §11.1 INV-1, §11.5 INV-5, §11.6 INV-6).

| Reuse target | Solution | Layer |
|-------------|----------|-------|
| Validation/guard logic | `flow` + `include` | MEL compile-time **(this ADR)** |
| Computation patterns (expression) | `define` | MEL compile-time (future ADR-013c) |
| Entity lookup/transform | `findById`/`updateById` | MEL builtin (future ADR-013b) |
| Action sequencing | `dispatchAsync` chaining | Caller runtime |
| Action causal reaction | `on('dispatch:completed')` | Caller runtime |

### 5.3 Expression Macro (`define`)

Expression-level reuse is addressed in a separate ADR-013c. It is approved independently of this ADR.

### 5.4 Entity Collection Primitives (`findById`, `updateById`, etc.)

Addressed in a separate ADR-013b. Approved independently of this ADR. Both ADRs may proceed in parallel, but neither serves as the other's justification.

---

## 6. Compilation

### 6.1 Compiler Pass Ordering

```
MEL Source
    │
    ▼
[1] Parse → AST (includes FlowDecl, IncludeStmt)
    │
    ▼
[2] Flow Declaration Validation Pass ← added by this ADR
    │  ├─ Collect all flow declarations (including unused ones)
    │  ├─ Parameter type validation
    │  ├─ Guard condition type validation (e.g., boolean-only)
    │  ├─ Include target resolution (all targets must be declared flows)
    │  ├─ Include call-site signature validation (arity + type compatibility)
    │  ├─ Cycle detection across ALL declared flows (not just reachable ones)
    │  ├─ Forbidden construct detection (once/onceIntent/patch/effect in flow)
    │  └─ Unused flow warning (SHOULD)
    │
    ▼
[3] Flow Expansion Pass ← added by this ADR
    │  ├─ Expansion depth check (ceiling 16)
    │  ├─ Parameter name substitution
    │  ├─ Inline flow body at include sites
    │  └─ Remove FlowDecl and IncludeStmt from AST
    │
    ▼
[4] Expanded AST (FlowDecl removed, IncludeStmt removed)
    │
    ▼
[5] Type Check → System Lowering → IR Generation
    │
    ▼
Core IR (no trace of flow/include)
```

**Why two separate passes**: The responsibilities are distinct and must not be collapsed.

- **Declaration Validation** (pass 2) enforces that all flow declarations — including unused ones — are well-formed. This is where FLOW-TYPECHECK-1 ("all flows are type-checked") and FLOW-3 ("circular include is a compile error") live. The pass operates on the **full AST** before any declarations are removed.
- **Expansion** (pass 3) performs inlining and then strips flow/include nodes from the AST. This is a **lowering** step whose sole job is to produce an expanded AST that Core has never heard of.

If these were a single pass, unused flows would vanish before type checking, creating a silent hole. Consider:

```mel
flow bad(taskId: string) {
  when taskId {           // boolean-only violation — MUST be caught
    fail "BAD"
  }
}
// bad is never included — but Declaration Validation still catches the error
```

Similarly, mutually recursive unused flows must still be detected:

```mel
flow A() { include B() }
flow B() { include A() }
// Neither is included from any action — but cycle detection still fires
```

**`$system.*` deduplication**: Flow Expansion runs before Type Check (pass 5), so `$system.time.now` inlined multiple times into the same action is deduplicated per FDR-MEL-052 during System Lowering.

### 6.2 Compile Errors

```
E013: Circular include detected.
      flow A includes flow B which includes flow A.

E014: Include expansion depth exceeds limit (16).
      Simplify flow composition.

E015: Include target is not a declared flow.
      'include nonExistent()' — 'nonExistent' is not a flow.

E016: Include not allowed in InnerStmt position.
      'include' can only appear at action or flow body top-level (GuardedStmt position).

E017: once() not allowed in flow (v1).
      Flows are guard+fail/stop only. Use once()/onceIntent in the action body.

E018: onceIntent not allowed in flow (v1).
      Same rationale as E017.

E019: patch not allowed in flow (v1).
      Flows are guard+fail/stop only.

E020: effect not allowed in flow (v1).
      Flows are guard+fail/stop only.

E021: Flow parameter name conflicts with top-level identifier.
      Parameter 'tasks' conflicts with state field 'tasks'.

E022: Flow and action share the same name.
      flow 'softDeleteTask' conflicts with action 'softDeleteTask'.

E023: Wrong number of arguments for included flow.
      'include requireTask()' — expected 1 argument, got 0.

E024: Include argument type mismatch.
      'include requireTask(123)' — argument 1: expected string, got number.
```

### 6.3 Source Location Mapping

| Rule ID | Level | Description |
|---------|-------|-------------|
| FLOW-DIAG-1 | MUST | Errors arising from expanded code MUST report **both** the original flow definition site and the include call site |

```
Error: fail code "NOT_FOUND" has no message — did you mean 'fail "NOT_FOUND" with ...'?
  at flow requireTask (taskflow.mel:12:5)
  included from action softDeleteTask (taskflow.mel:25:3)
```

---

## 7. Rules Summary

| Rule ID | Level | Description |
|---------|-------|-------------|
| FLOW-1 | MUST | `include` MUST inline-expand the flow body at compile time |
| FLOW-2 | MUST | Expanded IR MUST contain no FlowNode `{ kind: 'call' }` introduced by `include`. Ordinary ExprNode `{ kind: 'call' }` (builtin functions) are unaffected |
| FLOW-3 | MUST | Circular include across ALL declared flows MUST be a compile error (even if unreachable from actions) |
| FLOW-4 | MUST | Expansion depth exceeding the ceiling (16) MUST be a compile error |
| FLOW-5 | MUST | `flow` MUST only appear at domain block top-level |
| FLOW-6 | MUST | `include` MUST only be allowed in GuardedStmt position in action or flow bodies (not InnerStmt) |
| FLOW-7 | MUST | `flow` body MUST NOT contain `once`/`onceIntent`/`patch`/`effect` (v1) |
| FLOW-8 | MUST | A `flow` and an `action` MUST NOT share the same name |
| FLOW-9 | MUST | Expanded IR MUST be byte-identical to manual unrolling |
| FLOW-KW-1 | MUST | `flow` is a contextual keyword: keyword only at domain member start + `Identifier` `(` |
| FLOW-KW-2 | MUST | `include` is a contextual keyword: keyword only at GuardedStmt/FlowGuardedStmt start + `Identifier` `(` |
| FLOW-KW-3 | MUST | Outside the above contexts, `flow`/`include` MUST parse as identifiers (existing code compatibility) |
| FLOW-PARAM-1 | MUST | Parameter names MUST NOT collide with domain top-level identifiers |
| FLOW-PARAM-2 | MUST NOT | Nested field paths MUST NOT be treated as collision targets |
| FLOW-CALL-1 | MUST | `include` argument count MUST exactly match target flow parameter count |
| FLOW-CALL-2 | MUST | Each `include` argument type MUST be assignable to the corresponding parameter type |
| FLOW-TYPECHECK-1 | MUST | All flow declarations, including unused ones, MUST be validated in the Declaration Validation pass (§6.1 pass 2) before expansion |
| FLOW-TYPECHECK-2 | SHOULD | The compiler SHOULD emit a warning for unused flow declarations |
| FLOW-DIAG-1 | MUST | Error messages MUST include both the flow definition site and the include call site |

---

## 8. Impact Assessment

### 8.1 Compiler Changes

| Component | Change Level |
|-----------|-------------|
| Lexer | 2 contextual keywords added: `flow`, `include` |
| Parser | 2 new AST nodes: `FlowDecl`, `IncludeStmt` |
| New Pass 1 | Flow Declaration Validation — type checking, cycle detection, forbidden construct detection |
| New Pass 2 | Flow Expansion — name substitution, inlining, AST stripping |
| Diagnostics | Pre-/post-expansion source mapping |

### 8.2 Core Changes: None

Core IR, `compute()`, `apply()`, FlowNode types — all unchanged.

### 8.3 Host/World/SDK Changes: None

Fully resolved at compile time; no runtime layer impact.

### 8.4 Documentation Changes

- Add `flow` and `include` sections to Compiler SPEC
- Add flow/include-related errors to §8.2 Semantically Forbidden
- Add "include is the realized path" note to §13.4 Call Policy
- Add flow declarations and include usage patterns to MEL Reference
- Migration guide: extracting repeated validation patterns into flows

---

## 9. Before / After — TaskFlow Domain

### Before (current, repeated validation)

```mel
action softDeleteTask(id: string) {
  when isNull(at(taskIndex, id)) {
    fail "NOT_FOUND" with concat("Task not found: ", id)
  }
  onceIntent {
    patch tasks = /* updateById — ADR-013b scope */
  }
}

action restoreTask(id: string) {
  when isNull(at(taskIndex, id)) {
    fail "NOT_FOUND" with concat("Task not found: ", id)
  }
  onceIntent {
    patch tasks = /* ... */
  }
}

action moveTask(taskId: string, newStatus: string) {
  when isNull(at(taskIndex, taskId)) {
    fail "NOT_FOUND" with concat("Task not found: ", taskId)
  }
  onceIntent {
    patch tasks = /* ... */
  }
}
```

### After (with `flow` + `include`)

```mel
flow requireTask(taskId: string) {
  when isNull(at(taskIndex, taskId)) {
    fail "NOT_FOUND" with concat("Task not found: ", taskId)
  }
}

action softDeleteTask(id: string) {
  include requireTask(id)
  onceIntent {
    patch tasks = /* ... */
  }
}

action restoreTask(id: string) {
  include requireTask(id)
  onceIntent {
    patch tasks = /* ... */
  }
}

action moveTask(taskId: string, newStatus: string) {
  include requireTask(taskId)
  onceIntent {
    patch tasks = /* ... */
  }
}
```

**Change**: The 3-line × N-action validation repetition is replaced by a single `include` line per action. Validation logic is centralized in one flow definition. Each action declares *what* it validates at the intent level.

---

## 10. Alternatives Considered

### 10.1 Do Nothing (Maintain Current State)

- Repetition is tolerable — explicit and traceable
- Maintenance cost grows linearly as domains expand
- **Rejected**: Reported as friction from real usage (TaskFlow). Guard+fail repetition occurs across all domains

### 10.2 Expression Macro Only (Without flow)

- Reuse guard condition expressions via `define`
- The `when`/`fail` statement structure still repeats
- **Rejected**: The core friction is not in expressions but in the repetition of the entire "when + fail" **block**. Extracting only the expression solves half the problem

### 10.3 Expose Core `call` Node

- Add runtime flow invocation to Core IR
- **Rejected**: No reason to reverse FDR-MEL-061 decision. Compile-time inlining achieves equivalent value. Core purity preservation takes priority

### 10.4 Add `flow`/`include` as Reserved Keywords

- Simpler parser implementation
- **Rejected**: Compiler SPEC Appendix B reserved words list does not contain `flow`/`include`, and existing code may use them as identifiers. Adding reserved keywords is a breaking change. `onceIntent` was designed as a contextual keyword per FDR-MEL-077; following the same strategy is consistent

### 10.5 Introduce Guard-Level and InnerStmt-Level flow Together

- Allow flows to contain guards, patches, and effects
- **Rejected**: Statement category mixing increases verification complexity. `once()`/`onceIntent` interaction issues (Critical 2 from the withdrawn ADR-013). v1 starts conservatively; expansion follows as needed

---

## 11. Acceptance Criteria

- [ ] MEL containing `flow` + `include` compiles, and the generated IR contains no FlowNode `{ kind: 'call' }` nodes
- [ ] Circular `include` → compile error with clear message (E013)
- [ ] `once()` inside `flow` → compile error (E017)
- [ ] `onceIntent` inside `flow` → compile error (E018)
- [ ] `patch` inside `flow` → compile error (E019)
- [ ] `effect` inside `flow` → compile error (E020)
- [ ] `include` in InnerStmt position → compile error (E016)
- [ ] Expansion depth exceeding ceiling (16) → compile error (E014)
- [ ] Parameter name colliding with top-level identifier → compile error (E021)
- [ ] flow and action sharing the same name → compile error (E022)
- [ ] Expanded IR is byte-identical to manual unrolling (FLOW-9)
- [ ] TaskFlow domain refactored with flow validates identically to original
- [ ] Error messages include both flow definition site and include call site (FLOW-DIAG-1)
- [ ] Existing code using `flow` as identifier parses correctly: `state { flow: string = "" }`, `patch flow = "x"` (FLOW-KW-3)
- [ ] Existing code using `include` as identifier parses correctly: `when eq(include, true) { ... }` (FLOW-KW-3)
- [ ] `include` with wrong argument count → compile error (E023, FLOW-CALL-1)
- [ ] `include` with wrong argument type → compile error (E024, FLOW-CALL-2)
- [ ] Unused flow declarations are type-checked (FLOW-TYPECHECK-1)

---

## 12. Future Considerations (Non-Normative)

### 12.1 InnerStmt Include (v2 Candidate)

If guard-interior include becomes necessary, a statement category tag can be introduced for flows:

```mel
// Hypothetical v2 syntax
flow stampUpdate(id: string) : inner {   // explicit category
  patch tasks = updateById(tasks, id, { updatedAt: $system.time.now })
}
```

If `onceIntent` is later permitted in flows, guardId generation should use flowName + actionName + blockIndex, stored under `$mel.guards.flow.<guardId>` — consistent with the `$mel.guards.intent` precedent.

### 12.2 Cross-Domain Flow (Module System)

```mel
// Hypothetical future syntax
import { requireAuth } from "@org/common-flows"
```

Cross-domain flow sharing requires a separate module system ADR.

---

## 13. References

- FDR-MEL-061 — Call Exposure Policy ("Core retains, MEL hides")
- Compiler SPEC v0.6.0 §13.4 — Call Policy & Future Consideration
- Core SPEC v3.0.0 §8.4.5 — `call` FlowNode
- FDR-008 — Call Without Arguments
- FDR-MEL-020 — Guard-Mandatory Effects
- FDR-MEL-021 — Explicit once() Marker
- FDR-MEL-044 — Once Marker Enforcement
- FDR-MEL-074 — onceIntent Sugar
- FDR-MEL-077 — onceIntent Contextual Keyword (precedent for flow/include keyword strategy)
- ADR-002 §2.8 — GuardId Generation Policy
- SDK SPEC v1.0.0 §11.1, §11.5, §11.6 — INV-1, INV-5, INV-6
- F-004 (FRICTION.md) — MEL validation/guard boilerplate
- ADR-013 (Withdrawn) — Original mixed ADR

---

*End of ADR-013a*
