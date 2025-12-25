## 1. Compiler Invariants (Must Never Break)

1. **Deterministic Core MUST NOT depend on LLM output quality.**
   Linking, normalization, conflict detection, validation, DAG checks, and any “is this valid?” decision MUST be deterministic and reproducible (same inputs → same outputs), with no model calls, randomness, or heuristics that can drift.

2. **LLM MUST be treated as an untrusted proposal generator, never an authority.**
   If an LLM is used, it MAY only emit *candidate* fragments/patches plus provenance; it MUST NOT be allowed to directly “declare validity,” silently resolve conflicts, or bypass verification.

3. **Compilation MUST be modular and partial by construction.**
   The system MUST support compiling and re-compiling *only a selected construct* (statement/expression/effect/policy/derived/action/schema field) without requiring a full-domain regeneration.

4. **Every output MUST be explainable and traceable to provenance.**
   Every fragment and patch MUST carry `origin` + `evidence` sufficient to show “where this came from” (code span / text span / prior fragment). No anonymous or “model-intuited” artifacts.

5. **Effects MUST remain descriptions; the compiler MUST NEVER execute side effects.**
   The compiler MUST NOT call external services, mutate real systems, or run effect handlers. Execution is exclusively a runtime concern and must be explicitly invoked by consumers under policy/allowlist gates.

6. **Conflicts MUST NOT be auto-resolved silently.**
   If two fragments provide the same semantic target (path/action/schema field), the linker MUST surface an explicit `Conflict` and require an explicit resolution (user/patch), not “last write wins.”

7. **Dependencies MUST be mechanically derived or verified, not hand-waved.**
   For any expression-like output, `requires` (and derived `deps` if applicable) MUST be computed/checked via static analysis of the AST/DSL. Missing dependencies MUST become issues or auto-suggested patches; they MUST NOT be “best-effort” guesses.

8. **Generic compiler core MUST NOT embed domain-specific semantics.**
   The compiler MUST NOT ship with business-domain templates (“checkout,” “shipping”) or interpret domain meaning beyond language constructs and generic mapping rules. Domain specificity can exist only as opt-in external plugins/passes.

9. **Patch-first editing MUST be preserved end-to-end.**
   User changes MUST be representable as patch operations over fragments (or linked output), stored and replayable. The system MUST NOT require “re-run the entire model” as the primary update mechanism.

10. **Observability state MUST be first-class and reconstructible.**
    Progress/phase/blockers/next steps MUST be derivable from session inputs (artifacts + fragments + patches + verification output). No hidden mutable state that can’t be replayed or audited.

---

## 2. Explicit Non-Goals / Out-of-Scope

* **Not an IDE/editor product.**
  No UI building, code formatting, or interactive editor features in-core. Provide APIs that a UI can consume.

* **Not “perfect semantic understanding” of arbitrary natural language.**
  The compiler is not a general reasoning engine; it produces structured proposals with provenance and relies on verification + user patches when ambiguous.

* **Not a full source-to-source transpiler.**
  The goal is not to rewrite an entire application into a new language, but to compile *selected constructs* into composable fragments.

* **Not an autonomous agent that executes effects.**
  The compiler does not run external calls; runtime execution is explicit and gated.

* **Not a domain template library.**
  No baked-in “ecommerce,” “robot,” “finance” assumptions. Such accelerators (if any) must be separate packages/plugins.

* **Not multi-language support in MVP core.**
  The core architecture should be language-agnostic, but initial implementation can support a constrained set (e.g., JS/TS). Expanding to other languages is a later concern.

* **Not training or hosting models.**
  The system may call a model via an adapter interface, but it does not include training, fine-tuning, or inference infrastructure.

* **Not automatic conflict resolution policy.**
  The system can *suggest* resolutions; it cannot silently pick winners without an explicit patch.

---

## 3. Execution Trace Example (Mental Model)

### Example input (selected construct only)

User selects this snippet (and only this snippet) from code:

```js
const hello = 10
if (hello > 10) {
  doHello()
}
```

### Step-by-step trace

