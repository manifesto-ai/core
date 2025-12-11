# @manifesto-ai/agent

A session layer that executes LLM as a "pure policy function," standardizing all side effects as Effects with Runtime control.

```
f(snapshot) → effects[]
```

## Overview

`@manifesto-ai/agent` treats the LLM as a deterministic component—not the master, but a CPU-level policy executor. The Runtime owns all control flow, validates all outputs, and manages all side effects.

### Core Principles

| Principle | Description |
|-----------|-------------|
| **LLM as Component** | `f(snapshot) → effects[]` — LLM declares intent, Runtime executes |
| **Runtime Owns Control** | step/run, budget, stop — Control flow always belongs to Runtime |
| **Enforce, Don't Inject** | Schema → Constraints compilation + Validator Gatekeeping |
| **Errors Become State** | No exception crashes — failures are recorded and available for self-correction |
| **Sequential + Stop-on-Failure** | Partial failure discards remaining effects |

## Installation

```bash
npm install @manifesto-ai/agent
# or
pnpm add @manifesto-ai/agent
```

## Quick Start

```typescript
import {
  createSimpleSession,
  createMockClient,
  generateEffectId,
  type AgentDecision,
} from '@manifesto-ai/agent';

// Define decisions the mock LLM will return
const decisions: AgentDecision[] = [
  {
    effects: [
      {
        type: 'snapshot.patch',
        id: generateEffectId(),
        ops: [{ op: 'set', path: 'data.status', value: 'processing' }],
      },
      {
        type: 'log.emit',
        id: generateEffectId(),
        level: 'info',
        message: 'Started processing',
      },
    ],
  },
  { effects: [] }, // Empty effects = session complete
];

// Create a simple session
const { session, getSnapshot } = createSimpleSession({
  initialSnapshot: {
    data: { status: 'idle' },
    state: { phase: 'init' },
    derived: {},
  },
  client: createMockClient(decisions),
});

// Run the session
const result = await session.run();

console.log(result);
// { done: true, totalSteps: 2, totalEffects: 2, reason: 'Empty effects' }

console.log(getSnapshot().data.status);
// 'processing'
```

## Core Concepts

### Effect Types

Effects are declarations of intent. The LLM declares what it wants; the Runtime decides whether and how to execute.

```typescript
type Effect =
  | ToolCallEffect      // Call an external tool
  | SnapshotPatchEffect // Modify snapshot state
  | LogEmitEffect;      // Emit a log message

// Tool call
{
  type: 'tool.call',
  id: 'eff_abc123',
  tool: 'search',
  input: { query: 'manifesto architecture' }
}

// Snapshot patch
{
  type: 'snapshot.patch',
  id: 'eff_def456',
  ops: [
    { op: 'set', path: 'data.results', value: [...] },
    { op: 'append', path: 'data.history', value: 'searched' }
  ],
  reason: 'Store search results'
}

// Log emit
{
  type: 'log.emit',
  id: 'eff_ghi789',
  level: 'info',
  message: 'Processing complete'
}
```

### PatchOp Operations

Only two operations are allowed in v0.1:

| Operation | Description | Example |
|-----------|-------------|---------|
| `set` | Set a value at path | `{ op: 'set', path: 'data.name', value: 'John' }` |
| `append` | Append to array | `{ op: 'append', path: 'data.items', value: 'new' }` |

**Path Rules:**
- Dot-separated: `"data.user.name"`
- Array indices: `"data.items.0.status"`
- 0-based indexing with bounds checking

**Forbidden:** `delete`, `move`, `replace`, `copy`

### Snapshot Structure & ACL

```typescript
{
  data: { ... },    // LLM writable
  state: { ... },   // LLM writable (phase, etc.)
  derived: { ... }  // LLM write FORBIDDEN (Runtime managed)
}
```

The `derived.*` namespace is exclusively managed by the Runtime. Any LLM attempt to write to `derived.*` will be rejected with a validation error.

### Constraints

Constraints define what the LLM can and cannot do in the current phase:

```typescript
import {
  createDefaultConstraints,
  addTypeRule,
  addInvariant,
} from '@manifesto-ai/agent';

let constraints = createDefaultConstraints('processing');

// Add type rules
constraints = addTypeRule(constraints, 'data.count', 'number');
constraints = addTypeRule(constraints, 'data.name', 'string');

// Add invariants
constraints = addInvariant(
  constraints,
  'count_positive',
  'Count must be positive'
);
```

## Validation Pipeline

Every `snapshot.patch` effect goes through a validation pipeline:

```
PatchOp received
       ↓
1. Schema check (op/path/value structure)
       ↓
2. ACL check (derived.* write forbidden)
       ↓
3. Bounds check (array index range)
       ↓
4. Type rules check (expected types)
       ↓
5. Invariant check (phase-specific rules)
       ↓
   Pass → Apply    Fail → Record Error State
```

