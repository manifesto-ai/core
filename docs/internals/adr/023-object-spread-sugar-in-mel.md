# ADR-023: Object Spread Sugar in MEL

> **Status:** Accepted
> **Date:** 2026-04-23
> **Deciders:** Manifesto Architecture Team
> **Scope:** `@manifesto-ai/compiler` (MEL surface form)
> **Affected Packages:** `@manifesto-ai/compiler` (MEL parser, type checker, lowering)
> **Current Normative Source:** Compiler SPEC v1.3.0 §5, MEL Reference §5.7, MEL LLM Context
> **Supersedes:** None
> **Breaking:** No runtime/Core breaking — additive syntax only. Compiler type inference for existing `merge()` calls MAY be tightened where current behavior was unsound around nullable or presence-aware object operands. No change to `DomainSchema` hash, `SchemaGraph`, Core IR, runtime semantics, or any existing non-typing contract.

This ADR is the accepted decision record for object-literal spread in MEL. The current normative wording now lives in `packages/compiler/docs/SPEC-v1.2.0.md` and the maintained MEL docs. Parser, lowering, analyzer, and compiler compliance coverage landed on 2026-04-23; this ADR now remains as rationale and acceptance history.

---

## Review History

| Round | Reviewer | Finding | Resolution Version |
|-------|----------|---------|-------------------|
| 1 | Independent (GPT) | (a) patch-form Core IR equivalence overreach; (b) nullable vs optional conflation; (c) empty object grammar breakage | v2 |
| 2 | Independent (GPT) | Conditional contributor model incomplete (reverse direction / fallback-before-nullable-spread) | v3 |
| 3 | Independent (GPT) | Operand-level contributor classification breaks compositional closure; incompatible union unhandled | v4 |
| 4 | Independent (GPT) | Optional field consumption rule undefined; `merge()` type inference consistency implicit | v5 |
| 4 (minor) | Independent (GPT) | Breaking clause precision (type inference tightening on existing `merge()`) | v5 (header) |
| 5 | Independent (GPT) | **GO** for ADR acceptance and SPEC patch planning, conditional on §7.8 Implementation Cost Validation gate | v5 |

---

## Revision History

### v5 (2026-04-23) — Round 4 Review Fixes + Minor Header Precision

- §4.5 Presence-Aware Field Consumption (SPREAD-CONSUME-1 through -5): optional field read → `T | null` at boundary, aligned with MEL's `at()`/`first()`/`last()` idiom; preserves optional ≠ nullable distinction in the type system, converges only at read boundary
- §4.6 `merge()` Type Inference Extension (SPREAD-MERGE-TYPE-1): explicit consistency between direct `merge(presence-aware, ...)` and spread-form lowering
- Cases J, K, L, M added to §7.4 for consumption and merge-form parity guards
- Open Question 9 dissolved into §4.5 (normative); narrower Open Question 10 added for diagnostic quality
- Header `Breaking` clause clarified to note possible compiler type-inference tightening for existing `merge()` call sites that had unsound nullable-operand behavior

### v4 (2026-04-23) — Round 3 Review Fixes

Field-level contributor classification (operand-level was insufficient for compositional closure); union normalization rules (SPREAD-PRES-UNION-1/2); Cases F/G/H/I added.

### v3 (2026-04-23) — Round 2 Review Fixes

Presence-aware contributor model for nullable spread (SPREAD-PRES framework); object-only union closure (SPREAD-OP-5); Case D added.

### v2 (2026-04-23) — Round 1 Review Fixes

Patch-layer equivalence scoping (v1 falsely claimed byte-identical Core IR between `patch = spread` and `patch merge`); nullable-vs-optional distinction per MEL §3.3; empty-object grammar `{}` restored.

### v1 (2026-04-23) — Initial Draft

Original proposal. Superseded.

---

## 1. Context

### 1.1 The Problem