**Step 0 — Session starts**

* Create a compile session with one `CodeArtifact` containing the snippet + a selection span covering the whole snippet.
* Session phase: `parsing`.

**Step 1 — Code AST Extractor Pass (deterministic)**

* Parse code to AST.
* Emit *Findings* (deterministic facts, no meaning yet):

    * `VarDecl(name="hello", init=NumericLiteral(10))`
    * `IfStmt(test=BinaryExpr(">", Ident("hello"), 10), consequent=CallExpr("doHello"))`

**Step 2 — Schema/Symbol Pass (deterministic)**

* From `VarDecl`, emit a `SchemaFragment` or `SourceFragment` candidate:

    * “There exists a value named `hello`”
    * Default mapping rule: identifier in condition becomes `data.hello` (generic rule, not domain-specific).
* Output: `SchemaFragment` providing `data.hello` as a number with default `10`.

**Step 3 — Expression Lowering Pass (deterministic)**

* Convert `hello > 10` into Expression DSL AST:

    * `['>', ['get', 'data.hello'], 10]`
* Output: `ExpressionFragment`

    * `requires = ['data.hello']` (computed via DSL path extraction)
    * `provides = []` (it’s a reusable expression, not a named derived yet)

**Step 4 — Call Lowering Pass (policy-driven, deterministic fallback)**

* `doHello()` is an unknown side-effect. The compiler does NOT execute it.
* Emit an `EffectFragment` describing it in a safe generic form:

    * e.g., `EmitEvent(channel="domain", payload={type:"doHello"})` (or a configurable placeholder effect)
* Output: `EffectFragment` providing `effect:doHello` (a symbolic provide target), requiring nothing.

**Step 5 — Control-Flow Lowering Pass (deterministic)**

* Lower `if (cond) { effect }` into a conditional effect AST:

    * `ConditionalEffect(condition=<exprRef>, then=<effectRef>)`
* Output: `StatementFragment` (or `EffectFragment`) that composes:

    * requires: `['data.hello']`
    * provides: a symbolic statement id `stmt:if_1`

**Step 6 — Linker (deterministic composition)**

* Combine fragments into a *DomainDraft*:

    * Merge schema fragments into `dataSchema`
    * Decide whether to wrap the statement into an `ActionFragment`:

        * If consumer requested “executable action,” wrap into `action:runSnippet`.
        * If consumer requested “show me just the construct,” keep it as a standalone statement/effect fragment with no action.
* Detect conflicts (none here).

**Step 7 — Verifier (deterministic)**

* Validate:

    * All referenced paths exist (`data.hello` exists ✅)
    * Any derived declarations (none) have consistent deps (n/a)
    * Effect is purely descriptive (✅)
* Result: valid.

**Step 8 — User edits only what they want**
User changes only the threshold “10 → 5” in the conditional.

* Generate a patch:

    * `replaceLiteral(originSpanOf(10_in_condition), 5)` **or**
    * `replaceExpr(fragmentId="expr:cond_1", newExpr=['>', ['get','data.hello'], 5])`

**Step 9 — Incremental re-link + re-verify**

* Only affected fragments are updated.
* Linker recomposes the conditional effect.
* Verifier re-checks: still valid.
* Provide impact report: only statement/action behavior changed; schema unchanged.

This trace illustrates the intended mental model: **extract facts → lower into small fragments → deterministic link/verify → patch-based incremental edits**.

---

## 4. Intermediate Representation (IR) Shape Definition

TypeScript-like interfaces (structure-focused):