### Error as State

When validation fails, errors are recorded as state—not thrown as exceptions:

```typescript
const errors = getErrors();
// [
//   {
//     kind: 'patch_validation_error',
//     at: 'derived.x',
//     issue: 'Forbidden path',
//     advice: 'derived.* paths are Runtime-managed',
//     effectId: 'eff_abc123',
//     ts: 1704067200000
//   }
// ]
```

The LLM receives these errors in the next step and can self-correct.

## Session API

### Creating a Session

```typescript
import {
  createAgentSession,
  createDefaultHandlerRegistry,
  createDefaultConstraints,
} from '@manifesto-ai/agent';

const session = createAgentSession({
  core: manifestoCore,  // ManifestoCoreLike implementation
  client: llmClient,    // AgentClient implementation
  policy: {
    maxSteps: 100,
    maxEffectsPerStep: 16,
  },
  handlers: createDefaultHandlerRegistry(),
  compileConstraints: (snapshot) => createDefaultConstraints(snapshot.state.phase),
});
```

### Running a Session

```typescript
// Single step
const stepResult = await session.step();
// { done: boolean, effectsExecuted: number, errorsEncountered: number }

// Run until completion
const runResult = await session.run();
// { done: boolean, totalSteps: number, totalEffects: number, reason?: string }
```

### Simple Session (for Testing)

```typescript
import { createSimpleSession } from '@manifesto-ai/agent';

const { session, getSnapshot, getErrors, clearErrors } = createSimpleSession({
  initialSnapshot: { data: {}, state: {}, derived: {} },
  client: yourClient,
  policy: { maxSteps: 50 },
  isDone: (snapshot) => ({
    done: snapshot.state.phase === 'complete',
    reason: 'Phase complete',
  }),
});
```

## Tools

### Defining Tools

```typescript
import { defineTool, createToolRegistry } from '@manifesto-ai/agent';

const searchTool = defineTool({
  name: 'search',
  description: 'Search the web',
  execute: async (input: { query: string }) => {
    const results = await performSearch(input.query);
    return { results };
  },
});

const calculatorTool = defineTool({
  name: 'calculate',
  description: 'Perform calculations',
  execute: async (input: { expression: string }) => {
    return { result: eval(input.expression) };
  },
});

const toolRegistry = createToolRegistry([searchTool, calculatorTool]);
```

### Tool Results as Observations

When a tool executes, its result is automatically pushed to `derived.observations`:

```typescript
// After tool.call effect executes:
snapshot.derived.observations = [
  {
    id: 'obs_xyz789',
    source: 'tool:search',
    content: { results: [...] },
    triggeredBy: 'eff_abc123',
    ts: 1704067200000
  }
];
```

## Prompt Building

### System Prompt

```typescript
import { SYSTEM_PROMPT, buildSystemPrompt } from '@manifesto-ai/agent';

// Base system prompt with Iron Laws
console.log(SYSTEM_PROMPT);

// With tools and context
const prompt = buildSystemPrompt({
  includeToolList: true,
  tools: [
    { name: 'search', description: 'Search the web' },
  ],
  additionalContext: 'You are working on a todo application.',
});
```

### Step Prompt

```typescript
import { buildStepPrompt, createDefaultConstraints } from '@manifesto-ai/agent';

const prompt = buildStepPrompt({
  snapshot: currentSnapshot,
  constraints: createDefaultConstraints('processing'),
  recentErrors: errors,
  instruction: 'Process the next item in the queue.',
});
```

## AgentClient Interface

Implement this interface to connect your LLM:

```typescript
import type { AgentClient, AgentDecision, Constraints } from '@manifesto-ai/agent';

const myClient: AgentClient = {
  async decide(input) {
    const { snapshot, constraints, recentErrors, instruction } = input;

    // Call your LLM here
    const response = await callLLM({
      systemPrompt: buildSystemPrompt(),
      userPrompt: buildStepPrompt({
        snapshot,
        constraints,
        recentErrors,
        instruction,
      }),
    });

    // Parse and return AgentDecision
    return JSON.parse(response) as AgentDecision;
  },
};
```

### AgentDecision Schema

```typescript
type AgentDecision = {
  effects: Effect[];
  trace?: {
    model?: string;
    tokensIn?: number;
    tokensOut?: number;
    raw?: unknown;
  };
};
```

## Testing

### Mock Client

```typescript
import { createMockClient, generateEffectId } from '@manifesto-ai/agent';

const decisions = [
  {
    effects: [
      {
        type: 'snapshot.patch',
        id: generateEffectId(),
        ops: [{ op: 'set', path: 'data.x', value: 1 }],
      },
    ],
  },
  { effects: [] },
];

const client = createMockClient(decisions);
```