Manifesto domains require composing objects with field overrides as a first-class authoring pattern. The canonical expressions are `merge()` at the expression layer and `patch path merge expr` at the patch layer:

```mel
computed enriched = merge(item, { status: "active", ts: $meta.timestamp })

effect array.map({
  source: items,
  select: merge($item, { processed: true, source: "api" }),
  into: result
})

patch draft merge {
  submissionState: "submitted"
}
```

These forms are semantically sufficient. They are not sufficient for authoring comfort, per evidence in §1.2.

### 1.2 Evidence

**Manifesto designer (self-authored).** Repeated reports that `merge(...)` bracket nesting creates a reading and writing barrier.

Stimulus:

```mel
type CheckoutDraft = {
  customerId: string,
  appliedCouponId: string | null,
  submissionState: "idle" | "ready" | "submitted"
}

// Sanctioned form:
patch draft merge {
  submissionState: "submitted"
}

// Hand-reached-for form:
patch draft = {
  ...draft,
  submissionState: "submitted"
}
```

**Agent collaborators (independent evidence).** Multiple LLM collaborator sessions have independently flagged the same friction point.

Triangulation: both channels independently indicate real friction, not a single-channel artifact.

### 1.3 The Constraint

Manifesto's architecture enforces strict surface boundaries:

- MEL is not Turing-complete (structural property)
- MEL is **not a subset of JavaScript** — declines JS features deliberately
- Harness principle: safety through structural impossibility, not behavioral prohibition

This ADR proposes a bounded, named exception with explicit defense against generalization.

### 1.4 Contract Position at Proposal Time

Compiler SPEC v1.1.0 §5.1:

> Only ordinary function-call forms are part of this contract. No new arm syntax, named arguments, or parser-only shorthand is implied here.

Object spread is **parser-only shorthand**. This ADR explicitly amends §5.1 to admit object-literal spread as the sole parser-level surface extension.

### 1.5 Prior Withdrawal Lineage (ADR-005)

| Ground | ADR-005 | ADR-023 |
|---|---|---|
| §6.1 Zero String Paths | Violated | N/A |
| §2 Priority 8 (Simplicity) | Overhead exceeded alternative | Pure `merge()` equivalence; no new IR |
| Alternative exists | Yes, deployed | Yes (`merge()`), insufficient per evidence |
| Motivation | Future v3 coordinates | Current triangulated friction |
| §8.2 | "Future requirements not specified" | Present, documented, reproducible |

---

## 2. Decision

### 2.1 Grammar Admission

```ebnf
ObjectLiteral ::= "{" [ ObjectEntry ( "," ObjectEntry )* ","? ] "}"

ObjectEntry   ::= NamedField
               | SpreadEntry

NamedField    ::= Identifier ":" Expression
SpreadEntry   ::= "..." Expression
```

The outer bracket `[ ... ]` preserves empty-object parsing (`{}`).

| Rule ID | Level | Description |
|---------|-------|-------------|
| SPREAD-1 | MUST | Accept `"..." Expression` as valid `ObjectEntry` inside object literals |
| SPREAD-2 | MUST | Spread entries MAY appear at any position |
| SPREAD-3 | MUST | An object literal MAY contain multiple spread entries, or zero entries (`{}`) |
| SPREAD-4 | MUST NOT | Spread MUST NOT be admitted outside object literal expressions |
| SPREAD-5 | MUST | Spread entry AST MUST be structurally distinct from named-field entries |

### 2.2 Operand Shape

| Rule ID | Level | Description |
|---------|-------|-------------|
| SPREAD-OP-1 | MUST | Each spread operand's static type MUST resolve to an object-shaped type or `T \| null` where `T` is object-shaped |
| SPREAD-OP-2 | MUST | `Record<string, T>` operands MUST be rejected in v1 |
| SPREAD-OP-3 | MUST | Primitive, array, or union-including-non-object-non-null-branch types MUST be rejected |
| SPREAD-OP-4 | MUST | `T \| null` (object-shaped `T`) operands MUST be accepted under SPREAD-PRES rules (§4.2) |
| SPREAD-OP-5 | MUST NOT | Object-only union operands MUST NOT be admitted in v1. Only `T \| null` is admissible |

