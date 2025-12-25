# @manifesto-ai/compiler Architecture

This document describes the internal architecture of the Manifesto Compiler.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            @manifesto-ai/compiler                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌────────┐    ┌─────────┐  │
│  │Artifacts│───▶│  Passes  │───▶│Fragments │───▶│ Linker │───▶│ Domain  │  │
│  └─────────┘    └──────────┘    └──────────┘    └────────┘    └─────────┘  │
│       │              │               │              │              │        │
│       │              │               │              │              │        │
│       ▼              ▼               ▼              ▼              ▼        │
│  ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌────────┐    ┌─────────┐  │
│  │  Code   │    │  AST     │    │ Atomic   │    │Conflict│    │Verified │  │
│  │   NL    │    │ Extract  │    │  Units   │    │Detected│    │ Output  │  │
│  │Manifesto│    │ LLM Draft│    │ + Origin │    │+ Issues│    │         │  │
│  └─────────┘    └──────────┘    └──────────┘    └────────┘    └─────────┘  │
│                                                                             │
│                              ┌──────────┐                                   │
│                              │  Patch   │◀─── User/Agent Edits              │
│                              │  System  │                                   │
│                              └──────────┘                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Design Principles

### 1. Deterministic Core

The linking, verification, and conflict detection are **completely deterministic**. Same fragments in → same result out.

```typescript
// Guaranteed: same input = same output
const result1 = link(fragments);
const result2 = link(fragments);
assert(deepEqual(result1, result2)); // Always true
```

### 2. LLM as Untrusted Proposer

LLM outputs are treated as **untrusted proposals** (`FragmentDraft`), not final `Fragment`.

```
NL Input → LLM → FragmentDraft[] → lowerDrafts() → Fragment[]
                 (untrusted)       (validate)      (trusted)
```

### 3. Fragment as Atomic Unit

Everything compiles to **Fragments** - the atomic, composable units of domain logic.

### 4. Patch-First Editing

Modifications are expressed as **Patches** - explicit, auditable, reversible operations.

### 5. Provenance Tracking

Every fragment carries its **origin** - where it came from and why.

---

## Module Structure

```
src/
├── compiler.ts          # Main entry: createCompiler()
├── session.ts           # Stateful compilation sessions
├── index.ts             # Public exports
│
├── types/               # Type definitions
│   ├── fragment.ts      # Fragment types
│   ├── artifact.ts      # Input types
│   ├── provenance.ts    # Origin tracking
│   ├── issue.ts         # Validation issues
│   ├── conflict.ts      # Path conflicts
│   ├── patch.ts         # Patch operations
│   ├── codebook.ts      # Path aliasing
│   ├── session.ts       # Session state
│   └── compiler.ts      # Compiler interface
│
├── fragment/            # Fragment creation
│   ├── stable-id.ts     # Deterministic ID generation
│   └── base.ts          # Factory functions
│
├── pass/                # Pass system
│   ├── registry.ts      # Pass registration
│   ├── base.ts          # Pass interfaces
│   ├── code-ast-extractor.ts
│   ├── schema-pass.ts
│   ├── expression-lowering.ts
│   ├── effect-lowering.ts
│   ├── policy-lowering.ts
│   ├── action-pass.ts
│   ├── nl-extractor-pass.ts
│   └── draft-lowering.ts
│
├── linker/              # Linking pipeline
│   ├── index.ts         # Main link()
│   ├── normalizer.ts    # Path normalization
│   ├── deps-analyzer.ts # Dependency graph
│   ├── conflict-detector.ts
│   ├── merger.ts        # Fragment merging
│   └── domain-builder.ts
│
├── verifier/            # Verification
│   ├── index.ts         # Main verify()
│   ├── dag.ts           # DAG validation
│   ├── static.ts        # Static checks
│   └── issue-mapper.ts  # Issue creation
│
├── patch/               # Patch system
│   ├── index.ts         # Main exports
│   ├── applier.ts       # Patch application
│   ├── codebook.ts      # Alias management
│   ├── similarity.ts    # Path similarity
│   ├── hint-generator.ts
│   └── ops/             # Operation handlers
│
├── llm/                 # LLM adapters
│   ├── index.ts
│   ├── anthropic.ts
│   ├── openai.ts
│   ├── prompts.ts
│   └── utils.ts
│
└── runtime/             # Compiler runtime
    ├── domain.ts        # Compiler as Manifesto domain
    └── index.ts
```

