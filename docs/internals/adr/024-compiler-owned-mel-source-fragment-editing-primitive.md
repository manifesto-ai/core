# ADR-024: Compiler-Owned MEL Source Fragment Editing Primitive and External Author Layer Boundary

> **Status:** Accepted
> **Date:** 2026-04-25
> **Deciders:** Manifesto Architecture Team
> **Scope:** `@manifesto-ai/compiler`, Studio tooling, external Author layer integrations
> **Affected Packages:** Compiler, Studio/authoring tools
> **Non-Affected Packages:** Core, Host, SDK runtime, Lineage, Governance
> **Related:** ADR-021 Structural Annotation Sidecar, ADR-022 SourceMapIndex, Compiler SPEC v1.3.0, Current Contract
> **Current Normative Source:** Compiler SPEC v1.3.0 (`packages/compiler/docs/SPEC-v1.2.0.md`, updated in place)

This ADR is the accepted decision record for a compiler-owned, deterministic, string-first, single-fragment MEL source editing primitive. The current normative contract now lives in Compiler SPEC v1.3.0. This ADR preserves the boundary rationale: the external Author layer chooses and sequences edits while the compiler validates and materializes exactly one requested source edit.

---

## 1. Context

Manifesto currently has a clean runtime boundary:

```text
MEL source
  -> Compiler
  -> DomainSchema / DomainModule
  -> SDK / Host / Core runtime
```

Compiler already owns parsing, validation, lowering, `DomainSchema` emission, `SchemaGraph`, `AnnotationIndex`, and `SourceMapIndex`.

However, Studio and external agent tooling now need a more precise authoring-time capability:

> Given a base MEL domain and one intended source-level edit, produce the resulting full MEL source, diagnostics, text edits, and semantic impact.

Examples:

```text
- add a new computed declaration
- add a full action
- replace an action body
- replace a computed expression
- replace an available/dispatchable clause
- remove or rename a declaration when references are safe
```

At the same time, the project explicitly wants to keep the **Author layer** outside the compiler.

The Author layer may be implemented by Studio, an LLM agent, a CLI workflow, or another external tool. That layer owns:

```text
- user request interpretation
- planning
- edit sequence management
- retry / repair loops
- lineage of attempts
- acceptance policy
- agent decomposition
```

The compiler must not become an authoring runtime, planner, or session manager.

This ADR defines the boundary.

---

## 2. Problem

Without a compiler-owned edit primitive, external authoring tools must modify MEL source through ad-hoc string manipulation.

That creates several risks:

1. **Incorrect target edits**
   A tool may replace the wrong declaration or corrupt nearby syntax.

2. **Weak in-context validation**
   A fragment that parses in isolation may be invalid in the current domain context.

3. **No reliable impact signal**
   The authoring layer cannot easily know whether an edit changed only the intended schema targets.

4. **Pressure to put Author logic into Compiler**
   If the compiler does not expose a precise primitive, tools may ask for `composer`, `session`, `applyOps`, `repair`, or `planner` APIs inside the compiler package.

5. **LLM-hostile AST-first APIs**
   Requiring external agents to construct compiler AST or Core IR directly increases generation burden, especially for small models.

The project needs a narrow, deterministic, compiler-owned primitive that supports source editing without absorbing the Author layer.

---

## 3. Decision

### 3.1 Compiler does not own the Author layer

The compiler is not responsible for deciding **what** should be edited.

The compiler is responsible for deciding whether a requested source fragment edit is syntactically valid, semantically valid in context, and what deterministic source/module result it produces.

```text
Author Layer:
  chooses intent and edit operation

Compiler:
  validates and materializes exactly one source edit
```

### 3.2 Introduce a single source-fragment primitive

The compiler will expose one primary authoring-time primitive:

```ts
compileFragmentInContext(baseSource, op, options?) -> MelEditResult
```

This primitive accepts:

* a full base MEL source string
* exactly one `MelEditOp`
* optional reusable compiler context such as `baseModule`

It returns:

* resulting full MEL source
* diagnostics
* generated text edits
* changed declaration targets
* optional compiled `DomainModule`
* schema-level impact signal

