# @manifesto-ai/translator Guide

A step-by-step guide to using the Translator package for natural language to schema changes.

---

## Quick Start

### Installation

```bash
pnpm add @manifesto-ai/translator

# Peer dependencies
pnpm add @manifesto-ai/core @manifesto-ai/world @manifesto-ai/bridge @manifesto-ai/host

# Optional: LLM providers
pnpm add openai        # For OpenAI
pnpm add @anthropic-ai/sdk  # For Anthropic
```

### Your First Translation

```typescript
import { createTranslatorHost } from "@manifesto-ai/translator";

// 1. Define your schema
const schema = {
  id: "my-app",
  version: "1.0.0",
  hash: "schema-hash",
  state: {
    users: { type: { kind: "array", element: { kind: "primitive", name: "string" } } },
  },
  computed: {},
  actions: {},
  types: {},
};

// 2. Create host
const host = createTranslatorHost({
  schema,
  worldId: "my-app",
  config: {
    fastPathEnabled: true,
    slmModel: "gpt-4o-mini",
  },
});

// 3. Translate
const result = await host.translate("Add email field to user profile");

// 4. Handle result
if (result.status === "success") {
  console.log("Generated fragments:", result.fragments);
} else if (result.status === "awaiting_resolution") {
  console.log("Ambiguity detected:", result.ambiguityReport);
} else {
  console.error("Error:", result.error);
}
```

---

## TranslatorHost Usage

### Subscribing to State Changes

```typescript
const host = createTranslatorHost({ schema, worldId: "my-world" });

// Subscribe to all state changes
const unsubscribe = host.subscribe((snapshot) => {
  const state = snapshot.data;

  console.log("Status:", state.status);

  // Track pipeline progress
  if (state.status === "chunking") {
    console.log("Chunking input...");
  } else if (state.status === "proposing") {
    console.log("Generating proposals...");
  }
});

// Later: cleanup
unsubscribe();
```

### Getting Current State

```typescript
// Get full snapshot
const snapshot = host.getSnapshot();
console.log("Version:", snapshot.meta.version);

// Get state data directly
const state = host.getState();
console.log("Status:", state.status);
console.log("Input:", state.input);
```

### Handling Ambiguity Resolution

```typescript
const result = await host.translate("Add field to user");

if (result.status === "awaiting_resolution") {
  const report = result.ambiguityReport;

  console.log("Question:", report.resolutionPrompt.question);
  console.log("Options:");

  for (const candidate of report.candidates) {
    console.log(`  - ${candidate.candidateId}: ${candidate.description}`);
  }

  // User selects option (e.g., from UI)
  const selectedId = await getUserSelection(report.candidates);

  // Resolve and continue
  const resolved = await host.resolve(report.reportId, selectedId);

  if (resolved.status === "success") {
    console.log("Resolved fragments:", resolved.fragments);
  }
}
```

### Resetting State

```typescript
// After translation, reset for reuse
await host.translate("Add email");
// ... process result ...

host.reset();

// Now ready for next translation
await host.translate("Add phone");
```

---

## TranslatorBridge Usage

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

// One-shot translation
const result = await bridge.translate("Add email field");

switch (result.kind) {
  case "fragment":
    // Success: process fragments
    for (const fragment of result.fragments) {
      console.log(`Fragment ${fragment.fragmentId}:`, fragment.op);
    }
    break;

  case "ambiguity":
    // Ambiguity: handle externally
    console.log("Ambiguity:", result.report);
    break;

  case "error":
    // Error: log and handle
    console.error("Error:", result.error.message);
    break;
}
```

---

## CLI Usage

### Basic Commands

```bash
# Simple translation
manifesto-translate -w my-world "Add email to user"

# With custom schema
manifesto-translate -w my-world --schema ./schema.json "Create counter"

# Save output
manifesto-translate -w my-world "Add field" -o result.json
```

### Input Sources

```bash
# From file
manifesto-translate -w my-world --file requirements.txt

