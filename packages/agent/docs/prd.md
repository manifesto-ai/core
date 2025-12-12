# @manifesto/agent v0.1 — Product Requirements Document

**Version:** 0.1.0 (Frozen)
**Status:** Final Specification
**Date:** 2025-01

---

## 0. One-Sentence Definition

A session layer that takes a Manifesto Snapshot as input, executes the LLM as a "pure policy function," standardizes all side effects as Effects, and lets the Runtime maintain control.

---

## 1. Goals

| Goal | Description |
|------|-------------|
| **Demote LLM to a component** | `f(snapshot) → effects[]` — The LLM is not the master, but a CPU/Calculator-level component |
| **Runtime owns control** | step/run, budget, stop — Control flow always belongs to the Runtime |
| **Enforce schemas, don't inject** | Schema → Constraints compilation + Validator Gatekeeping |
| **Stable loop execution** | Deterministically reproducible on top of @manifesto/agent (e.g., HSCA loops) |

---

## 2. Non-Goals (v0.1 Scope Out)

| Item | Reason |
|------|--------|
| Planner (ToT/ReAct) / Goal decomposition | Increased complexity, separate layer |
| Vector DB / Retrieval / Tool recommendation engine | Infrastructure layer, not agent responsibility |
| Multi-agent scheduler / orchestration | v0.2+ extension |
| Core schema/phase semantics redefinition | Core package responsibility |
| Parallel effect execution (Concurrency) | v0.1 is sequential only |
| Full human.ask support | Session state transitions complex, deferred to v0.2 |
| Auto retry / stuck detection | Judgment criteria complex, v0.1 does simple execution only |

---

## 3. Package Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    @manifesto/loops-hsca                     │
│          (HSCA phase rules + constraints compiler)           │
└─────────────────────────┬───────────────────────────────────┘
                          │ uses
┌─────────────────────────▼───────────────────────────────────┐
│                     @manifesto/agent                         │
│   (LLM policy execution + Effect standardization +           │
│                  Runtime enforcement)                        │
└─────────────────────────┬───────────────────────────────────┘
                          │ uses
┌─────────────────────────▼───────────────────────────────────┐
│                     @manifesto/core                          │
│       (Snapshot storage/transition/logging —                 │
│              Constitution + minimal infra)                   │
└─────────────────────────────────────────────────────────────┘
```

**Core Principle:** Agent only *uses* core; it does not replicate or redefine core semantics.

---

## 4. Core Data Models

### 4.1 Effect (Declare intent only, Runtime executes)

```typescript
export type Effect =
  | { type: "tool.call"; id: string; tool: string; input: unknown }
  | { type: "snapshot.patch"; id: string; ops: PatchOp[]; reason?: string }
  | { type: "log.emit"; id: string; level: "debug" | "info" | "warn" | "error"; message: string; data?: unknown };
```

> **Note:** `human.ask` is type-defined only in v0.1; runtime support deferred to v0.2.

### 4.2 PatchOp — SimplePathValue (v0.1 Frozen)

```typescript
export type PatchOp =
  | { op: "set"; path: string; value: unknown }
  | { op: "append"; path: string; value: unknown };
```

**Path Rules:**

| Rule | Description | Example |
|------|-------------|---------|
| dot-separated | Object paths separated by dots | `"data.plan.items"` |
| Array index allowed | Numbers interpreted as array indices | `"data.items.0.status"` |
| 0-based indexing | Indices start from 0 | `"data.optionScores.2"` |
| Bounds check | `0 <= idx < length` violation → ValidationError | — |

**Deletion Semantics (v0.1):**

| Operation | Meaning |
|-----------|---------|
| `set(path, null)` | Set value to null (not deletion) |
| Array item removal | Replace entire array |
| Object field deletion | Not supported in v0.1 |

**Forbidden Operations:** `delete`, `move`, `replace`, `copy`

---

## 5. Runtime Enforcement (Gatekeeper)

### 5.1 Area Permissions (Write ACL)

```
┌─────────────────────────────────────────────────────────┐
│                   Snapshot Structure                     │
├─────────────────────────────────────────────────────────┤
│ data.*    │ LLM writable (subject to project policy)    │
│ state.*   │ LLM writable (phase, etc.)                  │
│ derived.* │ LLM write FORBIDDEN (Runtime managed)       │
└─────────────────────────────────────────────────────────┘
```

### 5.2 derived.observations Rules

```typescript
// derived.observations is ALWAYS pushed by Runtime
// LLM does not "record" observations, only uses log.emit

