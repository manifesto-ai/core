# Lab Guide

> **Purpose:** Practical guide for using @manifesto-ai/lab
> **Prerequisites:** Basic understanding of Manifesto World and Host
> **Time to complete:** ~30 minutes

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Usage](#basic-usage)
3. [Common Patterns](#common-patterns)
4. [Advanced Usage](#advanced-usage)
5. [Common Mistakes](#common-mistakes)
6. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Installation

```bash
npm install @manifesto-ai/lab @manifesto-ai/world @manifesto-ai/host @manifesto-ai/core
```

### Minimal Setup

```typescript
// 1. Import
import { createManifestoWorld } from '@manifesto-ai/world';
import { withLab } from '@manifesto-ai/lab';

// 2. Create base World
const world = createManifestoWorld({
  schemaHash: schema.hash,
  host,
});

// 3. Wrap with Lab
const labWorld = withLab(world, {
  runId: 'exp-001',
  necessityLevel: 0,
  outputPath: './traces',
});

// 4. Verify
console.log(labWorld.labMeta.runId);
// → 'exp-001'
console.log(labWorld.state.status);
// → 'running'
```

### Project Structure

```
my-experiment/
├── src/
│   ├── domain.ts          # Domain definition
│   ├── experiment.ts      # Lab setup and execution
│   └── index.ts
├── traces/                # Trace output directory
├── reports/               # Generated reports
├── package.json
└── tsconfig.json
```

---

## Basic Usage

### Use Case 1: Basic Experiment with Tracing

**Goal:** Run a simple experiment and record a trace.

```typescript
import { createManifestoWorld } from '@manifesto-ai/world';
import { createManifestoHost } from '@manifesto-ai/host';
import { withLab } from '@manifesto-ai/lab';

// 1. Setup
const host = createManifestoHost();
const world = createManifestoWorld({ schemaHash: schema.hash, host });

// 2. Wrap with Lab
const labWorld = withLab(world, {
  runId: 'simple-exp-001',
  necessityLevel: 0,
  outputPath: './traces',
  projection: { enabled: true, mode: 'watch' },
});

// 3. Register actors
labWorld.registerActor({
  actorId: 'system',
  kind: 'system',
  name: 'System Actor',
});

// 4. Execute
await labWorld.submitProposal({
  actorId: 'system',
  intent: {
    type: 'incrementCounter',
    input: {},
  },
});

// 5. Get trace
const trace = labWorld.trace();
console.log(`Outcome: ${trace.outcome}`);
console.log(`Events: ${trace.events.length}`);
console.log(`Duration: ${trace.header.durationMs}ms`);

// Expected output:
// → Outcome: success
// → Events: 5
// → Duration: 12ms
```

### Use Case 2: Level 1 with LLM Actor

**Goal:** Run an experiment with an LLM actor at Necessity Level 1.

```typescript
import { withLab, createLevelAuthority } from '@manifesto-ai/lab';
import { Level1Schema } from '@manifesto-ai/lab';

// 1. Create domain with Level 1 schema
const domain = defineDomain(
  MyDomainSchema.merge(Level1Schema),
  ({ state, actions }) => {
    // Domain definition with belief state
  }
);

// 2. Create World and wrap with Lab
const labWorld = withLab(world, {
  runId: 'level1-exp-001',
  necessityLevel: 1,
  outputPath: './traces',
  projection: { enabled: true, mode: 'interactive' },
});

// 3. Register LLM Actor
labWorld.registerActor({
  actorId: 'llm-gpt4',
  kind: 'agent',
  name: 'GPT-4 Belief Proposer',
  meta: {
    model: 'gpt-4-turbo',
    role: 'belief_proposer',
    level: 1,
  },
});

// 4. Bind Level 1 Authority
labWorld.bindAuthority(
  'llm-gpt4',
  'authority-level-1',
  createLevelAuthority(1)
);

// 5. Submit LLM proposal
await labWorld.submitProposal({
  actorId: 'llm-gpt4',
  intent: {
    type: 'llm.propose_belief',
    input: {
      hypotheses: [{
        id: 'h1',
        hiddenState: { opponentCard: 'ace' },
        confidence: 0.85,
        supportingObservations: ['obs1', 'obs2'],
      }],
    },
  },
});

// 6. Check trace for verification
const trace = labWorld.trace();
const verificationEvents = trace.events.filter(
  e => e.type === 'authority.decision'
);
console.log(verificationEvents[0].verificationMethod);
// → 'posterior_consistency'
```

### Use Case 3: HITL Intervention

**Goal:** Run an experiment that requires human approval.

```typescript
import { withLab, createLevelAuthority } from '@manifesto-ai/lab';

const labWorld = withLab(world, {
  runId: 'hitl-exp-001',
  necessityLevel: 2,
  outputPath: './traces',
  projection: { enabled: true, mode: 'interactive' },
  hitl: {
    enabled: true,
    timeout: 300000, // 5 minutes
    onTimeout: 'reject',
    onPending: async (proposal, context) => {
      console.log(`HITL required for proposal ${proposal.proposalId}`);
      console.log(`Intent: ${proposal.intent.type}`);
    },
  },
});

// Register Level 2 Authority (triggers HITL for low confidence)
labWorld.bindAuthority(
  'llm-level-2',
  'authority-level-2',
  createLevelAuthority(2, {
    hitlController: labWorld.hitl,
    confidenceThreshold: 0.70,
  })
);

// Submit proposal (will trigger HITL if confidence < 0.70)
await labWorld.submitProposal({
  actorId: 'llm-level-2',
  intent: {
    type: 'llm.propose_interpretation',
    input: {
      originalGoal: 'Make the report better',
      formalizedGoal: { /* ... */ },
      confidence: 0.65, // Below threshold
    },
  },
});

// In another context (e.g., UI callback):
// Human approves
await labWorld.hitl.approve(proposalId, {
  note: 'Reviewed and approved',
  validatedBy: 'human:alice',
});

// Check HITL events in trace
const trace = labWorld.trace();
const hitlEvents = trace.events.filter(e => e.type === 'hitl');
console.log(hitlEvents);
// → [{ type: 'hitl', action: 'approved', decidedBy: 'human:alice', ... }]
```

---

## Common Patterns

### Pattern 1: Save Trace After Experiment

**When to use:** Always. Traces are valuable for debugging and analysis.

```typescript
const labWorld = withLab(world, {
  runId: 'exp-001',
  necessityLevel: 1,
  outputPath: './traces',
});

// Run experiment
await runExperiment(labWorld);

// Save trace
await labWorld.trace().save('./traces/exp-001.trace.json');

// Or with options
await labWorld.trace().save('./traces/exp-001.trace.json.gz', {
  format: 'json.gz',
  pretty: false,
  includeSnapshots: false,
});
```

### Pattern 2: Generate Report

**When to use:** After experiment completion for human-readable summary.

```typescript
const labWorld = withLab(world, { /* ... */ });

// Run experiment
await runExperiment(labWorld);

// Generate and save report
const report = labWorld.report();
await report.toMarkdownFile('./reports/exp-001.md');

// Or get as string
const markdown = report.toMarkdown();
console.log(markdown);
```

### Pattern 3: Custom Projection Components

**When to use:** When you have domain-specific state that needs visualization.

```typescript
import { withLab } from '@manifesto-ai/lab';
import chalk from 'chalk';

const labWorld = withLab(world, {
  runId: 'exp-001',
  necessityLevel: 1,
  outputPath: './traces',
  projection: {
    enabled: true,
    mode: 'watch',
    components: {
      header: (ctx) =>
        `🧪 ${ctx.runId} | Level ${ctx.level} | Step ${ctx.step} | ${formatTime(ctx.elapsedMs)}`,

      renderSnapshot: (snapshot, ctx) => {
        // Domain-specific visualization
        const { todos } = snapshot.data;
        let output = chalk.bold('Todos:\n');

        for (const todo of todos) {
          const status = todo.completed ? '✅' : '⬜';
          output += `  ${status} ${todo.title}\n`;
        }

        return output;
      },

      renderAction: (intent, before, after, ctx) => {
        const change = `${before.data.todos.length} → ${after.data.todos.length} todos`;
        return chalk.cyan(`Action: ${intent.type}`) + chalk.dim(` (${change})`);
      },

      renderReasoning: (reasoning, confidence, ctx) => {
        const confidenceColor = confidence > 0.7 ? chalk.green : chalk.yellow;
        return [
          chalk.dim('Agent Reasoning:'),
          `"${reasoning}"`,
          '',
          confidenceColor(`Confidence: ${(confidence * 100).toFixed(0)}%`),
        ].join('\n');
      },
    },
  },
});

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}
```

### Pattern 4: Batch Analysis

**When to use:** Analyzing multiple experiment runs.

```typescript
import { loadAllTraces, summarize, diffTraces } from '@manifesto-ai/lab';

// 1. Load all traces
const traces = await loadAllTraces('./traces/*.trace.json');
console.log(`Loaded ${traces.length} traces`);

// 2. Generate summary
const summary = summarize(traces);
console.log(`Success Rate: ${(summary.successRate * 100).toFixed(1)}%`);
console.log(`Avg Steps: ${summary.avgSteps.toFixed(1)}`);
console.log(`HITL Rate: ${(summary.hitl.hitlRate * 100).toFixed(1)}%`);

// 3. Compare successful vs failed runs
const successTraces = traces.filter(t => t.outcome === 'success');
const failTraces = traces.filter(t => t.outcome === 'failure');

if (successTraces.length > 0 && failTraces.length > 0) {
  const diff = diffTraces(successTraces[0], failTraces[0]);
  console.log(`\nFirst divergence at event ${diff.divergedAtSeq}`);
  console.log(`Cause: ${diff.cause?.type}`);
  console.log(`Description: ${diff.cause?.description}`);
}

// 4. By-level analysis
for (const [level, stats] of Object.entries(summary.byLevel)) {
  console.log(`\nLevel ${level}:`);
  console.log(`  Runs: ${stats.runs}`);
  console.log(`  Success: ${(stats.successRate * 100).toFixed(1)}%`);
  console.log(`  Avg Duration: ${stats.avgDurationMs.toFixed(0)}ms`);
}
```

### Pattern 5: Model Comparison via Replay

**When to use:** Testing different models on the same scenario.

```typescript
import { loadTrace, replay, withLab } from '@manifesto-ai/lab';

// 1. Load original trace (GPT-4 run)
const gpt4Trace = await loadTrace('./traces/gpt4-run.trace.json');

// 2. Create new world with Claude
const claudeWorld = createManifestoWorld({ /* ... */ });
claudeWorld.registerActor({
  actorId: 'llm-claude',
  kind: 'agent',
  meta: { model: 'claude-3-opus', role: 'belief_proposer' },
});

// 3. Replay with Claude
const replayResult = await replay(gpt4Trace, {
  world: withLab(claudeWorld, {
    runId: 'replay-claude-001',
    necessityLevel: gpt4Trace.header.necessityLevel,
    outputPath: './traces',
  }),
  actorOverride: 'llm-claude',
  mode: 'compare',
});

// 4. Analyze differences
console.log(`GPT-4 outcome: ${gpt4Trace.outcome}`);
console.log(`Claude outcome: ${replayResult.trace.outcome}`);

if (!replayResult.success) {
  console.log(`\nDivergences: ${replayResult.divergences.length}`);
  for (const d of replayResult.divergences) {
    console.log(`  Event ${d.seq}: ${d.cause.description}`);
  }
}

// 5. Save Claude trace
await replayResult.trace.save('./traces/claude-run.trace.json');
```

### Pattern 6: HITL with Autonomous Agent Resolution

**When to use:** Agent-to-agent HITL where one agent reviews another's work.

```typescript
import { withLab, createHITLContext, buildPrompt } from '@manifesto-ai/lab';

const labWorld = withLab(world, {
  runId: 'agent-hitl-001',
  necessityLevel: 2,
  outputPath: './traces',
  projection: {
    enabled: true,
    mode: 'interactive',
    components: {
      renderSnapshot: myDomainRenderer, // Custom renderer
    },
  },
  hitl: {
    enabled: true,
    onPending: async (proposal, context) => {
      // Generate structured prompt for reviewing agent
      const hitlContext = createHITLContext({
        snapshot: labWorld.getCurrentSnapshot(),
        proposal,
        pendingReason: {
          code: 'LOW_CONFIDENCE',
          description: 'Confidence below threshold',
          details: {
            confidence: { actual: 0.65, required: 0.70 },
          },
        },
        availableActions: [
          { type: 'retry', description: 'Add more reasoning' },
          { type: 'modify', description: 'Choose different action', allowedModifications: ['direction'] },
          { type: 'abort', description: 'Give up' },
        ],
        renderContext: { /* ... */ },
        decisionRecord: { /* ... */ },
      });

      const prompt = hitlContext.toPrompt({
        stateRenderer: myDomainRenderer, // Reuse projection renderer
        includeActions: true,
        responseFormat: 'json',
        includeSchema: true,
      });

      // Send to reviewing agent (e.g., GPT-4)
      const response = await reviewingAgent.handleHITL(prompt);

      // Handle response
      switch (response.action) {
        case 'retry':
          await labWorld.hitl.approve(proposal.proposalId, {
            note: `Retry requested: ${response.reasoning}`,
          });
          break;
        case 'modify':
          await labWorld.hitl.approveWithModification(proposal.proposalId, {
            scope: response.newScope,
          });
          break;
        case 'abort':
          await labWorld.hitl.reject(proposal.proposalId, response.reason);
          break;
      }
    },
  },
});
```

---

## Advanced Usage

### Customizing Level Authority

**Prerequisites:** Understanding of Authority handlers and verification methods.

```typescript
import { createLevelAuthority } from '@manifesto-ai/lab';

// Create Level 2 Authority with custom threshold
const customAuthority = createLevelAuthority(2, {
  hitlController: labWorld.hitl,
  confidenceThreshold: 0.80, // Higher threshold than default (0.70)
});

labWorld.bindAuthority('llm-level-2', 'custom-authority', customAuthority);

// Or create fully custom authority
import type { LevelAuthorityHandler, AuthorityContext } from '@manifesto-ai/lab';

const strictAuthority: LevelAuthorityHandler = {
  level: 2,
  verificationMethod: 'semantic_audit',
  guarantee: 'plausible',

  async evaluate(proposal, context: AuthorityContext) {
    // Custom verification logic
    const confidence = proposal.intent.input.confidence ?? 0;

    if (confidence < 0.90) {
      // Require HITL for anything below 90%
      return {
        decision: 'pending',
        reason: {
          code: 'LOW_CONFIDENCE',
          description: 'Confidence must be >= 90%',
          details: { confidence: { actual: confidence, required: 0.90 } },
        },
      };
    }

    // Additional semantic checks
    const violations = await checkSemanticConstraints(proposal);
    if (violations.length > 0) {
      return {
        decision: 'rejected',
        reason: { code: 'SEMANTIC_VIOLATION', details: { violations } },
      };
    }

    return { decision: 'approved' };
  },
};
```

### Custom Trace Event Processing

```typescript
import { withLab } from '@manifesto-ai/lab';

const labWorld = withLab(world, {
  runId: 'custom-processing-001',
  necessityLevel: 1,
  outputPath: './traces',
});

// Subscribe to lab events
labWorld.onLabEvent((event) => {
  switch (event.type) {
    case 'world:event':
      // Process world event
      if (event.event.type === 'proposal:submitted') {
        console.log(`Proposal submitted: ${event.event.proposalId}`);
      }
      break;

    case 'hitl:pending':
      // Custom HITL notification
      sendSlackNotification(`HITL required for ${event.proposalId}`);
      break;

    case 'lab:status_changed':
      // Custom status handling
      updateDashboard(event.status);
      break;
  }
});
```

### Multi-Run Experiments

```typescript
import { withLab, summarize } from '@manifesto-ai/lab';

async function runMultipleExperiments(
  config: { model: string; level: NecessityLevel }[],
  iterations: number
) {
  const allTraces = [];

  for (const cfg of config) {
    for (let i = 0; i < iterations; i++) {
      const runId = `${cfg.model}-L${cfg.level}-${i.toString().padStart(3, '0')}`;

      const labWorld = withLab(world, {
        runId,
        necessityLevel: cfg.level,
        outputPath: './traces',
        projection: { enabled: false, mode: 'silent' }, // Silent for batch
      });

      // Register actor
      labWorld.registerActor({
        actorId: `llm-${cfg.model}`,
        kind: 'agent',
        meta: { model: cfg.model, level: cfg.level },
      });

      // Run experiment
      await runExperiment(labWorld);

      // Save trace
      const trace = labWorld.trace();
      await trace.save(`./traces/${runId}.trace.json`);
      allTraces.push(trace);

      console.log(`Completed: ${runId} (${trace.outcome})`);
    }
  }

  // Generate summary
  const summary = summarize(allTraces);
  console.log('\n=== Summary ===');
  console.log(`Total runs: ${summary.runs}`);
  console.log(`Success rate: ${(summary.successRate * 100).toFixed(1)}%`);
  console.log(`Avg steps: ${summary.avgSteps.toFixed(1)}`);
  console.log(`Avg duration: ${summary.avgDurationMs.toFixed(0)}ms`);

  return summary;
}

// Run experiments
const summary = await runMultipleExperiments(
  [
    { model: 'gpt-4-turbo', level: 1 },
    { model: 'claude-3-opus', level: 1 },
    { model: 'gpt-4-turbo', level: 2 },
    { model: 'claude-3-opus', level: 2 },
  ],
  10 // 10 iterations each
);
```

---

## Common Mistakes

### ❌ Mistake 1: Expecting Lab to Modify State

**What people do:**

```typescript
// Wrong - expecting Lab to trigger execution
const labWorld = withLab(world, { /* ... */ });
const trace = labWorld.trace();
console.log(trace.events.length);
// → 0 (no events, nothing happened!)
```

**Why it's wrong:** Lab is an observer. It doesn't execute anything. You still need to submit proposals to World.

**Correct approach:**

```typescript
// Right - Lab observes, you execute
const labWorld = withLab(world, { /* ... */ });

// Submit proposal to trigger execution
await labWorld.submitProposal({ /* ... */ });

// Now trace has events
const trace = labWorld.trace();
console.log(trace.events.length);
// → 5 (events were recorded)
```

### ❌ Mistake 2: Forgetting to Save Traces

**What people do:**

```typescript
// Wrong - trace lost when process exits
const labWorld = withLab(world, { /* ... */ });
await runExperiment(labWorld);
// Process exits, trace is lost
```

**Why it's wrong:** Traces are only in memory. They're lost when the process exits.

**Correct approach:**

```typescript
// Right - save trace before exiting
const labWorld = withLab(world, { /* ... */ });
await runExperiment(labWorld);

// Save trace
await labWorld.trace().save('./traces/exp-001.trace.json');
// Now trace is persisted
```

### ❌ Mistake 3: Modifying State in Projection Components

**What people do:**

```typescript
// Wrong - side effects in renderer
const labWorld = withLab(world, {
  projection: {
    components: {
      renderSnapshot: (snapshot, ctx) => {
        // WRONG: Modifying external state
        globalCounter++;
        statsDatabase.record({ step: ctx.step });
        return renderBoard(snapshot);
      },
    },
  },
});
```

**Why it's wrong:** Renderers must be pure functions. Side effects break determinism and testability.

**Correct approach:**

```typescript
// Right - pure renderer, side effects elsewhere
const labWorld = withLab(world, {
  projection: {
    components: {
      renderSnapshot: (snapshot, ctx) => {
        // Pure: no side effects
        return renderBoard(snapshot);
      },
    },
  },
});

// Side effects via event subscription
labWorld.onLabEvent((event) => {
  if (event.type === 'world:event' && event.event.type === 'snapshot:changed') {
    // OK to record stats here
    statsDatabase.record({ step: labWorld.state.status === 'running' ? labWorld.state.currentStep : 0 });
  }
});
```

### ❌ Mistake 4: Not Binding Authority for LLM Actors

**What people do:**

```typescript
// Wrong - LLM actor with no authority
labWorld.registerActor({
  actorId: 'llm-gpt4',
  kind: 'agent',
});

await labWorld.submitProposal({
  actorId: 'llm-gpt4',
  intent: { /* ... */ },
});
// Proposal might be rejected: "No authority bound for actor"
```

**Why it's wrong:** LLM actors need Authority handlers to verify their proposals.

**Correct approach:**

```typescript
// Right - bind authority before submitting
labWorld.registerActor({
  actorId: 'llm-gpt4',
  kind: 'agent',
});

// Bind Level 1 Authority
labWorld.bindAuthority(
  'llm-gpt4',
  'authority-level-1',
  createLevelAuthority(1)
);

// Now proposals are properly verified
await labWorld.submitProposal({
  actorId: 'llm-gpt4',
  intent: { /* ... */ },
});
```

### ❌ Mistake 5: Using Wrong Necessity Level

**What people do:**

```typescript
// Wrong - Level 0 for LLM-required task
const labWorld = withLab(world, {
  runId: 'exp-001',
  necessityLevel: 0, // Deterministic level
  outputPath: './traces',
});

// But using LLM for belief formation (Level 1 task)
await labWorld.submitProposal({
  actorId: 'llm-gpt4',
  intent: {
    type: 'llm.propose_belief',
    input: { /* ... */ },
  },
});
```

**Why it's wrong:** Necessity level should match the structural properties of the task.

**Correct approach:**

```typescript
// Right - Level 1 for partial observation task
const labWorld = withLab(world, {
  runId: 'exp-001',
  necessityLevel: 1, // Partial observation level
  outputPath: './traces',
});

// Use Level 1 schema and authority
const domain = defineDomain(
  MyDomainSchema.merge(Level1Schema),
  ({ state, actions }) => { /* ... */ }
);

labWorld.bindAuthority(
  'llm-gpt4',
  'authority-level-1',
  createLevelAuthority(1)
);
```

### ❌ Mistake 6: Not Handling HITL Timeout

**What people do:**

```typescript
// Wrong - no timeout handling
const labWorld = withLab(world, {
  hitl: {
    enabled: true,
    // No timeout or onTimeout
  },
});

// Process hangs forever waiting for human
await labWorld.submitProposal({ /* triggers HITL */ });
```

**Why it's wrong:** Without timeout handling, the process can hang indefinitely.

**Correct approach:**

```typescript
// Right - explicit timeout handling
const labWorld = withLab(world, {
  hitl: {
    enabled: true,
    timeout: 300000, // 5 minutes
    onTimeout: 'reject', // or 'approve' or 'abort'
  },
});

// Or handle timeout in onPending
const labWorld = withLab(world, {
  hitl: {
    enabled: true,
    timeout: 60000, // 1 minute
    onPending: async (proposal, context) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        labWorld.hitl.reject(proposal.proposalId, 'Timeout: no response in 1 minute');
      }, 60000);

      // Wait for human response
      // ... (clear timeout if response received)
    },
  },
});
```

### ❌ Mistake 7: Comparing Traces with Different Schema Versions

**What people do:**

```typescript
// Wrong - comparing incompatible traces
const oldTrace = await loadTrace('./traces/old-schema.trace.json'); // schemaHash: abc123
const newTrace = await loadTrace('./traces/new-schema.trace.json'); // schemaHash: xyz789

const diff = diffTraces(oldTrace, newTrace);
// Diff is meaningless - different schemas!
```

**Why it's wrong:** Traces with different schemas aren't comparable.

**Correct approach:**

```typescript
// Right - verify schema compatibility first
const trace1 = await loadTrace('./traces/run1.trace.json');
const trace2 = await loadTrace('./traces/run2.trace.json');

if (trace1.header.schemaHash !== trace2.header.schemaHash) {
  console.error('Cannot compare traces with different schemas');
  console.error(`Trace 1 schema: ${trace1.header.schemaHash}`);
  console.error(`Trace 2 schema: ${trace2.header.schemaHash}`);
  process.exit(1);
}

// Now safe to compare
const diff = diffTraces(trace1, trace2);
```

---

## Troubleshooting

### Error: "No authority bound for actor"

**Cause:** Trying to submit a proposal from an actor that has no Authority handler.

**Solution:**

```typescript
// Check if actor has authority
const hasAuthority = world.hasAuthorityBinding(actorId);

if (!hasAuthority) {
  // Bind authority before submitting
  labWorld.bindAuthority(
    actorId,
    `authority-${actorId}`,
    createLevelAuthority(necessityLevel)
  );
}
```

### Error: "Trace file not found"

**Cause:** Trying to load a trace file that doesn't exist.

**Diagnosis:**

```bash
# Check if file exists
ls -la ./traces/exp-001.trace.json

# Check output path in lab config
```

**Solution:**

```typescript
import { existsSync } from 'fs';

const tracePath = './traces/exp-001.trace.json';

if (!existsSync(tracePath)) {
  console.error(`Trace file not found: ${tracePath}`);
  // Create trace first or check path
}
```

### Symptom: Projection not showing

**Cause:** Projection mode is 'silent' or projection is disabled.

**Diagnosis:**

```typescript
console.log(labWorld.projection.mode);
// → 'silent'

// Check initial config
console.log(options.projection?.enabled);
// → false
```

**Solution:**

```typescript
// Enable projection and set mode
const labWorld = withLab(world, {
  projection: {
    enabled: true,
    mode: 'watch', // or 'interactive' or 'debug'
  },
});

// Or change mode at runtime
labWorld.projection.setMode('watch');
```

### Symptom: HITL not triggering

**Cause:** Authority is approving without pending, or HITL is disabled.

**Diagnosis:**

```typescript
// Check HITL config
console.log(options.hitl?.enabled);
// → undefined (HITL not enabled)

// Check authority decision
const trace = labWorld.trace();
const decisions = trace.events.filter(e => e.type === 'authority.decision');
console.log(decisions);
// → All decisions are 'approved', none 'pending'
```

**Solution:**

```typescript
// Enable HITL
const labWorld = withLab(world, {
  hitl: {
    enabled: true, // Must be true
    timeout: 300000,
  },
});

// Use authority that returns 'pending'
// Level 2+ authorities with low confidence return pending
const authority = createLevelAuthority(2, {
  hitlController: labWorld.hitl,
  confidenceThreshold: 0.70,
});

// Or custom authority that returns pending
const customAuthority = {
  async evaluate(proposal, context) {
    // Custom logic to determine if pending
    if (requiresReview(proposal)) {
      return {
        decision: 'pending',
        reason: { /* ... */ },
      };
    }
    return { decision: 'approved' };
  },
};
```

### Symptom: Trace has no events

**Cause:** No proposals were submitted, or world didn't emit events.

**Diagnosis:**

```typescript
const trace = labWorld.trace();
console.log(trace.events.length);
// → 0

// Check if proposals were submitted
console.log(labWorld.state);
// → { status: 'running', currentStep: 0, pendingHITL: [] }
```

**Solution:**

```typescript
// Submit at least one proposal
await labWorld.submitProposal({
  actorId: 'system',
  intent: { type: 'someAction', input: {} },
});

// Verify events are recorded
const trace = labWorld.trace();
console.log(trace.events.length);
// → Should be > 0 now
```

---

## Testing

### Unit Testing Lab Setup

```typescript
import { createManifestoWorld } from '@manifesto-ai/world';
import { withLab } from '@manifesto-ai/lab';
import { describe, it, expect, beforeEach } from 'vitest';

describe('Lab Experiments', () => {
  let world;
  let labWorld;

  beforeEach(() => {
    world = createManifestoWorld({ schemaHash: 'test-schema', host });
    labWorld = withLab(world, {
      runId: 'test-001',
      necessityLevel: 0,
      outputPath: './test-traces',
      projection: { enabled: false, mode: 'silent' }, // Silent for tests
    });
  });

  it('records trace events', async () => {
    // Arrange
    labWorld.registerActor({ actorId: 'test-actor', kind: 'system' });

    // Act
    await labWorld.submitProposal({
      actorId: 'test-actor',
      intent: { type: 'testAction', input: {} },
    });

    // Assert
    const trace = labWorld.trace();
    expect(trace.events.length).toBeGreaterThan(0);
    expect(trace.events[0].type).toBe('proposal');
  });

  it('generates report', async () => {
    // Arrange & Act
    labWorld.registerActor({ actorId: 'test-actor', kind: 'system' });
    await labWorld.submitProposal({
      actorId: 'test-actor',
      intent: { type: 'testAction', input: {} },
    });

    // Assert
    const report = labWorld.report();
    expect(report.runId).toBe('test-001');
    expect(report.necessityLevel).toBe(0);
    expect(report.summary.totalProposals).toBe(1);
  });
});
```

### Integration Testing HITL

```typescript
import { describe, it, expect } from 'vitest';
import { withLab, createLevelAuthority } from '@manifesto-ai/lab';

describe('HITL Integration', () => {
  it('handles HITL approval flow', async () => {
    // Arrange
    const labWorld = withLab(world, {
      runId: 'hitl-test-001',
      necessityLevel: 2,
      outputPath: './test-traces',
      hitl: { enabled: true, timeout: 5000 },
    });

    labWorld.registerActor({ actorId: 'llm-test', kind: 'agent' });
    labWorld.bindAuthority(
      'llm-test',
      'test-authority',
      createLevelAuthority(2, {
        hitlController: labWorld.hitl,
        confidenceThreshold: 0.70,
      })
    );

    // Act - submit low-confidence proposal
    const submitPromise = labWorld.submitProposal({
      actorId: 'llm-test',
      intent: {
        type: 'llm.propose_interpretation',
        input: { confidence: 0.60 }, // Below threshold
      },
    });

    // Wait for HITL to trigger
    await new Promise(resolve => setTimeout(resolve, 100));

    // Approve via HITL
    const pendingProposals = labWorld.hitl.pending;
    expect(pendingProposals.length).toBe(1);

    await labWorld.hitl.approve(pendingProposals[0].proposalId);

    // Wait for completion
    await submitPromise;

    // Assert
    const trace = labWorld.trace();
    const hitlEvents = trace.events.filter(e => e.type === 'hitl');
    expect(hitlEvents.length).toBe(1);
    expect(hitlEvents[0].action).toBe('approved');
  });
});
```

---

## Next Steps

- **Deep dive:** Read [README.md](./README.md) for mental model and architecture
- **Understand why:** Read [FDR.md](./FDR.md) for design rationale
- **Normative reference:** Read [SPEC.md](./SPEC.md) for complete specification
- **See examples:** Check [apps/llm-babybench](../../../apps/llm-babybench/) for real-world usage

---

## Quick Reference

### Key APIs

| API | Purpose | Example |
|-----|---------|---------|
| `withLab()` | Wrap World with Lab | `withLab(world, options)` |
| `labWorld.trace()` | Get trace artifact | `const trace = labWorld.trace()` |
| `labWorld.report()` | Generate report | `const report = labWorld.report()` |
| `labWorld.hitl.approve()` | Approve pending proposal | `await labWorld.hitl.approve(proposalId)` |
| `labWorld.projection.setMode()` | Change projection mode | `labWorld.projection.setMode('debug')` |
| `loadTrace()` | Load trace from file | `await loadTrace('./trace.json')` |
| `summarize()` | Summarize traces | `summarize(traces)` |
| `diffTraces()` | Compare two traces | `diffTraces(t1, t2)` |
| `replay()` | Replay trace | `await replay(trace, { world })` |

### Necessity Levels

| Level | Name | When Needed | Example Task |
|-------|------|-------------|--------------|
| 0 | Deterministic | Never | Counter, calculator |
| 1 | Partial Observation | Hidden state | Poker, belief tracking |
| 2 | Open-Ended Rules | Goal interpretation | "Make this better" |
| 3 | Natural Language | Intent grounding | "Send to my usual contact" |

### Projection Modes

| Mode | Visibility | Use Case |
|------|-----------|----------|
| `silent` | None | CI/CD, batch processing |
| `watch` | Progress + proposals | Monitoring |
| `interactive` | + HITL | Development, debugging |
| `debug` | + snapshots + LLM | Deep debugging |

### Checklist

Before going to production:

- [ ] Traces are being saved (not just in memory)
- [ ] HITL timeout is set (if enabled)
- [ ] Authority is bound for all LLM actors
- [ ] Necessity level matches task structure
- [ ] Projection mode is appropriate (silent for prod?)
- [ ] Error handling for HITL decisions
- [ ] Trace storage path exists and is writable

---

*End of Guide*