# From stdin (piping)
echo "Add email field" | manifesto-translate -w my-world --stdin

# Multiple lines from file
cat << EOF | manifesto-translate -w my-world --stdin
Add email field to user
Add phone field to user
Add address field to user
EOF
```

### LLM Provider Selection

```bash
# OpenAI (default)
manifesto-translate -w my-world --provider openai "Add field"

# Anthropic
manifesto-translate -w my-world --provider anthropic "Add field"
```

### Output Formats

```bash
# Simple output (default)
manifesto-translate -w my-world "Add field" --simple

# Verbose with progress
manifesto-translate -w my-world "Add field" --verbose

# Full trace
manifesto-translate -w my-world "Add field" --full

# Save trace separately
manifesto-translate -w my-world "Add field" -o result.json --trace trace.json
```

---

## Memory Integration

### Setting Up Memory Selector

```typescript
import { createTranslatorHost } from "@manifesto-ai/translator";
import type { MemorySelector } from "@manifesto-ai/memory";

// Create memory selector
const memorySelector: MemorySelector = {
  async select(request) {
    // Query your memory store
    const memories = await queryMemories(request.query);
    return {
      selected: memories,
      trace: { selectedCount: memories.length },
    };
  },
};

// Create host with memory
const host = createTranslatorHost({
  schema,
  worldId: "my-world",
  memorySelector,
  memoryContentFetcher: {
    async fetch(selected, query) {
      return {
        translationExamples: await fetchExamples(selected),
        schemaHistory: await fetchHistory(selected),
        glossaryTerms: await fetchGlossary(selected),
        resolutionHistory: await fetchResolutions(selected),
      };
    },
  },
});
```

### Memory Content Types

```typescript
interface MemoryContent {
  // Translation examples for few-shot learning
  translationExamples: Array<{
    input: string;
    output: PatchFragment[];
  }>;

  // Schema version history
  schemaHistory: Array<{
    version: string;
    changes: string[];
  }>;

  // Domain-specific vocabulary
  glossaryTerms: Array<{
    term: string;
    definition: string;
    aliases: string[];
  }>;

  // Past resolution decisions
  resolutionHistory: Array<{
    ambiguityKind: string;
    selectedOption: string;
  }>;
}
```

---

## Effect Handler Integration

### Registering with Host

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

### Custom Effect Handlers

```typescript
import { createTranslatorEffectHandlers } from "@manifesto-ai/translator";

const handlers = createTranslatorEffectHandlers({
  config: myConfig,
  schema: mySchema,
  worldId: "my-world",
});

// Override specific handler
handlers.set("translator.propose", async (type, params, context) => {
  // Custom proposal logic
  const proposal = await myCustomProposer(params);

  return [
    { op: "set", path: "proposalJson", value: JSON.stringify(proposal) },
    { op: "set", path: "status", value: "assembling" },
  ];
});
```

---

## Configuration Deep Dive

### Pipeline Configuration

```typescript
const config = createConfig({
  // Retrieval tier determines how schema is queried
  // 0: Schema-only (fastest, no external calls)
  // 1: With embedding search
  // 2: With LLM-enhanced retrieval
  retrievalTier: 0,

  // Enable fast path pattern matching
  fastPathEnabled: true,

  // Skip LLM stages entirely (fast path only)
  fastPathOnly: false,
});
```

### LLM Configuration

```typescript
const config = createConfig({
  // Model for proposals
  slmModel: "gpt-4o-mini",

  // Threshold for escalation to human
  escalationThreshold: 0.5,
});
```

### Confidence Policy

```typescript
const config = createConfig({
  confidencePolicy: {
    // Auto-accept if confidence >= 0.95
    autoAcceptThreshold: 0.95,

    // Reject if confidence < 0.3
    rejectThreshold: 0.3,
  },
});
```

### Tracing Configuration

```typescript
const config = createConfig({
  traceConfig: {
    // Where to send traces
    sink: "console", // "none" | "console" | "file"

    // Include raw input in trace (security consideration)
    includeRawInput: false,

    // Include preview of input
    includeInputPreview: true,

    // Max length of preview
    maxPreviewLength: 200,
  },
});
```

---

## Debugging

### Inspecting Pipeline State

```typescript
host.subscribe((snapshot) => {
  const state = snapshot.data;

  // Check each stage result
  if (state.chunksJson) {
    console.log("Chunks:", JSON.parse(state.chunksJson));
  }

  if (state.normalizationJson) {
    console.log("Normalization:", JSON.parse(state.normalizationJson));
  }

  if (state.fastPathJson) {
    console.log("Fast Path:", JSON.parse(state.fastPathJson));
  }

  if (state.retrievalJson) {
    console.log("Retrieval:", JSON.parse(state.retrievalJson));
  }

  if (state.memoryJson) {
    console.log("Memory:", JSON.parse(state.memoryJson));
  }

  if (state.proposalJson) {
    console.log("Proposal:", JSON.parse(state.proposalJson));
  }
});
```

### Viewing Trace

```typescript
const result = await host.translate("Add field");

