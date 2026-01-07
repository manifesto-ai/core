# @manifesto-ai/translator

Natural language to semantic change proposals (SPEC 1.1.1v)

## Overview

The Translator is a **Compiler Frontend** that transforms natural language into structured schema changes (`PatchFragment[]`). It implements a 6-stage pipeline with deterministic contracts.

### Three Architectural Pillars

1. **World is the Premise** - Cannot operate without World context (INV-009)
2. **Memory is Default** - Absence triggers graceful degradation (INV-010)
3. **Human Escalation is Constitutional** - Agent auto-resolve forbidden (INV-011)

## Installation

```bash
pnpm add @manifesto-ai/translator
```

### Peer Dependencies

```bash
pnpm add @manifesto-ai/core @manifesto-ai/world @manifesto-ai/bridge @manifesto-ai/host @manifesto-ai/memory
```

### Optional LLM Providers

```bash
pnpm add openai        # For OpenAI
pnpm add @anthropic-ai/sdk  # For Anthropic
```

## Quick Start

### TranslatorHost (Recommended)

Complete runtime with state management and subscription support:

```typescript
import { createTranslatorHost, type DomainSchema } from "@manifesto-ai/translator";

const schema: DomainSchema = {
  id: "my-app",
  version: "1.0.0",
  hash: "schema-hash",
  state: { users: { type: { kind: "array", element: { kind: "primitive", name: "string" } } } },
  computed: {},
  actions: {},
  types: {},
};

const host = createTranslatorHost({
  schema,
  worldId: "my-app",
  config: {
    fastPathEnabled: true,
    slmModel: "gpt-4o-mini",
  },
});

// Subscribe to state changes
host.subscribe((snapshot) => {
  console.log("Status:", (snapshot.data as any).status);
});

// Translate
const result = await host.translate("Add email field to user profile");

if (result.status === "success") {
  console.log("Fragments:", result.fragments);
} else if (result.status === "awaiting_resolution") {
  // Human escalation required
  const resolved = await host.resolve("report-id", "option-1");
} else {
  console.error("Error:", result.error);
}

// Reset for reuse
host.reset();
```

### TranslatorBridge (Simple API)

For simpler use cases without state management:

```typescript
import { createTranslatorBridge, createConfig } from "@manifesto-ai/translator";

const bridge = createTranslatorBridge({
  worldId: "my-world",
  schemaHash: "hash",
  schema: mySchema,
  actor: { actorId: "user-1", kind: "human" },
  translatorConfig: createConfig({
    fastPathEnabled: true,
    slmModel: "gpt-4o-mini",
  }),
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

## CLI

```bash
# Basic usage
manifesto-translate -w <world-id> "Add email field to user"

# With schema file
manifesto-translate -w my-world --schema ./schema.json "Create counter"

# LLM provider selection
manifesto-translate -w my-world --provider openai "Add name field"
manifesto-translate -w my-world --provider anthropic "Add age field"

# Input from file
manifesto-translate -w my-world --file requirements.txt

# Input from stdin
cat input.txt | manifesto-translate -w my-world --stdin

# Save output
manifesto-translate -w my-world "Add email" -o result.json --trace trace.json

# Verbosity
manifesto-translate -w my-world "Add email" --simple   # Default
manifesto-translate -w my-world "Add email" --verbose  # Show progress
manifesto-translate -w my-world "Add email" --full     # Full trace
```

## Pipeline Stages

| Stage | Name | Description |
|-------|------|-------------|
| 0 | Chunking | Split input into sections |
| 1 | Normalization | Canonicalize text, detect language |
| 2 | Fast Path | Pattern matching (deterministic) |
| 3 | Retrieval | Schema anchor lookup |
| 4 | Memory | Translation examples, history |
| 5 | Proposer | LLM-based fragment generation |
| 6 | Assembly | Combine fragments, validate |

## Effect Handlers

For integration with `@manifesto-ai/host`:

```typescript
import { registerTranslatorEffects, createConfig } from "@manifesto-ai/translator";
import { createEffectRegistry } from "@manifesto-ai/host";