// ❌ FORBIDDEN
{ op: "set", path: "derived.observations", value: [...] }
{ op: "append", path: "derived.observations", value: {...} }

// ✅ ALLOWED (Runtime internally in tool handler)
core.appendObservation({
  source: "tool:search",
  content: result,
  ts: Date.now()
});
```

> **This single rule makes the system production-grade.**

---

## 6. Schema → Constraints Compilation (JIT Injection)

### 6.1 Constraints Type

```typescript
export type Constraints = {
  phase: string;
  writablePathPrefixes: string[];  // e.g., ["data.", "state."]
  typeRules: Array<{
    path: string;
    type: "string" | "number" | "boolean" | "object" | "array" | "null";
  }>;
  invariants: Array<{
    id: string;
    description: string;  // Natural language description for LLM
  }>;
};
```

### 6.2 JIT Injection Principle

| Location | Content |
|----------|---------|
| System prompt | Immutable protocol only (Iron Laws) |
| Per-step | Current phase Constraints + snapshot essentials + recent errors |

---

## 7. Validation Pipeline

### 7.1 snapshot.patch Processing Flow

```
PatchOp received
       │
       ▼
┌─────────────────────────┐
│ 1. PatchOp schema check │  op/path/value structure
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 2. Path ACL check       │  derived.* write forbidden
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 3. Path Bounds check    │  Array index range check
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 4. Type Rules check     │  Expected type per path
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 5. Invariant check      │  Phase-specific invariants
└───────────┬─────────────┘
            ▼
      ┌─────┴─────┐
      │           │
    Pass        Fail
      │           │
      ▼           ▼
   Apply     Record Error State
            (patch not applied)
```

### 7.2 Standard Error State

```typescript
export type PatchErrorState = {
  kind: "patch_validation_error";
  at: string;              // Problem path
  issue: string;           // "Type mismatch" | "Forbidden path" | "Index out of bounds" | "Invariant violated"
  expected?: unknown;
  got?: unknown;
  advice?: string;         // "Use number instead of string", ...
  effectId: string;
  ts: number;
};
```

---

## 8. Execution Model: Sequential + Stop-on-Failure

### 8.1 Step Semantics

```
┌──────────────────────────────────────────────────────────┐
│                        One Step                          │
├──────────────────────────────────────────────────────────┤
│ 1. client.decide(snapshot + constraints + errors)        │
│                         │                                │
│                         ▼                                │
│ 2. Runtime executes effects sequentially                 │
│    ┌─────────────────────────────────────────┐          │
│    │ for effect in effects:                   │          │
│    │   validate(effect)                       │          │
│    │   execute(effect)                        │          │
│    │   if error: record & break               │          │
│    └─────────────────────────────────────────┘          │
│                         │                                │
│                         ▼                                │
│ 3. On error: stop immediately (discard remaining)        │
│                         │                                │
│                         ▼                                │
│ 4. Next step includes error state for retry              │
└──────────────────────────────────────────────────────────┘
```

### 8.2 Implementation Contract (Pseudo-code)

```typescript
async function executeStep(decision: AgentDecision, ctx: Context): Promise<void> {
  const maxEffects = ctx.policy.maxEffectsPerStep ?? 16;

  for (const effect of decision.effects.slice(0, maxEffects)) {
    // 1. Effect structure validation
    const validation = validateEffect(effect, ctx.constraints);
    if (!validation.ok) {
      ctx.core.appendError({
        kind: "effect_validation_error",
        effectId: effect.id,
        issue: validation.issue,
        ts: Date.now()
      });
      break;  // stop-on-failure
    }

    // 2. Effect execution
    try {
      await ctx.handlers.handle(effect, ctx);
    } catch (err) {
      ctx.core.appendError({
        kind: "handler_execution_error",
        effectId: effect.id,
        issue: err.message,
        ts: Date.now()
      });
      break;  // stop-on-failure
    }
  }
}
```

---

## 9. tool.call Result Attribution (Standard Pattern)

```typescript
// EffectHandler for tool.call
async function handleToolCall(
  effect: ToolCallEffect,
  ctx: Context
): Promise<void> {
  const tool = ctx.tools.get(effect.tool);
  if (!tool) {
    throw new Error(`Unknown tool: ${effect.tool}`);
  }

  // 1. Execute tool
  const result = await tool.execute(effect.input);

  // 2. Push result to derived.observations (Runtime authority)
  ctx.core.appendObservation({
    id: generateId(),
    source: `tool:${effect.tool}`,
    content: result,
    triggeredBy: effect.id,
    ts: Date.now()
  });
}
```

**Observations Schema:**

```typescript
export type Observation = {
  id: string;
  source: string;           // "tool:search", "tool:calculator", ...
  content: unknown;         // Tool result
  triggeredBy?: string;     // Originating effect.id
  ts: number;
};
```

---

## 10. AgentClient (LLM Adapter) Contract

### 10.1 Interface

```typescript
export type AgentDecision = {
  effects: Effect[];
  trace?: {
    model?: string;
    tokensIn?: number;
    tokensOut?: number;
    raw?: unknown;
  };
};