if (result.trace) {
  console.log("Trace ID:", result.trace.traceId);
  console.log("Started:", new Date(result.trace.startedAt));
  console.log("Duration:", result.trace.durationMs, "ms");

  for (const stage of result.trace.stages) {
    console.log(`Stage ${stage.name}: ${stage.durationMs}ms`);
  }
}
```

### Common Issues

**Issue: Fast path not matching**
```typescript
// Check if pattern matches
const config = createConfig({
  fastPathEnabled: true,
  // Enable verbose logging
  traceConfig: { sink: "console" },
});
```

**Issue: LLM returning invalid fragments**
```typescript
// Lower confidence threshold for debugging
const config = createConfig({
  confidencePolicy: {
    autoAcceptThreshold: 0.0,  // Accept all for debugging
    rejectThreshold: 0.0,
  },
});
```

**Issue: Memory not being used**
```typescript
// Verify memory selector is configured
const host = createTranslatorHost({
  // ...
  memorySelector: mySelector,  // Must be provided
});

// Check if memory stage runs
host.subscribe((s) => {
  if (s.data.status === "memory") {
    console.log("Memory stage running");
  }
});
```

---

## Best Practices

### 1. Always Provide World ID

```typescript
// Good: World ID provided
createTranslatorHost({ schema, worldId: "my-world" });

// Bad: Missing world ID
createTranslatorHost({ schema });  // Will fail per INV-009
```

### 2. Handle All Result Types

```typescript
const result = await host.translate(input);

// Handle all three cases
switch (result.status) {
  case "success":
    // Process fragments
    break;
  case "awaiting_resolution":
    // Present options to user
    break;
  case "error":
    // Log and recover
    break;
}
```

### 3. Use Fast Path for Common Patterns

```typescript
// Enable fast path for deterministic matching
createConfig({ fastPathEnabled: true });

// For testing/debugging only, skip LLM entirely
createConfig({ fastPathOnly: true });
```

### 4. Configure Memory for Better Results

```typescript
// Provide memory for context-aware translation
createTranslatorHost({
  // ...
  memorySelector,
  memoryContentFetcher,
});
```

### 5. Reset Between Translations

```typescript
// Reuse host across translations
await host.translate("First input");
host.reset();
await host.translate("Second input");
```

---

## Environment Variables

```bash
# LLM API keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Default model
TRANSLATOR_MODEL=gpt-4o-mini

# Optional: Debug mode
DEBUG=translator:*
```

---

## Related Guides

- [Core Concepts](/core-concepts/) - Understanding Snapshot, Intent, Effect
- [Host Guide](/packages/host/GUIDE) - Effect execution
- [Compiler Guide](/packages/compiler/GUIDE) - Lowering and evaluation
- [Memory Guide](/packages/memory/GUIDE) - Memory selection