```ts
// --- Core scalars ---
type SemanticPath = string;     // e.g. "data.hello", "derived.total"
type FragmentId = string;       // stable ID
type ArtifactId = string;
type PatchId = string;
type ConflictId = string;
type IssueId = string;

// --- Provenance / Evidence ---
interface CodeSpan {
  file?: string;
  startLine: number; startCol: number;
  endLine: number; endCol: number;
}

interface TextSpan {
  docId?: string;
  startOffset: number;
  endOffset: number;
}

type OriginLocation =
  | { kind: "code"; span: CodeSpan }
  | { kind: "text"; span: TextSpan }
  | { kind: "generated"; note: string };

interface Provenance {
  artifactId: ArtifactId;
  location: OriginLocation;
  // Stable-ish hash of normalized origin (used for stable IDs)
  originHash?: string;
}

interface Evidence {
  kind: "quote" | "ast_node" | "rule" | "link";
  ref: string;            // pointer to source, rule ID, or AST node kind
  excerpt?: string;        // short snippet
}

// --- Artifacts ---
type Artifact =
  | { id: ArtifactId; kind: "code"; language: "js" | "ts"; content: string }
  | { id: ArtifactId; kind: "text"; content: string }
  | { id: ArtifactId; kind: "manifesto"; content: unknown };

// --- Fragment base ---
type FragmentKind =
  | "SchemaFragment"
  | "SourceFragment"
  | "ExpressionFragment"
  | "DerivedFragment"
  | "PolicyFragment"
  | "EffectFragment"
  | "ActionFragment"
  | "StatementFragment";

interface FragmentBase {
  id: FragmentId;
  kind: FragmentKind;

  // Linker contract:
  requires: SemanticPath[];
  provides: string[]; // symbolic provides (paths or ids), e.g. "data.hello", "action:checkout", "effect:doHello"

  origin: Provenance;
  evidence: Evidence[];
  confidence?: number;

  // Optional: for incremental compile caches
  compilerVersion: string;
  tags?: string[];
}

// --- Schema fragments ---
interface SchemaField {
  path: SemanticPath;                 // "data.hello"
  type: "number" | "string" | "bool" | "object" | "array" | "unknown"; // MVP simplification
  optional?: boolean;
  defaultValue?: unknown;
  // Optional semantic metadata
  semantic?: { type: string; description: string; writable?: boolean; readable?: boolean };
}

interface SchemaFragment extends FragmentBase {
  kind: "SchemaFragment";
  namespace: "data" | "state";
  fields: SchemaField[];
}

// --- Expression fragments ---
type Expression = unknown; // Expression DSL AST (opaque here)

interface ExpressionFragment extends FragmentBase {
  kind: "ExpressionFragment";
  expr: Expression;
}

// --- Derived fragments ---
interface DerivedFragment extends FragmentBase {
  kind: "DerivedFragment";
  path: SemanticPath;      // "derived.canDispatch"
  expr: Expression;
  deps?: SemanticPath[];   // MAY be omitted by producers; linker/verifier derives/checks
  semantic?: { type: string; description: string };
}

// --- Policy fragments ---
interface ConditionRef {
  path: SemanticPath;
  expect?: "true" | "false";
  reason?: string;
}

interface FieldPolicy {
  relevantWhen?: ConditionRef[];
  editableWhen?: ConditionRef[];
  requiredWhen?: ConditionRef[];
}

interface PolicyFragment extends FragmentBase {
  kind: "PolicyFragment";
  target:
    | { kind: "action"; actionId: string }
    | { kind: "field"; path: SemanticPath };
  preconditions?: ConditionRef[];
  fieldPolicy?: FieldPolicy;
}

// --- Effect fragments ---
type Effect = unknown; // Effect AST (opaque here)

interface EffectFragment extends FragmentBase {
  kind: "EffectFragment";
  effect: Effect;
  // Optional: declared risk classification used by consumers
  risk?: "none" | "low" | "medium" | "high" | "critical";
}

// --- Action fragments ---
interface ActionFragment extends FragmentBase {
  kind: "ActionFragment";
  actionId: string;
  inputSchemaRef?: string;       // optional reference id
  preconditions?: ConditionRef[]; // can be composed from PolicyFragments
  effectRef?: string;            // reference to EffectFragment id, or inline effect
  effect?: Effect;
  semantic?: { verb: string; description: string; risk?: ActionFragment["risk"] };
  risk?: "none" | "low" | "medium" | "high" | "critical";
}

// --- Statement fragments (optional abstraction) ---
interface StatementFragment extends FragmentBase {
  kind: "StatementFragment";
  statementType: "if" | "assign" | "call" | "block" | "return" | "unknown";
  // Often lowered to Effect, but kept separate for UI “show me the exact construct”
  loweredEffectRef?: string;
}

// --- Conflicts / Issues ---
interface Conflict {
  id: ConflictId;
  target: string; // SemanticPath or symbolic target like "action:checkout"
  type:
    | "duplicate_provides"
    | "schema_mismatch"
    | "semantic_mismatch"
    | "incompatible_effect"
    | "unknown";
  candidates: FragmentId[];
  message: string;
  suggestedResolutions?: PatchHint[];
}

interface Issue {
  id: IssueId;
  code: string; // e.g. "MISSING_DEPENDENCY", "INVALID_PATH", ...
  severity: "error" | "warning" | "info" | "suggestion";
  message: string;
  path?: SemanticPath;
  relatedFragments?: FragmentId[];
  suggestedFix?: PatchHint;
}

// --- Patches ---
type PatchOp =
  | { op: "replaceExpr"; fragmentId: FragmentId; newExpr: Expression }
  | { op: "addDep"; derivedPath: SemanticPath; dep: SemanticPath }
  | { op: "renamePath"; from: SemanticPath; to: SemanticPath }
  | { op: "removeFragment"; fragmentId: FragmentId }
  | { op: "chooseConflict"; conflictId: ConflictId; chosenFragmentId: FragmentId }
  | { op: "updateSchemaField"; path: SemanticPath; update: Partial<SchemaField> };

interface Patch {
  id: PatchId;
  ops: PatchOp[];
  origin: Provenance;
  evidence?: Evidence[];
}

// --- Link / Verify results ---
interface DomainDraft {
  // Intentionally not the final runtime object; just structured output for generation.
  dataSchema: unknown;
  stateSchema: unknown;
  paths: unknown;
  actions: unknown;
}

interface LinkResult {
  fragments: FragmentBase[];
  domain?: DomainDraft;         // present only if linkable without unresolved blockers
  conflicts: Conflict[];
  issues: Issue[];
}

interface VerifyResult {
  valid: boolean;
  issues: Issue[];
}

// --- Session state for observability ---
type CompilerPhase =
  | "idle" | "parsing" | "extracting" | "lowering"
  | "linking" | "verifying" | "repairing"
  | "done" | "error";

interface CompilerSessionSnapshot {
  phase: CompilerPhase;
  artifacts: ArtifactId[];
  fragmentsCount: number;
  conflictsCount: number;
  blockingIssuesCount: number;

  blockers: Array<{ kind: "conflict" | "issue"; id: string; message: string }>;
  nextSteps: Array<{ action: string; params?: unknown; rationale: string }>;

  // Optional: structured logs/events for UI
  logs?: Array<{ level: "debug"|"info"|"warn"|"error"; message: string; at: number }>;
}
```

