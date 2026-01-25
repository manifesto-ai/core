# @manifesto-ai/lab

> **Status:** Deprecated (v2 focuses on Core/Host/World/App). This package is legacy and may be removed.


> **Lab** is the observation and governance layer for Manifesto. It wraps World to provide LLM governance, tracing, HITL intervention, and reproducibility.

---

## What is Lab?

Lab provides experimentation infrastructure for Manifesto systems. It observes World Protocol events to record traces, manage LLM governance through Necessity Levels, enable Human-in-the-Loop (HITL) intervention, and generate explainable reports.

In the Manifesto architecture:

```
┌──────────────────────────────────────────┐
│              Lab (Observer)              │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │            World                   │  │
│  │                                    │  │
│  │  Actor → Authority → Host → Core  │  │
│  │                                    │  │
│  └────────────────────────────────────┘  │
│                    │                      │
│            Events (subscribe)             │
│                    │                      │
│    ┌───────────────┼───────────────┐     │
│    ▼               ▼               ▼     │
│  Trace         HITL          Projection  │
│ (record)    (intervene)      (visualize) │
│                                          │
└──────────────────────────────────────────┘
```

Lab **observes but never modifies** World state. All HITL decisions flow through Authority, maintaining governance integrity.

---

## What Lab Does

| Responsibility | Description |
|----------------|-------------|
| Wrap World with observation | Attach to World via event subscription |
| Record structured traces | Capture all events for replay and analysis |
| Manage Necessity Levels | Determine when LLMs are structurally required (L0-L3) |
| Enable HITL intervention | Allow humans to approve/reject proposals |
| Provide real-time projection | Visualize execution with custom domain renderers |
| Generate explainable reports | Produce Markdown/HTML/JSON reports from traces |

---

## What Lab Does NOT Do

| NOT Responsible For | Who Is |
|--------------------|--------|
| Execute effects | Host |
| Modify World state | Authority + Host |
| Make governance decisions | Authority |
| Define domain logic | Builder + Core |
| Compute state transitions | Core |

**Critical:** Lab is an **observer**. It never modifies state through observation. HITL decisions go through Authority, not direct modification.

---

## Installation

```bash
npm install @manifesto-ai/lab
# or
pnpm add @manifesto-ai/lab
```

### Peer Dependencies

```bash
npm install @manifesto-ai/world @manifesto-ai/host @manifesto-ai/core
```

---

## Quick Example

```typescript
import { createManifestoWorld } from '@manifesto-ai/world';
import { withLab } from '@manifesto-ai/lab';

// 1. Create base World
const world = createManifestoWorld({ schemaHash, host });

// 2. Wrap with Lab
const labWorld = withLab(world, {
  runId: 'exp-001',
  necessityLevel: 1,
  outputPath: './traces',
  projection: { enabled: true, mode: 'interactive' },
  hitl: { enabled: true, timeout: 300000 },
});

// 3. Use labWorld (same interface as world + lab extensions)
await labWorld.submitProposal({ actorId: 'llm-gpt4', intent: { ... } });

// 4. Get results
const trace = labWorld.trace();
const report = labWorld.report();

console.log(`Outcome: ${trace.outcome}`);
console.log(`Steps: ${trace.events.length}`);
```

> See [GUIDE.md](./docs/GUIDE.md) for the full tutorial.

---

## Core Concepts

### Necessity Levels (L0-L3)

Manifesto defines four Necessity Levels that determine when LLMs are structurally required:

- **Level 0** (Deterministic Full Observation): No LLM needed — fully deterministic
- **Level 1** (Partial Observation): Hidden state requires belief formation
- **Level 2** (Open-Ended Rules): Goal interpretation required
- **Level 3** (Natural Language Grounding): Intent grounding from natural language

Each level has specific verification requirements and Authority handlers.

### Observer Pattern

Lab observes World via `world.subscribe()` (World Protocol Events). It never modifies state directly. This ensures:

- Traces accurately reflect World behavior
- No interference with determinism
- HITL decisions go through proper Authority channels

### Trace-as-Evidence

Every Lab run produces a **Lab Trace Artifact** that is:

- The canonical experimental record
- Sufficient for deterministic replay
- Sufficient for failure explanation
- Analyzable (summary, diff, compare)

### HITL via Authority

Human-in-the-Loop intervention flows through Authority, not direct state modification:

```
Authority returns 'pending' → Lab shows HITL UI → Human decides →
  HITLController.approve/reject → Authority receives decision →
    World proceeds
```

This ensures all decisions have DecisionRecords and maintain governance integrity.

---

## API Overview

### Main Exports