### 2.3 Same-Key Conflict Resolution

| Rule ID | Level | Description |
|---------|-------|-------------|
| SPREAD-KEY-1 | MUST | When multiple entries contribute the same key, source-order determines contributor precedence |
| SPREAD-KEY-2 | MUST | Named fields and spread entries compete on source order alone |
| SPREAD-KEY-3 | MUST | Simple last-wins type narrowing applies only to unconditional **field contributors** (per §4.2). Conditional field contributors follow SPREAD-PRES |

---

## 3. Lowering

### 3.1 Expression-Level Lowering

| Rule ID | Level | Description |
|---------|-------|-------------|
| SPREAD-LOWER-1 | MUST | Lower object-spread literals (as expressions) to `merge()` expressions with argument order preserved |
| SPREAD-LOWER-2 | MUST | Consecutive named-field entries between spread entries MUST group into a single object-literal argument |
| SPREAD-LOWER-3 | MUST | Lowered Core Runtime IR MUST use existing expression kinds only |
| SPREAD-LOWER-4 | MUST | No new `ExprNode` kind is introduced |

Canonical lowering:

```
{ f1: v1, ...a, f2: v2, f3: v3, ...b, f4: v4 }
  ↓
merge({ f1: v1 }, a, { f2: v2, f3: v3 }, b, { f4: v4 })
```

### 3.2 Patch-Layer Behavior

**Spread is an expression-level sugar.** When used as `patch path = expr` RHS, the statement is a `set` patch whose value is the lowered `merge()`. **Distinct** from `patch path merge expr`.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SPREAD-PATCH-LOWER-1 | MUST | `patch path = <object-spread>` MUST lower to `set` patch with lowered `merge(...)` value |
| SPREAD-PATCH-LOWER-2 | MUST | `patch path merge expr` preserved unchanged; no patch-layer grammar change |
| SPREAD-PATCH-LOWER-3 | MUST | `set` and `merge` are distinct patch operations and MAY differ at edge cases (Open Question 5) |

### 3.3 Semantic Equivalence Requirement

| Rule ID | Level | Description |
|---------|-------|-------------|
| SPREAD-EQ-1 | MUST | Spread-involving **expression** IR MUST be byte-identical to canonical `merge()` rewrite's expression IR |
| SPREAD-EQ-2 | MUST | `compute()` output MUST be byte-identical for contexts admitting both forms |
| SPREAD-EQ-3 | MUST NOT | MUST NOT claim equivalence between `patch path = <spread>` and `patch path merge <object>` |

---

## 4. Type System Impact

### 4.1 Presence-Tracking Object Type

Each field in a presence-tracking object type carries:

- `type` — value type
- `presence` — one of `{required, optional}`

Orthogonal to nullability. Valid combinations: `required: T`, `required: T | null`, `optional: T`, `optional: T | null`.

**Closure property.** Presence propagates across spread composition (see §4.2) and consumption (see §4.5). N-level chained spreads preserve presence soundness by induction.

**Implementation note.** This ADR assumes compiler `TypeDefinition` supports both type and presence flag on object fields. Phase 2 MUST verify against `@manifesto-ai/compiler` source.

### 4.2 Field-Level Contributor Classification and Presence-Aware Typing

