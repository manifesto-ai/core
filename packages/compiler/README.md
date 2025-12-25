# @manifesto-ai/compiler

Transform code and natural language into Manifesto Fragments with deterministic linking, verification, and patch-first editing.

## Installation

```bash
npm install @manifesto-ai/compiler @manifesto-ai/core
# or
pnpm add @manifesto-ai/compiler @manifesto-ai/core
```

## Features

- **Fragment-Based Compilation**: Transform code/NL into composable Fragment units
- **Deterministic Pipeline**: Reproducible linking and verification regardless of LLM variance
- **Pass System**: Modular, extensible compiler passes with priority ordering
- **Patch-First Editing**: Modify specific fragments without full recompilation
- **LLM Integration**: Built-in Anthropic and OpenAI adapters with provenance tracking

## Quick Start

```typescript
import { createCompiler } from '@manifesto-ai/compiler';

// 1. Create compiler
const compiler = createCompiler({
  coreVersion: '0.3.0',
});

// 2. Compile code artifact
const result = await compiler.compile({
  artifacts: [{
    id: 'counter',
    kind: 'code',
    language: 'ts',
    content: `
      const count: number = 0;
      const doubled = count * 2;
    `,
  }],
});

// 3. Access results
console.log(result.fragments);  // SchemaFragment, SourceFragment, DerivedFragment, ...
console.log(result.domain);     // Linked ManifestoDomain
console.log(result.issues);     // Verification issues
console.log(result.conflicts);  // Path conflicts
```

## Core Concepts

### Fragment

The atomic unit of compilation output. Each fragment represents a piece of domain logic:

| Fragment Type | Description | Example |
|---------------|-------------|---------|
| `SchemaFragment` | Data/state schema fields | `{ name: 'count', type: 'number' }` |
| `SourceFragment` | Source path definitions | `defineSource({ path: 'data.count', ... })` |
| `DerivedFragment` | Computed values | `defineDerived({ deps: [...], expr: [...] })` |
| `PolicyFragment` | Field policies & preconditions | `editable: when(...)` |
| `EffectFragment` | Side effect descriptions | `sequence([setValue(...), apiCall(...)])` |
| `ActionFragment` | Executable actions | `defineAction({ effect, preconditions })` |

### Pass System

Passes transform artifacts into fragments in priority order:

```typescript
import { createPassRegistry, codeAstExtractorPass, schemaPass } from '@manifesto-ai/compiler';

const registry = createPassRegistry();
registry.register(codeAstExtractorPass);  // priority: 0
registry.register(schemaPass);             // priority: 100
```

Built-in passes: `code-ast-extractor`, `schema`, `expression-lowering`, `effect-lowering`, `policy-lowering`, `action`, `nl-extractor`

### Linker

Merges fragments into a coherent domain with conflict detection:

```typescript
const linkResult = compiler.link(fragments);

// Access linked output
linkResult.domain;      // DomainDraft
linkResult.conflicts;   // Conflict[] (same path, different sources)
linkResult.issues;      // Issue[] (missing deps, etc.)
```

### Verifier

Validates the linked domain against Manifesto invariants:

```typescript
const verifyResult = compiler.verify(linkResult);

verifyResult.isValid;   // boolean
verifyResult.issues;    // Issue[] with codes like CYCLE_DETECTED, MISSING_DEPENDENCY
```

### Patch

Modify fragments incrementally without full recompilation:

```typescript
import { createPatch, replaceExprOp } from '@manifesto-ai/compiler';

const patch = createPatch(
  [replaceExprOp('derived-1', ['*', ['get', 'data.count'], 10])],
  { kind: 'user', user: 'developer' }
);

const result = compiler.applyPatch(fragments, patch);
```

## Compiler Session

For stateful compilation with observability:

```typescript
const session = compiler.createSession();

// Subscribe to phase changes
session.onPhaseChange((phase) => {
  console.log(`Phase: ${phase}`); // idle → parsing → linking → verifying → done
});

// Subscribe to snapshot changes
session.onSnapshotChange((snapshot) => {
  console.log(`Fragments: ${snapshot.fragmentsCount}`);
  console.log(`Conflicts: ${snapshot.conflictsCount}`);
});

// Compile with session tracking
await session.compile({ artifacts: [...] });

// Access current state
const snapshot = session.getSnapshot();
```

## LLM Integration

Use LLM adapters for natural language to fragment conversion:

```typescript
import { createCompiler, createAnthropicAdapter } from '@manifesto-ai/compiler';

const compiler = createCompiler({
  coreVersion: '0.3.0',
  llmAdapter: createAnthropicAdapter({
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-sonnet-4-20250514',
  }),
});

// Compile natural language
const result = await compiler.compile({
  artifacts: [{
    id: 'requirements',
    kind: 'text',
    format: 'markdown',
    content: `
      ## Order System
      - User can add items to cart
      - Total is calculated from item prices
      - Checkout requires at least one item
    `,
  }],
});
```

## API Overview

### Main

| Function | Description |
|----------|-------------|
| `createCompiler(config)` | Create compiler instance |
| `compiler.compile(input)` | Full pipeline: parse → link → verify |
| `compiler.compileFragments(input)` | Parse only, get fragments |
| `compiler.link(fragments)` | Link fragments into domain |
| `compiler.verify(result)` | Verify linked domain |
| `compiler.applyPatch(fragments, patch)` | Apply incremental patch |
| `compiler.createSession()` | Create stateful session |

### Fragment Creation

| Function | Creates |
|----------|---------|
| `createSchemaFragment(options)` | `SchemaFragment` |
| `createSourceFragment(options)` | `SourceFragment` |
| `createDerivedFragment(options)` | `DerivedFragment` |
| `createPolicyFragment(options)` | `PolicyFragment` |
| `createEffectFragment(options)` | `EffectFragment` |
| `createActionFragment(options)` | `ActionFragment` |

### LLM Adapters

| Function | Description |
|----------|-------------|
| `createAnthropicAdapter(config)` | Anthropic Claude adapter |
| `createOpenAIAdapter(config)` | OpenAI GPT adapter |

See [API Reference](./docs/API.md) for complete documentation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Compiler                                 │
├─────────────────────────────────────────────────────────────────┤
│  Artifacts ──► Pass System ──► Fragments ──► Linker ──► Domain  │
│      │              │              │            │          │     │
│   (code/NL)    (extract)      (atomic)     (merge)    (verify)  │
│                     │              │            │          │     │
│              ┌──────┴──────┐       │      ┌─────┴─────┐    │     │
│              │  NL Pass    │       │      │ Conflicts │    │     │
│              │ (LLM Draft) │       │      │  Issues   │    │     │
│              └──────┬──────┘       │      └───────────┘    │     │
│                     │              │                        │     │
│              lowerDrafts()    Patch System            Verifier   │
│             (validate LLM)   (incremental)          (DAG check)  │
└─────────────────────────────────────────────────────────────────┘
```

## Determinism Guarantees

The compiler ensures reproducibility:

1. **Linker**: Same fragments → Same domain structure
2. **Verifier**: Same domain → Same issues
3. **LLM Boundary**: LLM outputs are `FragmentDraft`, validated via `lowerDrafts()`

LLM variance is isolated: the deterministic core (link, verify, patch) remains reproducible.

## TypeScript

Full type inference is supported:

```typescript
import type {
  Fragment,
  SchemaFragment,
  SourceFragment,
  DerivedFragment,
  Issue,
  Conflict,
  Patch,
  CompileResult,
} from '@manifesto-ai/compiler';
```

## License

MIT