The primitive is intentionally **single-op only**. Multi-op sequencing remains the external Author layer's responsibility.

### 3.3 Public edit input is string-first

Fragment payloads such as action bodies, computed expressions, type expressions, and guard expressions are accepted as MEL source strings.

Examples:

```ts
{ kind: "replaceActionBody", target: "action:clearDoneTasks", body: "when gt(doneCount, 0) { ... }" }

{ kind: "addComputed", name: "doneCount", expr: "len(filter(tasks, eq($item.done, true)))" }

{ kind: "addStateField", name: "selectedId", type: "string | null", defaultValue: null }
```

Rationale:

* MEL is a source language.
* LLMs and human tools are naturally better at producing source snippets than internal AST structures.
* Compiler already owns string parsing, validation, diagnostics, and lowering.
* Small-model authoring becomes more practical.

### 3.4 String is accepted, but never trusted

String-first does not mean string-splice semantics.

The compiler must treat string fragments as untrusted input and immediately route them through the appropriate grammar-specific parser and semantic validator.

```text
body string
  -> action-body grammar
  -> internal AST/IR
  -> in-context semantic validation
  -> deterministic text edit
  -> full domain recompile
```

Compiler must not directly splice raw fragment strings into the source without first parsing and validating them.

This trust boundary also applies to fields that are not modeled as fragment strings. Declaration names, action parameter names, and rename targets must parse as exactly one MEL identifier token before source materialization. They are identifiers, not source snippets, so they must not be able to smuggle assignments, braces, new declarations, or newline-separated syntax into the edited source.

JSON defaults are accepted as JSON-like values, but the compiler still owns validation before rendering them back into MEL. Non-finite numbers, accessor properties, non-plain objects, non-inspectable object/array values, and object keys that are not valid MEL identifiers must fail as diagnostics before any text edit is produced.

Invalid runtime operation shapes must also fail through diagnostics, not exceptions. The public primitive processes exactly one object-shaped edit operation; arrays, `null`, and unknown operation kinds are outside the source-edit contract.

### 3.5 Internal compiler pipeline remains AST/IR-first

The public API is string-first.

The internal implementation remains structure-first:

```text
fragment string
  -> parsed fragment
  -> normalized internal AST / edit IR
  -> source span targeting
  -> text edit generation
  -> full source recompile
```

This preserves compiler correctness while keeping the public authoring surface friendly.

### 3.6 Public AST input is deferred

The MVP will not expose internal compiler AST as a primary public input surface.

A future additive API may expose opaque parsed fragments, for example:

```ts
ParsedMelFragment<"action_body">
```

But internal parser AST types must not become a public stability burden in this ADR.

**Forward-compatibility commitment.** If a future AST-first input surface is introduced, it must arrive as a non-breaking union extension over the current string-first input surface (for example, `body: string | ParsedMelFragment<"action_body">`). Existing callers that pass source strings must continue to work unchanged. No release may replace the string form with an AST-only form.

### 3.7 Source edit impact must be reported

`compileFragmentInContext` must return enough information for the external Author layer to verify that the edit had the intended scope.

At minimum:

```ts
changedTargets: LocalTargetKey[]
schemaDiff?: SchemaDiff
edits: MelTextEdit[]
diagnostics: Diagnostic[]
```

This allows an Author layer to reject edits that compile but modify unintended declarations.

### 3.8 Optional `baseModule` must be source-hash checked

If a caller provides a previously compiled `DomainModule`, the compiler may reuse it for source maps, declaration indexes, and reference analysis.

However, the compiler must verify that the module belongs to the provided `baseSource`.

If the module source hash does not match the base source hash, the compiler must return a diagnostic and must not use stale spans.

---

## 4. Proposed API Shape

This section is non-final API design guidance for the next Compiler SPEC revision (§13).

### 4.1 Main primitive

```ts
export function compileFragmentInContext(
  baseSource: string,
  op: MelEditOp,
  options?: CompileFragmentInContextOptions,
): MelEditResult;
```

```ts
export type CompileFragmentInContextOptions = {
  readonly baseModule?: DomainModule;
  readonly includeModule?: boolean;
  readonly includeSchemaDiff?: boolean;
};
```