```typescript
// Primary function
function withLab(world: ManifestoWorld, options: LabOptions): LabWorld;

// Authority factory
function createLevelAuthority(level: NecessityLevel, options?: LevelAuthorityOptions): LevelAuthorityHandler;

// Trace utilities (v1.1)
function loadTrace(path: string): Promise<LabTrace>;
function summarize(traces: LabTrace | LabTrace[]): TraceSummary;
function diffTraces(a: LabTrace, b: LabTrace): TraceDiff;
function replay(trace: LabTrace, options: ReplayOptions): Promise<ReplayResult>;

// Types
type LabOptions = { runId, necessityLevel, outputPath, projection?, hitl? };
type LabWorld = ManifestoWorld & { labMeta, state, hitl, projection, trace(), report() };
type LabTrace = { header, events, outcome, failureExplanation? };
```

> See [SPEC.md](./docs/SPEC.md) for complete API reference.

---

## Relationship with Other Packages

```
┌─────────────┐
│    World    │ ← Lab wraps World
└──────┬──────┘
       │
       │ uses
       ▼
┌─────────────┐
│    Host     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Core     │
└─────────────┘
```

| Relationship | Package | How |
|--------------|---------|-----|
| Wraps | `@manifesto-ai/world` | `withLab(world, options)` |
| Observes | `@manifesto-ai/world` | `world.subscribe()` events |
| Uses schemas from | `@manifesto-ai/builder` | Necessity level state extensions |

---

## When to Use Lab Directly

**Most users will use Lab for:**

- **Experiments**: Testing LLM-driven systems with governance
- **Debugging**: Recording traces for reproducible bug reports
- **Evaluation**: Comparing model performance across runs
- **HITL workflows**: Systems requiring human approval
- **Research**: Analyzing necessity levels and verification methods

**Do NOT use Lab if:**

- You're building a simple, fully deterministic system (Level 0 with no tracing needs)
- You don't need tracing, HITL, or LLM governance
- You're in production and need minimal overhead (though traces are valuable)

---

## What Makes Lab Different

| Lab is NOT | Lab IS |
|------------|--------|
| A workflow engine | An observation and governance layer |
| An agent framework | A wrapper that enforces LLM governance |
| A UI state library | A tracing and intervention system |
| A task planner | An experimental infrastructure |

**Mental Model:** Lab is to Manifesto what `strace` is to Unix — it records what happens without changing it.

The key difference: Lab **never hides state**. If it's not in Snapshot, it doesn't exist. If it's not in Trace, it didn't happen.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [GUIDE.md](./docs/GUIDE.md) | Step-by-step usage guide |
| [SPEC.md](./docs/SPEC.md) | Complete specification (normative) |
| [FDR.md](./docs/FDR.md) | Design rationale (why decisions were made) |

---

## Key Features (v1.1)

### Trace I/O

```typescript
// Save trace
await labWorld.trace().save('./traces/exp-001.trace.json');

// Load trace
const trace = await loadTrace('./traces/exp-001.trace.json');
```

### Trace Analysis

```typescript
// Summarize multiple runs
const traces = await loadAllTraces('./traces/*.json');
const summary = summarize(traces);
console.log(`Success rate: ${summary.successRate * 100}%`);

// Compare two traces
const diff = diffTraces(successTrace, failTrace);
console.log(`Diverged at event ${diff.divergedAtSeq}`);
```

### Trace Replay

```typescript
// Replay with different model
const result = await replay(originalTrace, {
  world: withLab(claudeWorld, { runId: 'replay-001', ... }),
  actorOverride: 'llm-claude',
  mode: 'compare',
});
```

### Custom Projection Components

```typescript
const labWorld = withLab(world, {
  projection: {
    enabled: true,
    mode: 'watch',
    components: {
      renderSnapshot: (snapshot, ctx) => {
        // Domain-specific visualization
        return renderMyBoard(snapshot.data.board);
      },
      renderAction: (intent, before, after, ctx) => {
        return `Action: ${intent.type} (${ctx.step}/${ctx.totalSteps})`;
      },
    },
  },
});
```

### HITL Structured Prompting

```typescript
const labWorld = withLab(world, {
  hitl: {
    enabled: true,
    onPending: async (proposal, context) => {
      // Generate structured prompt for agent
      const prompt = context.toPrompt({
        stateRenderer: myDomainRenderer,
        includeActions: true,
        responseFormat: 'json',
      });

      // Send to agent for autonomous HITL resolution
      const response = await agent.handleHITL(prompt);

      if (response.action === 'retry') {
        await context.retry(response.reasoning);
      }
    },
  },
});
```

---

## License

[MIT](../../LICENSE)