---

## Pipeline Stages

### Stage 1: Artifact Input

Artifacts are the raw inputs to compilation:

| Type | Description | Example |
|------|-------------|---------|
| `CodeArtifact` | TypeScript/JavaScript code | `const count = 0;` |
| `TextArtifact` | Natural language | `User can add items to cart` |
| `ManifestoArtifact` | Existing fragments | Previous compilation output |

### Stage 2: Pass Execution

Passes transform artifacts into fragments:

```
┌────────────────────────────────────────────────────────────┐
│                     Pass Executor                           │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Artifact ─┬─▶ code-ast-extractor (0)  ─▶ Finding[]        │
│            │                                                │
│            ├─▶ schema-pass (100)       ─▶ SchemaFragment    │
│            │                                                │
│            ├─▶ expression-lowering (200)─▶ DerivedFragment  │
│            │                                                │
│            ├─▶ effect-lowering (300)   ─▶ EffectFragment    │
│            │                                                │
│            ├─▶ policy-lowering (400)   ─▶ PolicyFragment    │
│            │                                                │
│            ├─▶ action-pass (500)       ─▶ ActionFragment    │
│            │                                                │
│            └─▶ nl-extractor (900)      ─▶ FragmentDraft[]   │
│                      │                                      │
│                      └─▶ lowerDrafts() ─▶ Fragment[]        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Pass Interface:**

```typescript
interface Pass {
  name: string;
  priority: number;  // Lower = earlier execution

  supports(artifact: Artifact): boolean;
  analyze(artifact: Artifact): Promise<Finding[]>;
  compile(findings: Finding[], context: PassContext): Promise<Fragment[]>;
}
```

**Priority Order:**

| Priority | Pass | Purpose |
|----------|------|---------|
| 0 | code-ast-extractor | Extract AST from code |
| 100 | schema-pass | Generate schema fragments |
| 200 | expression-lowering | Lower expressions to DSL |
| 300 | effect-lowering | Lower effects |
| 400 | policy-lowering | Lower policies |
| 500 | action-pass | Assemble actions |
| 900 | nl-extractor | Process natural language |

### Stage 3: Linking

The linker combines fragments into a coherent domain:

```
┌─────────────────────────────────────────────────────────────┐
│                         Linker                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Normalize                                               │
│     └─▶ Standardize paths (data.foo vs foo)                 │
│     └─▶ Separate action IDs from paths                      │
│                                                             │
│  2. Sort (Determinism)                                      │
│     └─▶ Sort by stable ID for reproducibility               │
│                                                             │
│  3. Build Dependency Graph                                  │
│     └─▶ Fragment A requires path X                          │
│     └─▶ Fragment B provides path X                          │
│     └─▶ A depends on B                                      │
│                                                             │
│  4. Detect Cycles                                           │
│     └─▶ Find circular dependencies                          │
│     └─▶ Generate CYCLE_DETECTED issues                      │
│                                                             │
│  5. Detect Conflicts                                        │
│     └─▶ Multiple fragments provide same path                │
│     └─▶ No auto-resolution (surface all)                    │
│                                                             │
│  6. Merge Fragments                                         │
│     └─▶ Combine compatible fragments                        │
│     └─▶ Union strategy by default                           │
│                                                             │
│  7. Build Domain                                            │
│     └─▶ Generate DomainDraft if no blocking issues          │
│     └─▶ Use Zod schemas directly                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Link Result:**

```typescript
interface LinkResult {
  fragments: Fragment[];      // Normalized, merged fragments
  domain?: DomainDraft;       // Generated domain (if valid)
  conflicts: Conflict[];      // Unresolved conflicts
  issues: Issue[];            // Validation issues
  version: string;            // Result version for tracking
}
```

### Stage 4: Verification

