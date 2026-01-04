# @manifesto-ai/translator Specification v1.1.1

> **Version:** 1.1.1v
> **Status:** Normative
> **Role:** Natural Language to Semantic Change Proposals
> **Philosophy:** *World is the premise. Memory is default. Human escalation is constitutional.*

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Three Architectural Pillars](#2-three-architectural-pillars)
3. [Package Boundaries](#3-package-boundaries)
4. [Core Types](#4-core-types)
5. [Pipeline Architecture](#5-pipeline-architecture)
6. [TranslatorHost](#6-translatorhost)
7. [TranslatorBridge](#7-translatorbridge)
8. [Effect Handlers](#8-effect-handlers)
9. [Memory Integration](#9-memory-integration)
10. [Ambiguity Resolution](#10-ambiguity-resolution)
11. [Error Handling](#11-error-handling)
12. [Configuration](#12-configuration)
13. [MEL Domain Definition](#13-mel-domain-definition)
14. [CLI Reference](#14-cli-reference)

---

## §1. Purpose

### 1.1 Overview

`@manifesto-ai/translator` is a **Compiler Frontend** that transforms natural language into structured schema changes (`PatchFragment[]`).

```
Natural Language ──Translator──> PatchFragment[] ──Host──> Snapshot
```

### 1.2 Role in Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Input                           │
│                    "Add email to user"                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     TRANSLATOR                              │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐│
│  │ Chunk   │→│Normalize │→│Fast Path │→│Retrieval/Memory  ││
│  └─────────┘ └──────────┘ └──────────┘ └──────────────────┘│
│                                              │              │
│  ┌─────────────┐ ┌─────────────────────────────────────────┐│
│  │  Proposer   │→│          Assembly                       ││
│  │   (LLM)     │ │      PatchFragment[]                    ││
│  └─────────────┘ └─────────────────────────────────────────┘│
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     COMPILER                                │
│              Lowering → Evaluation → Patch[]                │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                       HOST                                  │
│              core.apply() → Snapshot'                       │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Success Criteria

| Criterion | Definition |
|-----------|------------|
| Functional | Natural language → valid `PatchFragment[]` |
| Deterministic | Same input + context = same fragments (given same LLM responses) |
| Traceable | Full pipeline trace available |
| Safe | Invalid fragments never reach output |
| Governable | Human escalation path always available |

---

## §2. Three Architectural Pillars

### 2.1 INV-009: World is the Premise

**Translator CANNOT operate without World context.**

```typescript
// FORBIDDEN: Operating without World
const translator = createTranslator({ schema }); // ❌ No worldId

// REQUIRED: World context is mandatory
const translator = createTranslator({
  schema,
  worldId: "my-world",  // ✅ World identity required
});
```

**Rationale:** Schema alone is insufficient. The World provides:
- Actor identity for authorization
- Event history for context
- Schema versioning for compatibility

### 2.2 INV-010: Memory is Default

**Absence of Memory triggers graceful degradation, not failure.**

```typescript
// Memory available: full capability
// Memory absent: reduced capability (graceful degradation)

if (!memorySelector) {
  return {
    content: EMPTY_MEMORY_CONTENT,
    degraded: true,
    degradeReason: "SELECTOR_NOT_CONFIGURED",
  };
}
```

Memory provides:
- Translation examples (few-shot learning)
- Schema history (versioning context)
- Resolution history (learned preferences)
- Glossary terms (domain vocabulary)

### 2.3 INV-011: Human Escalation is Constitutional

**Agent auto-resolve is FORBIDDEN. Human escalation is a constitutional right.**

```typescript
// FORBIDDEN: Agent auto-resolving ambiguity
if (ambiguous) {
  const choice = await llm.decide(options); // ❌
  translator.resolve(choice);
}

// REQUIRED: Human escalation
if (ambiguous) {
  // Transition to awaiting_resolution
  // External system (HITL/AITL) makes decision
  // Only external system can call resolve()
}
```

---

## §3. Package Boundaries

### 3.1 Dependencies

```
@manifesto-ai/translator
    │
    ├──→ @manifesto-ai/core (DomainSchema, Snapshot, Patch)
    ├──→ @manifesto-ai/world (WorldId, ActorRef)
    ├──→ @manifesto-ai/bridge (Event routing)
    ├──→ @manifesto-ai/host (Effect execution)
    ├──→ @manifesto-ai/memory (MemorySelector - optional)
    └──→ LLM SDK (effect handler implementation)
```

### 3.2 What Translator Does

- Parses natural language into structured intents
- Retrieves schema anchors for grounding
- Queries memory for examples and context
- Generates `PatchFragment[]` proposals
- Validates fragments against schema

### 3.3 What Translator Does NOT Do

- Execute patches (Host responsibility)
- Lower MEL IR (Compiler responsibility)
- Evaluate expressions (Compiler responsibility)
- Persist state (Bridge/World responsibility)
- Authorize actions (World responsibility)

---

## §4. Core Types

### 4.1 PatchFragment

```typescript
interface PatchFragment {
  /** Unique fragment identifier */
  fragmentId: string;

  /** Intent ID for idempotency */
  intentId: string;

  /** Patch operation (MEL IR) */
  op: PatchOp;

  /** Confidence score (0.0 - 1.0) */
  confidence: number;

  /** Source text that generated this fragment */
  sourceText: string | null;
}
```

### 4.2 PatchOp

```typescript
type PatchOp =
  | { kind: "defineType"; name: string; fields: TypeField[] }
  | { kind: "addField"; typeName: string; field: TypeField }
  | { kind: "setDefaultValue"; path: string; value: ExprNode }
  | { kind: "addConstraint"; path: string; constraint: Constraint }
  | { kind: "addComputed"; name: string; expr: ExprNode }
  | { kind: "addAction"; name: string; params: ActionParam[]; flow: FlowNode }
  | { kind: "addActionAvailable"; actionName: string; condition: ExprNode };
```

### 4.3 AmbiguityReport

```typescript
interface AmbiguityReport {
  /** Unique report identifier */
  reportId: string;

  /** Ambiguity kind */
  kind: "semantic" | "syntactic" | "conflict";

  /** Resolution candidates */
  candidates: AmbiguityCandidate[];

  /** Resolution prompt for human */
  resolutionPrompt: {
    question: string;
    context: string | null;
  };
}

interface AmbiguityCandidate {
  candidateId: string;
  description: string;
  confidence: number;
  preview: string | null;
}
```

### 4.4 TranslationResult

```typescript
type TranslationResult =
  | { kind: "fragment"; fragments: PatchFragment[]; trace: TranslationTrace }
  | { kind: "ambiguity"; report: AmbiguityReport; trace: TranslationTrace }
  | { kind: "error"; error: TranslationError; trace: TranslationTrace };
```

---

## §5. Pipeline Architecture

### 5.1 Pipeline Stages

| Stage | Name | Purpose | Effect Type |
|-------|------|---------|-------------|
| 0 | Chunking | Split input into sections | `translator.chunk` |
| 1 | Normalization | Canonicalize text, detect language | `translator.normalize` |
| 2 | Fast Path | Pattern matching (deterministic) | `translator.fastPath` |
| 3 | Retrieval | Schema anchor lookup | `translator.retrieve` |
| 4 | Memory | Translation examples, history | `translator.memory` |
| 5 | Proposer | LLM-based fragment generation | `translator.propose` |
| 6 | Assembly | Combine fragments, validate | `translator.assemble` |

### 5.2 Stage Flow

```
Input ──Stage 0──> Chunks
           │
           ▼
      ──Stage 1──> NormalizedText
           │
           ▼
      ──Stage 2──> FastPathResult
           │
           ├── (matched) ──────────────────────────────────┐
           │                                               │
           ▼                                               │
      ──Stage 3──> SchemaAnchors                           │
           │                                               │
           ▼                                               │
      ──Stage 4──> MemoryContent                           │
           │                                               │
           ▼                                               │
      ──Stage 5──> ProposedFragments ◄─────────────────────┘
           │
           ▼
      ──Stage 6──> PatchFragment[]
```

### 5.3 Fast Path

Fast Path provides **deterministic pattern matching** before LLM stages:

```typescript
const fastPathPatterns = [
  { pattern: /add (\w+) field to (\w+)/i, generate: addFieldFragment },
  { pattern: /create (\w+) action/i, generate: createActionFragment },
  { pattern: /set (\w+) default to (.+)/i, generate: setDefaultFragment },
];
```

When Fast Path matches, stages 3-5 are skipped.

---

## §6. TranslatorHost

### 6.1 Overview

`TranslatorHost` is the **recommended runtime** with full state management.

### 6.2 API

```typescript
class TranslatorHost {
  /** Get current snapshot */
  getSnapshot(): Snapshot;

  /** Get current state data */
  getState(): TranslatorState;

  /** Subscribe to state changes */
  subscribe(listener: (snapshot: Snapshot) => void): () => void;

  /** Run translation pipeline */
  translate(input: string): Promise<TranslatorHostResult>;

  /** Resolve ambiguity */
  resolve(reportId: string, selectedOptionId: string): Promise<TranslatorHostResult>;

  /** Reset to idle state */
  reset(): void;
}
```

### 6.3 TranslatorHostResult

```typescript
interface TranslatorHostResult {
  status: "success" | "error" | "awaiting_resolution";
  fragments?: PatchFragment[];
  error?: { code: string; message: string };
  ambiguityReport?: AmbiguityReport;
  snapshot: Snapshot;
}
```

### 6.4 Usage Example

```typescript
import { createTranslatorHost } from "@manifesto-ai/translator";

const host = createTranslatorHost({
  schema,
  worldId: "my-world",
  config: {
    fastPathEnabled: true,
    slmModel: "gpt-4o-mini",
  },
});

// Subscribe to state changes
host.subscribe((snapshot) => {
  console.log("Status:", snapshot.data.status);
});

// Translate
const result = await host.translate("Add email field to user profile");

if (result.status === "success") {
  console.log("Fragments:", result.fragments);
} else if (result.status === "awaiting_resolution") {
  // Human escalation required
  const resolved = await host.resolve("report-id", "option-1");
}
```

---

## §7. TranslatorBridge

### 7.1 Overview

`TranslatorBridge` is a **simpler API** without state management.

### 7.2 API

```typescript
function createTranslatorBridge(config: TranslatorBridgeConfig): TranslatorBridge;

interface TranslatorBridge {
  translate(input: string): Promise<TranslationResult>;
}
```

### 7.3 Usage Example

```typescript
import { createTranslatorBridge } from "@manifesto-ai/translator";

const bridge = createTranslatorBridge({
  worldId: "my-world",
  schemaHash: "hash",
  schema: mySchema,
  actor: { actorId: "user-1", kind: "human" },
});

const result = await bridge.translate("Add email field");

switch (result.kind) {
  case "fragment":
    console.log(result.fragments);
    break;
  case "ambiguity":
    console.log(result.report);
    break;
  case "error":
    console.error(result.error);
    break;
}
```

---

## §8. Effect Handlers

### 8.1 Effect Types

| Effect | Params | Description |
|--------|--------|-------------|
| `translator.chunk` | `{ input }` | Split input into chunks |
| `translator.normalize` | `{ input }` | Normalize text |
| `translator.fastPath` | `{}` | Pattern matching |
| `translator.retrieve` | `{}` | Schema anchor lookup |
| `translator.memory` | `{}` | Memory selection |
| `translator.propose` | `{ resolution? }` | LLM proposal |
| `translator.assemble` | `{}` | Fragment assembly |

### 8.2 Handler Registration

```typescript
import { registerTranslatorEffects } from "@manifesto-ai/translator";
import { createEffectRegistry } from "@manifesto-ai/host";

const registry = createEffectRegistry();

registerTranslatorEffects(registry, {
  config: createConfig({ fastPathEnabled: true }),
  schema: mySchema,
  worldId: "my-world",
});
```

### 8.3 Handler Contract

Each handler MUST:
- Return `Patch[]` to update Translator state
- Transition status to next stage or terminal
- Never throw (express failures as state)

---

## §9. Memory Integration

### 9.1 MemorySelectorCompat

```typescript
interface MemorySelectorCompat {
  select(request: SelectionRequest): Promise<SelectionResult>;
}

interface SelectionRequest {
  query: string;
  atWorldId: string;
  constraints?: SelectionConstraints;
}
```

### 9.2 MemoryContent

```typescript
interface MemoryContent {
  translationExamples: TranslationExample[];
  schemaHistory: SchemaHistoryEntry[];
  glossaryTerms: GlossaryTerm[];
  resolutionHistory: ResolutionHistoryEntry[];
}
```

### 9.3 Configuration

```typescript
const host = createTranslatorHost({
  schema,
  worldId: "my-world",
  memorySelector: myMemorySelector,
  memoryContentFetcher: {
    async fetch(selected, query) {
      return {
        translationExamples: [...],
        schemaHistory: [...],
        glossaryTerms: [...],
        resolutionHistory: [...],
      };
    },
  },
});
```

---

## §10. Ambiguity Resolution

### 10.1 Ambiguity Kinds

| Kind | Description | Example |
|------|-------------|---------|
| `semantic` | Multiple valid interpretations | "Add field" → which type? |
| `syntactic` | Parsing ambiguity | "user name" vs "username" |
| `conflict` | Conflicts with existing schema | Field already exists |

### 10.2 Resolution Flow

```
Proposer detects ambiguity
         │
         ▼
   status: "awaiting_resolution"
   ambiguityReport: { ... }
         │
         ▼
   External system receives
   (HITL UI, AITL agent, etc.)
         │
         ▼
   External system calls
   host.resolve(reportId, optionId)
         │
         ▼
   status: "proposing"
   Re-run proposer with resolution
```

### 10.3 Resolution Policy

```typescript
type ResolutionPolicy = {
  /** Auto-accept above this threshold */
  autoAcceptThreshold: number;  // default: 0.95

  /** Reject below this threshold */
  rejectThreshold: number;      // default: 0.3

  /** Escalation behavior */
  escalation: "await" | "reject";
};
```

---

## §11. Error Handling

### 11.1 Error Codes

| Code | Description |
|------|-------------|
| `EMPTY_INPUT` | Input text is empty |
| `CHUNKING_FAILED` | Failed to split input |
| `NORMALIZATION_FAILED` | Failed to normalize text |
| `RETRIEVAL_FAILED` | Failed to retrieve schema anchors |
| `MEMORY_FAILED` | Memory selection failed |
| `PROPOSAL_FAILED` | LLM proposal failed |
| `ASSEMBLY_FAILED` | Fragment assembly failed |
| `VALIDATION_FAILED` | Fragment validation failed |
| `NO_FRAGMENTS` | No fragments generated |
| `PIPELINE_ERROR` | General pipeline error |

### 11.2 Error Representation

Errors are represented in state, not thrown:

```typescript
// In state
{
  status: "error",
  errorJson: JSON.stringify({
    code: "PROPOSAL_FAILED",
    message: "LLM returned invalid response",
  }),
}

// In result
{
  status: "error",
  error: { code: "PROPOSAL_FAILED", message: "..." },
}
```

---

## §12. Configuration

### 12.1 TranslatorConfig

```typescript
interface TranslatorConfig {
  // Pipeline
  retrievalTier: 0 | 1 | 2;     // 0: schema-only, 1: +embedding, 2: +LLM
  fastPathEnabled: boolean;     // Enable pattern matching
  fastPathOnly: boolean;        // Skip LLM stages

  // LLM
  slmModel: string;             // e.g., "gpt-4o-mini"
  escalationThreshold: number;  // Confidence threshold for escalation

  // Confidence
  confidencePolicy: {
    autoAcceptThreshold: number;
    rejectThreshold: number;
  };

  // Tracing
  traceConfig: {
    sink: "none" | "console" | "file";
    includeRawInput: boolean;
    includeInputPreview: boolean;
    maxPreviewLength: number;
  };
}
```

### 12.2 Default Configuration

```typescript
const DEFAULT_CONFIG: TranslatorConfig = {
  retrievalTier: 0,
  fastPathEnabled: true,
  fastPathOnly: false,
  slmModel: "gpt-4o-mini",
  escalationThreshold: 0.5,
  confidencePolicy: {
    autoAcceptThreshold: 0.95,
    rejectThreshold: 0.3,
  },
  traceConfig: {
    sink: "none",
    includeRawInput: false,
    includeInputPreview: true,
    maxPreviewLength: 200,
  },
};
```

---

## §13. MEL Domain Definition

Translator is itself a Manifesto App defined in MEL:

```mel
domain Translator {
  state {
    status: "idle" | "chunking" | "normalizing" | "fast_path"
          | "retrieval" | "memory" | "proposing" | "assembling"
          | "awaiting_resolution" | "success" | "error" = "idle"

    input: string | null = null
    atWorldId: string | null = null
    schemaHash: string | null = null
    intentId: string | null = null

    chunksJson: string | null = null
    normalizationJson: string | null = null
    fastPathJson: string | null = null
    retrievalJson: string | null = null
    memoryJson: string | null = null
    proposalJson: string | null = null
    fragmentsJson: string | null = null
    ambiguityReportJson: string | null = null
    errorJson: string | null = null

    traceId: string | null = null
    startedAt: number | null = null
    completedAt: number | null = null
  }

  computed isIdle = eq(status, "idle")
  computed isTerminal = or(eq(status, "success"), eq(status, "error"))
  computed hasAmbiguity = eq(status, "awaiting_resolution")

  action translate(input: string, atWorldId: string, schemaHash: string)
    available when isIdle {
    // ... see implementation
  }

  action resolve(reportId: string, selectedOptionId: string)
    available when hasAmbiguity {
    // ... see implementation
  }

  action reset() available when isTerminal {
    // ... see implementation
  }
}
```

---

## §14. CLI Reference

### 14.1 Basic Usage

```bash
manifesto-translate -w <world-id> "Add email field to user"
```

### 14.2 Options

| Option | Description |
|--------|-------------|
| `-w, --world` | World ID (required) |
| `--schema` | Schema file path |
| `--provider` | LLM provider (openai, anthropic) |
| `--file` | Input from file |
| `--stdin` | Input from stdin |
| `-o, --output` | Output file path |
| `--trace` | Trace output file |
| `--simple` | Simple output (default) |
| `--verbose` | Show progress |
| `--full` | Full trace output |

### 14.3 Examples

```bash
# Basic usage
manifesto-translate -w my-world "Add email field to user"

# With schema file
manifesto-translate -w my-world --schema ./schema.json "Create counter"

# From file
manifesto-translate -w my-world --file requirements.txt

# With trace
manifesto-translate -w my-world "Add email" -o result.json --trace trace.json
```

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **PatchFragment** | Unit of schema change with confidence |
| **Fast Path** | Deterministic pattern matching |
| **Retrieval** | Schema anchor lookup |
| **Memory** | Context from translation history |
| **Proposer** | LLM-based fragment generator |
| **Assembly** | Fragment combination and validation |
| **Ambiguity** | Multiple valid interpretations |
| **Escalation** | Human decision required |

---

## Appendix B: Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.1.1v | 2025-01-04 | Initial specification |

---

*End of @manifesto-ai/translator Specification v1.1.1*