```ts
export type MelEditResult = {
  readonly ok: boolean;
  readonly newSource: string;
  readonly diagnostics: readonly Diagnostic[];
  readonly module?: DomainModule;
  readonly changedTargets: readonly LocalTargetKey[];
  readonly edits: readonly MelTextEdit[];
  readonly schemaDiff?: SchemaDiff;
};
```

### 4.2 Text edit shape

```ts
export type MelTextEdit = {
  readonly range: SourceSpan;
  readonly replacement: string;
};
```

The edit list is intended to be Monaco/LSP-friendly.

The compiler may return one replacement edit for the target declaration, or smaller edits when it can do so deterministically.

### 4.3 Edit operations

```ts
export type MelEditOp =
  | AddTypeOp
  | AddStateFieldOp
  | AddComputedOp
  | AddActionOp
  | AddAvailableOp
  | AddDispatchableOp
  | ReplaceActionBodyOp
  | ReplaceComputedExprOp
  | ReplaceAvailableOp
  | ReplaceDispatchableOp
  | ReplaceStateDefaultOp
  | ReplaceTypeFieldOp
  | RemoveDeclarationOp
  | RenameDeclarationOp;
```

Example operation shapes:

```ts
export type AddTypeOp = {
  readonly kind: "addType";
  readonly name: string;
  readonly expr: string;
};

export type AddStateFieldOp = {
  readonly kind: "addStateField";
  readonly name: string;
  readonly type: string;
  readonly defaultValue: JsonLiteral;
};

export type AddComputedOp = {
  readonly kind: "addComputed";
  readonly name: string;
  readonly expr: string;
};

export type AddActionOp = {
  readonly kind: "addAction";
  readonly name: string;
  readonly params: readonly MelParamSource[];
  readonly body: string;
};

export type ReplaceActionBodyOp = {
  readonly kind: "replaceActionBody";
  readonly target: `action:${string}`;
  readonly body: string;
};

export type ReplaceComputedExprOp = {
  readonly kind: "replaceComputedExpr";
  readonly target: `computed:${string}`;
  readonly expr: string;
};

export type ReplaceAvailableOp = {
  readonly kind: "replaceAvailable";
  readonly target: `action:${string}`;
  readonly expr: string | null;
};

export type ReplaceDispatchableOp = {
  readonly kind: "replaceDispatchable";
  readonly target: `action:${string}`;
  readonly expr: string | null;
};

export type ReplaceStateDefaultOp = {
  readonly kind: "replaceStateDefault";
  readonly target: `state_field:${string}`;
  readonly value: JsonLiteral;
};

export type ReplaceTypeFieldOp = {
  readonly kind: "replaceTypeField";
  readonly target: `type_field:${string}.${string}`;
  readonly type: string;
};

export type RemoveDeclarationOp = {
  readonly kind: "removeDeclaration";
  readonly target: LocalTargetKey;
};

export type RenameDeclarationOp = {
  readonly kind: "renameDeclaration";
  readonly target: LocalTargetKey;
  readonly newName: string;
};
```

### 4.4 Schema diff

```ts
export type SchemaDiff = {
  readonly addedTargets: readonly LocalTargetKey[];
  readonly removedTargets: readonly LocalTargetKey[];
  readonly modifiedTargets: readonly SchemaModifiedTarget[];
};
```

```ts
export type SchemaModifiedTarget = {
  readonly target: LocalTargetKey;
  readonly beforeHash: string;
  readonly afterHash: string;
  readonly before?: unknown;
  readonly after?: unknown;
};
```

`before` and `after` are optional normalized summaries. The stable comparison mechanism should be hash-based.

---

## 5. Invariants

### 5.1 Single-op invariant

`compileFragmentInContext` must process exactly one edit operation.

It must not accept an array of operations.

```ts
compileFragmentInContext(source, op);      // allowed
compileFragmentInContext(source, [op1]);   // forbidden
```

Sequencing belongs to the external Author layer.

### 5.2 Full-domain output invariant

The result must include `newSource` as a full MEL domain source, not only the inserted fragment.

```text
input:  full domain source + one fragment op
output: full domain source
```

### 5.3 Full recompile invariant