const registry = createEffectRegistry();

registerTranslatorEffects(registry, {
  config: createConfig({ fastPathEnabled: true }),
  schema: mySchema,
  worldId: "my-world",
});

// Registry now handles:
// - translator.chunk
// - translator.normalize
// - translator.fastPath
// - translator.retrieve
// - translator.memory
// - translator.propose
// - translator.assemble
```

## Memory Integration

```typescript
import { createTranslatorHost } from "@manifesto-ai/translator";
import type { MemorySelector } from "@manifesto-ai/memory";

const host = createTranslatorHost({
  schema,
  worldId: "my-world",

  // @manifesto-ai/memory compatible
  memorySelector: myMemorySelector,

  // Convert World content to MemoryContent
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

## Configuration

```typescript
import { createConfig } from "@manifesto-ai/translator";

const config = createConfig({
  // Pipeline
  retrievalTier: 0,           // 0: schema-only, 1: +embedding, 2: +LLM
  fastPathEnabled: true,      // Enable pattern matching
  fastPathOnly: false,        // Skip LLM stages

  // LLM
  slmModel: "gpt-4o-mini",
  escalationThreshold: 0.5,

  // Confidence
  confidencePolicy: {
    autoAcceptThreshold: 0.95,
    rejectThreshold: 0.3,
  },

  // Tracing
  traceConfig: {
    sink: "none",
    includeRawInput: false,
    includeInputPreview: true,
    maxPreviewLength: 200,
  },
});
```

## API Reference

### TranslatorHost

| Method | Description |
|--------|-------------|
| `getSnapshot()` | Get current snapshot |
| `getState()` | Get current state data |
| `subscribe(listener)` | Subscribe to state changes |
| `translate(input)` | Run translation pipeline |
| `resolve(reportId, optionId)` | Resolve ambiguity |
| `reset()` | Reset to idle state |

### TranslatorHostResult

```typescript
interface TranslatorHostResult {
  status: "success" | "error" | "awaiting_resolution";
  fragments?: PatchFragment[];
  error?: { code: string; message: string };
  ambiguityReport?: AmbiguityReport;
  snapshot: Snapshot;
}
```

### TranslationResult

```typescript
type TranslationResult =
  | { kind: "fragment"; fragments: PatchFragment[]; trace: TranslationTrace }
  | { kind: "ambiguity"; report: AmbiguityReport; trace: TranslationTrace }
  | { kind: "error"; error: TranslationError; trace: TranslationTrace };
```

## MEL Domain Definition

The Translator's state machine is defined in MEL:

```mel
domain Translator {
  state {
    status: "idle" | "chunking" | "normalizing" | "fast_path"
          | "retrieval" | "memory" | "proposing" | "assembling"
          | "awaiting_resolution" | "success" | "error" = "idle"

    input: string | null = null
    fragmentsJson: string | null = null
    errorJson: string | null = null
    // ...
  }

  action translate(input: string, atWorldId: string, schemaHash: string)
    available when isIdle {
    // ...
  }

  action resolve(reportId: string, selectedOptionId: string)
    available when hasAmbiguity {
    // ...
  }
}
```

## Environment Variables

```bash
OPENAI_API_KEY=sk-...      # For OpenAI provider
ANTHROPIC_API_KEY=sk-...   # For Anthropic provider
```

## Related Packages

- [`@manifesto-ai/core`](/specifications/core-spec) - Core compute engine
- [`@manifesto-ai/host`](/specifications/host-spec) - Effect execution runtime
- [`@manifesto-ai/world`](/specifications/world-spec) - World protocol
- [`@manifesto-ai/memory`](/specifications/memory-spec) - Memory selection
- [`@manifesto-ai/bridge`](/specifications/bridge-spec) - Event sourcing bridge
- [`@manifesto-ai/compiler`](/specifications/compiler-spec) - MEL compiler

## License

MIT
