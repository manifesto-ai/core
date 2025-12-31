# Compiler Guide

> **Purpose:** Practical guide for using @manifesto-ai/compiler
> **Prerequisites:** Understanding of Builder, LLM API access
> **Time to complete:** ~15 minutes

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [CLI Usage](#cli-usage)
3. [Basic Usage](#basic-usage)
4. [Common Patterns](#common-patterns)
5. [Advanced Usage](#advanced-usage)
6. [Common Mistakes](#common-mistakes)
7. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Installation

```bash
npm install @manifesto-ai/compiler @manifesto-ai/builder
```

### Choose LLM Provider

```bash
# Option 1: Anthropic (recommended)
npm install @anthropic-ai/sdk

# Option 2: OpenAI
npm install openai
```

### Minimal Setup

```typescript
import { createCompiler } from "@manifesto-ai/compiler";

// With Anthropic
const compiler = createCompiler({
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
});

// Subscribe to state changes
compiler.subscribe((state) => {
  console.log("Status:", state.status);
});
```

---

## CLI Usage

The compiler provides an interactive CLI tool `manifesto-compile` for compiling natural language to DomainSchema.

### Installation

After installing the package, the CLI is available as `manifesto-compile`:

```bash
# Global install
npm install -g @manifesto-ai/compiler

# Or use via npx
npx @manifesto-ai/compiler "Your requirements here"

# Or in a project with the package installed
npx manifesto-compile "Your requirements here"
```

### Basic CLI Usage

```bash
# Direct input
manifesto-compile "Track user name and email"

# Read from file
manifesto-compile --file requirements.txt

# Read from stdin
cat requirements.txt | manifesto-compile --stdin

# Output to file
manifesto-compile "Track todos" -o schema.json
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--provider` | LLM provider: `openai` or `anthropic` | `openai` |
| `--api-key` | API key (or use env variable) | - |
| `--model` | Model name | `gpt-4o-mini` / `claude-3-haiku-20240307` |
| `--file` | Read input from file | - |
| `--stdin` | Read input from stdin | `false` |
| `-o, --output` | Write result JSON to file | stdout |
| `--simple` | Minimal output | default |
| `--verbose` | Show phase progress | - |
| `--full` | Show full metrics | - |

### Environment Variables

The CLI automatically loads `.env` and `.env.local` files from the current directory up to root.

```bash
# .env or .env.local
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Provider Selection

```bash
# OpenAI (default)
manifesto-compile "Track todos"

# Anthropic
manifesto-compile --provider anthropic "Track todos"

# With custom model
manifesto-compile --provider openai --model gpt-4-turbo "Track todos"
manifesto-compile --provider anthropic --model claude-3-5-sonnet-20241022 "Track todos"
```

### Verbosity Levels

```bash
# Simple (default) - minimal output, just the result
manifesto-compile "Track todos"

# Verbose - shows phase progress
manifesto-compile --verbose "Track todos"

# Full - shows all metrics and timing
manifesto-compile --full "Track todos"
```

### Example Workflows

**Quick schema generation:**

```bash
manifesto-compile "Users have name, email, and profile picture" -o user-schema.json
```

**From requirements document:**

```bash
# requirements.txt:
# Track a list of todos with title, description, and due date.
# Users can add, edit, delete, and mark todos as complete.
# Show overdue todos highlighted.

manifesto-compile --file requirements.txt --verbose -o todo-schema.json
```

**Pipeline usage:**

```bash
echo "Simple counter with increment and decrement" | manifesto-compile --stdin -o counter.json
```

**Debug mode with full metrics:**

```bash
manifesto-compile --full --provider anthropic "Complex multi-user task board"
```

---

## Basic Usage

### Use Case 1: Basic Compilation

**Goal:** Compile natural language to DomainSchema.

```typescript
import { createCompiler } from "@manifesto-ai/compiler";

const compiler = createCompiler({
  anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
});

// Subscribe to results
compiler.subscribe((state) => {
  switch (state.status) {
    case "segmenting":
      console.log("Parsing input...");
      break;
    case "normalizing":
      console.log("Normalizing intents...");
      break;
    case "proposing":
      console.log("Generating schema...");
      break;
    case "validating":
      console.log("Validating schema...");
      break;
    case "success":
      console.log("Generated schema:", state.result);
      break;
    case "discarded":
      console.log("Failed:", state.discardReason);
      break;
  }
});

// Start compilation
await compiler.start({
  text: `
    Track a list of todos with title and completion status.
    Users can add new todos, mark them complete, and delete them.
    Show how many todos are remaining.
  `,
});
```

### Use Case 2: Adding Context

**Goal:** Provide additional context for better results.

```typescript
await compiler.start({
  text: "Users can submit support tickets and track their status",
  context: {
    domainName: "support",
    existingActions: ["user.login", "user.logout"],
    glossary: {
      ticket: "A support request from a customer",
      status: "The current state: open, in-progress, resolved, closed",
    },
  },
});
```

### Use Case 3: Using OpenAI

**Goal:** Use OpenAI instead of Anthropic.

```typescript
import { createCompiler, createOpenAIAdapter } from "@manifesto-ai/compiler";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const adapter = createOpenAIAdapter({
  client: openai,
  model: "gpt-4-turbo-preview",
});

const compiler = createCompiler({
  llmAdapter: adapter,
});

await compiler.start({ text: "..." });
```

---

## Common Patterns

### Pattern 1: Handling Resolution Requests

**When to use:** LLM needs clarification.

```typescript
compiler.subscribe((state) => {
  if (state.status === "awaiting_resolution") {
    console.log("Ambiguity detected!");
    console.log("Options:", state.resolutionOptions);

    // Present options to user...
    const selectedOptionId = await promptUser(state.resolutionOptions);

    // Provide resolution
    await compiler.requestResolution(selectedOptionId);
  }
});
```

### Pattern 2: Retry on Validation Failure

**When to use:** First attempt fails validation.

```typescript
let attempts = 0;
const maxAttempts = 3;

compiler.subscribe(async (state) => {
  if (state.status === "discarded" && attempts < maxAttempts) {
    attempts++;
    console.log(`Attempt ${attempts} failed, retrying...`);

    // Retry with more context
    await compiler.start({
      text: originalText,
      context: {
        previousErrors: state.diagnostics?.errors,
        hint: "Please ensure all types are valid Zod schemas",
      },
    });
  }
});
```

### Pattern 3: Progress Indicator

**When to use:** Show user-friendly progress.

```typescript
const statusMessages = {
  idle: "Ready",
  segmenting: "Parsing your requirements...",
  normalizing: "Understanding intents...",
  proposing: "Generating domain schema...",
  validating: "Validating structure...",
  awaiting_resolution: "Need your input...",
  success: "Done!",
  discarded: "Failed",
};

compiler.subscribe((state) => {
  updateUI({
    message: statusMessages[state.status],
    progress: getProgress(state.status),
  });
});

function getProgress(status: string): number {
  const stages = ["idle", "segmenting", "normalizing", "proposing", "validating", "success"];
  return (stages.indexOf(status) / (stages.length - 1)) * 100;
}
```

---

## Advanced Usage

### Custom LLM Adapter

**Prerequisites:** Understanding of LLM APIs.

```typescript
import { createCompiler, type LLMAdapter } from "@manifesto-ai/compiler";

const myAdapter: LLMAdapter = {
  async segment({ text }) {
    // Call your LLM
    const response = await myLLM.complete({
      prompt: `Parse this into segments: ${text}`,
    });

    return {
      ok: true,
      data: {
        segments: parseSegments(response),
      },
    };
  },

  async normalize({ segments, schema, context }) {
    const response = await myLLM.complete({
      prompt: `Normalize these segments to intents: ${JSON.stringify(segments)}`,
    });

    return {
      ok: true,
      data: {
        intents: parseIntents(response),
      },
    };
  },

  async propose({ schema, intents, history, context }) {
    const response = await myLLM.complete({
      prompt: `Generate DomainSchema for: ${JSON.stringify(intents)}`,
    });

    return {
      ok: true,
      data: {
        draft: parseDraft(response),
      },
    };
  },
};

const compiler = createCompiler({ llmAdapter: myAdapter });
```

### Accessing Internal State

```typescript
// Get current state at any time
const state = compiler.getState();

console.log("Current status:", state.status);
console.log("Segments:", state.segments);
console.log("Intents:", state.intents);
console.log("Draft:", state.draft);
console.log("Telemetry:", state.telemetry);
```

### Using the Domain Directly

```typescript
import { CompilerDomain, INITIAL_STATE } from "@manifesto-ai/compiler";
import { createHost, createSnapshot } from "@manifesto-ai/host";

// Use compiler as a Manifesto domain
const host = createHost({
  schema: CompilerDomain.schema,
  snapshot: createSnapshot(CompilerDomain.schema),
});

// Register effect handlers
host.registerEffect("llm.segment", async ({ params }) => {
  // Custom segment implementation
});

// Dispatch directly
await host.dispatch({
  type: "compiler.start",
  input: { text: "..." },
});
```

---

## Common Mistakes

### Mistake 1: Not Handling All States

**What people do:**

```typescript
// Wrong: Only handling success
compiler.subscribe((state) => {
  if (state.status === "success") {
    console.log(state.result);
  }
});
// User sees nothing if it fails!
```

**Why it's wrong:** User has no feedback on failure.

**Correct approach:**

```typescript
// Right: Handle all states
compiler.subscribe((state) => {
  switch (state.status) {
    case "success":
      onSuccess(state.result);
      break;
    case "discarded":
      onError(state.discardReason);
      break;
    case "awaiting_resolution":
      onNeedInput(state.resolutionOptions);
      break;
    default:
      onProgress(state.status);
  }
});
```

### Mistake 2: Not Waiting for Completion

**What people do:**

```typescript
// Wrong: Not awaiting
compiler.start({ text: "..." });
const state = compiler.getState();
console.log(state.result); // undefined!
```

**Why it's wrong:** Compilation is async.

**Correct approach:**

```typescript
// Right: Use subscribe or await
await compiler.start({ text: "..." });

// Or use subscribe
compiler.subscribe((state) => {
  if (state.status === "success") {
    console.log(state.result);
  }
});
await compiler.start({ text: "..." });
```

### Mistake 3: Ignoring Validation Errors

**What people do:**

```typescript
// Wrong: Using result without checking validation
compiler.subscribe((state) => {
  if (state.draft) {
    useDraft(state.draft); // May be invalid!
  }
});
```

**Why it's wrong:** Draft may fail validation.

**Correct approach:**

```typescript
// Right: Only use validated result
compiler.subscribe((state) => {
  if (state.status === "success" && state.result) {
    useDraft(state.result); // Validated!
  }
});
```

---

## Troubleshooting

### Error: "API key not found"

**Cause:** Missing or invalid API key.

**Solution:**

```typescript
// Ensure API key is set
const compiler = createCompiler({
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY, // Must be defined
  },
});

// Check environment variable
console.log("Key exists:", !!process.env.ANTHROPIC_API_KEY);
```

### Error: "Rate limit exceeded"

**Cause:** Too many requests to LLM.

**Solution:**

```typescript
// Add delay between requests
import { sleep } from "./utils";

compiler.subscribe(async (state) => {
  if (state.status === "discarded" && state.discardReason === "rate_limit") {
    await sleep(5000); // Wait 5 seconds
    await compiler.start({ text: originalText });
  }
});
```

### Validation always fails

**Cause:** LLM generating invalid schema.

**Diagnosis:**

```typescript
compiler.subscribe((state) => {
  if (state.diagnostics) {
    console.log("Validation errors:", state.diagnostics.errors);
  }
});
```

**Solution:**

```typescript
// Add more context
await compiler.start({
  text: originalText,
  context: {
    hint: "Use Zod schemas. State must be z.object({}). Actions need flow definitions.",
    example: exampleSchema, // Provide example
  },
});
```

---

## Testing

### Unit Testing with Mock Adapter

```typescript
import { createCompiler, type LLMAdapter } from "@manifesto-ai/compiler";
import { describe, it, expect, vi } from "vitest";

describe("Compiler", () => {
  const mockAdapter: LLMAdapter = {
    segment: vi.fn().mockResolvedValue({
      ok: true,
      data: { segments: ["Track todos"] },
    }),
    normalize: vi.fn().mockResolvedValue({
      ok: true,
      data: { intents: [{ kind: "state", description: "todos list" }] },
    }),
    propose: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        draft: {
          version: "1.0.0",
          state: { todos: { type: "array", default: [] } },
          actions: {},
        },
      },
    }),
  };

  it("compiles text to schema", async () => {
    const compiler = createCompiler({ llmAdapter: mockAdapter });

    let result: any;
    compiler.subscribe((state) => {
      if (state.status === "success") {
        result = state.result;
      }
    });

    await compiler.start({ text: "Track todos" });

    expect(result).toBeDefined();
    expect(result.state.todos).toBeDefined();
  });
});
```

---

## Quick Reference

### Key APIs

| API | Purpose | Example |
|-----|---------|---------|
| `createCompiler()` | Create compiler | `createCompiler({ anthropic: {...} })` |
| `compiler.start()` | Start compilation | `await compiler.start({ text })` |
| `compiler.subscribe()` | Listen to state | `compiler.subscribe(callback)` |
| `compiler.requestResolution()` | Resolve ambiguity | `await compiler.requestResolution(optionId)` |
| `compiler.getState()` | Get current state | `compiler.getState()` |

### Compiler Status

| Status | Meaning |
|--------|---------|
| `idle` | Ready to start |
| `segmenting` | Parsing input text |
| `normalizing` | Converting to intents |
| `proposing` | Generating schema |
| `validating` | Validating with Builder |
| `awaiting_resolution` | Needs user input |
| `success` | Completed successfully |
| `discarded` | Failed |

### LLM Adapters

| Adapter | Factory | Package |
|---------|---------|---------|
| Anthropic | `anthropic: { apiKey }` | `@anthropic-ai/sdk` |
| OpenAI | `createOpenAIAdapter()` | `openai` |
| Custom | `llmAdapter: adapter` | - |

### CLI Commands

| Command | Description |
|---------|-------------|
| `manifesto-compile "text"` | Compile text directly |
| `manifesto-compile --file <file>` | Compile from file |
| `manifesto-compile --stdin` | Compile from stdin |
| `manifesto-compile -o <file>` | Output to file |
| `manifesto-compile --provider anthropic` | Use Anthropic |
| `manifesto-compile --verbose` | Show progress |
| `manifesto-compile --full` | Show all metrics |

---

*End of Guide*