Contributor classification is **per-field**, not per-operand.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SPREAD-PRES-1 | MUST | Spread-involving literal result type MUST be computed as presence-tracking object type |
| SPREAD-PRES-2 | MUST | **Field-level classification:** **(a)** Named field → unconditional. **(b)** Non-nullable operand: required field → unconditional; optional field → conditional. **(c)** `T \| null` operand: every field of `T` → conditional, regardless of declared presence inside `T` |
| SPREAD-PRES-3 | MUST | **Unconditional contributor effect:** overwrites prior state; result becomes `{presence: required, type: <declared type>}` |
| SPREAD-PRES-4 | MUST | **Conditional contributor effect:** combines with prior state: **(a)** no prior → `{optional, <declared type>}`; **(b)** prior optional (type `T_prev`) → `{optional, T_prev ∪ <declared type>}`; **(c)** prior required (type `T_prev`) → `{required, T_prev ∪ <declared type>}`. Union per SPREAD-PRES-UNION |
| SPREAD-PRES-5 | MUST | Optional fields MUST NOT satisfy required fields of assignment target; compiler MUST require explicit unconditional contribution |
| SPREAD-PRES-6 | MAY | Implementations MAY warn when optional field is never promoted to required |

| Rule ID | Level | Description |
|---------|-------|-------------|
| SPREAD-PRES-UNION-1 | MUST | Normalize value-type unions using existing MEL type-unification rules (e.g., literal-subtype absorption, nullable absorption) |
| SPREAD-PRES-UNION-2 | MUST | Reject spread expression with diagnostic if resulting union cannot be represented in MEL's current type system |

### 4.3 Record Spread Deferred

| Rule ID | Level | Description |
|---------|-------|-------------|
| SPREAD-REC-1 | MUST NOT | `Record<string, T>` operands MUST be rejected in v1 |

### 4.4 Patch RHS Assignability

| Rule ID | Level | Description |
|---------|-------|-------------|
| SPREAD-PATCH-1 | MUST | `patch path = <object-spread>` undergoes standard assignability check |
| SPREAD-PATCH-2 | MUST | Fields not declared on target MUST be rejected at compile time |
| SPREAD-PATCH-3 | MUST NOT | MUST NOT silently drop extra fields at runtime |
| SPREAD-PATCH-4 | MUST | Optional fields MUST NOT satisfy required fields on target |
| SPREAD-PATCH-5 | MUST | Existing `patch path merge expr` form remains unchanged |

### 4.5 Presence-Aware Field Consumption

Presence information, once introduced by spread, MUST have a defined observation rule wherever a presence-aware object is consumed.

MEL's existing absence-observation idiom (`at(arr, i) → T | null`, `first(arr) → T | null`, `last(arr) → T | null`, `coalesce()` for explicit normalization) is the pattern this ADR aligns with: **absence is observed as `null` at the read boundary, and explicit normalization is the author's responsibility when a required `T` is needed.**

| Rule ID | Level | Description |
|---------|-------|-------------|
| SPREAD-CONSUME-1 | MUST | Presence-aware object types MAY flow into computed expressions, action bodies, effect arguments, and other expression contexts |
| SPREAD-CONSUME-2 | MUST | **Direct field access on an optional field MUST have value type `T \| null`**, where `T` is the field's present-value type. An absent optional field is observed as `null` at the expression read boundary |
| SPREAD-CONSUME-3 | MUST | A value read from an optional field MUST NOT satisfy a non-null required argument or target type unless explicitly normalized (`coalesce(...)`, a later unconditional object contribution, or a structural override) |
| SPREAD-CONSUME-4 | MUST | Spread re-use and dot access MUST agree on presence: if spreading preserves a field as optional (per SPREAD-PRES-2), dot access MUST also treat it as optional |
| SPREAD-CONSUME-5 | MUST | If the current Core expression evaluator cannot faithfully observe missing object fields as `null` at runtime, direct optional-field access MUST be rejected at compile time in v1 with a diagnostic directing the author toward `coalesce()` or explicit normalization. Phase 2 MUST verify Core behavior before relaxing |

**Rationale for SPREAD-CONSUME-2 direction.** MEL already treats "absence" as observable `null` in collection and record access. Optional-field dot access aligns with this idiom. Banning dot access on optional fields would make spread results effectively dead-end for consumption, undermining the proposal's motivation.

