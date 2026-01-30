# Manifesto Translator Specification v1.0.3

> **Status:** Draft  
> **Version:** 1.0.3  
> **Date:** 2026-01-28 (Updated: 2026-01-30)  
> **Authors:** Manifesto Contributors  
> **License:** MIT  
> **Companion:** ADR-TRANSLATOR v1.0.8 (TRN-101~107)  
> **Depends On:** Intent IR v0.2+

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Normative Language](#2-normative-language)
3. [Core Philosophy](#3-core-philosophy)
4. [Architecture](#4-architecture)
5. [Type Definitions](#5-type-definitions)
6. [Strategy Interfaces](#6-strategy-interfaces)
7. [Pipeline Orchestrator](#7-pipeline-orchestrator)
8. [Plugin System](#8-plugin-system)
9. [LLM Port (Input Adapter)](#9-llm-port-input-adapter)
10. [Target Exporter Port (Output Adapter)](#10-target-exporter-port-output-adapter)
11. [Invariants](#11-invariants)
12. [Validation](#12-validation)
13. [Error Handling](#13-error-handling)
14. [Public API](#14-public-api)
15. [Conformance](#15-conformance)
16. [Examples](#16-examples)
17. [Versioning](#17-versioning)
18. [Appendix: Normative Rules Index](#appendix-normative-rules-index)

---

## 1. Introduction

### 1.1 What is Translator?

Translator is a **semantic compiler** that transforms natural language into structured Intent Graph representations. It provides:

- **Natural Language → Intent Graph** transformation (LLM-assisted)
- **Complex intent decomposition** into dependency-aware DAG structures
- **Ambiguity measurement** without policy decisions
- **Target-agnostic output** via pluggable exporters

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Natural Language  ────►  Intent Graph  ────►  Target Output              │
│   "Create a project        (DAG of IntentIR     (ManifestoBundle,          │
│    and add tasks"           nodes)               JSON, OpenAPI, ...)       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 What Translator is NOT

Translator is **NOT**:

- An execution engine (execution is Host/App responsibility)
- A governance system (governance is World responsibility)
- A replacement for Intent IR (Translator composes with Intent IR)
- A policy decision maker (ambiguity triage is consumer responsibility)
- Part of Manifesto runtime (Translator is an independent package)
- A target-specific tool (target emission is delegated to exporters)

### 1.3 Design Goals

| Goal | Description |
|------|-------------|
| **Independence** | No runtime dependency on Core/Host/World/App |
| **Clean Architecture** | Separated concerns via Strategy Pattern + Ports & Adapters |
| **Composition** | Builds on Intent IR v0.2, does not replace it |
| **Measurement over Decision** | Produces ambiguity scores, not triage decisions |
| **Target Agnosticism** | Core produces Intent Graph; exporters produce target-specific output |
| **Extensibility** | Plugin system for observation and transformation |

### 1.4 Relationship to Intent IR

Translator **composes with** Intent IR v0.2:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Translator                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Intent Graph                                  │  │
│  │   ┌──────────┐    ┌──────────┐    ┌──────────┐                       │  │
│  │   │ IntentIR │───►│ IntentIR │───►│ IntentIR │   (DAG of nodes)      │  │
│  │   │  (v0.2)  │    │  (v0.2)  │    │  (v0.2)  │                       │  │
│  │   └──────────┘    └──────────┘    └──────────┘                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

- Each Intent Graph **node wraps** an IntentIR instance
- Intent IR's semantic contract applies **per node**
- Translator does not modify Intent IR semantics

**v0.2 Alignment Notes:**
- Translator MUST emit `IntentIR.v = "0.2"` for new nodes.
- Plurality/coordination is expressed as `ListTerm` inside a role slot (args still map Role → Term).
- `PredOp "in"` is supported and requires `rhs.kind === "list"`.
- Term-level `ext` is allowed for non-semantic hints; semantics MUST remain in core fields.

### 1.5 Version History

| Version | Date | Description |
|---------|------|-------------|
| v0.1.x | 2026-01 | Initial prototype (God Object anti-pattern) |
| v1.0.0 | 2026-01 | Clean Architecture rewrite (TRN-101~107) |
| v1.0.3 | 2026-01-30 | Intent IR v0.2 alignment and spec refinements |

---

## 2. Normative Language

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

**Normative Rule IDs:**

This specification uses prefixed rule IDs for traceability:

| Prefix | Domain |
|--------|--------|
| `TRN-BND-*` | Package boundary rules |
| `PKG-*` | Package structure rules |
| `L-*` | Layer dependency rules |
| `D-INV-*` | Decomposition invariants |
| `M-INV-*` | Merge invariants |
| `G-INV-*` | Graph invariants |
| `R-INV-*` | Resolution invariants |
| `E-INV-*` | ExecutionPlan invariants |
| `L-INV-*` | Lowering invariants (Target-owned) |
| `OVL-*` | Overlap safety rules |
| `PEX-*` | ParallelExecutor rules |
| `PLG-*` | Plugin system rules |
| `EXP-*` | Target exporter rules |
| `DIAG-*` | Diagnostics rules |
| `V-*` | Validation function rules |
| `C-ABS-*` | Abstract node constraints |
| `C-EDGES-*` | Edge constraints |

---

## 3. Core Philosophy

### 3.1 The Translator Constitution

```
1. Independence is sacred. No runtime coupling to Core/Host/World/App.
2. Composition over replacement. Intent IR is wrapped, not superseded.
3. Measurement is pure. Ambiguity is scored, not judged.
4. Lowering is target-specific. Core produces graphs; exporters produce execution plans.
5. Terminology is guarded. Internal concepts stay internal.
6. Graphs are acyclic. Cycles are errors, not features.
7. Resolution is orthogonal to lowering. Semantic completeness ≠ execution readiness.
8. Strategies are composable. Each concern has exactly one responsibility.
9. Plugins extend, not modify. Core invariants are protected.
```

### 3.2 The Separation Principle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TARGET EXPORTERS                                   │
│  - Manifesto bundle generation                                              │
│  - Lowering (IntentIR → IntentBody)                                         │
│  - Target-specific artifacts                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ exportTo(exporter, input, ctx)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TRANSLATOR CORE                                    │
│  - NL → Intent Graph transformation                                         │
│  - Decomposition / Translation / Merge                                      │
│  - Validation & diagnostics                                                 │
│  - ExecutionPlan (topological sort only)                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ llmPort.complete(request)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LLM ADAPTERS                                      │
│  - OpenAI / Claude / Ollama / etc.                                          │
│  - SDK-specific implementation                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Resolution vs Lowering

These two axes are **independent**:

| Axis | Question | Owner |
|------|----------|-------|
| **Resolution** | Is the intent semantically complete? | Core (Translator) |
| **Lowering** | Can IntentIR be converted to IntentBody? | Target (Exporter) |

A `Resolved` intent may still fail lowering (schema mismatch).
An `Ambiguous` intent may still be lowerable (deferred resolution).

---

## 4. Architecture

### 4.1 Clean Architecture Overview

Translator v1.0 follows **Clean Architecture** with **Ports & Adapters** (Hexagonal):

```
                    ┌─────────────────────┐
                    │    LLM Adapters     │  Input Port
                    │  (openai/claude/…)  │
                    └──────────┬──────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                      @manifesto-ai/translator                             │
│                            (Core)                                         │
│                                                                           │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│   │ Decomposer  │───►│ Translator  │───►│   Merger    │                  │
│   │  Strategy   │    │  Strategy   │    │  Strategy   │                  │
│   └─────────────┘    └─────────────┘    └─────────────┘                  │
│          │                  │                  │                          │
│          └──────────────────┼──────────────────┘                          │
│                             │                                             │
│                     ┌───────▼───────┐                                     │
│                     │   Pipeline    │                                     │
│                     │ Orchestrator  │                                     │
│                     └───────┬───────┘                                     │
│                             │                                             │
│   ┌─────────────────────────┼─────────────────────────┐                  │
│   │                    Plugin System                  │                  │
│   │  (Inspector / Transformer hooks)                  │                  │
│   └───────────────────────────────────────────────────┘                  │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Target Exporters   │  Output Port
                    │ (manifesto/json/…)  │
                    └─────────────────────┘
```

### 4.2 Package Structure

```
@manifesto-ai/translator/                    # Core package (SDK/Target 무의존)
├── src/
│   ├── core/                                # Domain Layer
│   │   ├── interfaces/
│   │   │   ├── decomposer.ts                # DecomposeStrategy
│   │   │   ├── translator.ts                # TranslateStrategy
│   │   │   ├── merger.ts                    # MergeStrategy
│   │   │   ├── llm-port.ts                  # LLMPort
│   │   │   └── exporter-port.ts             # TargetExporter
│   │   └── types/
│   │       ├── chunk.ts                     # Chunk, Span
│   │       ├── intent-graph.ts              # IntentGraph, IntentNode
│   │       ├── execution-plan.ts            # ExecutionPlan, ExecutionStep
│   │       ├── validation.ts                # ValidationResult
│   │       ├── diagnostics.ts               # DiagnosticsBag
│   │       └── extension-candidate.ts       # ExtensionCandidate
│   ├── strategies/                          # Built-in Strategies
│   │   ├── decompose/
│   │   │   ├── sliding-window.ts
│   │   │   └── sentence-based.ts
│   │   ├── translate/
│   │   │   └── llm-translator.ts
│   │   └── merge/
│   │       ├── conservative-merger.ts
│   │       └── aggressive-merger.ts
│   ├── pipeline/                            # Orchestration
│   │   ├── pipeline.ts
│   │   ├── parallel-executor.ts
│   │   └── factory.ts
│   ├── plugins/                             # Built-in Plugins
│   │   ├── or-detector.ts
│   │   └── coverage-checker.ts
│   ├── helpers/                             # Core Helpers
│   │   ├── build-execution-plan.ts
│   │   └── validate-graph.ts
│   └── index.ts

@manifesto-ai/translator-adapter-openai/     # LLM Adapter (separate package)
@manifesto-ai/translator-adapter-claude/     # LLM Adapter (separate package)
@manifesto-ai/translator-adapter-ollama/     # LLM Adapter (separate package)

@manifesto-ai/translator-target-manifesto/   # Target Exporter (separate package)
@manifesto-ai/translator-target-json/        # Target Exporter (separate package)
@manifesto-ai/translator-target-openapi/     # Target Exporter (separate package)
```

### 4.3 Boundary Rules (Normative)

| ID | Level | Rule |
|----|-------|------|
| **TRN-BND-1** | MUST NOT | Translator SHALL NOT import `@manifesto-ai/host\|world\|app` |
| **TRN-BND-2** | MUST NOT | Translator SHALL NOT generate Proposal/Authority/ExecutionKey |
| **TRN-BND-3** | MAY | `@manifesto-ai/core` is allowed as type-only import |
| **TRN-BND-4** | MUST | Translator SHALL perform pure semantic transformation (NL → Intent Graph) |
| **TRN-BND-5** | MUST NOT | Translator core SHALL NOT contain target-specific emission logic |

### 4.4 Layer Rules (Normative)

| ID | Level | Rule |
|----|-------|------|
| **L-1** | MUST | Core layer SHALL have no external dependencies (pure interfaces) |
| **L-2** | MUST | Strategies SHALL implement only Core interfaces |
| **L-3** | MUST | LLM Adapters SHALL be in separate packages |
| **L-4** | MUST | Target Exporters SHALL be in separate packages |
| **L-5** | MUST | Pipeline SHALL compose via interfaces only |

### 4.5 Package Content Rules (Normative)

| ID | Level | Rule |
|----|-------|------|
| **PKG-1** | MUST | `@manifesto-ai/translator` SHALL include SDK-independent core logic (pipeline, strategies, decorators, plugin types, LLMPort definition) |
| **PKG-2** | MUST | LLM SDK dependencies SHALL be in adapter packages only |
| **PKG-3** | MUST | Target-specific types (InvocationPlan, LoweringResult, IntentBody) SHALL be in exporter packages only |

---

## 5. Type Definitions

### 5.1 Chunk

```typescript
/**
 * A decomposed segment of input text.
 */
interface Chunk {
  /** Zero-based index in chunk array */
  readonly index: number;
  
  /** The actual text content */
  readonly text: string;
  
  /** Position in original input */
  readonly span: Span;
  
  /** Optional metadata */
  readonly meta?: Readonly<Record<string, unknown>>;
}

interface Span {
  /** Start offset (inclusive) */
  readonly start: number;
  
  /** End offset (exclusive) */
  readonly end: number;
}
```

### 5.2 Intent Graph

```typescript
/**
 * A directed acyclic graph of intent nodes.
 */
interface IntentGraph {
  readonly nodes: readonly IntentNode[];
}

/**
 * A single intent node wrapping an IntentIR.
 */
interface IntentNode {
  /** Unique identifier within graph */
  readonly id: string;
  
  /** The underlying Intent IR instance */
  readonly ir: IntentIR;
  
  /** Semantic resolution status */
  readonly resolution: Resolution;
  
  /** Dependency references (node IDs) */
  readonly dependsOn: readonly string[];
}

/**
 * Resolution status (semantic completeness).
 * 
 * Note: This is an interface, not a discriminated union.
 * All fields are present; status determines interpretation.
 */
interface Resolution {
  /** Resolution status (PascalCase) */
  readonly status: "Resolved" | "Ambiguous" | "Abstract";
  
  /** Ambiguity score (0.0 = resolved, 1.0 = fully ambiguous) */
  readonly ambiguityScore: number;
  
  /** Missing semantic roles (for Ambiguous status) */
  readonly missing?: readonly Role[];
  
  /** Clarification questions (for Ambiguous status) */
  readonly questions?: readonly string[];
}

/**
 * Semantic role in a relation.
 * Aligned with Intent IR v0.2.
 * 
 * Note: TIME is modeled separately as IntentIR.time?: TimeSpec
 */
type Role =
  | "TARGET"
  | "THEME"
  | "SOURCE"
  | "DEST"          // not "DESTINATION"
  | "INSTRUMENT"
  | "BENEFICIARY";
```

### 5.3 ExecutionPlan (Core)

```typescript
/**
 * Core execution plan.
 * 
 * Contains topologically sorted steps and dependency graph.
 * Does NOT contain lowering information (target-specific).
 */
interface ExecutionPlan {
  /** Execution steps (Abstract nodes excluded, topologically sorted) */
  readonly steps: readonly ExecutionStep[];
  
  /** Dependency edges (within steps only) */
  readonly dependencyEdges: readonly DependencyEdge[];
  
  /** Abstract nodes (excluded from execution) */
  readonly abstractNodes: readonly string[];
}

/**
 * Execution step (Core, no lowering).
 */
interface ExecutionStep {
  readonly nodeId: string;
  readonly ir: IntentIR;
  readonly resolution: Resolution;
  // Note: No lowering field - that's target-specific
}

/**
 * Dependency edge.
 * 
 * Direction: dependency → dependent
 * Topological sort: `from` executes before `to`
 */
interface DependencyEdge {
  /** Dependency node (executes first) */
  readonly from: string;
  
  /** Dependent node (executes after) */
  readonly to: string;
}
```

### 5.4 ValidationResult

```typescript
type ValidationResult =
  | { readonly valid: true; readonly warnings?: readonly ValidationWarning[] }
  | { readonly valid: false; readonly error: ValidationErrorInfo };

/**
 * Validation error information (data type).
 * Note: This is distinct from the ValidationException class in §13.
 */
interface ValidationErrorInfo {
  readonly code: ValidationErrorCode;
  readonly message: string;
  readonly nodeId?: string;
  readonly chunkIndex?: number;  // For chunk validation errors
}

interface ValidationWarning {
  readonly code: string;
  readonly message: string;
  readonly nodeId?: string;
}

/**
 * Validation error codes.
 * Covers both graph validation and chunk validation.
 */
type ValidationErrorCode =
  // Graph validation codes
  | "DUPLICATE_ID"
  | "MISSING_DEPENDENCY"
  | "CYCLE_DETECTED"
  | "ABSTRACT_DEPENDENCY"
  | "INVALID_RESOLUTION"
  // Chunk validation codes
  | "SPAN_MISMATCH"
  | "INDEX_MISMATCH"
  | "SPAN_ORDER_VIOLATION"
  | "INVALID_SPAN"
  | "EMPTY_CHUNKS";  // D-INV-1 violation
```

### 5.5 DiagnosticsBag

```typescript
/**
 * Diagnostic information collector.
 */
interface DiagnosticsBag {
  /** Add warning */
  warn(code: string, message: string, nodeId?: string): void;
  
  /** Add info */
  info(code: string, message: string, nodeId?: string): void;
  
  /**
   * Record metric (last-write-wins).
   * Overwrites if name already exists.
   * Note: Non-deterministic in parallel chunk hooks.
   */
  metric(name: string, value: number): void;
  
  /**
   * Accumulate metric (sum aggregation).
   * Safe for parallel chunk hooks.
   */
  metricAdd(name: string, delta: number): void;
  
  /**
   * Observe metric (histogram/average).
   * Stores all observations for later min/max/avg calculation.
   * 
   * ⚠️ May grow unbounded. See DIAG-OBS-1.
   */
  metricObserve(name: string, value: number): void;
  
  /** Read-only access */
  readonly warnings: readonly Diagnostic[];
  readonly infos: readonly Diagnostic[];
  readonly metrics: ReadonlyMap<string, number>;
  readonly metricObservations: ReadonlyMap<string, readonly number[]>;
}

/**
 * Read-only diagnostics view.
 * Used in ExportInput.
 */
type DiagnosticsReadonly = Pick<
  DiagnosticsBag,
  'warnings' | 'infos' | 'metrics' | 'metricObservations'
>;

interface Diagnostic {
  readonly code: string;
  readonly message: string;
  readonly nodeId?: string;
  readonly timestamp: number;
}
```

### 5.6 ExtensionCandidate

```typescript
/**
 * Target-agnostic extension hint.
 * 
 * Generalizes the concept of "melCandidates" to support
 * multiple target types.
 */
interface ExtensionCandidate {
  /** Related node ID */
  readonly nodeId: string;
  
  /**
   * Hint type.
   * - "mel": Manifesto Expression Language (Manifesto target)
   * - "jsonschema": JSON Schema extension (OpenAPI target)
   * - "patch-template": Patch template (generic)
   */
  readonly kind: string;
  
  /** Kind-specific payload */
  readonly payload: unknown;
  
  /** Capabilities enabled if this hint is applied */
  readonly wouldEnable?: readonly string[];
}
```

---

## 6. Strategy Interfaces

### 6.1 DecomposeStrategy

```typescript
/**
 * Decomposes input text into processable chunks.
 */
interface DecomposeStrategy {
  /**
   * Decompose text into chunks.
   * 
   * Note: Returns Promise to support LLM-based or I/O-based decomposers.
   * Sync implementations should return Promise.resolve(chunks).
   * 
   * @param text - Input text
   * @param options - Decomposition options
   * @returns Promise of chunk array satisfying D-INV-* invariants
   */
  decompose(text: string, options?: DecomposeOptions): Promise<Chunk[]>;
}

interface DecomposeOptions {
  /** Maximum chunk size (tokens or characters) */
  maxChunkSize?: number;
  
  /** Overlap size for context preservation */
  overlapSize?: number;
  
  /** Language hint for better sentence detection */
  language?: string;
}
```

**Built-in Implementations:**

| Strategy | Description |
|----------|-------------|
| `SlidingWindowDecomposer` | Fixed-size windows with optional overlap |
| `SentenceBasedDecomposer` | Sentence boundary detection |

### 6.2 TranslateStrategy

```typescript
/**
 * Translates text into an Intent Graph.
 */
interface TranslateStrategy {
  /**
   * Translate text to Intent Graph.
   * 
   * @param text - Input text (chunk or full)
   * @param options - Translation options
   * @returns Intent Graph with nodes
   */
  translate(text: string, options?: TranslateOptions): Promise<IntentGraph>;
}

interface TranslateOptions {
  /** Maximum nodes to extract per chunk */
  maxNodes?: number;
  
  /** Domain hint (e.g., "project-management", "calendar") */
  domain?: string;
  
  /** Language hint */
  language?: string;
  
  /** Allowed event types (whitelist) */
  allowedEvents?: string[];
}
```

**Built-in Implementations:**

| Strategy | Description |
|----------|-------------|
| `LLMTranslator` | LLM-based semantic extraction |
| `DeterministicTranslator` | Rule-based extraction (testing) |

### 6.3 MergeStrategy

```typescript
/**
 * Merges multiple Intent Graphs into one.
 */
interface MergeStrategy {
  /**
   * Merge graphs.
   * 
   * @param graphs - Array of graphs to merge
   * @param options - Merge options
   * @returns Single merged graph satisfying M-INV-* invariants
   */
  merge(graphs: readonly IntentGraph[], options?: MergeOptions): IntentGraph;
}

interface MergeOptions {
  /** Use prefix-based node ID collision prevention */
  prefixNodeIds?: boolean;
  
  /** Perform semantic deduplication */
  deduplicate?: boolean;
  
  /** Cross-chunk linking strategy */
  linkStrategy?: "conservative" | "aggressive" | "none";
}
```

**Built-in Implementations:**

| Strategy | Description |
|----------|-------------|
| `ConservativeMerger` | Minimal linking, safe dedup |
| `AggressiveMerger` | Maximum linking, semantic matching |

---

## 7. Pipeline Orchestrator

### 7.1 TranslatorPipeline

```typescript
/**
 * Main orchestrator for the translation pipeline.
 */
class TranslatorPipeline {
  constructor(
    decomposer: DecomposeStrategy,
    translator: TranslateStrategy,
    merger: MergeStrategy,
    options?: PipelineOptions,
    plugins?: readonly PipelinePlugin[]
  );
  
  /**
   * Process input text through the full pipeline.
   * 
   * @param input - Natural language input
   * @returns Pipeline result with graph and diagnostics
   */
  process(input: string): Promise<PipelineResult>;
}

interface PipelineOptions {
  /** Concurrent chunk translation limit (default: 5) */
  concurrency?: number;
  
  /** Overall timeout (ms) */
  timeout?: number;
  
  /** Per-chunk timeout (ms) */
  chunkTimeout?: number;
  
  /** Maximum chunk size (passed to decomposer) */
  maxChunkSize?: number;
  
  /** 
   * Enable deduplication.
   * Forced to true if overlap is detected.
   * Error if false with overlap.
   */
  deduplicate?: boolean;
  
  /** Error handling policy */
  errorPolicy?: "fail-fast" | "best-effort";
  
  /** Cross-chunk linking strategy */
  linkStrategy?: "conservative" | "aggressive" | "none";
}

interface PipelineResult {
  readonly graph: IntentGraph;
  readonly diagnostics: DiagnosticsReadonly;
  readonly meta: Readonly<{
    chunkCount: number;
    nodeCount: number;
    processingTimeMs: number;
    hasOverlap: boolean;
  }>;
}
```

### 7.2 ParallelExecutor

```typescript
/**
 * Parallel execution with concurrency control.
 */
class ParallelExecutor<TIn, TOut> {
  constructor(options: ParallelExecutorOptions);
  
  /**
   * Execute function on inputs with concurrency control.
   * 
   * CRITICAL: Results MUST be in input order (PEX-1).
   * 
   * @param inputs - Input array
   * @param fn - Async function to execute
   * @returns Results in same order as inputs
   */
  execute(
    inputs: TIn[],
    fn: (input: TIn, index: number) => Promise<TOut>
  ): Promise<TOut[]>;
}

interface ParallelExecutorOptions {
  concurrency: number;
  timeout?: number;
  onError?: "fail-fast" | "best-effort";
}
```

### 7.3 Factory Functions

```typescript
/**
 * Create default pipeline (non-overlap, safe).
 */
function createDefaultPipeline(llm: LLMPort): TranslatorPipeline;

/**
 * Create pipeline with context overlap.
 * Overlap is auto-detected from spans; dedup is forced.
 */
function createContextOverlapPipeline(llm: LLMPort): TranslatorPipeline;

/**
 * Create high-throughput pipeline (best-effort errors).
 */
function createFastPipeline(llm: LLMPort): TranslatorPipeline;
```

---

## 8. Plugin System

### 8.1 Plugin Interface

```typescript
/**
 * Pipeline plugin.
 * 
 * Plugins extend pipeline behavior without modifying core logic.
 * Two kinds: Inspector (observe) and Transformer (modify).
 */
interface PipelinePlugin {
  /** Plugin name (for debugging) */
  readonly name: string;
  
  /** Plugin kind */
  readonly kind: "inspector" | "transformer";
  
  /**
   * Create run-scoped hooks.
   * Called once per pipeline.process() invocation.
   * 
   * @returns Hooks for this run
   */
  createRunHooks(): PipelineHooks;
}

/**
 * Pipeline execution phases.
 */
type PipelinePhase =
  | "beforeDecompose"
  | "afterDecompose"
  | "beforeTranslateChunk"
  | "afterTranslateChunk"
  | "beforeMerge"
  | "afterMerge"
  | "afterStructuralValidate"
  | "afterLexiconValidate";
```

### 8.2 Context Types

```typescript
/**
 * Read-only context for plugins.
 */
interface ReadonlyPipelineContext {
  readonly input: string;
  readonly chunks?: readonly Chunk[];
  readonly graphs?: readonly IntentGraph[];
  readonly merged?: IntentGraph;
  readonly structuralValidation?: ValidationResult;
  readonly lexiconValidation?: ValidationResult;
  readonly diagnostics: DiagnosticsBag;
}

/**
 * Per-chunk hook context (parallel-safe).
 */
interface ChunkHookContext extends ReadonlyPipelineContext {
  /** Current chunk index */
  readonly chunkIndex: number;
  
  /** Current chunk */
  readonly chunk: Chunk;
  
  /** Chunk translation result (afterTranslateChunk only) */
  readonly chunkGraph?: IntentGraph;
}
```

### 8.3 Hook Types

```typescript
/** Standard hook (Inspector/Transformer, no return) */
type StandardHook = (ctx: ReadonlyPipelineContext) => void | Promise<void>;

/** Chunk hook (parallel execution, chunk-local context) */
type ChunkHook = (ctx: ChunkHookContext) => void | Promise<void>;

/**
 * Transformer hook (afterMerge only).
 * Returns modified graph; pipeline re-validates.
 */
type TransformerHook = (ctx: ReadonlyPipelineContext) => 
  | void 
  | IntentGraph 
  | Promise<void | IntentGraph>;

/**
 * Pipeline hooks definition.
 */
interface PipelineHooks {
  beforeDecompose?: StandardHook;
  afterDecompose?: StandardHook;
  beforeTranslateChunk?: ChunkHook;
  afterTranslateChunk?: ChunkHook;
  beforeMerge?: StandardHook;
  afterMerge?: TransformerHook;
  afterStructuralValidate?: StandardHook;
  afterLexiconValidate?: StandardHook;
}
```

### 8.4 Built-in Plugins

| Plugin | Kind | Description |
|--------|------|-------------|
| `orDetectorPlugin` | Inspector | Detects OR patterns, emits warnings |
| `coverageCheckerPlugin` | Inspector | Calculates quoted string coverage |
| `dependencyRepairPlugin` | Transformer | Fixes missing cross-chunk dependencies |

---

## 9. LLM Port (Input Adapter)

### 9.1 LLMPort Interface

```typescript
/**
 * LLM provider abstraction.
 * Implements Ports & Adapters pattern for input.
 */
interface LLMPort {
  /**
   * Send completion request to LLM.
   * 
   * @param request - LLM request
   * @returns LLM response
   */
  complete(request: LLMRequest): Promise<LLMResponse>;
}

interface LLMRequest {
  /** System prompt (separate from messages) */
  system?: string;
  
  /** Conversation messages */
  messages: LLMMessage[];
  
  /** LLM call options */
  options?: LLMCallOptions;
}

/**
 * LLM message.
 * Note: "system" is NOT a valid role; use LLMRequest.system instead.
 */
interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

interface LLMCallOptions {
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
  responseFormat?: "text" | "json";
  timeout?: number;
}

interface LLMResponse {
  content: string;
  usage?: LLMUsage;
  finishReason: "stop" | "length" | "content_filter" | "error";
}

interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
```

### 9.2 LLM Error Types

```typescript
/**
 * LLM adapter error.
 */
class LLMError extends Error {
  constructor(
    message: string,
    readonly code: LLMErrorCode,
    readonly retryable: boolean,
    readonly cause?: unknown
  ) {
    super(message);
  }
}

type LLMErrorCode =
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "AUTH_FAILED"
  | "INVALID_REQUEST"
  | "SERVICE_ERROR"
  | "CONTENT_FILTER"
  | "NETWORK_ERROR"
  | "UNKNOWN";
```

### 9.3 Adapter Packages

| Package | Dependency |
|---------|------------|
| `@manifesto-ai/translator-adapter-openai` | `openai` |
| `@manifesto-ai/translator-adapter-claude` | `@anthropic-ai/sdk` |
| `@manifesto-ai/translator-adapter-ollama` | `ollama` |

---

## 10. Target Exporter Port (Output Adapter)

### 10.1 TargetExporter Interface

```typescript
/**
 * Target-specific output generator.
 * Implements Ports & Adapters pattern for output.
 * 
 * TOut: Output type (target-specific)
 * TCtx: Context type (target-specific, e.g., Lexicon/Resolver)
 */
interface TargetExporter<TOut, TCtx = void> {
  /** Exporter identifier */
  readonly id: string;
  
  /**
   * Export Intent Graph to target-specific output.
   * 
   * @param input - Pipeline result
   * @param ctx - Target-specific context
   * @returns Target-specific output
   */
  export(input: ExportInput, ctx: TCtx): Promise<TOut>;
}

/**
 * Input to exporter.
 */
interface ExportInput {
  /** Final merged graph */
  readonly graph: IntentGraph;
  
  /** Pipeline diagnostics (optional) */
  readonly diagnostics?: DiagnosticsReadonly;
  
  /** Source information (optional, for traceback) */
  readonly source?: Readonly<{
    text?: string;
    chunks?: readonly Chunk[];
  }>;
}

/**
 * Convenience helper.
 */
async function exportTo<TOut, TCtx>(
  exporter: TargetExporter<TOut, TCtx>,
  input: ExportInput,
  ctx: TCtx
): Promise<TOut> {
  return exporter.export(input, ctx);
}
```

### 10.2 Exporter Packages

| Package | Output Type |
|---------|-------------|
| `@manifesto-ai/translator-target-manifesto` | `ManifestoBundle` |
| `@manifesto-ai/translator-target-json` | `JsonOutput` |
| `@manifesto-ai/translator-target-openapi` | `OpenAPISpec` |

### 10.3 Manifesto Target (Non-normative Example)

```typescript
// @manifesto-ai/translator-target-manifesto

import { 
  TargetExporter, 
  ExportInput, 
  ExtensionCandidate,
  buildExecutionPlan
} from '@manifesto-ai/translator';
import type { Lexicon, Resolver } from '@manifesto-ai/core';

// Target-specific types (owned by this package)
interface InvocationPlan {
  readonly steps: readonly InvocationStep[];
  readonly dependencyEdges: readonly DependencyEdge[];
  readonly abstractNodes: readonly string[];
}

interface InvocationStep {
  readonly nodeId: string;
  readonly ir: IntentIR;
  readonly resolution: Resolution;
  readonly lowering: LoweringResult;  // Target-specific
}

type LoweringResult =
  | { readonly status: "ready"; readonly intentBody: IntentBody }
  | { readonly status: "deferred"; readonly reason: string }
  | { readonly status: "failed"; readonly failure: LoweringFailure };

interface ManifestoBundle {
  readonly invocationPlan: InvocationPlan;
  readonly extensionCandidates: readonly ExtensionCandidate[];
  readonly meta: Readonly<{
    nodeCount: number;
    readyCount: number;
    deferredCount: number;
    failedCount: number;
  }>;
}

export const manifestoExporter: TargetExporter<ManifestoBundle, ManifestoExportContext> = {
  id: "manifesto",
  async export(input, ctx) {
    // 1. Build ExecutionPlan (Core helper)
    const execPlan = buildExecutionPlan(input.graph);
    
    // 2. Perform lowering (target-specific)
    const lowered = lowerWithContext(execPlan, ctx.lexicon, ctx.resolver);
    
    // 3. Generate MEL candidates
    const melCandidates = generateMelCandidates(lowered.deferred, ctx);
    
    return {
      invocationPlan: lowered.invocationPlan,
      extensionCandidates: melCandidates.map(m => ({
        nodeId: m.nodeId,
        kind: "mel",
        payload: m.template,
        wouldEnable: m.capabilities,
      })),
      meta: { ... }
    };
  }
};
```

---

## 11. Invariants

### 11.1 Decomposition Invariants

| ID | Level | Rule |
|----|-------|------|
| **D-INV-0** | MUST | `chunk.text === input.slice(span.start, span.end)` (substring guarantee, no paraphrase/summary) |
| **D-INV-1** | MUST | `chunks.length >= 1` (empty input still produces at least 1 chunk) |
| **D-INV-2** | MUST | `chunks[i].index === i` (index matches array position) |
| **D-INV-2b** | MUST | `chunks[i].span.start <= chunks[i+1].span.start` (sorted by span.start, prerequisite for overlap detection) |
| **D-INV-3** | MUST | `0 <= span.start <= span.end <= input.length` |
| **D-INV-3a** | SHOULD | If `input.length > 0`, then `span.start < span.end` (discourage empty spans) |
| **D-INV-4** | SHOULD | Default is non-overlap full cover |
| **D-INV-5** | MUST | If overlap exists, semantic deduplication is required before/during merge |

### 11.2 Graph Invariants

| ID | Level | Rule |
|----|-------|------|
| **G-INV-1** | MUST | Node IDs are unique within graph |
| **G-INV-2** | MUST | All `dependsOn` IDs exist in graph |
| **G-INV-3** | MUST | Graph is a DAG (no cycles) |
| **G-INV-4** | MUST | Non-abstract nodes SHALL NOT depend on abstract nodes (C-ABS-1) |

### 11.2a Resolution Invariants

| ID | Level | Rule |
|----|-------|------|
| **R-INV-1** | MUST | `resolution.status === "Resolved"` ⟹ `resolution.missing` is absent or length 0 |
| **R-INV-2** | MUST | `resolution.missing` exists and length > 0 ⟹ `resolution.status !== "Resolved"` |

> **Note:** R-INV-1 and R-INV-2 ensure logical consistency between resolution status and missing roles. A "Resolved" intent cannot have missing semantic roles. `INVALID_RESOLUTION` validation error code indicates R-INV violation.

### 11.3 Merge Invariants

| ID | Level | Rule |
|----|-------|------|
| **M-INV-1** | MUST | Result graph is a valid DAG |
| **M-INV-2** | MUST | C-ABS-1 is preserved |
| **M-INV-3** | MUST | `prefixNodeIds=true` ⟹ no ID collisions |
| **M-INV-4** | MUST | Overlap input triggers semantic deduplication |
| **M-INV-5** | MUST | Result graph node IDs are globally unique (re-id required if chunks produce n1/n2...) |

> **Note (M-INV-5 vs prefixNodeIds):** `prefixNodeIds=false` does NOT mean "allow collisions". It means "don't use prefix style". MergeStrategy MUST still ensure global uniqueness via re-id or other mechanisms.

### 11.4 ExecutionPlan Invariants (Core)

| ID | Level | Rule |
|----|-------|------|
| **E-INV-1** | MUST | `steps` contains no abstract nodes |
| **E-INV-2** | MUST | `dependencyEdges` references only nodes in `steps` |
| **E-INV-3** | MUST | `from` is dependency (executes first), `to` is dependent (executes after) |

### 11.5 Lowering Invariants (Target-owned)

| ID | Level | Rule | Owner |
|----|-------|------|-------|
| **L-INV-1** | MUST | `status="ready"` ⟹ `intentBody` exists | Target |
| **L-INV-2** | MUST | `status≠"ready"` ⟹ `intentBody` absent | Target |
| **L-INV-3** | MUST | `status="failed"` ⟹ `failure.kind` + `failure.details` exist | Target |

### 11.6 Overlap Safety Rules

| ID | Level | Rule |
|----|-------|------|
| **OVL-1** | MUST | Overlap is detected by span (`prev.end > curr.start`), requires D-INV-2b |
| **OVL-2** | MUST | Overlap detection forces `deduplicate=true` (error if explicitly false) |
| **OVL-3** | SHOULD | Default pipelines should use non-overlap decomposers |
| **OVL-4** | MUST NOT | `PipelineOptions.overlapSize` does not exist (span-based detection replaces it) |

### 11.7 ParallelExecutor Rules

| ID | Level | Rule |
|----|-------|------|
| **PEX-1** | MUST | `ParallelExecutor.execute(inputs, fn)` returns outputs in **input order** |
| **PEX-2** | MUST | `graphs[i]` corresponds to `chunks[i]` |
| **PEX-3** | MUST NOT | Results SHALL NOT be returned in completion (arrival) order |

> **Critical (PEX-1):** This rule ensures correctness. D-INV-2, ChunkHookContext.chunkIndex, and Merge prefix/re-id rules all assume chunk order. Incorrect order silently corrupts Plugin/Merge/Coverage behavior.

### 11.8 Plugin Rules

| ID | Level | Rule |
|----|-------|------|
| **PLG-1** | MUST | Plugins create run-scope hooks via `createRunHooks()` |
| **PLG-2** | MUST | Inspector plugins may only modify diagnostics |
| **PLG-3** | MUST | Transformer plugins must explicitly return modified graph |
| **PLG-4** | MUST | Pipeline re-validates after transformer modification |
| **PLG-5** | MUST NOT | No plugin may modify `Chunk.text` or `Chunk.span` |
| **PLG-6** | SHOULD | Plugins should use run-local state only (no shared mutable state) |
| **PLG-7** | MUST | `beforeTranslateChunk`/`afterTranslateChunk` receive `ChunkHookContext` (parallel-safe) |
| **PLG-8** | MUST | Plugins receive `ReadonlyPipelineContext` only |
| **PLG-9** | MUST | Pipeline validates decompose results against D-INV-0/1/2/2b/3 |
| **PLG-10** | MUST | `DiagnosticsBag.metric()` is last-write-wins (non-deterministic in parallel) |
| **PLG-11** | MUST | Plugins execute in **injection order** (array index order) |
| **PLG-12** | MUST | Chunk translation uses `ParallelExecutor` respecting concurrency/timeout/errorPolicy |
| **PLG-13** | SHOULD | Parallel chunk hooks should use `metricAdd()`/`metricObserve()` for aggregation |
| **PLG-14** | MUST | If `plugin.kind === "inspector"` and `afterMerge` returns `IntentGraph`, Pipeline SHALL throw error |

### 11.9 Exporter Rules

| ID | Level | Rule |
|----|-------|------|
| **EXP-1** | MUST | `@manifesto-ai/translator` core SHALL NOT contain target-specific exporter implementations |
| **EXP-2** | MUST | Target-specific emission SHALL be implemented as `TargetExporter` in `translator-target-*` packages |
| **EXP-3** | MUST | Exporters SHALL treat `ExportInput.graph` as immutable (no mutation) |
| **EXP-4** | SHOULD | Exporters MAY use `buildExecutionPlan()`, `validateGraph()` helpers from core |
| **EXP-5** | MUST | Target-specific extension hints SHALL be expressed as `ExtensionCandidate[]` (kind + payload) |
| **EXP-6** | MUST NOT | Core public API SHALL NOT expose `emitForManifesto()` (deprecated wrapper allowed in target package) |
| **EXP-7** | MUST NOT | Core SHALL NOT use "melCandidates" terminology → use `ExtensionCandidate(kind="mel")` |

### 11.10 Diagnostics Rules

| ID | Level | Rule |
|----|-------|------|
| **DIAG-OBS-1** | SHOULD | `metricObserve()` implementations should consider sample limits or rolling windows (prevent memory explosion) |

### 11.11 Validation Function Rules

| ID | Level | Rule |
|----|-------|------|
| **V-1** | MUST NOT | `validateGraph()` / `validateChunks()` SHALL NOT throw on validation failure |
| **V-2** | MUST | `validateGraph()` / `validateChunks()` SHALL return `{valid: false, error}` for invalid input |
| **V-3** | MAY | `assertValidGraph()` / `assertValidChunks()` MAY throw `ValidationException` |

---

## 12. Validation

### 12.1 Validation Contract

Validation functions follow **pure function semantics**:

| Function Type | Behavior | Returns | Throws |
|---------------|----------|---------|--------|
| `validate*` | Pure validation | `ValidationResult` | **MUST NOT** throw on validation failure |
| `assert*` | Assertion helper | `void` | **MAY** throw `ValidationException` |

> **Rationale:** Pure validation functions allow callers to decide how to handle failures. Assertion helpers provide convenience for fail-fast scenarios.

### 12.2 Graph Validation

```typescript
/**
 * Validate Intent Graph structure.
 * 
 * Checks: G-INV-1, G-INV-2, G-INV-3, G-INV-4, R-INV-1, R-INV-2
 * 
 * MUST NOT throw on validation failure.
 * Returns {valid: false, error} for invalid graphs.
 */
function validateGraph(graph: IntentGraph): ValidationResult;

/**
 * Assert graph is valid.
 * 
 * @throws ValidationException if validation fails
 */
function assertValidGraph(graph: IntentGraph): void;
```

### 12.3 Chunk Validation

```typescript
/**
 * Validate chunk array invariants.
 * 
 * Checks: D-INV-0, D-INV-1, D-INV-2, D-INV-2b, D-INV-3
 * 
 * MUST NOT throw on validation failure.
 * Returns {valid: false, error} for invalid chunks.
 * 
 * @param chunks - Chunk array to validate
 * @param input - Original input text
 */
function validateChunks(chunks: Chunk[], input: string): ValidationResult;

/**
 * Assert chunks are valid.
 * 
 * @throws ValidationException if validation fails
 */
function assertValidChunks(chunks: Chunk[], input: string): void;
```

### 12.4 Validation Error Codes

| Code | Description | Related Invariant |
|------|-------------|-------------------|
| `DUPLICATE_ID` | Node ID appears more than once | G-INV-1 |
| `MISSING_DEPENDENCY` | `dependsOn` references non-existent node | G-INV-2 |
| `CYCLE_DETECTED` | Dependency graph contains cycle | G-INV-3 |
| `ABSTRACT_DEPENDENCY` | Non-abstract depends on abstract | G-INV-4, C-ABS-1 |
| `INVALID_RESOLUTION` | Resolution invariant violated | R-INV-1, R-INV-2 |
| `SPAN_MISMATCH` | `chunk.text !== input.slice(...)` | D-INV-0 |
| `EMPTY_CHUNKS` | `chunks.length === 0` | D-INV-1 |
| `INDEX_MISMATCH` | `chunk.index !== array position` | D-INV-2 |
| `SPAN_ORDER_VIOLATION` | Spans not sorted by start | D-INV-2b |
| `INVALID_SPAN` | Span bounds invalid | D-INV-3 |

---

## 13. Error Handling

### 13.1 Error Types

```typescript
/**
 * Base error for translator operations.
 */
class TranslatorError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly cause?: unknown
  ) {
    super(message);
  }
}

/**
 * Pipeline execution error.
 */
class PipelineError extends TranslatorError {
  constructor(
    message: string,
    code: string,
    readonly phase: PipelinePhase,
    readonly chunkIndex?: number,
    cause?: unknown
  ) {
    super(message, code, cause);
  }
}

/**
 * Validation exception (thrown by assertValidGraph/assertValidChunks).
 * 
 * Note: This is distinct from ValidationErrorInfo (data type in §5.4).
 * validate* functions MUST NOT throw; use assert* for throwing behavior.
 */
class ValidationException extends TranslatorError {
  constructor(
    message: string,
    readonly errorCode: ValidationErrorCode,
    readonly nodeId?: string,
    readonly chunkIndex?: number,
    cause?: unknown
  ) {
    super(message, errorCode, cause);
  }
}

// Note: LLMError is defined in §9.2
```

### 13.2 Error Policies

| Policy | Behavior |
|--------|----------|
| `fail-fast` | First error stops pipeline, throws immediately |
| `best-effort` | Continue on chunk errors, collect all results |

---

## 14. Public API

### 14.1 Core Exports

```typescript
// @manifesto-ai/translator

// Types
export type {
  // Chunk
  Chunk,
  Span,
  
  // Graph
  IntentGraph,
  IntentNode,
  Resolution,
  Role,
  
  // Plan
  ExecutionPlan,
  ExecutionStep,
  DependencyEdge,
  
  // Validation
  ValidationResult,
  ValidationErrorInfo,
  ValidationWarning,
  ValidationErrorCode,
  
  // Diagnostics
  DiagnosticsBag,
  DiagnosticsReadonly,
  Diagnostic,
  
  // Extension
  ExtensionCandidate,
  
  // Strategies
  DecomposeStrategy,
  DecomposeOptions,
  TranslateStrategy,
  TranslateOptions,
  MergeStrategy,
  MergeOptions,
  
  // Pipeline
  PipelineOptions,
  PipelineResult,
  
  // Plugin
  PipelinePlugin,
  PipelineHooks,
  PipelinePhase,
  ReadonlyPipelineContext,
  ChunkHookContext,
  StandardHook,
  ChunkHook,
  TransformerHook,
  
  // Ports
  LLMPort,
  LLMRequest,
  LLMResponse,
  LLMMessage,
  LLMCallOptions,
  LLMUsage,
  LLMErrorCode,
  TargetExporter,
  ExportInput,
};

// Classes
export {
  TranslatorPipeline,
  ParallelExecutor,
  
  // Built-in Strategies
  SlidingWindowDecomposer,
  SentenceBasedDecomposer,
  LLMTranslator,
  DeterministicTranslator,
  ConservativeMerger,
  AggressiveMerger,
  
  // Errors
  TranslatorError,
  PipelineError,
  ValidationException,
  LLMError,
};

// Functions
export {
  // Factory
  createDefaultPipeline,
  createContextOverlapPipeline,
  createFastPipeline,
  
  // Validation (pure, MUST NOT throw)
  validateGraph,
  validateChunks,
  
  // Assertion (MAY throw)
  assertValidGraph,
  assertValidChunks,
  
  // Helpers
  buildExecutionPlan,
  exportTo,
};

// Built-in Plugins
export {
  orDetectorPlugin,
  coverageCheckerPlugin,
  dependencyRepairPlugin,
};
```

### 14.2 Adapter Package Exports

```typescript
// @manifesto-ai/translator-adapter-openai
export { OpenAIAdapter } from './adapter';

// @manifesto-ai/translator-adapter-claude
export { ClaudeAdapter } from './adapter';

// @manifesto-ai/translator-adapter-ollama
export { OllamaAdapter } from './adapter';
```

### 14.3 Target Package Exports

```typescript
// @manifesto-ai/translator-target-manifesto
export { manifestoExporter } from './exporter';
export type { ManifestoBundle, ManifestoExportContext } from './types';

// Deprecated compatibility wrapper
export { emitForManifesto } from './compat';
```

---

## 15. Conformance

### 15.1 Conformance Levels

| Level | Requirements |
|-------|--------------|
| **Core** | All MUST rules in sections 4, 5, 6, 11 |
| **Pipeline** | Core + section 7 |
| **Plugin** | Pipeline + section 8 |
| **Full** | All MUST and SHOULD rules |

### 15.2 Conformance Tests

A conforming implementation MUST pass:

1. **Chunk Invariant Tests** - D-INV-0/1/2/2b/3 (MUST rules only)
2. **Graph Invariant Tests** - G-INV-1/2/3/4
3. **Resolution Invariant Tests** - R-INV-1/2
4. **Merge Invariant Tests** - M-INV-1/2/3/4/5
5. **ExecutionPlan Tests** - E-INV-1/2/3
6. **ParallelExecutor Order Tests** - PEX-1/2/3
7. **Plugin Isolation Tests** - PLG-5/8/14
8. **Exporter Immutability Tests** - EXP-3
9. **Validation Contract Tests** - V-1/2 (validate* MUST NOT throw)

For **Full** conformance, implementations SHOULD additionally pass:

- **Chunk SHOULD Tests** - D-INV-3a/4
- **Assertion Tests** - V-3 (assert* MAY throw)

### 15.3 Test Fixtures

Test fixtures are provided in `@manifesto-ai/translator/test-fixtures`:

```typescript
import {
  validGraphFixtures,
  invalidGraphFixtures,
  chunkFixtures,
  mergeScenarios,
} from '@manifesto-ai/translator/test-fixtures';
```

---

## 16. Examples

### 16.1 Basic Usage

```typescript
import { 
  createDefaultPipeline,
  validateGraph,
  buildExecutionPlan,
  exportTo
} from '@manifesto-ai/translator';
import { ClaudeAdapter } from '@manifesto-ai/translator-adapter-claude';
import { manifestoExporter } from '@manifesto-ai/translator-target-manifesto';

// 1. Create LLM adapter
const llm = new ClaudeAdapter({ apiKey: process.env.CLAUDE_KEY });

// 2. Create pipeline
const pipeline = createDefaultPipeline(llm);

// 3. Process input
const result = await pipeline.process("Create a project named 'Demo' and add three tasks");

// 4. Validate
const validation = validateGraph(result.graph);
if (!validation.valid) {
  throw new Error(validation.error.message);
}

// 5. Build core execution plan (no lowering)
const execPlan = buildExecutionPlan(result.graph);
console.log(`${execPlan.steps.length} steps to execute`);

// 6. Export to Manifesto target (with lowering)
const bundle = await exportTo(
  manifestoExporter,
  { graph: result.graph, diagnostics: result.diagnostics },
  { lexicon: myLexicon, resolver: myResolver }
);

console.log(`Ready: ${bundle.meta.readyCount}, Deferred: ${bundle.meta.deferredCount}`);
```

### 16.2 Custom Pipeline with Plugins

```typescript
import {
  TranslatorPipeline,
  SlidingWindowDecomposer,
  LLMTranslator,
  ConservativeMerger,
  orDetectorPlugin,
  coverageCheckerPlugin
} from '@manifesto-ai/translator';

const pipeline = new TranslatorPipeline(
  new SlidingWindowDecomposer(8000, 0),
  new LLMTranslator(llm),
  new ConservativeMerger(),
  { 
    concurrency: 10,
    errorPolicy: "best-effort"
  },
  [orDetectorPlugin, coverageCheckerPlugin]
);

const result = await pipeline.process(longDocument);

// Check plugin diagnostics
for (const warn of result.diagnostics.warnings) {
  console.log(`[${warn.code}] ${warn.message}`);
}
```

### 16.3 Custom Plugin

```typescript
import type { PipelinePlugin, ChunkHookContext } from '@manifesto-ai/translator';

const timingPlugin: PipelinePlugin = {
  name: "timing",
  kind: "inspector",
  
  createRunHooks() {
    const chunkTimes: number[] = [];
    
    return {
      beforeTranslateChunk(ctx: ChunkHookContext) {
        ctx.diagnostics.metric(`chunk_${ctx.chunkIndex}_start`, Date.now());
      },
      
      afterTranslateChunk(ctx: ChunkHookContext) {
        const start = ctx.diagnostics.metrics.get(`chunk_${ctx.chunkIndex}_start`) ?? 0;
        const elapsed = Date.now() - start;
        chunkTimes.push(elapsed);
        ctx.diagnostics.metricObserve('chunk_time_ms', elapsed);
      },
      
      afterMerge(ctx) {
        const total = chunkTimes.reduce((a, b) => a + b, 0);
        ctx.diagnostics.metric('total_chunk_time_ms', total);
      }
    };
  }
};
```

### 16.4 Custom Target Exporter

```typescript
import type { TargetExporter, ExportInput } from '@manifesto-ai/translator';
import { buildExecutionPlan } from '@manifesto-ai/translator';

interface JsonOutput {
  nodes: Array<{
    id: string;
    event: string;
    resolution: string;
    dependencies: string[];
  }>;
  edges: Array<{ from: string; to: string }>;
}

const jsonExporter: TargetExporter<JsonOutput, void> = {
  id: "json",
  
  async export(input) {
    const plan = buildExecutionPlan(input.graph);
    
    return {
      nodes: plan.steps.map(step => ({
        id: step.nodeId,
        event: step.ir.event,
        resolution: step.resolution.status,
        dependencies: input.graph.nodes
          .find(n => n.id === step.nodeId)
          ?.dependsOn ?? []
      })),
      edges: plan.dependencyEdges.map(e => ({
        from: e.from,
        to: e.to
      }))
    };
  }
};
```

---

## 17. Versioning

### 17.1 Semantic Versioning

This specification follows [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR**: Breaking changes to public API or normative rules
- **MINOR**: New features, backward-compatible
- **PATCH**: Bug fixes, clarifications

### 17.2 Compatibility

| Spec Version | Package Version | Intent IR |
|--------------|-----------------|-----------|
| 1.0.x | @manifesto-ai/translator@1.x | v0.2+ |

### 17.3 Migration from v0.1

| v0.1 | v1.0 |
|------|------|
| `translate(text, options)` | `pipeline.process(text)` |
| `emitForManifesto(graph, ...)` | `exportTo(manifestoExporter, ...)` |
| `buildInvocationPlan(graph)` | `buildExecutionPlan(graph)` (no lowering) |
| `melCandidates` | `extensionCandidates` (kind="mel") |
| `options.overlapSize` | Span-based detection (OVL-1) |

---

## Appendix: Normative Rules Index

### A.1 MUST Rules

| ID | Section | Summary |
|----|---------|---------|
| TRN-BND-1 | 4.3 | No import of host/world/app |
| TRN-BND-2 | 4.3 | No Proposal/Authority/ExecutionKey generation |
| TRN-BND-4 | 4.3 | Pure semantic transformation only |
| TRN-BND-5 | 4.3 | No target-specific emission in core |
| L-1~5 | 4.4 | Layer dependency rules |
| PKG-1~3 | 4.5 | Package content rules |
| D-INV-0~5 | 11.1 | Decomposition invariants |
| G-INV-1~4 | 11.2 | Graph invariants |
| R-INV-1~2 | 11.2a | Resolution consistency (Resolved ⟹ missing absent/empty) |
| M-INV-1~5 | 11.3 | Merge invariants |
| E-INV-1~3 | 11.4 | ExecutionPlan invariants |
| OVL-1~2 | 11.6 | Overlap safety |
| PEX-1~3 | 11.7 | ParallelExecutor order |
| PLG-1~14 | 11.8 | Plugin rules |
| EXP-1~7 | 11.9 | Exporter rules |
| V-1~2 | 11.11 | validate* MUST NOT throw, MUST return ValidationResult |

### A.2 SHOULD Rules

| ID | Section | Summary |
|----|---------|---------|
| D-INV-3a | 11.1 | Non-empty input should have non-empty spans |
| D-INV-4 | 11.1 | Default non-overlap full cover |
| OVL-3 | 11.6 | Use non-overlap decomposers |
| PLG-6 | 11.8 | Use run-local state only |
| PLG-13 | 11.8 | Use metricAdd/metricObserve for parallel aggregation |
| EXP-4 | 11.9 | Use core helpers |
| DIAG-OBS-1 | 11.10 | Sample limits for metricObserve |

### A.3 MAY Rules

| ID | Section | Summary |
|----|---------|---------|
| TRN-BND-3 | 4.3 | Type-only import from @manifesto-ai/core |
| V-3 | 11.11 | assert* MAY throw ValidationException |

---

## References

- [ADR-TRANSLATOR v1.0.8](./translator-ADR-001-v1.0.8.md)
- [Intent IR v0.2 Specification](../../../intent-ir/docs/SPEC-v0.2.0.md)
- [Hexagonal Architecture (Alistair Cockburn)](https://alistair.cockburn.us/hexagonal-architecture/)
- [Clean Architecture (Robert C. Martin)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Strategy Pattern (GoF)](https://refactoring.guru/design-patterns/strategy)
- [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119)
- [Semantic Versioning 2.0.0](https://semver.org/)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-28 | Initial v1.0 specification based on ADR-TRANSLATOR v1.0.8 |
| 1.0.1 | 2026-01-28 | **Critical ADR sync fixes:** (1) Resolution: discriminated union → interface model with ambiguityScore/missing/questions, PascalCase status. (2) DecomposeStrategy: sync → async (Promise<Chunk[]>), added language option. (3) D-INV rules: aligned IDs/meanings with ADR, added D-INV-4/5. (4) TranslateOptions: removed LLMConfig, added maxNodes/domain/language/allowedEvents. (5) LLMPort: separated system field, role union fixed, added LLMCallOptions/LLMUsage/LLMErrorCode. (6) Validation: renamed ValidationError interface → ValidationErrorInfo, class → ValidationException, extended error codes. (7) Plugin: category → kind, added PLG-14 (inspector graph return protection). |
| 1.0.2 | 2026-01-28 | **Contract clarity fixes:** (1) validate* 계약 봉인: V-1~3 규범 추가, validateGraph/validateChunks는 MUST NOT throw, assertValidGraph/assertValidChunks MAY throw. (2) R-INV-1/R-INV-2: Resolution 일관성 규칙 추가 (Resolved ⟹ missing 없음). (3) INVALID_RESOLUTION → R-INV 위반으로 명확화. (4) §16.4 예제 import type 문제 수정. |
| 1.0.3 | 2026-01-30 | **Intent IR v0.2 alignment:** (1) v0.2 참조/도해/계약 업데이트. (2) ADR 링크 정리. (3) Version metadata 정합성 보강. |