The verifier validates the linked result:

```
┌─────────────────────────────────────────────────────────────┐
│                        Verifier                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  DAG Validation                                             │
│  ├─▶ Cycle detection                                        │
│  └─▶ Missing dependency detection                           │
│                                                             │
│  Static Validation                                          │
│  ├─▶ Path format validation                                 │
│  ├─▶ Type consistency                                       │
│  ├─▶ Policy validation                                      │
│  ├─▶ Effect validation                                      │
│  ├─▶ Action validation                                      │
│  └─▶ Provenance validation                                  │
│                                                             │
│  Issue Classification                                       │
│  ├─▶ error: Must be fixed                                   │
│  ├─▶ warning: Should review                                 │
│  ├─▶ info: Informational                                    │
│  └─▶ suggestion: Improvement hint                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Stage 5: Patching

Patches enable incremental modification:

```
┌─────────────────────────────────────────────────────────────┐
│                      Patch System                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Operations:                                                │
│  ├─▶ replaceExpr     - Replace expression in fragment       │
│  ├─▶ addDep          - Add dependency                       │
│  ├─▶ removeDep       - Remove dependency                    │
│  ├─▶ renamePath      - Rename path globally                 │
│  ├─▶ removeFragment  - Delete fragment                      │
│  ├─▶ addFragment     - Add new fragment                     │
│  ├─▶ chooseConflict  - Resolve conflict                     │
│  └─▶ applyAlias      - Apply codebook alias                 │
│                                                             │
│  Codebook (Path Aliasing):                                  │
│  ├─▶ Suggestions: Detected similar paths                    │
│  ├─▶ Applied: User-confirmed aliases                        │
│  └─▶ Rejected: User-dismissed suggestions                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Fragment Lifecycle

```
┌──────────────┐
│   Created    │  generateStableFragmentId()
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Compiled   │  Pass generates fragment
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Normalized  │  Linker normalizes paths
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Merged     │  Compatible fragments combined
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Verified   │  Validation passes
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   In Domain  │  Part of final domain
└──────────────┘
```

**Stable ID Generation:**

```typescript
// Fragment IDs are deterministic based on:
// 1. Fragment kind
// 2. Origin location hash
// 3. Structural signature (provides/requires)

const id = generateStableFragmentId(
  'DerivedFragment',
  codeOrigin('app.ts', { line: 10, column: 0 })
);
// Result: "der_a1b2c3d4"
```

---

## LLM Integration

LLM adapters are isolated to maintain determinism:

```
┌─────────────────────────────────────────────────────────────┐
│                      LLM Boundary                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Input: TextArtifact                                        │
│       │                                                     │
│       ▼                                                     │
│  ┌──────────────┐                                           │
│  │ NL Extractor │                                           │
│  │    Pass      │                                           │
│  └──────┬───────┘                                           │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐    ┌─────────────────┐                    │
│  │  LLM Adapter │───▶│ Anthropic/OpenAI│                    │
│  └──────┬───────┘    └─────────────────┘                    │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐                                           │
│  │FragmentDraft │  (untrusted, confidence < 1.0)            │
│  └──────┬───────┘                                           │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐                                           │
│  │ lowerDrafts()│  Validate structure, normalize            │
│  └──────┬───────┘                                           │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐                                           │
│  │   Fragment   │  (validated, with provenance)             │
│  └──────────────┘                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Provenance Tracking:**

```typescript
// LLM-generated fragments include:
const origin: Provenance = {
  kind: 'llm',
  model: 'claude-sonnet-4-20250514',
  promptHash: 'abc123...',  // Hash of the prompt for reproducibility
};
```

**Confidence Capping:**

```typescript
// LLM adapters cap confidence to reflect uncertainty
const anthropicAdapter = createAnthropicAdapter({
  maxConfidence: 0.9,  // Never report > 90% confidence
});
```

---

## Session and Observability

The compiler can run as a Manifesto domain itself:

```
┌─────────────────────────────────────────────────────────────┐
│                    Compiler Session                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Compiler Domain (Manifesto):                               │
│  ├─▶ data.input.*        Input artifacts                    │
│  ├─▶ data.ir.*           Fragments, patches                 │
│  ├─▶ data.verify.*       Issues, conflicts                  │
│  ├─▶ state.phase         Current phase                      │
│  ├─▶ state.progress      Progress info                      │
│  ├─▶ derived.blockers    Blocking issues                    │
│  └─▶ derived.nextSteps   Available actions                  │
│                                                             │
│  Subscription API:                                          │
│  ├─▶ onPhaseChange()     Phase transitions                  │
│  ├─▶ onSnapshotChange()  State updates                      │
│  ├─▶ subscribePath()     Specific path changes              │
│  └─▶ subscribeEvents()   Event stream                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Invariants