**Important distinction — optional vs nullable.** SPREAD-CONSUME-2 does not collapse the optional/nullable distinction. The distinction is preserved in the **type system** (assignability, contributor classification, patch target checking) and merges only at the **read boundary** (field value observation):

- Optional field `customerId?: string` cannot satisfy a target field declared `customerId: string` (SPREAD-PRES-5, SPREAD-CONSUME-3)
- But reading `partialDraft.customerId` produces `string | null`, flowing into expression contexts as any other nullable value would

This two-layer model — orthogonal in types, convergent at reads — keeps presence-aware typing sound without requiring new operators for the nullable-vs-optional distinction.

**Illustration:**

```mel
// draft: Draft | null
computed partialDraft = { ...draft }

computed maybeCustomerId = partialDraft.customerId
// maybeCustomerId: string | null (SPREAD-CONSUME-2)

computed label = concat("customer=", partialDraft.customerId)
// COMPILE ERROR: concat arg requires string, got string | null (SPREAD-CONSUME-3)

computed label = concat("customer=", coalesce(partialDraft.customerId, "unknown"))
// OK: explicit normalization
```

### 4.6 `merge()` Type Inference Extension

Since spread lowers to `merge()` (SPREAD-LOWER-1) and spread inputs may be presence-aware (§4.2), `merge()` type inference MUST recognize presence on inputs consistently, whether called via spread sugar or directly.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SPREAD-MERGE-TYPE-1 | MUST | `merge()` type inference MUST handle presence-aware input types per SPREAD-PRES-2/3/4 rules. A direct call `merge(partialDraft, { x: 1 })` MUST produce a result type identical to the lowered form of `{ ...partialDraft, x: 1 }` |

Rationale. Without SPREAD-MERGE-TYPE-1, `{ ...partialDraft }` and its lowered `merge(partialDraft)` could produce different result types, violating SPREAD-EQ-1. This rule makes the implication explicit.

**Non-goal.** Runtime semantics of `merge()` are unchanged: non-object arguments skipped, later keys override. Extension is purely at the type-inference layer.

**Compatibility note.** Per the `Breaking` clause, this type-inference tightening MAY cause existing `merge()` call sites that previously compiled to emit new diagnostics where their nullable-operand handling was unsound. This is a soundness improvement, not a semantic change; affected sites were already producing runtime-surprising values and are now caught at compile time.

---

## 5. Identity and Boundary Preservation

### 5.1 Amendment to "Not a Subset of JavaScript"

The following MUST be incorporated into `docs/mel/LLM-CONTEXT.md`:

> **MEL is not a subset of JavaScript.** Object-literal spread is admitted exclusively as an authoring-ergonomics sugar that lowers to `merge()`. All other JavaScript syntactic forms — array spread, rest destructuring, computed keys, optional chaining, method call syntax, template literals, truthiness coercion — remain unsupported.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SPREAD-BDRY-1 | MUST | `LLM-CONTEXT.md` and MEL reference docs MUST carry the amendment text |
| SPREAD-BDRY-2 | MUST | This ADR's admission MUST NOT be cited as precedent for other JS syntactic forms |
| SPREAD-BDRY-3 | MUST | Compiler MUST emit specific diagnostics for forbidden adjacent forms referencing this ADR's scope boundary |

### 5.2 Patch Layer Untouched

Existing forms preserved: `patch path = expr`, `patch path merge expr`, `patch path unset`, `patch path[key] = expr`, `patch path[key] unset`. The two forms `patch draft = { ...draft, x: v }` and `patch draft merge { x: v }` may be runtime-equivalent under narrow conditions but are not guaranteed byte-identical Core IR.

### 5.3 Harness Surface Accounting

Object-spread admission expands syntactic surface only; action surface is untouched. Presence-aware typing expands the type system surface (§4.1); consumption boundary (§4.5) closes this expansion against silent unsoundness. Agents may continue generating `merge()` forms with identical expression IR.