Key point: **all compiler outputs coexist as fragments**, and composition happens via deterministic linking over `requires/provides` + explicit conflicts/issues + replayable patches.

---

## 5. Responsibility Matrix (Who Can Do What)

| Actor                               | Can Do                                                                                                                                                            | Cannot Do                                                                                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Compiler Pass Modules**           | Parse/scan inputs, emit *Findings* and *Fragments* within their specialty (schema, expression, control-flow, effects, policy). Must attach provenance/evidence.   | Must NOT execute effects, must NOT resolve conflicts, must NOT declare final validity, must NOT embed business-domain assumptions.                                     |
| **Linker (Deterministic)**          | Normalize paths, merge fragments into a coherent draft, compute/verify dependencies, detect conflicts, produce link-time issues and suggested patches.            | Must NOT call LLMs, must NOT guess “business meaning,” must NOT silently override conflicts, must NOT mutate external state.                                           |
| **Verifier (Deterministic)**        | Run static validation, dependency/DAG checks, consistency checks, produce issues with machine-actionable fix hints.                                               | Must NOT “fix” by itself except by emitting patches/hints; must NOT run side effects; must NOT use non-reproducible heuristics.                                        |
| **Runtime (Execution Environment)** | Execute effects *only when explicitly invoked* by consumer code; enforce allowlists/approval gates; provide explain/impact tools over the linked domain.          | Must NOT perform extraction/lowering; must NOT call LLMs; must NOT rewrite compiler fragments; must NOT hide side effects behind compilation.                          |
| **LLM Adapter (Optional)**          | Generate candidate fragments/patches, propose semantic descriptions, map ambiguous text/code into structured guesses, annotate uncertainty and evidence pointers. | Must NOT be the source of truth; must NOT bypass deterministic checks; must NOT decide conflict winners; must NOT execute effects; must NOT produce “validity” claims. |
| **User / Consumer Code**            | Select scope (the exact construct to compile), review conflicts/issues, apply patches, choose conflict resolutions, provide effect handler policies.              | Must NOT rely on hidden compiler state; must NOT assume compilation executes anything; must NOT assume conflicts are auto-fixed.                                       |