These invariants are always maintained:

| # | Invariant | Implementation |
|---|-----------|----------------|
| 1 | Deterministic core | Sorting, no randomness in link/verify |
| 2 | LLM as untrusted proposer | FragmentDraft → lowerDrafts() |
| 3 | Modular compilation | Pass system with selection support |
| 4 | Provenance on all output | Fragment.origin required |
| 5 | Effects are descriptions | Compiler never executes effects |
| 6 | Conflicts surfaced | No auto-resolution |
| 7 | Deps from analysis | analyzeExpression() for dependencies |
| 8 | Domain-agnostic | No business domain templates |
| 9 | Patch-first editing | All modifications through patches |
| 10 | Observable | Session exposes full state |

---

## Error Handling

### Issue Codes

| Code | Severity | Description |
|------|----------|-------------|
| `MISSING_DEPENDENCY` | error | Required path not provided |
| `CYCLE_DETECTED` | error | Circular dependency |
| `DUPLICATE_PROVIDES` | error | Multiple providers for path |
| `INVALID_PATH` | error | Malformed semantic path |
| `SCHEMA_MISMATCH` | warning | Inconsistent schema types |
| `MISSING_PROVENANCE` | warning | No origin tracking |
| `EFFECT_RISK_TOO_HIGH` | warning | Effect exceeds risk threshold |

### Conflict Types

| Type | Description | Resolution |
|------|-------------|------------|
| `duplicate_provides` | Same path, different sources | Choose winner |
| `schema_mismatch` | Type incompatibility | Fix schema |
| `semantic_mismatch` | Different semantic meanings | Clarify intent |
| `dependency_conflict` | Incompatible requirements | Restructure |

---

## Extension Points

### Custom Passes

```typescript
const myPass: Pass = {
  name: 'my-custom-pass',
  priority: 150,  // After schema, before expression

  supports(artifact) {
    return artifact.kind === 'code';
  },

  async analyze(artifact) {
    // Extract findings from artifact
    return findings;
  },

  async compile(findings, context) {
    // Generate fragments from findings
    return fragments;
  },
};

const compiler = createCompiler({
  coreVersion: '0.3.0',
  passes: {
    custom: [myPass],
  },
});
```

### Custom LLM Adapter

```typescript
interface LLMAdapter {
  generate(prompt: string, context: LLMContext): Promise<FragmentDraft[]>;
}

const myAdapter: LLMAdapter = {
  async generate(prompt, context) {
    // Call your LLM
    const response = await myLLM.complete(prompt);

    // Parse and return drafts
    return parseDrafts(response);
  },
};
```

---

## Performance Considerations

### Incremental Compilation

Use `incrementalLink` for updates:

```typescript
const newResult = incrementalLink(
  previousResult,
  changedFragments,
  removedFragmentIds,
  options
);
```

### Fragment Caching

Stable IDs enable caching:

```typescript
// Same origin + same structure = same ID
const id1 = generateStableFragmentId(kind, origin);
const id2 = generateStableFragmentId(kind, origin);
assert(id1 === id2);
```

### Selective Pass Execution

Disable unnecessary passes:

```typescript
const compiler = createCompiler({
  passes: {
    disabled: ['nl-extractor'],  // Skip if no NL input
  },
});
```

---

For implementation details, see:
- [API Reference](./API.md)
- [Examples](./EXAMPLES.md)
- [Getting Started](./GETTING_STARTED.md)