---

## 6. Considered and Resolved

### 6.1–6.5 (v1) — Unchanged

Identity, contract amendment, ADR-005 precedent, slope risk, harness surface accounting.

### 6.6–6.8 (v2) — Unchanged

Patch IR overreach, nullable-vs-optional conflation, empty-object grammar.

### 6.9–6.10 (v3) — Unchanged

Conditional contributor modeling gap, object-only union closure.

### 6.11–6.12 (v4) — Unchanged

Operand-level classification breaking compositional closure (resolved by field-level classification), value-type union representability.

### 6.13 (v5) — Consumption Boundary Gap

**Concern.** v4 introduced optional presence via SPREAD-PRES but deferred the read-side observation rule to Open Question 9 ("follow-up if unexpected behavior"). This incorrectly categorized consumption rules as peripheral: optional presence is a type-system concept that immediately affects every context where spread results are consumed.

**Resolution.** v5 adds §4.5 defining SPREAD-CONSUME-1 through SPREAD-CONSUME-5. Optional read → `T | null` aligns with MEL's existing "absence as null" idiom. Type-system distinction between optional and nullable is preserved; convergence only at the read boundary.

### 6.14 (v5) — `merge()` Type Inference Consistency

**Concern.** SPREAD-LOWER-1 lowers `{ ...partialDraft }` to `merge(partialDraft)`. Without extending `merge()` type inference to presence-aware inputs, the lowered form could produce a different result type than the spread form, violating SPREAD-EQ-1.

**Resolution.** v5 adds SPREAD-MERGE-TYPE-1 making the extension explicit. Runtime semantics of `merge()` unchanged. Header `Breaking` clause updated to note possible type-inference tightening for existing call sites.

---

## 7. Acceptance Criteria

Implementation landed on 2026-04-23. This checklist is preserved as closure evidence; checked items reflect the current implemented/compiler-covered state.

### 7.1 Semantic Equivalence (Expression Layer Only)

- [x] Spread-involving expression IR byte-identical to canonical `merge()` rewrite
- [x] `compute()` output byte-identical for contexts admitting both forms
- [x] Acceptance suite MUST NOT claim byte-identical Core IR between `patch p = <spread>` and `patch p merge <expr>`
- [x] No new `ExprNode` kind in Core IR

### 7.2 Grammar and Parsing

- [x] `ObjectEntry` admits both named-field and spread forms
- [x] Empty `{}` parses correctly
- [x] Spread entries at leading, trailing, interleaved positions parse
- [x] Multiple spread entries within a single literal parse
- [x] Array spread, rest, computed keys each rejected with diagnostic

### 7.3 Type System

- [x] SPREAD-PRES-2 field-level classification (a)(b)(c) all covered
- [x] SPREAD-PRES-3 unconditional effect
- [x] SPREAD-PRES-4 conditional effect (a)(b)(c) all covered
- [x] SPREAD-PRES-5 optional cannot satisfy required target
- [x] SPREAD-PRES-UNION-1/2 union normalization and rejection
- [x] SPREAD-CONSUME-2 optional field read → `T | null`
- [x] SPREAD-CONSUME-3 normalization required for non-null target
- [x] SPREAD-MERGE-TYPE-1 direct `merge()` with presence-aware input equals spread form
- [x] `Record<string, T>` rejected
- [x] Multi-branch object union `A | B` rejected
- [x] Primitive/array/non-object-union rejected

### 7.4 Patch Integration and Consumption — Mandated Test Cases

Test setup:

```mel
type Draft = {
  customerId: string,
  appliedCouponId: string | null,
  submissionState: "idle" | "ready" | "submitted"
}

state { draft: Draft | null = null }
```

**Case A (negative) — nullable spread alone cannot satisfy required target:**

