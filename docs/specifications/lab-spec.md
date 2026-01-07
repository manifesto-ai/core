# Manifesto LLM Necessity & Lab Specification v1.1

> **Status:** Release Candidate  
> **Scope:** Normative  
> **Authors:** Manifesto Team  
> **License:** MIT  
> **Changelog:**
> - v1.0: Initial specification
> - v1.1: Added Trace Utilities (I/O, Summary, Diff, Report, Replay), Projection Components (Domain Renderer), HITL Prompt Builder
>
> **Depends On:**
> - Manifesto Core Spec v1.0
> - World Protocol v1.1 (with Events)
> - Builder Spec v1.0
> - Host Contract v1.0

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Normative Language](#2-normative-language)
3. [Core Philosophy](#3-core-philosophy)
4. [Necessity Levels](#4-necessity-levels)
5. [Level State Extensions](#5-level-state-extensions)
6. [LLM Governance Model](#6-llm-governance-model)
7. [Authority by Level](#7-authority-by-level)
8. [Lab Architecture](#8-lab-architecture)
9. [Lab Projection](#9-lab-projection) *(extended in v1.1)*
10. [HITL Intervention](#10-hitl-intervention) *(extended in v1.1)*
11. [Lab Trace Artifact](#11-lab-trace-artifact)
12. [Failure Explainability Model](#12-failure-explainability-model)
13. [Trace I/O](#13-trace-io) *(v1.1)*
14. [Trace Summary](#14-trace-summary) *(v1.1)*
15. [Trace Diff](#15-trace-diff) *(v1.1)*
16. [Trace Report](#16-trace-report) *(v1.1)*
17. [Trace Replay](#17-trace-replay) *(v1.1)*
18. [Builder Integration](#18-builder-integration)
19. [World Integration](#19-world-integration)
20. [Conformance Requirements](#20-conformance-requirements)
21. [Forbidden Patterns](#21-forbidden-patterns)
22. [Explicit Non-Goals](#22-explicit-non-goals)

**Appendices**
- [Appendix A: Type Definitions](#appendix-a-type-definitions)
- [Appendix B: Level Summary](#appendix-b-level-summary)
- [Appendix C: Trace Example](#appendix-c-trace-example)
- [Appendix D: Quick Reference](#appendix-d-quick-reference)
- [Appendix E: CLI Reference](#appendix-e-cli-reference) *(v1.1)*

---

## 1. Introduction

### 1.1 Purpose

This specification defines a **unified governance, experimentation, and tracing model** for Manifesto-compliant systems.

It formalizes:

- **When** LLMs are structurally necessary (Necessity Levels)
- **How** LLM participation is governed (Actor + Authority)
- **How** experiments are observed in real-time (Lab + Projection)
- **How** humans intervene when required (HITL)
- **How** failures become first-class explainable artifacts
- **How** traces are persisted, analyzed, compared, and replayed *(v1.1)*

> A Manifesto system MUST be able to justify not only *what* happened,
> but *why it could not have happened otherwise*.

### 1.2 Scope

This specification applies to:

- Deterministic and non-deterministic Worlds
- LLM-driven and LLM-free systems
- Research experiments and production systems
- Interactive and batch execution modes
- Single-run and multi-run analysis *(v1.1)*

### 1.3 Relationship to World Events

Lab relies on **World Protocol Event System** (v1.1) for observation:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Lab                                     │
│                          │                                      │
│                   world.subscribe()                             │
│                          │                                      │
│                          ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                      World                                 │ │
│  │                                                            │ │
│  │   proposal:submitted ──► proposal:decided                  │ │
│  │          │                     │                           │ │
│  │          │              ┌──────┴──────┐                    │ │
│  │          │              │             │                    │ │
│  │          │          approved      rejected                 │ │
│  │          │              │                                  │ │
│  │          │              ▼                                  │ │
│  │          │     execution:started                           │ │
│  │          │              │                                  │ │
│  │          │              ▼                                  │ │
│  │          │     execution:patches                           │ │
│  │          │              │                                  │ │
│  │          │              ▼                                  │ │
│  │          │     snapshot:changed                            │ │
│  │          │              │                                  │ │
│  │          │              ▼                                  │ │
│  │          │     execution:completed                         │ │
│  │          │              │                                  │ │
│  │          │              ▼                                  │ │
│  │          └────► world:created                              │ │
│  │                                                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Lab observes ALL events via subscribe()                        │
│  No plugin system required                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Normative Language

The keywords **MUST**, **MUST NOT**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **MAY**, **OPTIONAL** are to be interpreted as described in RFC 2119.

---

## 3. Core Philosophy

### 3.1 Structural Necessity Principle

> **LLM usage is justified only when no deterministic function exists
> that can solve the task correctly for all valid instances.**

**Definition (Structural Necessity):**

An LLM is structurally necessary at Level N if and only if:

```
∄ f: ObservableState → Action such that
  ∀ valid task instances, f achieves correctness
```

### 3.2 Actor Equality Principle

LLMs are **not special components**. They are:

- Registered as Actors with `kind: 'agent'`
- Bound by the World Protocol
- Subject to Authority verification
- Fully traceable

### 3.3 Trace-as-Evidence Principle

> **A run without a trace is not an experiment.**

Every execution produces a **Lab Trace Artifact** which is:

- The canonical experimental record
- Sufficient for replay
- Sufficient for failure explanation

### 3.4 Failure-as-Structure Principle

> **Manifesto does not ask whether an agent succeeded,
> but whether the world allowed it to succeed — and proves the answer.**

---

## 4. Necessity Levels

### 4.1 Level Definitions

```typescript
type NecessityLevel = 0 | 1 | 2 | 3;
```

| Level | Name | Structural Property | LLM Role |
|-------|------|---------------------|----------|
| 0 | Deterministic Full Observation | Solvable without LLM | `none` / `fact_proposer` |
| 1 | Partial Observation | Hidden state requires belief | `belief_proposer` |
| 2 | Open-Ended Rules | Goal interpretation required | `rule_interpreter` |
| 3 | Natural Language Grounding | Intent grounding required | `intent_parser` |

### 4.2 Level Detection

```typescript
type LevelDetection = {
  readonly observation: 0 | 1;
  readonly rules: 0 | 2;
  readonly language: 0 | 3;
  readonly detectedAt: number;
};

function computeEffectiveLevel(detection: LevelDetection): NecessityLevel {
  return Math.max(detection.observation, detection.rules, detection.language) as NecessityLevel;
}
```

### 4.3 Level Inheritance

Higher Levels inherit ALL requirements from lower Levels.

```
Level 3 ⊃ Level 2 ⊃ Level 1 ⊃ Level 0
```

---

## 5. Level State Extensions

### 5.1 Base Necessity State

```typescript
import { z } from 'zod';

const NecessityBaseSchema = z.object({
  level: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  levelDetection: z.object({
    observation: z.union([z.literal(0), z.literal(1)]),
    rules: z.union([z.literal(0), z.literal(2)]),
    language: z.union([z.literal(0), z.literal(3)]),
    detectedAt: z.number(),
  }),
  llmTrace: z.array(z.object({
    step: z.number(),
    role: z.enum(['none', 'fact_proposer', 'belief_proposer', 'rule_interpreter', 'intent_parser']),
    proposalId: z.string().optional(),
    verified: z.boolean(),
    verificationMethod: z.enum(['deterministic', 'posterior_consistency', 'semantic_audit', 'user_confirmation']),
  })).default([]),
});
```

### 5.2 Level 1: BeliefState

```typescript
const HypothesisSchema = z.object({
  id: z.string(),
  hiddenState: z.record(z.unknown()),
  confidence: z.number().min(0).max(1),
  supportingObservations: z.array(z.string()),
  refutingConditions: z.array(z.object({
    observation: z.string(),
    reason: z.string(),
  })),
});

const BeliefStateSchema = z.object({
  hypotheses: z.array(HypothesisSchema).default([]),
  observations: z.array(z.object({
    id: z.string(),
    content: z.unknown(),
    observedAt: z.number(),
  })).default([]),
  beliefUpdatedAt: z.number().nullable().default(null),
});

const Level1Schema = NecessityBaseSchema.extend({
  belief: BeliefStateSchema,
});
```

### 5.3 Level 2: InterpretedRuleState

```typescript
const AssumptionSchema = z.object({
  id: z.string(),
  description: z.string(),
  impact: z.enum(['critical', 'moderate', 'minor']),
  alternative: z.string().nullable(),
});

const ValidationStatusSchema = z.discriminatedUnion('validated', [
  z.object({ validated: z.literal(false), reason: z.literal('pending') }),
  z.object({ validated: z.literal(true), by: z.literal('human'), at: z.number(), validator: z.string() }),
  z.object({ validated: z.literal(true), by: z.literal('assumed'), at: z.number(), flagged: z.literal(true) }),
]);

const InterpretedRuleSchema = z.object({
  originalGoal: z.string(),
  formalizedGoal: z.unknown(),
  inferredConstraints: z.array(z.unknown()).default([]),
  assumptions: z.array(AssumptionSchema).default([]),
  confidence: z.enum(['high', 'medium', 'low']),
  clarifyingQuestions: z.array(z.string()).default([]),
  validation: ValidationStatusSchema,
});

const Level2Schema = Level1Schema.extend({
  interpretedRule: InterpretedRuleSchema.nullable().default(null),
});
```

### 5.4 Level 3: GroundingState

```typescript
const ReferenceResolutionSchema = z.object({
  span: z.string(),
  resolvedTo: z.unknown(),
  method: z.enum(['context', 'default', 'user_confirmed', 'inferred']),
  confidence: z.number().min(0).max(1),
});

const AmbiguitySchema = z.object({
  span: z.string(),
  interpretations: z.array(z.unknown()),
  resolved: z.unknown().nullable(),
  resolutionMethod: z.enum(['context', 'default', 'user_confirmed', 'unresolved']),
});

const ConfirmationStatusSchema = z.discriminatedUnion('required', [
  z.object({ required: z.literal(false) }),
  z.object({
    required: z.literal(true),
    level: z.enum(['passive', 'active', 'critical']),
    status: z.enum(['pending', 'confirmed', 'rejected']),
  }),
]);

const GroundingStateSchema = z.object({
  originalUtterance: z.string(),
  parsedIntent: z.unknown(),
  referenceResolutions: z.array(ReferenceResolutionSchema).default([]),
  ambiguities: z.array(AmbiguitySchema).default([]),
  confirmation: ConfirmationStatusSchema,
});

const Level3Schema = Level2Schema.extend({
  grounding: GroundingStateSchema.nullable().default(null),
});
```

---

## 6. LLM Governance Model

### 6.1 LLM as Actor

```typescript
type LLMRole = 'none' | 'fact_proposer' | 'belief_proposer' | 'rule_interpreter' | 'intent_parser';

type LLMActorMeta = {
  readonly model: string;
  readonly role: LLMRole;
  readonly level: NecessityLevel;
  readonly capabilities: readonly string[];
};

world.registerActor({
  actorId: 'llm-gpt4',
  kind: 'agent',
  name: 'GPT-4 Belief Proposer',
  meta: {
    model: 'gpt-4-turbo',
    role: 'belief_proposer',
    level: 1,
    capabilities: ['hypothesize_hidden_state', 'estimate_probability'],
  } satisfies LLMActorMeta,
});
```

### 6.2 Proposal-Only Rule

| Action | Allowed? |
|--------|----------|
| Submit outputs as Proposals | ✅ MUST |
| Directly mutate state | ❌ MUST NOT |
| Act as Authority | ❌ MUST NOT |
| Bypass verification | ❌ MUST NOT |
| Verify own outputs | ❌ MUST NOT |

### 6.3 LLM Proposal Intent Types

```typescript
type LLMProposalIntentType =
  | 'llm.propose_fact'
  | 'llm.propose_belief'
  | 'llm.propose_interpretation'
  | 'llm.propose_grounding';
```

---

## 7. Authority by Level

### 7.1 Verification by Level

| Level | Method | Guarantee | Can Prove Correct? | Can Prove Incorrect? |
|-------|--------|-----------|-------------------|---------------------|
| 0 | `deterministic` | `certain` | ✅ Yes | ✅ Yes |
| 1 | `posterior_consistency` | `consistent` | ❌ No | ✅ Yes |
| 2 | `semantic_audit` | `plausible` | ❌ No | ⚠️ Partially |
| 3 | `user_confirmation` | `confirmed` | ❌ No | ⚠️ Partially |

### 7.2 Authority Handler Interface

```typescript
type VerificationMethod = 'deterministic' | 'posterior_consistency' | 'semantic_audit' | 'user_confirmation';
type VerificationGuarantee = 'certain' | 'consistent' | 'plausible' | 'confirmed';

interface LevelAuthorityHandler extends AuthorityHandler {
  readonly level: NecessityLevel;
  readonly verificationMethod: VerificationMethod;
  readonly guarantee: VerificationGuarantee;
}
```

### 7.3 Authority Factory

```typescript
function createLevelAuthority(
  level: NecessityLevel,
  options?: { hitlController?: HITLController }
): LevelAuthorityHandler;
```

---

## 8. Lab Architecture

### 8.1 Lab Definition

The **Lab** is a World wrapper that:

- Observes World events via `subscribe()`
- Records structured traces
- Provides real-time projection
- Enables HITL intervention
- Produces explainable reports

### 8.2 Primary API: `withLab`

```typescript
import { createManifestoWorld } from '@manifesto-ai/world';
import { withLab } from '@manifesto-ai/necessity-lab';

// 1. Create base World
const world = createManifestoWorld({ schemaHash, host });

// 2. Wrap with Lab
const labWorld = withLab(world, {
  runId: 'exp-2024-001',
  necessityLevel: 1,
  outputPath: './traces',
  projection: {
    enabled: true,
    mode: 'interactive',
  },
  hitl: {
    enabled: true,
    timeout: 300000,
  },
});

// 3. Use labWorld (same interface as world + lab extensions)
await labWorld.submitProposal({ ... });

// 4. Get results
const trace = labWorld.trace();
const report = labWorld.report();
```

### 8.3 `withLab` Signature

```typescript
function withLab(world: ManifestoWorld, options: LabOptions): LabWorld;
```

### 8.4 Lab Options

```typescript
type LabOptions = {
  /** Unique run identifier */
  runId: string;
  
  /** Expected necessity level */
  necessityLevel: NecessityLevel;
  
  /** Trace output directory */
  outputPath: string;
  
  /** Trace format */
  traceFormat?: 'json' | 'jsonl' | 'json.gz';
  
  /** Projection configuration */
  projection?: ProjectionOptions;
  
  /** HITL configuration */
  hitl?: HITLOptions;
  
  /** Environment metadata */
  environment?: Record<string, unknown>;
};
```

### 8.5 LabWorld Interface

```typescript
interface LabWorld extends ManifestoWorld {
  /** Lab metadata */
  readonly labMeta: {
    runId: string;
    necessityLevel: NecessityLevel;
    startedAt: number;
  };
  
  /** Current experiment state */
  readonly state: LabState;
  
  /** HITL controller */
  readonly hitl: HITLController;
  
  /** Projection controller */
  readonly projection: ProjectionController;
  
  /** Get current trace */
  trace(): LabTrace;
  
  /** Generate report */
  report(): LabReport;
  
  /** Subscribe to lab-specific events */
  onLabEvent(handler: LabEventHandler): Unsubscribe;
}

type LabState = 
  | { status: 'running'; currentStep: number; pendingHITL: Proposal[] }
  | { status: 'waiting_hitl'; proposal: Proposal; waitingSince: number }
  | { status: 'completed'; outcome: 'success' | 'failure' }
  | { status: 'aborted'; reason: string };
```

### 8.6 Lab Constraints

| Constraint | Description |
|------------|-------------|
| Observation-Only | Lab MUST NOT modify World state through observation |
| Trace Completeness | Lab MUST record all World events |
| HITL via Authority | HITL decisions go through Authority, not direct modification |
| Non-Interference | Projection MUST NOT affect execution timing |
| Deterministic Replay | Trace MUST suffice for replay |

---

## 9. Lab Projection

### 9.1 Projection Options

```typescript
type ProjectionOptions = {
  enabled: boolean;
  mode: ProjectionMode;
  theme?: 'default' | 'minimal' | 'verbose' | 'debug';
  components?: ProjectionComponents;
};

type ProjectionMode =
  | 'silent'      // No output, trace only
  | 'watch'       // Read-only progress view
  | 'interactive' // Progress + HITL intervention
  | 'debug';      // Full detail including snapshots
```

### 9.2 Projection Mode Capabilities

| Mode | Progress | Proposals | HITL | Snapshots | LLM Calls |
|------|----------|-----------|------|-----------|-----------|
| `silent` | ❌ | ❌ | ❌ | ❌ | ❌ |
| `watch` | ✅ | ✅ | View only | ❌ | Summary |
| `interactive` | ✅ | ✅ | ✅ Interact | Optional | Detail |
| `debug` | ✅ | ✅ | ✅ Interact | ✅ Full | ✅ Full |

### 9.3 Projection Controller

```typescript
interface ProjectionController {
  readonly mode: ProjectionMode;
  setMode(mode: ProjectionMode): void;
  toggleView(view: ProjectionView): void;
  pause(): void;
  resume(): void;
  refresh(): void;
}
```

### 9.4 Projection Components (Domain Renderer)

*(Added in v1.1)*

Lab is domain-agnostic, but experiments often need domain-specific visualization. **Projection Components** allow injection of custom renderers.

```typescript
type ProjectionComponents = {
  /** 
   * Render domain-specific snapshot visualization.
   * Called on every snapshot:changed event.
   */
  renderSnapshot?: SnapshotRenderer;
  
  /**
   * Render action/intent in domain-specific way.
   * Called after execution:completed.
   */
  renderAction?: ActionRenderer;
  
  /**
   * Render proposal before decision.
   * Called on proposal:submitted.
   */
  renderProposal?: ProposalRenderer;
  
  /**
   * Render agent reasoning (LLM output).
   * Called when LLM proposal includes reasoning.
   */
  renderReasoning?: ReasoningRenderer;
  
  /**
   * Custom header component.
   */
  header?: HeaderRenderer;
  
  /**
   * Custom footer component.
   */
  footer?: FooterRenderer;
  
  /**
   * Custom layout (replaces default entirely).
   */
  layout?: LayoutRenderer;
};
```

### 9.5 Renderer Types

```typescript
type SnapshotRenderer = (
  snapshot: Snapshot,
  context: RenderContext
) => string | ReactNode;

type ActionRenderer = (
  intent: Intent,
  before: Snapshot,
  after: Snapshot,
  context: RenderContext
) => string | ReactNode;

type ProposalRenderer = (
  proposal: Proposal,
  context: RenderContext
) => string | ReactNode;

type ReasoningRenderer = (
  reasoning: string,
  confidence: number,
  context: RenderContext
) => string | ReactNode;

type HeaderRenderer = (context: RenderContext) => string | ReactNode;
type FooterRenderer = (context: RenderContext) => string | ReactNode;
type LayoutRenderer = (sections: LayoutSections, context: RenderContext) => ReactNode;
```

### 9.6 Render Context

```typescript
type RenderContext = {
  /** Current step number */
  step: number;
  
  /** Total steps (if known, otherwise Infinity) */
  totalSteps: number;
  
  /** Run identifier */
  runId: string;
  
  /** Necessity level */
  level: NecessityLevel;
  
  /** Current lab state */
  state: LabState;
  
  /** Time elapsed in ms */
  elapsedMs: number;
  
  /** Latest events */
  recentEvents: LabTraceEvent[];
  
  /** Projection mode */
  mode: ProjectionMode;
};
```

### 9.7 Layout Sections

```typescript
type LayoutSections = {
  /** Header section (from header renderer or default) */
  header: ReactNode;
  
  /** Domain visualization (from renderSnapshot) */
  domain: ReactNode;
  
  /** Action/event log */
  actions: ReactNode;
  
  /** LLM reasoning panel */
  reasoning: ReactNode;
  
  /** HITL panel (if waiting) */
  hitl: ReactNode;
  
  /** Footer section */
  footer: ReactNode;
};
```

### 9.8 Default Layout

When no custom `layout` is provided, Lab uses a default terminal layout:

```
┌─────────────────────────────────────────────────────────────────┐
│  {header}                                                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                 │
│  {domain}                                                       │
│  (renderSnapshot output, or "No domain renderer" if absent)     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  {actions}                                                      │
│  (renderAction output, or default event log)                    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  {reasoning}                                                    │
│  (renderReasoning output, if LLM actor)                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  {hitl}                                                         │
│  (HITL panel, only shown when waiting for human)                │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  {footer}                                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 9.9 Example: BabyBench Renderer

```typescript
import { withLab } from '@manifesto-ai/necessity-lab';
import chalk from 'chalk';

const labWorld = withLab(world, {
  runId: 'baby-001',
  necessityLevel: 1,
  outputPath: './traces',
  projection: {
    enabled: true,
    mode: 'watch',
    components: {
      header: (ctx) => 
        `🎮 BabyBench Level ${ctx.level}  |  Turn: ${ctx.step}  |  ${formatTime(ctx.elapsedMs)}`,
      
      renderSnapshot: (snapshot, ctx) => {
        const { board, agent, goal, score } = snapshot;
        let output = '';
        
        for (let y = 0; y < board.height; y++) {
          for (let x = 0; x < board.width; x++) {
            if (agent.x === x && agent.y === y) {
              output += chalk.green('🤖');
            } else if (goal.x === x && goal.y === y) {
              output += chalk.yellow('★ ');
            } else if (board.walls[y][x]) {
              output += chalk.gray('▓▓');
            } else {
              output += '  ';
            }
          }
          output += '\n';
        }
        
        output += `\nAgent: (${agent.x},${agent.y})  Goal: (${goal.x},${goal.y})  Score: ${score}`;
        return output;
      },
      
      renderAction: (intent, before, after, ctx) => {
        const dir = intent.body.direction;
        const moved = `(${before.agent.x},${before.agent.y}) → (${after.agent.x},${after.agent.y})`;
        return `Action: ${chalk.cyan(dir.toUpperCase())}  ${moved}`;
      },
      
      renderReasoning: (reasoning, confidence, ctx) => {
        return [
          chalk.dim('Agent Reasoning:'),
          `"${reasoning}"`,
          '',
          `Confidence: ${(confidence * 100).toFixed(0)}%`,
        ].join('\n');
      },
    },
  },
});
```

**Output:**

```
┌─────────────────────────────────────────────────────────────────┐
│  🎮 BabyBench Level 1  |  Turn: 12  |  00:02:34                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                 │
│    ▓▓      ★                                                   │
│      ▓▓                                                         │
│  🤖    ▓▓                                                       │
│                                                                 │
│    ▓▓                                                           │
│                                                                 │
│  Agent: (0,2)  Goal: (4,0)  Score: 150                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Action: RIGHT  (0,1) → (0,2)                                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Agent Reasoning:                                               │
│  "I see an obstacle at (1,2). Moving right to avoid it.        │
│   Goal is at (4,0), so I'll need to go up after this."         │
│                                                                 │
│  Confidence: 85%                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9.10 Projection Component Constraints

| Constraint | Description |
|------------|-------------|
| PC-C1 | Renderers MUST be pure functions (no side effects) |
| PC-C2 | Renderers MUST return quickly (< 16ms for 60fps) |
| PC-C3 | Renderers MUST NOT modify snapshot or context |
| PC-C4 | Renderers MAY return string (terminal) or ReactNode (Ink) |
| PC-C5 | Missing renderers fall back to default or empty |

---

## 10. HITL Intervention

### 10.1 HITL Options

```typescript
type HITLOptions = {
  enabled: boolean;
  timeout?: number;
  onTimeout?: 'reject' | 'approve' | 'abort';
  autoApprove?: AutoApproveCondition[];
  onPending?: (proposal: Proposal, context: HITLContext) => void | Promise<void>;
};
```

### 10.2 HITL Controller

```typescript
interface HITLController {
  readonly pending: Proposal[];
  readonly isWaiting: boolean;
  
  approve(proposalId: string, options?: ApproveOptions): Promise<void>;
  reject(proposalId: string, reason: string): Promise<void>;
  retry(proposalId: string, additionalReasoning?: string): Promise<void>;
  requestInfo(proposalId: string, question: string): Promise<unknown>;
  approveWithModification(proposalId: string, modifications: ProposalModification): Promise<void>;
  delegate(proposalId: string, authorityId: string): Promise<void>;
  
  onPending(handler: (proposal: Proposal) => void): Unsubscribe;
}
```

### 10.3 HITL Context

*(Added in v1.1)*

`HITLContext` provides structured information about why a proposal is pending and what actions are available.

```typescript
type HITLContext = {
  /** Current snapshot at time of pending */
  snapshot: Snapshot;
  
  /** The pending proposal */
  proposal: Proposal;
  
  /** Why this proposal is pending */
  pendingReason: PendingReason;
  
  /** Available actions for resolution */
  availableActions: HITLAction[];
  
  /** Render context (reused from Projection) */
  renderContext: RenderContext;
  
  /** Decision record from Authority */
  decisionRecord: DecisionRecord;
  
  /** Generate structured prompt for agent */
  toPrompt(options?: HITLPromptOptions): HITLPrompt;
};
```

### 10.4 Pending Reason

*(Added in v1.1)*

`PendingReason` explains why Authority returned `pending` instead of `approved` or `rejected`.

```typescript
type PendingReason = {
  /** Reason code */
  code: PendingReasonCode;
  
  /** Human-readable description */
  description: string;
  
  /** Structured details (code-specific) */
  details: PendingReasonDetails;
  
  /** Suggestions for resolution */
  suggestions?: string[];
};

type PendingReasonCode =
  | 'LOW_CONFIDENCE'        // Confidence below threshold
  | 'AMBIGUOUS_INTENT'      // Multiple interpretations possible
  | 'REQUIRES_CONFIRMATION' // Policy requires human confirmation
  | 'SCOPE_EXCEEDED'        // Action exceeds allowed scope
  | 'RESOURCE_LIMIT';       // Would exceed resource limits

type PendingReasonDetails = {
  /** For LOW_CONFIDENCE */
  confidence?: { actual: number; required: number };
  
  /** For AMBIGUOUS_INTENT */
  ambiguity?: { interpretations: unknown[]; question: string };
  
  /** For REQUIRES_CONFIRMATION */
  confirmation?: { policy: string; risk: 'low' | 'medium' | 'high' };
  
  /** For SCOPE_EXCEEDED */
  scope?: { requested: string[]; allowed: string[] };
  
  /** For RESOURCE_LIMIT */
  resource?: { type: string; requested: number; limit: number };
};
```

### 10.5 HITL Actions

*(Added in v1.1)*

`HITLAction` defines available resolution options for a pending proposal.

```typescript
type HITLAction =
  | { 
      type: 'retry'; 
      description: string;
      /** Hint: what additional info would help */
      hint?: string;
    }
  | { 
      type: 'modify'; 
      description: string;
      /** Which parts can be modified */
      allowedModifications: string[];
    }
  | { 
      type: 'request_info'; 
      description: string;
      /** Suggested questions */
      suggestedQuestions: string[];
    }
  | { 
      type: 'escalate'; 
      description: string;
      /** Escalation target */
      to: string;
    }
  | { 
      type: 'abort'; 
      description: string;
    };
```

### 10.6 HITL Prompt Builder

*(Added in v1.1)*

`HITLPrompt` provides a structured prompt that can be sent to an Agent (LLM) for autonomous HITL resolution.

```typescript
type HITLPromptOptions = {
  /** Use domain renderer for state visualization (reuses SnapshotRenderer) */
  stateRenderer?: SnapshotRenderer;
  
  /** Include available actions in prompt */
  includeActions?: boolean;
  
  /** Response format specification */
  responseFormat?: 'json' | 'text';
  
  /** Include response schema for structured output */
  includeSchema?: boolean;
};

type HITLPrompt = {
  /** Situation description */
  situation: string;
  
  /** Current state (rendered by stateRenderer if provided) */
  currentState: string;
  
  /** The proposal that was submitted */
  yourProposal: {
    intentType: string;
    content: unknown;
  };
  
  /** Why it's pending */
  whyPending: {
    reason: PendingReasonCode;
    description: string;
    details: PendingReasonDetails;
  };
  
  /** Available options */
  options: {
    id: string;
    type: HITLAction['type'];
    description: string;
    example?: string;
  }[];
  
  /** Expected response format */
  responseFormat?: {
    type: 'json';
    schema: unknown;
  };
};
```

### 10.7 HITL Prompt Usage Example

```typescript
const labWorld = withLab(world, {
  runId: 'exp-001',
  projection: {
    enabled: true,
    components: {
      renderSnapshot: myDomainRenderer,
    },
  },
  hitl: {
    enabled: true,
    onPending: async (proposal, context) => {
      // Generate structured prompt using domain renderer
      const prompt = context.toPrompt({
        stateRenderer: myDomainRenderer,
        includeActions: true,
        responseFormat: 'json',
        includeSchema: true,
      });
      
      /*
      prompt = {
        situation: "Your proposed action is pending review.",
        
        currentState: "
          ┌───┬───┬───┐
          │🤖│ ▓ │ ★ │
          └───┴───┴───┘
          Agent: (0,0)  Goal: (2,0)
        ",
        
        yourProposal: {
          intentType: "agent.move",
          content: { direction: "RIGHT" }
        },
        
        whyPending: {
          reason: "LOW_CONFIDENCE",
          description: "Confidence below threshold",
          details: { 
            confidence: { actual: 0.45, required: 0.70 } 
          }
        },
        
        options: [
          { id: "retry", type: "retry", description: "Retry with more reasoning" },
          { id: "modify", type: "modify", description: "Choose different action" },
          { id: "abort", type: "abort", description: "Give up" }
        ],
        
        responseFormat: {
          type: "json",
          schema: HITLResponseSchema
        }
      }
      */
      
      // Send to agent and handle response
      const response = await agent.handleHITL(prompt);
      
      switch (response.action) {
        case 'retry':
          await context.retry(response.reasoning);
          break;
        case 'modify':
          await context.modify(response.newIntent);
          break;
        case 'abort':
          await context.abort(response.reason);
          break;
      }
    },
  },
});
```

### 10.8 PendingReason vs FailureReason

| Aspect | PendingReason | FailureReason |
|--------|---------------|---------------|
| **When** | Before final decision | After final rejection |
| **Purpose** | Enable retry/modification | Explain failure |
| **Recoverable** | Yes | No |
| **Used by** | HITL prompt to Agent | Failure Explanation to User |

```
Proposal ──► Authority
                │
                ├── approved ──► execute
                │
                ├── pending (PendingReason) ──► HITL ──► retry/modify
                │                                           │
                │                                           ▼
                │                                    new Proposal
                │
                └── rejected ──► FailureReason ──► Explanation
```

---

## 11. Lab Trace Artifact

### 11.1 Trace Requirement

Every Lab run MUST produce exactly one **Lab Trace Artifact**.

### 11.2 Trace Structure

```typescript
type LabTrace = {
  readonly header: LabTraceHeader;
  readonly events: readonly LabTraceEvent[];
  readonly outcome: 'success' | 'failure' | 'aborted';
  readonly failureExplanation?: FailureExplanation;
};

type LabTraceHeader = {
  specVersion: 'lab/1.1';
  runId: string;
  necessityLevel: NecessityLevel;
  schemaHash: string;
  createdAt: string;
  completedAt?: string;
  durationMs?: number;
  environment?: Record<string, unknown>;
};
```

### 11.3 Trace Event Types

```typescript
type LabTraceEvent =
  | ProposalTraceEvent
  | AuthorityDecisionTraceEvent
  | ApplyTraceEvent
  | EffectTraceEvent
  | HITLTraceEvent
  | TerminationTraceEvent
  | WorldCreatedTraceEvent
  | FailureExplanationTraceEvent;
```

---

## 12. Failure Explainability Model

### 12.1 Failure Reasons

```typescript
type FailureReason =
  | 'NO_EXECUTABLE_ACTION'
  | 'GOAL_UNREACHABLE'
  | 'AUTHORITY_REJECTION'
  | 'UNRESOLVED_AMBIGUITY'
  | 'HUMAN_REQUIRED'
  | 'TIMEOUT'
  | 'RESOURCE_EXHAUSTED';
```

### 12.2 Failure Explanation

```typescript
type FailureExplanation = {
  reason: FailureReason;
  kind: 'structural' | 'informational' | 'governance' | 'human_required' | 'resource';
  title: string;
  description: string;
  evidence: ExplanationEvidence[];
  counterfactual?: Counterfactual;
};

type Counterfactual = {
  change: CounterfactualChange;
  expectedOutcome: 'success' | 'different_failure';
  confidence: 'high' | 'medium' | 'low';
};
```

---

## 13. Trace I/O

*(Added in v1.1)*

### 13.1 Purpose

Trace I/O enables persistence and retrieval of Lab Trace Artifacts for analysis, comparison, and replay.

### 13.2 Save API

```typescript
interface LabTrace {
  /** Save trace to file */
  save(path: string): Promise<void>;
  
  /** Save with options */
  save(path: string, options: TraceSaveOptions): Promise<void>;
}

type TraceSaveOptions = {
  /** Output format (default: inferred from extension) */
  format?: 'json' | 'jsonl' | 'json.gz';
  
  /** Pretty print JSON (default: false) */
  pretty?: boolean;
  
  /** Include snapshots in trace (default: false) */
  includeSnapshots?: boolean;
};
```

### 13.3 Load API

```typescript
namespace LabTrace {
  /** Load single trace from file */
  function load(path: string): Promise<LabTrace>;
  
  /** Load multiple traces matching glob pattern */
  function loadAll(pattern: string): Promise<LabTrace[]>;
  
  /** Load multiple traces from directory */
  function loadDir(dir: string): Promise<LabTrace[]>;
}
```

### 13.4 File Formats

| Extension | Format | Description |
|-----------|--------|-------------|
| `.trace.json` | JSON | Single JSON object |
| `.trace.jsonl` | JSON Lines | One event per line (streaming) |
| `.trace.json.gz` | Gzipped JSON | Compressed single object |

### 13.5 Example Usage

```typescript
// Save after experiment
const labWorld = withLab(world, { runId: 'exp-001', ... });
await runExperiment(labWorld);
await labWorld.trace().save('./traces/exp-001.trace.json');

// Load for analysis
const trace = await LabTrace.load('./traces/exp-001.trace.json');

// Load all traces
const traces = await LabTrace.loadAll('./traces/*.trace.json');
```

### 13.6 Requirements

| ID | Requirement |
|----|-------------|
| TIO-R1 | Save MUST produce valid JSON/JSONL |
| TIO-R2 | Load MUST validate against LabTrace schema |
| TIO-R3 | Load MUST reject invalid or corrupted files |
| TIO-R4 | Format MUST be inferred from extension if not specified |

---

## 14. Trace Summary

*(Added in v1.1)*

### 14.1 Purpose

Trace Summary aggregates statistics across one or more traces for analysis and reporting.

### 14.2 API

```typescript
function summarize(traces: LabTrace | LabTrace[]): TraceSummary;

type TraceSummary = {
  /** Number of runs */
  runs: number;
  
  /** Overall success rate */
  successRate: number;
  
  /** Average steps per run */
  avgSteps: number;
  
  /** Average duration in ms */
  avgDurationMs: number;
  
  /** Breakdown by necessity level */
  byLevel: Record<NecessityLevel, LevelSummary>;
  
  /** Failure reason distribution */
  failureReasons: Record<FailureReason, number>;
  
  /** HITL statistics */
  hitl: HITLSummary;
  
  /** LLM usage statistics */
  llm: LLMSummary;
};
```

### 14.3 Level Summary

```typescript
type LevelSummary = {
  runs: number;
  successRate: number;
  avgSteps: number;
  avgDurationMs: number;
};
```

### 14.4 HITL Summary

```typescript
type HITLSummary = {
  /** Total HITL triggers */
  triggered: number;
  
  /** Approved by human */
  approved: number;
  
  /** Rejected by human */
  rejected: number;
  
  /** Timed out */
  timedOut: number;
  
  /** Average decision time in ms */
  avgDecisionTimeMs: number;
  
  /** HITL rate (triggered / total proposals) */
  hitlRate: number;
};
```

### 14.5 LLM Summary

```typescript
type LLMSummary = {
  /** Total LLM proposals */
  totalProposals: number;
  
  /** Proposals approved */
  approved: number;
  
  /** Proposals rejected */
  rejected: number;
  
  /** Approval rate */
  approvalRate: number;
  
  /** Breakdown by role */
  byRole: Record<LLMRole, {
    proposals: number;
    approved: number;
    rejected: number;
  }>;
};
```

### 14.6 Example Usage

```typescript
const traces = await LabTrace.loadAll('./traces/*.trace.json');
const summary = summarize(traces);

console.log(`Runs: ${summary.runs}`);
console.log(`Success Rate: ${(summary.successRate * 100).toFixed(1)}%`);
console.log(`HITL Rate: ${(summary.hitl.hitlRate * 100).toFixed(1)}%`);

// By level
for (const [level, stats] of Object.entries(summary.byLevel)) {
  console.log(`Level ${level}: ${stats.runs} runs, ${(stats.successRate * 100).toFixed(1)}% success`);
}

// Failure analysis
for (const [reason, count] of Object.entries(summary.failureReasons)) {
  console.log(`${reason}: ${count} failures`);
}
```

---

## 15. Trace Diff

*(Added in v1.1)*

### 15.1 Purpose

Trace Diff compares two traces to identify divergence points and causal differences.

### 15.2 API

```typescript
function diffTraces(traceA: LabTrace, traceB: LabTrace): TraceDiff;

type TraceDiff = {
  /** Whether traces are identical */
  identical: boolean;
  
  /** Event sequence where traces diverge (null if identical) */
  divergedAtSeq: number | null;
  
  /** Event in trace A at divergence point */
  eventA: LabTraceEvent | null;
  
  /** Event in trace B at divergence point */
  eventB: LabTraceEvent | null;
  
  /** Inferred cause of divergence */
  cause: DivergenceCause | null;
  
  /** Outcome comparison */
  outcomes: {
    a: 'success' | 'failure' | 'aborted';
    b: 'success' | 'failure' | 'aborted';
  };
  
  /** Detailed event-by-event comparison */
  eventDiffs: EventDiff[];
};
```

### 15.3 Divergence Cause

```typescript
type DivergenceCause = {
  type: DivergenceType;
  description: string;
  details: Record<string, unknown>;
};

type DivergenceType =
  | 'authority_decision'    // Same proposal, different decision
  | 'proposal_content'      // Different proposal content
  | 'execution_result'      // Same intent, different execution result
  | 'effect_result'         // Same effect, different result
  | 'hitl_decision'         // Different HITL decision
  | 'timing'                // Same events, different timing (non-causal)
  | 'unknown';              // Cannot determine cause
```

### 15.4 Event Diff

```typescript
type EventDiff = {
  seq: number;
  status: 'identical' | 'different' | 'only_a' | 'only_b';
  eventA?: LabTraceEvent;
  eventB?: LabTraceEvent;
  differences?: string[];
};
```

### 15.5 Example Usage

```typescript
const successTrace = await LabTrace.load('./traces/success.trace.json');
const failTrace = await LabTrace.load('./traces/fail.trace.json');

const diff = diffTraces(successTrace, failTrace);

if (!diff.identical) {
  console.log(`Diverged at event ${diff.divergedAtSeq}`);
  console.log(`Cause: ${diff.cause?.type}`);
  console.log(`Description: ${diff.cause?.description}`);
  
  console.log('\nTrace A event:');
  console.log(diff.eventA);
  
  console.log('\nTrace B event:');
  console.log(diff.eventB);
}
```

### 15.6 Use Cases

| Use Case | Description |
|----------|-------------|
| Model Comparison | "Why did GPT-4 succeed but Claude fail?" |
| Regression Analysis | "Why did this test pass before but fail now?" |
| HITL Impact | "How did human intervention change the outcome?" |
| Parameter Sensitivity | "How does threshold X affect results?" |

---

## 16. Trace Report

*(Added in v1.1)*

### 16.1 Purpose

Trace Report generates human-readable reports from trace data.

### 16.2 API

```typescript
interface LabTrace {
  /** Generate report */
  report(): LabReport;
}

interface LabReport {
  /** Render to Markdown */
  toMarkdown(): string;
  
  /** Save Markdown to file */
  toMarkdown(path: string): Promise<void>;
  
  /** Render to HTML */
  toHTML(): string;
  
  /** Save HTML to file */
  toHTML(path: string): Promise<void>;
  
  /** Render to JSON (structured) */
  toJSON(): ReportJSON;
}
```

### 16.3 Report Structure

```typescript
type ReportJSON = {
  meta: {
    runId: string;
    level: NecessityLevel;
    outcome: 'success' | 'failure' | 'aborted';
    duration: string;
    createdAt: string;
  };
  
  summary: {
    totalSteps: number;
    proposals: number;
    approvals: number;
    rejections: number;
    hitlInterventions: number;
  };
  
  failure?: {
    reason: FailureReason;
    explanation: string;
    counterfactual?: string;
  };
  
  timeline: TimelineEntry[];
};

type TimelineEntry = {
  seq: number;
  timestamp: string;
  event: string;
  actor?: string;
  result?: string;
  note?: string;
};
```

### 16.4 Markdown Template

```markdown
# Experiment: {runId}

## Overview
- **Level:** {level} ({levelName})
- **Outcome:** {outcome}
- **Duration:** {duration}
- **Date:** {createdAt}

## Summary
| Metric | Value |
|--------|-------|
| Total Steps | {totalSteps} |
| Proposals | {proposals} |
| Approvals | {approvals} |
| Rejections | {rejections} |
| HITL Interventions | {hitlInterventions} |

## Failure Analysis
*(Only if outcome = failure)*

**Reason:** {failureReason}

**Explanation:** {explanation}

**Counterfactual:** {counterfactual}

## Timeline
| Step | Event | Actor | Result |
|------|-------|-------|--------|
| 1 | proposal:submitted | llm-gpt4 | - |
| 2 | proposal:decided | authority-l2 | approved |
| ... | ... | ... | ... |
```

### 16.5 Example Usage

```typescript
const trace = await LabTrace.load('./traces/exp-001.trace.json');
const report = trace.report();

// To console
console.log(report.toMarkdown());

// To file
await report.toMarkdown('./reports/exp-001.md');

// Batch reports
const traces = await LabTrace.loadAll('./traces/*.trace.json');
for (const t of traces) {
  await t.report().toMarkdown(`./reports/${t.header.runId}.md`);
}
```

---

## 17. Trace Replay

*(Added in v1.1)*

### 17.1 Purpose

Trace Replay re-executes a trace's inputs against a (potentially different) World to compare behavior.

### 17.2 API

```typescript
function replay(
  trace: LabTrace,
  options: ReplayOptions
): Promise<ReplayResult>;

type ReplayOptions = {
  /** World to replay against */
  world: ManifestoWorld;
  
  /** Stop at specific event sequence */
  stopAtSeq?: number;
  
  /** Stop at specific event type */
  stopAtEvent?: LabTraceEventType;
  
  /** Override actor for proposals */
  actorOverride?: string;
  
  /** Replay mode */
  mode?: ReplayMode;
};

type ReplayMode =
  | 'strict'    // Fail if any divergence
  | 'lenient'   // Continue despite divergence
  | 'compare';  // Record divergences, don't fail
```

### 17.3 Replay Result

```typescript
type ReplayResult = {
  /** Resulting trace from replay */
  trace: LabTrace;
  
  /** Whether replay completed without divergence */
  success: boolean;
  
  /** Comparison with original */
  diff: TraceDiff;
  
  /** Divergences encountered (in compare mode) */
  divergences: Divergence[];
  
  /** Events replayed */
  eventsReplayed: number;
  
  /** Events remaining (if stopped early) */
  eventsRemaining: number;
};

type Divergence = {
  seq: number;
  originalEvent: LabTraceEvent;
  replayEvent: LabTraceEvent;
  cause: DivergenceCause;
};
```

### 17.4 Example Usage

```typescript
// Load original trace
const originalTrace = await LabTrace.load('./traces/gpt4-run.trace.json');

// Create world with different model
const claudeWorld = createManifestoWorld({ ... });
claudeWorld.registerActor({
  actorId: 'llm-claude',
  kind: 'agent',
  meta: { model: 'claude-3-opus' },
});

// Replay with different model
const result = await replay(originalTrace, {
  world: withLab(claudeWorld, { runId: 'replay-001', ... }),
  actorOverride: 'llm-claude',
  mode: 'compare',
});

// Analyze differences
if (!result.success) {
  console.log('Divergences:');
  for (const d of result.divergences) {
    console.log(`  Seq ${d.seq}: ${d.cause.description}`);
  }
}

// Compare outcomes
console.log(`Original: ${originalTrace.outcome}`);
console.log(`Replay: ${result.trace.outcome}`);
```

### 17.5 Use Cases

| Use Case | Description |
|----------|-------------|
| Model A/B Testing | Same scenario, different models |
| Regression Testing | Same model, different versions |
| Parameter Tuning | Same run, different authority thresholds |
| Debugging | Step through execution to find issue |

### 17.6 Requirements

| ID | Requirement |
|----|-------------|
| REP-R1 | Replay MUST use original proposal content |
| REP-R2 | Replay MUST preserve event ordering |
| REP-R3 | Replay MUST record all divergences in compare mode |
| REP-R4 | Replay MUST stop at specified breakpoint |
| REP-R5 | Actor override MUST apply to all proposals |

---

## 18. Builder Integration

### 18.1 Domain Extension

```typescript
import { defineDomain } from '@manifesto-ai/builder';
import { Level1Schema } from '@manifesto-ai/necessity-lab';

const Level1Domain = defineDomain(
  MyDomainSchema.merge(Level1Schema),
  ({ state, computed, actions }) => {
    // Domain definition with belief state
  }
);
```

---

## 19. World Integration

### 19.1 Complete Example

```typescript
import { createManifestoWorld } from '@manifesto-ai/world';
import { withLab, createLevelAuthority, LabTrace, summarize, diffTraces, replay } from '@manifesto-ai/necessity-lab';

// 1. Create World
const world = createManifestoWorld({ schemaHash: schema.hash, host });

// 2. Wrap with Lab
const labWorld = withLab(world, {
  runId: 'exp-2024-001',
  necessityLevel: 2,
  outputPath: './traces',
  projection: { enabled: true, mode: 'interactive' },
  hitl: { enabled: true, timeout: 300000, onTimeout: 'reject' },
});

// 3. Register LLM Actor
labWorld.registerActor({
  actorId: 'llm-level-2',
  kind: 'agent',
  meta: { level: 2, role: 'rule_interpreter' },
});

// 4. Bind Level Authority
labWorld.bindAuthority(
  'llm-level-2',
  'authority-level-2',
  createLevelAuthority(2, { hitlController: labWorld.hitl })
);

// 5. Execute
await labWorld.submitProposal({
  actorId: 'llm-level-2',
  intent: { type: 'llm.propose_interpretation', input: { /* ... */ } },
});

// 6. Save trace
await labWorld.trace().save('./traces/exp-2024-001.trace.json');

// 7. Generate report
await labWorld.trace().report().toMarkdown('./reports/exp-2024-001.md');

// 8. Analyze multiple runs
const traces = await LabTrace.loadAll('./traces/*.trace.json');
const summary = summarize(traces);
console.log(summary);

// 9. Compare runs
const diff = diffTraces(traces[0], traces[1]);
console.log(diff);
```

---

## 20. Conformance Requirements

### 20.1 Implementation Conformance

| ID | Requirement |
|----|-------------|
| CR-1 | Necessity Level explicitly determined and recorded |
| CR-2 | LLMs registered as Actors with `kind: 'agent'` |
| CR-3 | LLMs governed by Level-appropriate Authority |
| CR-4 | Level 0 systems achieve equal success with NullLLM |
| CR-5 | Every run produces a Lab Trace Artifact |
| CR-6 | Failures include structured explanations |
| CR-7 | Trace alone suffices for replay |
| CR-8 | Level state extensions satisfy legality conditions |
| CR-9 | HITL events recorded when intervention occurs |
| CR-10 | Lab observes World via `subscribe()` only |
| CR-11 | Trace I/O produces valid, loadable files *(v1.1)* |
| CR-12 | Summary computes accurate statistics *(v1.1)* |
| CR-13 | Diff correctly identifies divergence point *(v1.1)* |
| CR-14 | Replay preserves original proposal content *(v1.1)* |
| CR-15 | Projection components are called with correct context *(v1.1)* |
| CR-16 | Projection components do not modify snapshot or state *(v1.1)* |
| CR-17 | HITLContext includes complete PendingReason *(v1.1)* |
| CR-18 | HITLPrompt includes all available actions *(v1.1)* |
| CR-19 | HITL toPrompt() uses injected stateRenderer if provided *(v1.1)* |

---

## 21. Forbidden Patterns

### 21.1 Universal

| ID | Pattern |
|----|---------|
| FP-1 | LLM as Decider |
| FP-2 | Traceless Execution |
| FP-3 | Unexplained Failure |
| FP-4 | Verification Bypass |
| FP-5 | Self-Verification |
| FP-6 | Protocol Bypass |
| FP-7 | Direct State Modification by Lab |

---

## 22. Explicit Non-Goals

| Non-Goal | Reason |
|----------|--------|
| LLM prompt engineering | Application concern |
| Model selection criteria | Application concern |
| Performance benchmarks | Separate spec (BabyBench) |
| Visualization UI | Implementation concern |
| Cloud storage | Implementation concern |

---

## Appendix A: Type Definitions

```typescript
// Core types
export type NecessityLevel = 0 | 1 | 2 | 3;
export type LLMRole = 'none' | 'fact_proposer' | 'belief_proposer' | 'rule_interpreter' | 'intent_parser';
export type VerificationMethod = 'deterministic' | 'posterior_consistency' | 'semantic_audit' | 'user_confirmation';
export type ProjectionMode = 'silent' | 'watch' | 'interactive' | 'debug';

// Primary API
export function withLab(world: ManifestoWorld, options: LabOptions): LabWorld;

// Trace utilities (v1.1)
export namespace LabTrace {
  export function load(path: string): Promise<LabTrace>;
  export function loadAll(pattern: string): Promise<LabTrace[]>;
  export function loadDir(dir: string): Promise<LabTrace[]>;
}
export function summarize(traces: LabTrace | LabTrace[]): TraceSummary;
export function diffTraces(a: LabTrace, b: LabTrace): TraceDiff;
export function replay(trace: LabTrace, options: ReplayOptions): Promise<ReplayResult>;

// Projection Components (v1.1)
export type ProjectionComponents = {
  renderSnapshot?: SnapshotRenderer;
  renderAction?: ActionRenderer;
  renderProposal?: ProposalRenderer;
  renderReasoning?: ReasoningRenderer;
  header?: HeaderRenderer;
  footer?: FooterRenderer;
  layout?: LayoutRenderer;
};

export type SnapshotRenderer = (snapshot: Snapshot, context: RenderContext) => string | ReactNode;
export type ActionRenderer = (intent: Intent, before: Snapshot, after: Snapshot, context: RenderContext) => string | ReactNode;
export type ProposalRenderer = (proposal: Proposal, context: RenderContext) => string | ReactNode;
export type ReasoningRenderer = (reasoning: string, confidence: number, context: RenderContext) => string | ReactNode;
export type RenderContext = {
  step: number;
  totalSteps: number;
  runId: string;
  level: NecessityLevel;
  state: LabState;
  elapsedMs: number;
  recentEvents: LabTraceEvent[];
  mode: ProjectionMode;
};

// HITL Types (v1.1)
export type HITLContext = {
  snapshot: Snapshot;
  proposal: Proposal;
  pendingReason: PendingReason;
  availableActions: HITLAction[];
  renderContext: RenderContext;
  decisionRecord: DecisionRecord;
  toPrompt(options?: HITLPromptOptions): HITLPrompt;
};

export type PendingReasonCode = 
  | 'LOW_CONFIDENCE' 
  | 'AMBIGUOUS_INTENT' 
  | 'REQUIRES_CONFIRMATION' 
  | 'SCOPE_EXCEEDED' 
  | 'RESOURCE_LIMIT';

export type PendingReason = {
  code: PendingReasonCode;
  description: string;
  details: PendingReasonDetails;
  suggestions?: string[];
};

export type HITLAction =
  | { type: 'retry'; description: string; hint?: string }
  | { type: 'modify'; description: string; allowedModifications: string[] }
  | { type: 'request_info'; description: string; suggestedQuestions: string[] }
  | { type: 'escalate'; description: string; to: string }
  | { type: 'abort'; description: string };

export type HITLPrompt = {
  situation: string;
  currentState: string;
  yourProposal: { intentType: string; content: unknown };
  whyPending: { reason: PendingReasonCode; description: string; details: PendingReasonDetails };
  options: { id: string; type: string; description: string; example?: string }[];
  responseFormat?: { type: 'json'; schema: unknown };
};

// Schemas
export { NecessityBaseSchema, Level1Schema, Level2Schema, Level3Schema };

// Factory functions
export { createLevelAuthority };
```

---

## Appendix B: Level Summary

| Level | LLM Required | Primary Risk | Verification |
|-------|--------------|--------------|--------------|
| 0 | No | None | Deterministic |
| 1 | Sometimes | Wrong belief | Posterior consistency |
| 2 | Often | Wrong interpretation | Semantic audit + HITL |
| 3 | Always | Wrong intent | User confirmation |

---

## Appendix C: Trace Example

```json
{
  "header": {
    "specVersion": "lab/1.1",
    "runId": "run_abc123",
    "necessityLevel": 1,
    "schemaHash": "schema_xyz",
    "createdAt": "2025-01-15T10:30:00Z",
    "completedAt": "2025-01-15T10:32:34Z",
    "durationMs": 154000
  },
  "events": [
    { "type": "proposal", "seq": 1, "proposalId": "prop_001", "intentType": "llm.propose_belief" },
    { "type": "authority.decision", "seq": 2, "proposalId": "prop_001", "decision": "approved" },
    { "type": "apply", "seq": 3, "intentId": "intent_001", "patchCount": 2 },
    { "type": "termination", "seq": 4, "outcome": "success" },
    { "type": "world.created", "seq": 5, "worldId": "world_002" }
  ],
  "outcome": "success"
}
```

---

## Appendix D: Quick Reference

### D.1 Lab Creation

```typescript
const labWorld = withLab(world, {
  runId: string,
  necessityLevel: 0 | 1 | 2 | 3,
  outputPath: string,
  projection?: { enabled: boolean, mode: ProjectionMode },
  hitl?: { enabled: boolean, timeout?: number },
});
```

### D.2 Trace Utilities

```typescript
// Save
await labWorld.trace().save('./path/to/trace.json');

// Load
const trace = await LabTrace.load('./path/to/trace.json');
const traces = await LabTrace.loadAll('./traces/*.json');

// Analyze
const summary = summarize(traces);
const diff = diffTraces(traceA, traceB);
const result = await replay(trace, { world });

// Report
await trace.report().toMarkdown('./report.md');
```

### D.3 Projection Components

```typescript
const labWorld = withLab(world, {
  runId: 'exp-001',
  projection: {
    enabled: true,
    mode: 'watch',
    components: {
      header: (ctx) => `Run: ${ctx.runId} | Step: ${ctx.step}`,
      
      renderSnapshot: (snapshot, ctx) => {
        // Return ASCII art, table, or any string
        return renderMyDomain(snapshot);
      },
      
      renderAction: (intent, before, after, ctx) => {
        return `${intent.type}: ${describeChange(before, after)}`;
      },
      
      renderReasoning: (reasoning, confidence, ctx) => {
        return `"${reasoning}" (${(confidence * 100).toFixed(0)}%)`;
      },
    },
  },
});
```

### D.4 HITL Prompt

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
      
      // prompt.whyPending.reason = 'LOW_CONFIDENCE'
      // prompt.whyPending.details.confidence = { actual: 0.45, required: 0.70 }
      // prompt.options = [{ type: 'retry' }, { type: 'modify' }, ...]
      
      // Send to agent
      const response = await agent.handleHITL(prompt);
      
      // Handle response
      if (response.action === 'retry') {
        await context.retry(response.reasoning);
      } else if (response.action === 'modify') {
        await context.modify(response.newIntent);
      }
    },
  },
});
```

---

## Appendix E: CLI Reference

*(Added in v1.1)*

```bash
# Run experiment
manifesto-lab run --config <config.yaml> --output <dir>

# Summarize traces
manifesto-lab summary <traces...>
manifesto-lab summary ./traces/*.json

# Compare traces
manifesto-lab diff <trace-a> <trace-b>

# Generate report
manifesto-lab report <trace> [--format md|html] [--output <path>]

# Replay trace
manifesto-lab replay <trace> --world <world-config> [--stop-at <seq>]
```

---

## Final One-Line Summary

> **Manifesto does not ask whether an agent succeeded,
> but whether the world allowed it to succeed — and proves the answer.**

---

*End of Manifesto LLM Necessity & Lab Specification v1.1*