Trust boundary summary: **Only deterministic components can “approve” correctness. LLM can suggest; user can decide; runtime can execute only with explicit gating.**

---

## 6. Good vs Bad Examples (Anti-Patterns)

### ❌ Bad: “LLM writes the final domain directly”

* *What it looks like:* One prompt → outputs a full `defineDomain(...)` with guessed paths, deps, policies, effects.
* *Why it’s wrong:* Validity becomes model-dependent; partial edits become hard; provenance and conflict surfacing are lost.
* *Typical failure:* Silent deps omissions, invalid paths, domain-specific hallucinations.

### ✅ Good: “LLM proposes fragments; linker/verifier enforce structure”

* LLM emits: `ExpressionFragment` + `EffectFragment` proposals with evidence.
* Linker derives `requires`, normalizes paths, surfaces conflicts.
* Verifier flags missing deps / invalid paths, produces patch hints.

---

### ❌ Bad: “Linker resolves conflicts by last-write-wins”

* *What it looks like:* Two fragments both provide `derived.total`; linker keeps the newest and drops the other.
* *Why it’s wrong:* User loses control; edits become non-local; reproducibility breaks when pass order changes.

### ✅ Good: “Conflicts are first-class blockers with explicit resolution patches”

* Linker emits `Conflict { candidates: [...] }`.
* User selects a candidate (or merges) → `chooseConflict` patch.
* Re-link is deterministic.

---

### ❌ Bad: “Compiler calls external APIs to ‘verify’ behavior”

* *What it looks like:* During compilation, the system hits real endpoints to see what happens.
* *Why it’s wrong:* Side effects, non-determinism, security risk, flaky builds.

### ✅ Good: “Compiler verifies structurally; runtime executes explicitly”

* Compiler verifies shape, references, deps, conflicts.
* Runtime executes effects only when a consumer triggers it with an allowlisted handler.

---

### ❌ Bad: “Deps are authored by model or developer guesswork”

* *What it looks like:* `deps: ['data.items']` but expression also reads `data.couponCode`—no one notices.
* *Why it’s wrong:* Incremental recomputation and correctness break; changes don’t propagate.

### ✅ Good: “Deps/requires are mechanically extracted from the expression AST”

* Expression analysis extracts all referenced paths.
* Verifier compares extracted paths vs declared deps.
* Auto-suggests patch: `addDep(derivedPath, missingDep)`.

---

### ❌ Bad: “Partial edit triggers full recompilation and rewrites everything”

* *What it looks like:* User changes `10 → 5`, system regenerates the entire domain and invalidates all IDs.
* *Why it’s wrong:* Destroys editability, breaks review, loses provenance.

### ✅ Good: “Patch-first incremental update”

* User edit produces a `replaceExpr(fragmentId, newExpr)` patch.
* Only impacted fragments are re-linked and re-verified.
* Stable IDs and provenance remain intact.

---

If you want, the next artifact to pin down for an implementation agent is a **minimal deterministic linker spec**: normalization rules, conflict classification rules, and patch application semantics. That’s the “compiler law” that prevents the system from drifting into an app-like architecture.