```mel
action bad() {
  onceIntent {
    patch draft = { ...draft, submissionState: "submitted" }
    // EXPECTED: compile error
  }
}
```

**Case B (positive) — explicit override after nullable spread:**

```mel
action goodAfter(customerId: string) {
  onceIntent {
    patch draft = {
      ...draft,
      customerId: customerId,
      appliedCouponId: null,
      submissionState: "submitted"
    }
  }
}
```

**Case C (positive) — non-nullable base, spread alone sufficient:**

```mel
type Order = { orderId: string, status: "pending" | "shipped" }
state { order: Order = { orderId: "o1", status: "pending" } }

action updateOrder() {
  onceIntent {
    patch order = { ...order, status: "shipped" }
  }
}
```

**Case D (positive) — required fallback before nullable spread:**

```mel
action goodBefore(customerId: string) {
  onceIntent {
    patch draft = {
      customerId: customerId,
      appliedCouponId: null,
      ...draft,
      submissionState: "submitted"
    }
  }
}
```

**Case E (computed regression) — defaults-then-override:**

```mel
type UserPrefs = { theme: string, locale: string }
state { prefs: UserPrefs | null = null }

computed effectiveConfig = {
  theme: "light",
  locale: "en",
  ...prefs
}
// EXPECTED: both fields required, types normalized
```

**Case F — optional preserved through re-spread:**

```mel
computed partialDraft = { ...draft }
computed copiedDraft = { ...partialDraft }
// EXPECTED: all optional preserved
```

**Case G (negative) — optional from non-null re-spread cannot satisfy required target:**

```mel
computed partialDraft = { ...draft }

action badCopy() {
  onceIntent {
    patch draft = { ...partialDraft }
    // EXPECTED: compile error
  }
}
```

**Case H (positive) — fallback before optional-field spread preserves required:**

```mel
computed partialDraft = { ...draft }

action goodCopy(customerId: string) {
  onceIntent {
    patch draft = {
      customerId: customerId,
      appliedCouponId: null,
      submissionState: "idle",
      ...partialDraft
    }
  }
}
```

**Case I (negative) — incompatible union rejected:**

```mel
type Weird = { amount: string }
state { weird: Weird | null = null }

computed x = { amount: 0, ...weird }
// EXPECTED: compile error
```

**Case J — optional field read becomes nullable value:**

```mel
computed partialDraft = { ...draft }
computed maybeCustomerId = partialDraft.customerId
// EXPECTED: maybeCustomerId : string | null
```

**Case K (negative) — optional field value cannot satisfy required without normalization:**

```mel
type CustomerRef = { customerId: string }
state { ref: CustomerRef | null = null }

computed partialDraft = { ...draft }

action badRef() {
  onceIntent {
    patch ref = { customerId: partialDraft.customerId }
    // EXPECTED: compile error
  }
}
```

**Case L (positive) — explicit normalization succeeds:**

```mel
action goodRef() {
  onceIntent {
    patch ref = {
      customerId: coalesce(partialDraft.customerId, "unknown")
    }
  }
}
```

**Case M — direct `merge()` with presence-aware input matches spread form:**

```mel
computed partialDraft = { ...draft }

computed viaSpread = { ...partialDraft, submissionState: "submitted" }
computed viaMerge  = merge(partialDraft, { submissionState: "submitted" })

// EXPECTED: byte-identical result types and expression IR
```

### 7.5 Evidence Preservation

- [ ] §1.2 MUST cite at least one designer-authored scenario and one agent-collaborator feedback instance
- [ ] §6 (including v2, v3, v4, v5 additions 6.6–6.14) MUST be preserved intact

### 7.6 Documentation

- [x] `docs/mel/LLM-CONTEXT.md` amended per §5.1
- [x] `docs/mel/REFERENCE.md` §5.7 adds spread sugar section with patch-layer distinction note and consumption-rule reference
- [x] `docs/mel/SYNTAX.md` updated with object-literal grammar
- [x] `docs/mel/ERROR-GUIDE.md` adds entries for SPREAD-BDRY-3, SPREAD-PRES-5, SPREAD-PRES-UNION-2, SPREAD-OP-5, SPREAD-CONSUME-3, SPREAD-CONSUME-5 diagnostics