After producing `newSource`, the compiler must re-run full domain compilation.

A fragment may pass local parsing but fail full-domain semantic validation. The result must surface those diagnostics.

### 5.4 Grammar-specific fragment invariant

Each string fragment must be parsed with the narrowest valid grammar.

```text
action body string       -> action-body grammar only
computed expr string     -> expression grammar only
type string              -> type grammar only
state field string       -> state-field grammar only
available/dispatchable   -> expression grammar only
```

For example, an action body fragment must not be allowed to smuggle a new top-level action declaration.

### 5.5 No raw splice invariant

The compiler must not apply raw string fragments directly to `baseSource`.

All fragment strings must first parse and validate into internal structure.

### 5.6 Source hash invariant

If `options.baseModule` is provided:

```text
hash(baseSource) MUST equal baseModule.sourceMap.sourceHash
```

If not, the result must fail with a stale-module diagnostic.

Suggested diagnostic:

```text
E_STALE_MODULE:
  baseModule.sourceMap.sourceHash does not match baseSource.
```

### 5.7 Determinism invariant

For the same:

```text
baseSource
MelEditOp
compiler version
options
```

the compiler must produce the same:

```text
newSource
diagnostics
text edits
changedTargets
schemaDiff
```

### 5.8 Target containment invariant

The edit must not modify unrelated declaration targets except where the operation explicitly requires it.

For example:

```text
replaceActionBody(action:clearDoneTasks)
```

should not modify state fields, computed declarations, or other actions.

If secondary changes occur, they must appear in `schemaDiff` and `changedTargets`. The precise set of permitted secondary targets per operation is defined by the op's SPEC contract, not by this ADR.

Remove and rename are Safe v1 all-or-nothing operations. The compiler may materialize them only when every required reference update is compiler-known and deterministic; otherwise it must return diagnostics with no partial edits.

### 5.9 Diagnostics-as-values invariant

Fragment parse, validation, stale module, and compile failures should return diagnostics.

They should not throw except for programmer errors such as invalid API argument shape.

---

## 6. Boundary Rules

### 6.1 Compiler MAY

Compiler may provide:

```text
- fragment parsing
- fragment validation in domain context
- source span lookup
- declaration/reference indexing
- deterministic text edit generation
- full source reconstruction
- full module recompilation
- schema diff / changed target calculation
```

### 6.2 Compiler MUST NOT

Compiler must not provide:

```text
- author sessions
- edit sequence stores
- applyOps/composer over multiple ops
- retry loops
- repair loops
- LLM planner/decomposer
- user request interpretation
- lineage/commit/proposal handling
- runtime snapshot mutation
- policy or acceptance decisions
```

### 6.3 Author layer owns

External Author layer owns:

```text
- deciding which MelEditOp to attempt
- ordering multiple edit ops
- retry strategy
- interpreting diagnostics
- choosing whether to accept or reject an edit
- comparing intended vs actual impact
- storing edit attempts
- integrating with Studio, LSP, CLI, or agents
```

---

## 7. Non-Goals

This ADR does not:

```text
- add new Core runtime patch operations
- change Snapshot patch semantics
- change SDK runtime activation
- introduce a compiler session manager
- introduce a Studio source runtime
- expose tokenizer as public authoring API
- expose internal compiler AST as a stable public API
- provide full pretty-print / formatMel as an MVP requirement
- provide structured quick-fix generation as an MVP requirement
```

`formatMel` and structured quick fixes may be added later, but are not required by this ADR.

---

## 8. Rationale

### 8.1 Why compiler-owned?

The compiler is the only layer that already owns:

```text
- MEL grammar
- semantic validation
- lowering rules
- declaration target identity
- source maps
- annotations
- schema graph
```

External tools should not duplicate those responsibilities.

### 8.2 Why not Author-layer-owned string editing?

A Studio or LLM author can generate fragments, but it should not be responsible for parsing MEL grammar, locating source spans, or validating semantic impact.

That would create divergent implementations and fragile string manipulation.

### 8.3 Why string-first public API?

String-first is better for:

```text
- LLM generation
- small local models
- human-authored snippets
- CLI usage
- Studio text editor integrations
```