### Fixed Client

```typescript
import { createFixedClient, generateEffectId } from '@manifesto-ai/agent';

// Returns the same decision every time
const client = createFixedClient({
  effects: [
    {
      type: 'log.emit',
      id: generateEffectId(),
      level: 'info',
      message: 'Hello',
    },
  ],
});
```

### Invariant Helpers

```typescript
import {
  requiredFieldInvariant,
  rangeInvariant,
  arrayLengthInvariant,
  customInvariant,
} from '@manifesto-ai/agent';

// Field must exist and not be null/undefined
const hasName = requiredFieldInvariant('data.user.name');

// Number must be in range
const validAge = rangeInvariant('data.user.age', 0, 150);

// Array length constraint
const maxItems = arrayLengthInvariant('data.items', 0, 100);

// Custom validation
const customRule = customInvariant(
  'positive_balance',
  'Balance must be positive',
  (snapshot) => snapshot.data.balance > 0
);
```

## Error Types

```typescript
import type {
  PatchErrorState,
  EffectErrorState,
  HandlerErrorState,
} from '@manifesto-ai/agent';

// Patch validation error
type PatchErrorState = {
  kind: 'patch_validation_error';
  at: string;           // Problem path
  issue: string;        // Error description
  expected?: unknown;   // Expected type/value
  got?: unknown;        // Actual type/value
  advice?: string;      // Correction hint
  effectId: string;
  ts: number;
};
```

## Configuration

### Policy

```typescript
type Policy = {
  maxSteps: number;           // Maximum steps before forced stop
  maxEffectsPerStep?: number; // Default: 16
};
```

### ManifestoCoreLike Interface

If integrating with `@manifesto-ai/core`:

```typescript
interface ManifestoCoreLike<S> {
  getSnapshot(): S;
  applyPatch(ops: PatchOp[]): ApplyResult;
  appendError(error: PatchErrorState): void;
  getRecentErrors(limit?: number): PatchErrorState[];
  clearErrors(): void;
  appendObservation(obs: Observation): void;
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    @manifesto/loops-hsca                     │
│          (HSCA phase rules + constraints compiler)           │
└─────────────────────────┬───────────────────────────────────┘
                          │ uses
┌─────────────────────────▼───────────────────────────────────┐
│                     @manifesto-ai/agent                      │
│   (LLM policy execution + Effect standardization +           │
│                  Runtime enforcement)                        │
└─────────────────────────┬───────────────────────────────────┘
                          │ uses
┌─────────────────────────▼───────────────────────────────────┐
│                     @manifesto-ai/core                       │
│       (Snapshot storage/transition/logging —                 │
│              Constitution + minimal infra)                   │
└─────────────────────────────────────────────────────────────┘
```

## API Reference

### Types

- `Effect`, `ToolCallEffect`, `SnapshotPatchEffect`, `LogEmitEffect`
- `PatchOp`
- `Constraints`, `TypeRule`, `Invariant`
- `Policy`
- `PatchErrorState`, `EffectErrorState`, `HandlerErrorState`
- `AgentClient`, `AgentDecision`
- `AgentSession`, `StepResult`, `RunResult`
- `Observation`
- `Tool`, `ToolRegistry`

### Session

- `createAgentSession(options)` - Create a full session
- `createSimpleSession(options)` - Create a simple session for testing

### Validation

- `validatePathAcl(path, effectId)` - Check write ACL
- `validatePathBounds(path, snapshot, effectId)` - Check array bounds
- `validateTypeRule(path, value, rule, effectId)` - Check type rule
- `validateInvariant(snapshot, invariant)` - Check invariant
- `validatePatchPipeline(ops, snapshot, constraints, effectId)` - Full validation

### Handlers

- `createDefaultHandlerRegistry()` - Create registry with default handlers
- `createToolCallHandler(tools, core)` - Create tool call handler
- `createSnapshotPatchHandler(core, constraints)` - Create patch handler
- `createLogEmitHandler(collector?)` - Create log handler

### Prompt

- `SYSTEM_PROMPT` - Base system prompt with Iron Laws
- `buildSystemPrompt(options?)` - Build customized system prompt
- `buildStepPrompt(input, options?)` - Build per-step prompt
- `buildLLMMessages(systemPrompt, stepInput)` - Build message array

### Utilities

- `generateEffectId()` - Generate unique effect ID
- `generateObservationId()` - Generate unique observation ID
- `createDefaultConstraints(phase?)` - Create default constraints
- `createMockClient(decisions)` - Create mock client for testing
- `createFixedClient(decision)` - Create fixed-response client

## License

MIT

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Related Packages

- [@manifesto-ai/core](../core) - Core snapshot management
- [@manifesto-ai/loops-hsca](../loops-hsca) - HSCA loop implementation