export interface AgentClient<S = unknown> {
  decide(input: {
    snapshot: S;
    constraints: Constraints;
    recentErrors?: PatchErrorState[];
    instruction?: string;
  }): Promise<AgentDecision>;
}
```

### 10.2 Output Enforcement Rules

| Rule | Description |
|------|-------------|
| JSON only | No natural language output, JSON only |
| AgentDecision only | Only output the defined schema |
| No hallucination | Never generate data not present in snapshot |
| log.emit for notes | Use log.emit for memos/reasoning |

---

## 11. Session API

### 11.1 Policy (Simplified)

```typescript
export type Policy = {
  maxSteps: number;
  maxEffectsPerStep?: number;  // default: 16
};
```

> **Removed in v0.1:** `tokenBudget`, `onStuck`, `retry` — removed due to judgment criteria complexity

### 11.2 Session Factory

```typescript
export function createAgentSession<S>(opts: {
  core: ManifestoCoreLike<S>;
  client: AgentClient<S>;
  policy: Policy;
  handlers: EffectHandlerRegistry;
  compileConstraints: (snapshot: S) => Constraints;
  instruction?: string;
}): AgentSession;

export interface AgentSession {
  step(): Promise<StepResult>;
  run(): Promise<RunResult>;
}

export type StepResult = {
  done: boolean;
  reason?: string;
  effectsExecuted: number;
  errorsEncountered: number;
};

export type RunResult = {
  done: boolean;
  reason?: string;
  totalSteps: number;
  totalEffects: number;
};
```

---

## 12. ManifestoCoreLike Minimal Interface

```typescript
export interface ManifestoCoreLike<S> {
  // Read
  getSnapshot(): S;

  // Write (patch application)
  applyPatch(ops: PatchOp[]): ApplyResult;

  // Error state management
  appendError(error: PatchErrorState): void;
  getRecentErrors(limit?: number): PatchErrorState[];
  clearErrors(): void;

  // Observations (Runtime only)
  appendObservation(obs: Observation): void;
}

export type ApplyResult =
  | { ok: true; snapshot: S }
  | { ok: false; error: PatchErrorState };
```

---

## 13. Prompt Templates (v0.1 Standard)

### 13.1 System Prompt (Iron Laws)

```
# ROLE
You are a deterministic policy kernel. You receive state, you emit effects. Nothing else.

# IRON LAWS
1. You are a PURE FUNCTION: f(snapshot) → effects[]
2. You NEVER execute — you only declare intentions as Effect objects
3. You output ONLY valid JSON matching AgentDecision schema
4. You NEVER hallucinate data not present in the snapshot
5. You NEVER write to derived.* paths — those are Runtime-managed
6. When uncertain, emit { type: "log.emit", level: "warn", message: "..." }

# OUTPUT SCHEMA
{
  "effects": [
    { "type": "snapshot.patch", "id": "<uuid>", "ops": [...], "reason": "..." },
    { "type": "tool.call", "id": "<uuid>", "tool": "<name>", "input": {...} },
    { "type": "log.emit", "id": "<uuid>", "level": "info", "message": "..." }
  ]
}

# FAILURE MODE
If you violate these laws, your effects will be rejected and recorded as errors.
You will see these errors in the next step. Learn and correct.
```

### 13.2 Per-step Prompt Template

```
## CURRENT SNAPSHOT
```json
{snapshot_json}
```