MEL is designed as a source language. It is reasonable for the compiler to accept source fragments as input.

### 8.4 Why not AST-first public API?

AST-first public input has several costs:

```text
- external agents must construct large structured objects
- public AST becomes a compatibility burden
- internal compiler refactors become harder
- small model authoring quality decreases
```

Internal AST/IR remains necessary, but it should stay behind the compiler boundary.

### 8.5 Why single-op only?

Multi-op sequencing introduces authoring policy.

For example:

```text
1. add state field
2. add computed
3. add action
4. repair diagnostics
5. retry with changed body
```

That is not compiler responsibility. The compiler should be a deterministic evaluator of one requested edit.

---

## 9. Alternatives Considered

### 9.1 SPEC Patch only

Rejected as insufficient.

The key issue is not just API shape. It is a package responsibility boundary:

```text
Compiler edit primitive yes.
Compiler Author layer no.
```

That boundary should be recorded as an ADR.

### 9.2 AST-first public API

Rejected for MVP.

It reduces raw string risk but creates excessive burden for external authoring tools and LLMs.

### 9.3 Separate functions for every edit type

Example:

```ts
replaceActionBody(...)
replaceComputedExpr(...)
addAction(...)
addStateField(...)
```

Rejected for MVP.

This would expand compiler public surface and blur the central primitive. A single union-based primitive is narrower and easier to extend.

### 9.4 Compiler-owned composer/session

Rejected.

A composer would own sequence, state, retries, and policy. Those belong to the external Author layer.

### 9.5 Raw text edit API

Rejected.

Letting callers provide arbitrary `{ range, replacement }` edits would bypass compiler knowledge and reduce the value of SourceMapIndex and semantic validation.

---

## 10. Acceptance Criteria

### 10.1 Replace action body

Given a valid domain source and:

```ts
{
  kind: "replaceActionBody",
  target: "action:clearDoneTasks",
  body: `
    when gt(doneCount, 0) {
      patch tasks = filter(tasks, neq($item.done, true))
    }
  `
}
```

the compiler must:

```text
- parse body using action-body grammar
- replace only the target action body
- return full newSource
- return text edits
- recompile full domain
- return changedTargets including action:clearDoneTasks
- return schemaDiff showing action modification
```

### 10.2 Reject smuggled declaration in body

Given:

```ts
{
  kind: "replaceActionBody",
  target: "action:x",
  body: `
    action hacked() {
      when true { patch count = 1 }
    }
  `
}
```

the compiler must reject with diagnostics because an action body fragment cannot contain top-level declarations.

### 10.3 Add computed

Given:

```ts
{
  kind: "addComputed",
  name: "doneCount",
  expr: "len(filter(tasks, eq($item.done, true)))"
}
```

the compiler must:

```text
- parse expression using expression grammar
- validate expression in the current domain context
- add a computed declaration
- recompile full domain
- return schemaDiff.addedTargets containing computed:doneCount
```

### 10.4 Stale module rejection

Given `baseSource` and `baseModule` whose `sourceHash` does not match, the compiler must return an `E_STALE_MODULE` diagnostic and must not use source spans from that module.

### 10.5 Single-op only

The public primitive must not accept arrays of edit ops.

### 10.6 Determinism

For identical inputs, results must be byte-identical where ordering is defined:

```text
newSource
edits
changedTargets
schemaDiff
diagnostics
```

### 10.7 Schema impact visibility

If an edit compiles and changes multiple schema targets, the compiler MUST expose those targets through `changedTargets` and `schemaDiff`.

The compiler MUST NOT compare the result against caller intent or author expectations. Acceptance of actual impact is the responsibility of the external Author layer.

The compiler MAY reject an edit only when the edit violates the operation's SPEC-defined safety contract, such as ambiguous rename references or remove blockers.

For Safe v1, `removeDeclaration` succeeds only when removing the declaration cannot leave compiler-known references dangling. `renameDeclaration` succeeds only when the declaration name and every compiler-known reference can be rewritten deterministically.

---

## 11. Test Plan

### 11.1 Fragment grammar tests