### 7.7 Non-Regression

- [ ] All existing MEL test fixtures compile unchanged **except** where v5 Breaking note applies (existing `merge()` calls with previously-unsound nullable-operand handling MAY emit new diagnostics; each such case MUST be reviewed as a soundness fix, not a regression)
- [x] Empty object literal usage unchanged
- [x] CCTS extended with spread coverage while preserving existing rule modes
- [x] Existing `merge()` test coverage passes under unchanged runtime semantics

### 7.8 Implementation Cost Validation (Historical Gate, Closed)

The pre-implementation gate is now closed. The implementation validated the Core/runtime assumptions that mattered for landing:

- Core expression evaluation already observed missing object fields as `null`, so optional spread-result reads could remain admitted as `T | null`.
- Unary `merge()` lowering proved viable, so `{ ...a }` could lower directly through `merge(a)` without extra empty-object scaffolding.
- Presence-aware typing landed in the compiler analyzer/CCTS layer without changing the public `DomainSchema` / `TypeDefinition` wire contract.
- The implementation stayed inside compiler/docs/CCTS scope; no Core IR or runtime contract expansion was required.

---

## 8. Open Questions

1. **Record spread admission timing.** Entry criteria: `record.*` effects insufficient for use case, plus value-type-preserving typing model.

2. **Multi-branch object union spread admission timing.** Entry criteria: concrete authoring pattern plus per-branch presence model.

3. **`self` keyword consideration.** `patch draft = { ...draft, x: v }` restates target. Declined; may revisit with post-adoption evidence.

4. **Array spread status.** Explicit resolution of "permanently out of scope" vs. "not currently proposed" prevents ambiguity.

5. **Patch `set`-with-`merge()` vs patch `merge` operation edge cases.** Core SPEC should document divergence surface.

6. **Optional field diagnostic presentation.** Phase 2 decision for author-actionable form.

7. **Tooling normalization.** Studio, linter, formatter display-form choices out of scope.

8. **Agent generation parity.** Post-adoption measurement.

9. ~~Presence-aware typing propagation beyond spread.~~ **Resolved in v5 §4.5.**

10. **Optional-field diagnostic precision in SPREAD-CONSUME-3 errors.** Distinguish spread-consumption errors from plain `T | null` argument errors (coalesce hint vs isNotNull branching hint). Phase 2.

11. **Co-occurring presence propagation beyond this ADR.** If presence-aware typing is adopted elsewhere (action parameter defaults, partial update patterns), these rules SHOULD be the foundation. Unification opportunity.

---

## 9. References

- Compiler SPEC v1.1.0 §5 (Pure Collection Builtins), §5.1 (Additional Explicit MEL Surface Forms)
- MEL Reference §3.3 (Nullable as Present-or-Null), §5.7 (Object functions, `merge()` semantics)
- MEL Reference §5.5 (`coalesce`, `isNull`, `isNotNull`), §5.6 (`at` — absence-as-null idiom) — convergence points for SPREAD-CONSUME
- ADR-005 (Withdrawn) — lineage contrast §1.5
- ADR-013b — precedent for surface extension
- ADR-021 — precedent for bounded addition
- ADR-022a — source map implications
- `docs/mel/LLM-CONTEXT.md` — amendment target per §5.1
- Core SPEC — `merge()` expression semantics, `set`/`merge`/`unset` patch operations (Open Question 5 target)
- Manifesto Constitution §6.1 (Zero String Paths), §2 Priority 8 (Simplicity), §8.2 (Valid Refactoring Motivation)
- Manifesto Design Principle — "Separation by evidence, not by speculation"

---

*End of ADR-023*