## PHASE RULES (Constraints)
Phase: {phase}
Writable paths: {writable_paths}
Invariants: {invariants_list}

## RECENT ERRORS (if any)
{recent_errors_json}

## INSTRUCTION
{instruction}

Respond with a single JSON object matching AgentDecision schema.
```

---

## 14. Test Requirements

### 14.1 Unit Tests (Required)

| Test | Validation Content |
|------|-------------------|
| `patch-acl.test` | derived.* write blocking |
| `patch-bounds.test` | Array index range validation |
| `patch-type.test` | Type mismatch error generation |
| `invariant.test` | Invariant violation handling |
| `sequential.test` | Sequential execution + stop-on-failure |
| `max-effects.test` | maxEffectsPerStep limit |

### 14.2 Integration Tests (Required)

| Test | Validation Content |
|------|-------------------|
| `mock-client.test` | Mock client returning fixed effects |
| `mock-tool.test` | Observations push verification |
| `hsca-fixture.test` | HSCA snapshot sequence deterministic replay |

---

## 15. Milestones

| Milestone | Content | Completion Criteria |
|-----------|---------|---------------------|
| **M0** | Type freeze | Effect, PatchOp, Policy, Constraints, Errors interfaces finalized |
| **M1** | Session implementation | step/run + sequential executor + stop-on-failure + limits |
| **M2** | Enforcement | patch validator + error-as-state + derived write ACL |
| **M3** | HSCA connection | constraints compiler + observations runtime-managed |
| **M4** | Docs/Examples | README + examples/hsca-longbench execution script |

---

## 16. v0.2 Planned Extensions (Explicit Deferral)

| Item | Description |
|------|-------------|
| Full human.ask support | Session state transitions (waiting_human) + response injection API |
| Parallel effect groups | Transaction-unit parallel execution |
| Patch conflict resolution | Merge strategies |
| Retry / stuck detection | Transient/permanent error distinction + auto-retry |
| tokenBudget | Cumulative/per-step token limits |
| schemaChangeCost | Constitution change cost measurement |
| Provenance tracking | Which observation triggered which effect |

---

## 17. Final Freeze Declaration

### v0.1 Victory Condition

> **Even when LLM is wrong, Runtime doesn't break, errors accumulate as state, and a self-correcting loop is reproducible in the next step.**

### Core Invariants

1. **derived.* is Runtime-only** — LLM can never directly modify
2. **All failures become state** — No exception crashes
3. **Sequential execution + immediate stop** — Discard remaining on partial failure
4. **Constraints are enforced, not injected** — Validator gatekeeps

---

## Appendix A: Directory Structure (Recommended)

```
@manifesto/agent/
├── src/
│   ├── index.ts              # Public exports
│   ├── types/
│   │   ├── effect.ts         # Effect, PatchOp
│   │   ├── constraints.ts    # Constraints
│   │   ├── errors.ts         # PatchErrorState
│   │   └── policy.ts         # Policy
│   ├── session/
│   │   ├── create.ts         # createAgentSession
│   │   ├── executor.ts       # Sequential executor
│   │   └── step.ts           # Single step logic
│   ├── validation/
│   │   ├── patch.ts          # PatchOp validation
│   │   ├── acl.ts            # Write ACL check
│   │   ├── bounds.ts         # Array bounds check
│   │   └── invariant.ts      # Invariant validation
│   ├── handlers/
│   │   ├── registry.ts       # EffectHandlerRegistry
│   │   ├── tool-call.ts      # tool.call handler
│   │   ├── patch.ts          # snapshot.patch handler
│   │   └── log.ts            # log.emit handler
│   └── prompt/
│       ├── system.ts         # System prompt template
│       └── step.ts           # Per-step prompt builder
├── tests/
│   ├── unit/
│   └── integration/
└── examples/
    └── hsca-longbench/
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Effect** | Intent declared by LLM. Execution is Runtime's responsibility |
| **Snapshot** | Complete state at a point in time. Treated as immutable |
| **Constraints** | Runtime rules compiled from Schema (ACL, types, invariants) |
| **Observation** | Tool execution result. Runtime pushes to derived.observations |
| **Step** | One LLM call + effects execution cycle |
| **Session** | Execution unit composed of multiple steps |
| **Gatekeeper** | Validation pipeline. Blocks invalid effects |

---

*Document Version: v0.1.0-frozen*
*Last Updated: 2025-01*