```text
- action body accepts when/once/onceIntent/fail/stop/effect/patch statements
- action body rejects top-level declarations
- computed expr accepts expression grammar only
- type expr accepts type grammar only
- available/dispatchable accepts expression grammar only
```

### 11.2 Source edit tests

```text
- replaceActionBody preserves action signature
- replaceComputedExpr preserves computed name and replaces only expression
- addStateField inserts into state block
- addAction inserts action declaration in deterministic location
- replaceAvailable removes clause when expr is null
- replaceDispatchable removes clause when expr is null
- safe removeDeclaration removes an unreferenced declaration and reports schema impact
- safe renameDeclaration rewrites compiler-known references and reports schema impact
- unsafe removeDeclaration returns E_REMOVE_BLOCKED_BY_REFERENCES with no edits
- unsafe renameDeclaration returns E_UNSAFE_RENAME_AMBIGUOUS with no edits
```

### 11.3 Full compile tests

```text
- local fragment parse success but full semantic failure returns diagnostics
- successful edit returns DomainModule when includeModule is true
- annotations and sourceMap remain out-of-schema
```

### 11.4 Impact tests

```text
- added computed appears in schemaDiff.addedTargets
- replaced action appears in schemaDiff.modifiedTargets
- removed declaration appears in schemaDiff.removedTargets
- changedTargets matches direct source targets
```

### 11.5 Stale context tests

```text
- matching baseModule sourceHash is accepted
- mismatched baseModule sourceHash returns E_STALE_MODULE
- no baseModule falls back to parsing/analyzing baseSource
```

### 11.6 Determinism tests

```text
- same input produces same newSource
- same input produces same edit ranges
- same input produces same schemaDiff ordering
```

---

## 12. Consequences

### Positive

```text
- external Author layer gets a stable compiler primitive
- compiler boundary stays narrow
- LLM/small-model authoring remains practical
- source edits become grammar-aware and semantically checked
- Studio can display precise Monaco/LSP edits
- Author layer can verify impact through schemaDiff
```

### Negative

```text
- compiler public API grows
- compiler must maintain fragment parsers as public behavior
- source reconstruction/edit generation becomes a compiler responsibility
- schemaDiff introduces additional implementation cost
```

### Risks

| Risk                                      | Mitigation                                     |
| ----------------------------------------- | ---------------------------------------------- |
| Compiler gradually becomes Author runtime | Single-op invariant and explicit MUST NOT list |
| String fragments are unsafe               | Grammar-specific parse + full recompile        |
| Internal AST leaks into public API        | MVP string-first; public AST deferred          |
| Stale source maps corrupt edits           | sourceHash invariant                           |
| Diff output becomes too heavy             | hash-first modified target representation      |

---

## 13. Follow-up Compiler SPEC Revision (v1.3.0)

This ADR is realized by the next revision of the single canonical Compiler SPEC file (currently v1.2.0 → v1.3.0). No separate SPEC Patch document is introduced; all of the following must be defined as additive content within the existing Compiler SPEC:

```text
1.  compileFragmentInContext API
2.  MelEditOp union
3.  MelEditResult
4.  MelTextEdit
5.  SchemaDiff
6.  sourceHash validation rule
7.  fragment grammar constraints
8.  deterministic output ordering
9.  diagnostic codes
10. per-op permitted secondary target contract (§5.8 pointer)
11. compliance tests
```

Suggested new diagnostics:

```text
E_STALE_MODULE
E_FRAGMENT_PARSE_FAILED
E_FRAGMENT_SCOPE_VIOLATION
E_TARGET_NOT_FOUND
E_TARGET_KIND_MISMATCH
E_UNSAFE_RENAME_AMBIGUOUS
E_REMOVE_BLOCKED_BY_REFERENCES
```

---

## 14. Decision Summary

```text
GO.
```

Compiler will own a deterministic, string-first, single-fragment source edit primitive.

Compiler will not own Author sessions, planning, retries, op sequencing, lineage, or LLM decomposition.

The public API accepts source strings for LLM and human friendliness, but the compiler must immediately parse, validate, normalize, edit, and fully recompile before returning results.

The result must include enough impact data for an external Author layer to decide whether to accept or reject the edit.

---

*End of ADR-024*
