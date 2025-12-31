# @manifesto-ai/compiler

> **Compiler** compiles natural language specifications into Manifesto DomainSchemas using LLM-powered pipelines.

---

## What is Compiler?

Compiler takes natural language descriptions and produces valid DomainSchemas. It uses LLM adapters for parsing and proposal, then validates the output using Builder.

Importantly, Compiler is itself a Manifesto application (dogfooding).

In the Manifesto architecture:

```
Natural Language ──→ COMPILER ──→ DomainSchema
                        │
    LLM-powered pipeline (segment → normalize → propose)
    Builder validation as authority
```

---

## What Compiler Does

| Responsibility | Description |
|----------------|-------------|
| Parse natural language | Segment text into semantic units |
| Normalize intents | Convert segments to structured requirements |
| Propose schema | Generate DomainSchema draft via LLM |
| Validate output | Use Builder to validate generated schema |
| Handle ambiguity | Request user resolution for unclear requirements |

---

## What Compiler Does NOT Do

| NOT Responsible For | Who Is |
|--------------------|--------|
| Execute domains | Host |
| Provide LLM infrastructure | Your LLM provider (Anthropic, OpenAI, etc.) |
| Run the domain | Host, World, Bridge |

---

## Installation

```bash
npm install @manifesto-ai/compiler @manifesto-ai/builder
# or
pnpm add @manifesto-ai/compiler @manifesto-ai/builder
```

### LLM Provider (choose one)

```bash
npm install @anthropic-ai/sdk  # For Anthropic
# or
npm install openai             # For OpenAI
```

---

## Quick Example

### Using Anthropic (Built-in)

```typescript
import { createCompiler } from "@manifesto-ai/compiler";

const compiler = createCompiler({
  anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
});

// Subscribe to state changes
compiler.subscribe((state) => {
  console.log("Status:", state.status);

  if (state.status === "success") {
    console.log("Generated schema:", state.result);
  }

  if (state.status === "discarded") {
    console.log("Discarded:", state.discardReason);
  }
});

// Start compilation
await compiler.start({
  text: `
    Track a list of todos with title and completion status.
    Users can add new todos, toggle completion, and delete todos.
    Show a count of remaining incomplete todos.
  `,
  context: {
    domainName: "todo",
  },
});
```

### Using OpenAI

```typescript
import { createCompiler, createOpenAIAdapter } from "@manifesto-ai/compiler";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const adapter = createOpenAIAdapter({ client: openai, model: "gpt-4" });

const compiler = createCompiler({
  llmAdapter: adapter,
});

await compiler.start({ text: "Track user profiles with name and email..." });
```

> See [GUIDE.md](GUIDE.md) for the full tutorial.

---

## CLI Usage

The compiler includes an interactive CLI tool:

```bash
# Direct input
manifesto-compile "Track user name and email"

# From file
manifesto-compile --file requirements.txt

# Output to file
manifesto-compile "Track todos" -o schema.json

# Use Anthropic provider
manifesto-compile --provider anthropic "Create a counter"

# Show progress
manifesto-compile --verbose "Complex requirements..."
```

### CLI Options

| Option | Description |
|--------|-------------|
| `--provider` | LLM provider: `openai` (default) or `anthropic` |
| `--model` | Model name |
| `--file` | Read input from file |
| `--stdin` | Read input from stdin |
| `-o, --output` | Write result to file |
| `--verbose` | Show phase progress |
| `--full` | Show full metrics |

> See [GUIDE.md](GUIDE.md#cli-usage) for detailed CLI documentation.

---

## Compiler API

### Main Exports

```typescript
// Factory
function createCompiler(options: CompilerOptions): Compiler;

// Compiler interface
interface Compiler {
  start(input: CompileInput): Promise<void>;
  subscribe(callback: (state: CompilerState) => void): Unsubscribe;
  requestResolution(optionId: string): Promise<void>;
  getState(): CompilerState;
}

// LLM Adapters
function createAnthropicAdapter(options: AnthropicAdapterOptions): LLMAdapter;
function createOpenAIAdapter(options: OpenAIAdapterOptions): LLMAdapter;

// Types
type CompilerStatus =
  | "idle"
  | "segmenting"
  | "normalizing"
  | "proposing"
  | "validating"
  | "awaiting_resolution"
  | "success"
  | "discarded";

type CompilerState = {
  status: CompilerStatus;
  segments?: string[];
  intents?: NormalizedIntent[];
  draft?: DomainSchema;
  result?: DomainSchema;
  diagnostics?: CompilerDiagnostics;
  resolutionOptions?: ResolutionOption[];
  discardReason?: DiscardReason;
};

interface LLMAdapter {
  segment(input: SegmentInput): Promise<LLMResult<SegmentResult>>;
  normalize(input: NormalizeInput): Promise<LLMResult<NormalizeResult>>;
  propose(input: ProposeInput): Promise<LLMResult<ProposeResult>>;
}
```

> See [SPEC.md](SPEC.md) for complete API reference.

---

## Core Concepts

### Pipeline Stages

```
idle → segmenting → normalizing → proposing → validating → success
                                      ↓              ↓
                              awaiting_resolution  discarded
```

1. **Segmenting**: Parse NL text into semantic segments
2. **Normalizing**: Convert segments to structured NormalizedIntents
3. **Proposing**: Generate DomainSchema draft via LLM
4. **Validating**: Validate draft using Builder (the "judge")
5. **Resolution**: Handle ambiguities (user choice or auto-discard)
6. **Success/Discarded**: Terminal states

### LLM as Untrusted Proposer

The LLM generates schema proposals, but Builder validates them. This ensures type safety and structural correctness regardless of LLM output quality.

```
LLM (untrusted proposer) → Draft Schema
                              ↓
                    Builder (judge) → Validation
                              ↓
                    Valid? → Success
                    Invalid? → Retry or Discard
```

### Custom LLM Adapters

Implement `LLMAdapter` interface for any LLM provider:

```typescript
const myAdapter: LLMAdapter = {
  async segment({ text }) {
    // Call your LLM
    return { ok: true, data: { segments: [...] } };
  },
  async normalize({ segments, schema, context }) {
    return { ok: true, data: { intents: [...] } };
  },
  async propose({ schema, intents, history, context }) {
    return { ok: true, data: { draft: {...} } };
  },
};
```

---

## Relationship with Other Packages

```
┌─────────────┐
│    Your     │ ← Uses Compiler for NL→Schema
│    Tool     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  COMPILER   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Builder   │ ← Validates generated schemas
└─────────────┘
```

| Relationship | Package | How |
|--------------|---------|-----|
| Depends on | `@manifesto-ai/builder` | Validates generated schemas |
| Depends on | `@manifesto-ai/core` | Uses Core types |
| Used by | Developer tools | For AI-assisted domain creation |

---

## When to Use Compiler

Use Compiler when:
- Building AI-assisted domain definition tools
- Creating no-code/low-code domain builders
- Prototyping domains from natural language specs
- Building developer productivity tools

For manual domain definition, use [`@manifesto-ai/builder`](../builder/) directly.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [GUIDE.md](GUIDE.md) | Step-by-step usage guide |
| [SPEC.md](SPEC.md) | Complete specification |
| [FDR.md](FDR.md) | Design rationale |

---

## License

[MIT](../../LICENSE)
