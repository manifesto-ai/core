# Manifesto LLM Necessity & Lab — Foundational Design Rationale (FDR)

> **Version:** 1.1  
> **Status:** Normative  
> **Purpose:** Document the "Why" behind every constitutional decision in the Necessity & Lab Specification
> **Changelog:**
> - v1.0: Initial 15 FDRs
> - v1.1: Added FDR-N016 (Projection Components), FDR-N017 (HITL Structured Prompting)

---

## Overview

This document records the foundational design decisions that shape the LLM Necessity & Lab Specification.

Each FDR entry follows the format:

- **Decision**: What was decided
- **Context**: Why this decision was needed
- **Rationale**: The reasoning behind the choice
- **Alternatives Rejected**: Other options considered and why they were rejected
- **Consequences**: What this decision enables and constrains

---

## Table of Contents

### Part I: Core Philosophy
1. [FDR-N001: Structural Necessity as Justification](#fdr-n001-structural-necessity-as-justification)
2. [FDR-N002: LLM as Actor, Not Special Component](#fdr-n002-llm-as-actor-not-special-component)
3. [FDR-N003: Proposal-Only Rule](#fdr-n003-proposal-only-rule)
4. [FDR-N004: Trace-as-Evidence Principle](#fdr-n004-trace-as-evidence-principle)
5. [FDR-N005: Failure-as-Structure Principle](#fdr-n005-failure-as-structure-principle)

### Part II: Necessity Levels
6. [FDR-N006: Four-Level Taxonomy](#fdr-n006-four-level-taxonomy)
7. [FDR-N007: Level Inheritance](#fdr-n007-level-inheritance)
8. [FDR-N008: Level Detection as Computed Value](#fdr-n008-level-detection-as-computed-value)

### Part III: Lab Architecture
9. [FDR-N009: withLab Higher-Order Function](#fdr-n009-withlab-higher-order-function)
10. [FDR-N010: World Events as Observation Channel](#fdr-n010-world-events-as-observation-channel)
11. [FDR-N011: Lab as Observer, Not Participant](#fdr-n011-lab-as-observer-not-participant)
12. [FDR-N012: Projection Mode Spectrum](#fdr-n012-projection-mode-spectrum)
13. [FDR-N016: Projection Components (Domain Renderer Injection)](#fdr-n016-projection-components-domain-renderer-injection) *(v1.1)*

### Part IV: HITL & Authority
14. [FDR-N013: HITL via Authority, Not Direct Modification](#fdr-n013-hitl-via-authority-not-direct-modification)
15. [FDR-N014: Level-Appropriate Verification](#fdr-n014-level-appropriate-verification)
16. [FDR-N015: Counterfactual Explanations](#fdr-n015-counterfactual-explanations)
17. [FDR-N017: HITL Structured Prompting](#fdr-n017-hitl-structured-prompting) *(v1.1)*

### Summary
18. [Summary Table](#summary-table)
19. [Cross-Reference: Related FDRs](#cross-reference-related-fdrs)

---

## Part I: Core Philosophy

---

## FDR-N001: Structural Necessity as Justification

### Decision

LLM usage is justified **only** when no deterministic function exists that can solve the task correctly for all valid instances.

```
∄ f: ObservableState → Action such that
  ∀ valid task instances, f achieves correctness
```

### Context

Many systems use LLMs by default, treating them as universal problem-solvers. This leads to:

- Unnecessary complexity
- Non-deterministic behavior where determinism is possible
- Difficulty in testing and verification
- Wasted resources

### Rationale

**LLM usage should be a structural property of the problem, not a convenience choice.**

Consider two tasks:

```typescript
// Task A: Calculate shipping cost
// Input: weight, dimensions, destination
// Output: price
// 
// This is DETERMINISTIC. A lookup table or formula solves it.
// Using an LLM here is structural waste.

// Task B: Interpret user intent from natural language
// Input: "Ship this to my mom's place"
// Output: Structured address
//
// This REQUIRES understanding context, resolving references.
// LLM is structurally necessary.
```

**The question is not "Can an LLM do this?" but "Must an LLM do this?"**

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| "Use LLM when convenient" | Leads to unnecessary non-determinism |
| "Use LLM for everything" | Overkill; impossible to verify |
| "Never use LLM" | Ignores legitimate use cases |

### Consequences

- Every LLM usage must be justified by structural necessity
- Level 0 tasks MUST work without LLM
- Enables NullLLM testing for verification
- Forces explicit reasoning about where LLM adds value

---

## FDR-N002: LLM as Actor, Not Special Component

### Decision

LLMs are registered as **Actors** with `kind: 'agent'`, subject to the same governance as any other actor.

```typescript
world.registerActor({
  actorId: 'llm-gpt4',
  kind: 'agent',  // Not 'llm' or 'special'
  name: 'GPT-4 Belief Proposer',
  meta: { model: 'gpt-4-turbo', role: 'belief_proposer' },
});
```

### Context

Many architectures treat LLMs as privileged components:

```
┌─────────────────────────────────────────┐
│            Application                  │
│                 │                       │
│                 ▼                       │
│  ┌───────────────────────────────────┐ │
│  │             LLM                   │ │
│  │   (special, trusted, central)     │ │
│  └───────────────────────────────────┘ │
│                 │                       │
│                 ▼                       │
│            State/Actions                │
└─────────────────────────────────────────┘
```

This creates accountability gaps and verification challenges.

### Rationale

**Equality enables governance.**

When LLMs are actors like any other:

| Capability | Special LLM | LLM as Actor |
|------------|-------------|--------------|
| Submit proposals | Bypasses? | ✅ Same as others |
| Subject to authority | Maybe? | ✅ Always |
| Traceable | Partially? | ✅ Fully |
| Replaceable | Hard | ✅ Easy (swap actor) |

```
┌─────────────────────────────────────────┐
│            World Protocol               │
│                                         │
│   Human Actor ─┐                        │
│                │                        │
│   Agent Actor ─┼──► Authority ──► Host  │
│   (LLM)        │                        │
│                │                        │
│  System Actor ─┘                        │
│                                         │
│   All actors are equal under Protocol   │
└─────────────────────────────────────────┘
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| LLM as privileged orchestrator | No accountability |
| LLM as trusted core | Can't verify trust |
| LLM as external service only | Misses governance opportunity |

### Consequences

- LLMs use the same `submitProposal` API as humans
- Authority can reject LLM proposals
- LLM actions are fully traced
- Can substitute NullLLM for testing

---

## FDR-N003: Proposal-Only Rule

### Decision

LLMs **MUST** submit outputs as Proposals. They **MUST NOT** directly mutate state, act as Authority, bypass verification, or verify their own outputs.

| Action | Allowed? |
|--------|----------|
| Submit outputs as Proposals | ✅ MUST |
| Directly mutate state | ❌ MUST NOT |
| Act as Authority | ❌ MUST NOT |
| Bypass verification | ❌ MUST NOT |
| Verify own outputs | ❌ MUST NOT |

### Context

The fundamental tension:

```
LLMs produce useful outputs
    BUT
LLMs can hallucinate, make errors, be manipulated
    THEREFORE
LLM outputs need verification before becoming truth
```

### Rationale

**Proposal is the universal interface for uncertain contributions.**

```
LLM Output ──► Proposal ──► Authority ──► State
                  │             │
                  │             └── Verification happens here
                  │
                  └── Uncertainty is explicit here
```

**Self-verification is logically impossible:**

```typescript
// This is circular
const llmOutput = await llm.generate(prompt);
const isValid = await llm.verify(llmOutput); // Same LLM!
if (isValid) applyToState(llmOutput);

// The LLM that made an error will validate the error
```

**Separation of concerns:**

```
LLM: "I believe the answer is X" (proposal)
Authority: "Is X consistent with observations?" (verification)
World: "X is now part of state" (commitment)
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Direct state mutation | No verification possible |
| Self-verification | Circular; same errors |
| Optional verification | Creates inconsistent trust |

### Consequences

- All LLM outputs go through Authority
- Clean separation: LLM proposes, Authority disposes
- Verification is mandatory, not optional
- Self-verification is a forbidden pattern (FP-5)

---

## FDR-N004: Trace-as-Evidence Principle

### Decision

> **A run without a trace is not an experiment.**

Every execution MUST produce a Lab Trace Artifact that is:
- The canonical experimental record
- Sufficient for replay
- Sufficient for failure explanation

### Context

Without traces:

```
Run 1: Success
Run 2: Failure
Run 3: Success

Why did Run 2 fail? 🤷
What was different? 🤷
Can we reproduce it? 🤷
```

With traces:

```
Run 2 Trace:
  - proposal:submitted (prop_003)
  - proposal:decided (rejected, reason: "confidence too low")
  - No execution occurred
  
Root cause: LLM confidence threshold not met
Reproducible: Yes, same input produces same rejection
```

### Rationale

**Evidence requires records.**

| Claim | Without Trace | With Trace |
|-------|--------------|------------|
| "The system worked" | Assertion | Provable |
| "The LLM was wrong" | Blame | Evidence |
| "Authority rejected X" | Anecdote | Record |
| "We can reproduce" | Hope | Certainty |

**Traces enable:**

1. **Debugging**: What happened?
2. **Auditing**: Who did what?
3. **Replay**: Can we reproduce?
4. **Learning**: What patterns emerge?

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Logging (unstructured) | Can't replay, hard to analyze |
| Optional tracing | Creates evidence gaps |
| Sampling (partial traces) | Misses the failure you need |

### Consequences

- Every Lab run produces exactly one trace
- Trace is structured (not logs)
- Trace is sufficient for deterministic replay
- No "traceless mode"

---

## FDR-N005: Failure-as-Structure Principle

### Decision

> **Manifesto does not ask whether an agent succeeded,
> but whether the world allowed it to succeed — and proves the answer.**

Failures are first-class structural outcomes with mandatory explanations.

### Context

Typical failure handling:

```
Error: Agent failed
Message: "Something went wrong"
Stack trace: [internal implementation details]

Useful? No.
```

### Rationale

**Failure has structure. Capture it.**

```typescript
type FailureReason =
  | 'NO_EXECUTABLE_ACTION'     // Structural: no action possible
  | 'GOAL_UNREACHABLE'         // Structural: goal is impossible
  | 'AUTHORITY_REJECTION'      // Governance: not permitted
  | 'UNRESOLVED_AMBIGUITY'     // Informational: need clarification
  | 'HUMAN_REQUIRED'           // Procedural: human must decide
  | 'TIMEOUT'                  // Resource: out of time
  | 'RESOURCE_EXHAUSTED';      // Resource: out of resources
```

**Explanations, not blame:**

```typescript
// Bad: Blame the LLM
"The model failed to produce a valid response"

// Good: Explain the structure
{
  reason: 'NO_EXECUTABLE_ACTION',
  explanation: {
    kind: 'structural',
    title: 'No valid action available',
    description: 'All possible actions violate constraint C1',
    evidence: [
      { type: 'constraint_violation', constraint: 'C1', ... }
    ],
    counterfactual: {
      change: { type: 'relax_constraint', constraint: 'C1' },
      expectedOutcome: 'success',
      confidence: 'high'
    }
  }
}
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Generic error messages | No learning, no debugging |
| Stack traces only | Implementation detail, not meaning |
| Success/failure binary | Loses why |

### Consequences

- Every failure has a structured explanation
- Explanations include evidence
- Counterfactuals suggest what would have worked
- Rule FE-R3: Explanation MUST NOT blame "model" or "agent"

---

## Part II: Necessity Levels

---

## FDR-N006: Four-Level Taxonomy

### Decision

Necessity is classified into exactly **four levels** (0-3):

| Level | Name | Structural Property | LLM Role |
|-------|------|---------------------|----------|
| 0 | Deterministic Full Observation | Solvable without LLM | `none` |
| 1 | Partial Observation | Hidden state requires belief | `belief_proposer` |
| 2 | Open-Ended Rules | Goal interpretation required | `rule_interpreter` |
| 3 | Natural Language Grounding | Intent grounding required | `intent_parser` |

### Context

Why not 2 levels? Why not 10?

### Rationale

**Each level represents a distinct structural boundary.**

```
Level 0: Everything is observable and rules are formal
         ↓ (introduce hidden state)
Level 1: Must form beliefs about unobservable state
         ↓ (introduce open-ended goals)
Level 2: Must interpret what "success" means
         ↓ (introduce natural language)
Level 3: Must ground language to formal constructs
```

**Each boundary requires qualitatively different LLM capabilities:**

| Level | Key Capability | Example |
|-------|---------------|---------|
| 0 | None (deterministic) | Chess with full board visible |
| 1 | Probabilistic inference | Poker with hidden cards |
| 2 | Goal formalization | "Make this report better" |
| 3 | Language understanding | "Send this to my usual contact" |

**Why not more levels?**

Tested taxonomies with 5-7 levels. Found:
- Intermediate levels were hard to distinguish
- Verification methods didn't differ meaningfully
- Added complexity without added clarity

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Binary (LLM/no-LLM) | Too coarse; loses important distinctions |
| Continuous scale | Hard to define verification for each point |
| 5+ levels | Distinctions become fuzzy |
| Task-specific taxonomies | Not universal |

### Consequences

- Four distinct verification methods
- Clear criteria for each level
- Level detection is computable
- Each level has specific legality conditions

---

## FDR-N007: Level Inheritance

### Decision

Higher levels inherit ALL requirements from lower levels.

```
Level 3 ⊃ Level 2 ⊃ Level 1 ⊃ Level 0
```

### Context

A Level 3 system (natural language) must also handle:
- Deterministic computation (Level 0)
- Belief formation (Level 1)
- Goal interpretation (Level 2)

### Rationale

**Necessity accumulates; it doesn't replace.**

```
Level 3 Task: "Schedule a meeting with the team next week"

Must handle:
- Language grounding: "the team" → [Alice, Bob, Charlie]
- Goal interpretation: "next week" → which days are preferred?
- Belief formation: Who is likely available? (partial observation)
- Deterministic: Check calendar constraints (full observation)
```

**Schema design reflects this:**

```typescript
const Level3Schema = Level2Schema.extend({
  grounding: GroundingStateSchema,  // Level 3 addition
  // Level 2's interpretedRule is inherited
  // Level 1's belief is inherited
  // Level 0's base is inherited
});
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Levels are independent | Ignores that higher levels need lower capabilities |
| Pick highest only | Loses lower-level constraints |
| Additive (L1+L2+L3) | Same as inheritance, more confusing notation |

### Consequences

- Level 3 systems must satisfy Level 0, 1, 2 requirements
- Schemas compose via extension
- Testing must cover all inherited levels
- Verification is cumulative

---

## FDR-N008: Level Detection as Computed Value

### Decision

Level detection is a **computed value** derived from observable properties, not a manual configuration.

```typescript
type LevelDetection = {
  readonly observation: 0 | 1;   // Can observe all state?
  readonly rules: 0 | 2;         // Are rules formal?
  readonly language: 0 | 3;      // Is input natural language?
  readonly detectedAt: number;
};

function computeEffectiveLevel(detection: LevelDetection): NecessityLevel {
  return Math.max(detection.observation, detection.rules, detection.language);
}
```

### Context

Manual level configuration is error-prone:

```typescript
// Developer says Level 1, but task is actually Level 2
const config = { necessityLevel: 1 }; // Wrong!
```

### Rationale

**Detection > Declaration.**

Properties that determine level are observable:

| Property | How to Detect |
|----------|--------------|
| Hidden state | Schema defines what's observable |
| Open-ended rules | Goal specification is informal |
| Natural language | Input contains NL strings |

**Detection enables validation:**

```typescript
// Configuration says Level 1
const labWorld = withLab(world, { necessityLevel: 1 });

// But detection finds Level 2 properties
if (labWorld.state.effectiveLevel > labWorld.labMeta.necessityLevel) {
  warn("Configured level may be too low");
}
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Manual configuration only | Error-prone, no validation |
| Fully automatic | Can't handle edge cases |
| No level tracking | Loses verification guidance |

### Consequences

- Level is computed from schema and input properties
- Configuration is validated against detection
- Mismatch triggers warnings
- Enables automatic level-appropriate authority binding

---

## Part III: Lab Architecture

---

## FDR-N009: withLab Higher-Order Function

### Decision

Lab is applied via `withLab(world, options)` higher-order function, not factory + method pattern.

```typescript
// Chosen: withLab
const labWorld = withLab(world, {
  runId: 'exp-001',
  necessityLevel: 1,
  outputPath: './traces',
});

// Rejected: createLab().wrap()
const labWorld = createLab({ ... }).wrap(world);
```

### Context

Two API patterns were considered:

| Pattern | Code |
|---------|------|
| Factory + wrap | `createLab(opts).wrap(world)` |
| Higher-order function | `withLab(world, opts)` |

### Rationale

**Subject-first reading order.**

```typescript
// withLab: "Take this world, add Lab to it"
const labWorld = withLab(world, options);
//                       ↑ subject first

// createLab().wrap(): "Create a Lab, then wrap a world with it"
const labWorld = createLab(options).wrap(world);
//               ↑ object first, subject later
```

**No Lab instance reuse needed.**

```typescript
// This reuse pattern doesn't make sense:
const lab = createLab({ runId: 'exp-001' });
const labWorld1 = lab.wrap(world1);  // Same runId?
const labWorld2 = lab.wrap(world2);  // Trace collision!
```

Each Lab run needs unique `runId`, so reuse is an anti-pattern.

**Consistency with potential future wrappers:**

```typescript
// Consistent pattern
const world = createManifestoWorld({ ... });
const labWorld = withLab(world, { ... });
const metricsWorld = withMetrics(labWorld, { ... });
const replayWorld = withReplay(metricsWorld, { ... });

// Compose with pipe
const finalWorld = pipe(
  createManifestoWorld({ ... }),
  w => withLab(w, { ... }),
  w => withMetrics(w, { ... }),
);
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| `createLab().wrap()` | Lab reuse is anti-pattern; awkward reading |
| `world.withLab()` | Requires modifying World interface |
| `new LabWorld(world, opts)` | Class instantiation is less idiomatic |

### Consequences

- Clean, functional API
- No Lab instance to manage
- Easy to compose with other wrappers
- `createLab` is not exported as primary API

---

## FDR-N010: World Events as Observation Channel

### Decision

Lab observes World via `world.subscribe()` (World Events), not via plugin system or internal hooks.

```typescript
function withLab(world: ManifestoWorld, options: LabOptions): LabWorld {
  // Subscribe to World events
  world.subscribe((event) => {
    trace.push(mapWorldEventToTraceEvent(event));
    updateProjection(event);
    checkHITL(event);
  });
  
  return createLabWorld(world, ...);
}
```

### Context

Three observation mechanisms were considered:

| Mechanism | Description |
|-----------|-------------|
| Plugin system | World accepts plugins at construction |
| Internal hooks | Lab accesses World internals |
| **Event subscription** | Lab subscribes to World events |

### Rationale

**Event subscription enables decoupling.**

```
Plugin system:
  World ←── Lab (must be present at construction)
  
Event subscription:
  World ──events──► Lab (can attach anytime)
```

**No World modification required.**

```typescript
// Plugin system would require:
const world = createManifestoWorld({
  plugins: [lab],  // World knows about Lab
});

// Event subscription requires nothing:
const world = createManifestoWorld({ ... }); // World doesn't know about Lab
const labWorld = withLab(world, { ... });    // Lab attaches via subscribe
```

**Can wrap existing Worlds:**

```typescript
// With event subscription:
const existingWorld = getWorldFromSomewhere();
const labWorld = withLab(existingWorld, { ... }); // Works!

// With plugin system:
// Can't add Lab to existing World without reconstruction
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Plugin system | Construction-time coupling; can't wrap existing |
| Internal hooks | Breaks encapsulation; fragile |
| Wrapper interception only | Can't see internal events (Authority, effects) |

### Consequences

- Lab depends on World Protocol v1.1 (with Events)
- Lab can wrap any compliant World
- No plugin registration system needed
- Clear dependency: Lab → World Events

---

## FDR-N011: Lab as Observer, Not Participant

### Decision

Lab MUST NOT modify World state through observation. Lab is a pure observer.

| Allowed | Forbidden |
|---------|-----------|
| Record events | Modify state |
| Update projection | Submit proposals |
| Track HITL status | Execute effects |
| Generate reports | Change snapshots |

### Context

If Lab could modify state:

```typescript
world.subscribe((event) => {
  if (event.type === 'proposal:submitted') {
    // Lab modifies state?
    world.submitProposal({ type: 'lab.log', ... }); // ❌
  }
});
```

This creates:
- Infinite loops (Lab event triggers Lab action)
- Non-deterministic traces (Lab affects what it's tracing)
- Unclear accountability (who proposed what?)

### Rationale

**Observer and observed must be separate.**

```
Heisenberg's Observation Principle (paraphrased for software):
  Observation that modifies the observed system
  produces unreliable observations.
```

**Lab's value is in accurate recording:**

```
Accurate trace ← Pure observation
                      ↑
              No side effects on World
```

**HITL appears to modify, but doesn't:**

```typescript
// HITL decision goes through Authority, not direct modification
labWorld.hitl.approve(proposalId);
// This triggers Authority to make final decision
// Authority modifies state, not Lab
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Lab can inject logging events | Pollutes trace with non-semantic events |
| Lab can pause/resume World | Breaks determinism |
| Lab can modify proposals | Accountability lost |

### Consequences

- Lab Constraint: Observation-Only
- Forbidden Pattern FP-7: Direct State Modification by Lab
- HITL works through Authority channel
- Traces are reliable records of World behavior

---

## FDR-N012: Projection Mode Spectrum

### Decision

Four projection modes form a spectrum from minimal to maximal observability:

| Mode | Progress | Proposals | HITL | Snapshots | LLM Calls |
|------|----------|-----------|------|-----------|-----------|
| `silent` | ❌ | ❌ | ❌ | ❌ | ❌ |
| `watch` | ✅ | ✅ | View only | ❌ | Summary |
| `interactive` | ✅ | ✅ | ✅ Interact | Optional | Detail |
| `debug` | ✅ | ✅ | ✅ Interact | ✅ Full | ✅ Full |

### Context

Different use cases need different levels of visibility:

| Use Case | Need |
|----------|------|
| CI/CD pipeline | Trace only, no output |
| Monitoring | Progress, high-level status |
| Development | Full interaction, debugging |
| Production debugging | Everything, including snapshots |

### Rationale

**Modes are additive, not alternatives.**

```
silent ⊂ watch ⊂ interactive ⊂ debug
```

Each mode adds visibility without removing anything.

**Modes match common workflows:**

```typescript
// CI: Just need trace
withLab(world, { projection: { mode: 'silent' } });

// Monitoring dashboard
withLab(world, { projection: { mode: 'watch' } });

// Developer working on HITL flow
withLab(world, { projection: { mode: 'interactive' } });

// Debugging production issue
withLab(world, { projection: { mode: 'debug' } });
```

**Runtime switching supported:**

```typescript
// Start in watch, switch to debug when needed
labWorld.projection.setMode('debug');
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Single verbose mode | Too noisy for simple cases |
| Fine-grained flags | Too many combinations |
| No modes (always full) | Performance impact, noise |

### Consequences

- Four well-defined modes
- Clear capability matrix
- Runtime mode switching
- Trace always captured regardless of mode

---

## Part IV: HITL & Authority

---

## FDR-N013: HITL via Authority, Not Direct Modification

### Decision

HITL decisions flow through Authority, not direct state modification.

```
HITL Request Flow:

Authority returns 'pending' ──► Lab shows HITL UI
                                      │
                                      ▼
                               Human decides
                                      │
                                      ▼
                        HITLController.approve/reject
                                      │
                                      ▼
                         Authority receives decision
                                      │
                                      ▼
                  Authority returns 'approved' or 'rejected'
                                      │
                                      ▼
                              World proceeds
```

### Context

HITL could modify state directly:

```typescript
// Direct modification (rejected)
labWorld.hitl.approve(proposalId);
// Lab directly applies proposal to state

// Via Authority (chosen)
labWorld.hitl.approve(proposalId);
// Lab notifies Authority
// Authority makes decision
// World applies if approved
```

### Rationale

**Authority is the single point of governance.**

```
Without Authority channel:
  Human ──direct──► State
  LLM ──proposal──► Authority ──► State
  
  Different paths = inconsistent governance

With Authority channel:
  Human ──► HITL ──► Authority ──► State
  LLM ──► Proposal ──► Authority ──► State
  
  Same path = consistent governance
```

**HITL decisions are recorded in DecisionRecord:**

```typescript
// Because HITL goes through Authority:
DecisionRecord {
  decision: 'approved',
  authority: 'hitl-authority',
  metadata: {
    decidedBy: 'human:alice',
    decisionTimeMs: 5000,
    note: 'Approved after review',
  }
}
```

**Authority can add conditions to HITL approval:**

```typescript
// Human approves with narrowed scope
labWorld.hitl.approveWithModification(proposalId, {
  scope: { allowedPaths: ['/tasks/*'] },
});
// Authority enforces the narrowed scope
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Direct state modification | Bypasses governance |
| Separate HITL pathway | Inconsistent with Authority model |
| HITL as special Actor | Adds complexity; same result as Authority |

### Consequences

- HITL is a type of Authority decision
- All decisions have DecisionRecords
- HITL can leverage Authority features (scope, conditions)
- Consistent governance for all actors

---

## FDR-N014: Level-Appropriate Verification

### Decision

Each Necessity Level has a specific verification method with known guarantees:

| Level | Method | Guarantee | Certainty |
|-------|--------|-----------|-----------|
| 0 | `deterministic` | `certain` | Can prove correct AND incorrect |
| 1 | `posterior_consistency` | `consistent` | Can prove incorrect only |
| 2 | `semantic_audit` | `plausible` | Partial proof of incorrect |
| 3 | `user_confirmation` | `confirmed` | Human takes responsibility |

### Context

Verification quality degrades with necessity level:

```
Level 0: 2 + 2 = 4  → Verify: compute 2 + 2, check if 4 ✓
Level 1: "I believe X is hidden" → Verify: is X consistent with observations?
Level 2: "This means Y" → Verify: does a human agree?
Level 3: "User wants Z" → Verify: confirm with user
```

### Rationale

**Verification should match what's provable.**

```
Level 0: Full verification possible
  Can prove: "This is correct"
  Can prove: "This is incorrect"

Level 1: Consistency check possible
  Cannot prove: "This belief is correct" (hidden state)
  Can prove: "This belief contradicts observations"

Level 2: Semantic audit possible
  Cannot prove: "This interpretation is correct" (subjective)
  Can partially prove: "This interpretation seems off"

Level 3: Confirmation only
  Cannot prove: "This grounding is correct" (intent is in user's head)
  Can confirm: "User says this is what they meant"
```

**Authority implementations match level:**

```typescript
function createLevelAuthority(level: NecessityLevel): LevelAuthorityHandler {
  switch (level) {
    case 0: return createDeterministicAuthority();    // Compute & verify
    case 1: return createConsistencyAuthority();      // Check observations
    case 2: return createSemanticAuditAuthority();    // HITL for low confidence
    case 3: return createConfirmationAuthority();     // Always require confirmation
  }
}
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Same verification for all levels | Over-promises for high levels |
| No verification for high levels | Under-delivers; unsafe |
| Probabilistic thresholds only | Doesn't capture structural differences |

### Consequences

- Verification expectations are explicit
- Users know what each level guarantees
- Authority implementations are level-specific
- No false promises of certainty

---

## FDR-N015: Counterfactual Explanations

### Decision

Failure explanations SHOULD include counterfactuals: what minimal change would have led to success?

```typescript
type Counterfactual = {
  change: CounterfactualChange;
  expectedOutcome: 'success' | 'different_failure';
  confidence: 'high' | 'medium' | 'low';
};

type CounterfactualChange =
  | { type: 'add_observation'; observation: unknown }
  | { type: 'relax_constraint'; constraint: string }
  | { type: 'increase_confidence'; to: number }
  | { type: 'resolve_ambiguity'; resolution: unknown }
  | { type: 'obtain_confirmation'; from: string };
```

### Context

Failure without counterfactual:

```
Failure: AUTHORITY_REJECTION
Reason: Confidence too low (0.65)

What now? 🤷
```

Failure with counterfactual:

```
Failure: AUTHORITY_REJECTION
Reason: Confidence too low (0.65)

Counterfactual:
  Change: Increase confidence to 0.80
  Expected outcome: Success
  Confidence: High
  
Actionable: Get more observations to increase confidence
```

### Rationale

**Counterfactuals enable learning and debugging.**

| Question | Counterfactual Answers |
|----------|----------------------|
| "Why did this fail?" | "Because X was missing" |
| "What would fix it?" | "Adding X" |
| "Is the system broken?" | "No, just needs X" |
| "Should we change design?" | "Maybe relax constraint Y" |

**Minimal change is key:**

```
Bad counterfactual: "If everything were different, it would work"
Good counterfactual: "If confidence were 0.80 instead of 0.65, it would work"
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| No counterfactuals | Failures are opaque |
| Complex counterfactuals | Hard to act on |
| Always provide | Sometimes not determinable |

### Consequences

- Rule FE-R4: SHOULD include counterfactual when determinable
- Counterfactuals are structured, not prose
- Confidence level on counterfactual itself
- Enables automated learning from failures

---

## FDR-N016: Projection Components (Domain Renderer Injection)

*(Added in v1.1)*

### Decision

Lab provides **injectable Projection Components** that allow domain-specific visualization without modifying Lab core.

```typescript
type ProjectionComponents = {
  renderSnapshot?: SnapshotRenderer;
  renderAction?: ActionRenderer;
  renderProposal?: ProposalRenderer;
  renderReasoning?: ReasoningRenderer;
  header?: HeaderRenderer;
  footer?: FooterRenderer;
  layout?: LayoutRenderer;
};
```

### Context

Lab faces a fundamental tension:

```
Lab must be domain-agnostic (works with any Manifesto domain)
    BUT
Useful visualization requires domain knowledge

Example:
  Lab sees:  { board: [[0,1,0],[0,0,1]], agent: {x:1,y:2} }
  
  User wants to see:
    ┌───┬───┬───┐
    │   │ ▓ │   │
    │   │   │ ▓ │
    │   │🤖│   │
    └───┴───┴───┘
```

### Rationale

**Inversion of Control: Lab knows WHEN, Domain knows WHAT.**

```
┌─────────────────────────────────────────────────────────────┐
│                      Lab (framework)                        │
│                                                             │
│   Event: snapshot:changed                                   │
│       │                                                     │
│       ▼                                                     │
│   "Time to render snapshot"                                 │
│       │                                                     │
│       ▼                                                     │
│   components.renderSnapshot(snapshot, context)              │
│       │                                                     │
│       │         ┌───────────────────────────────────┐      │
│       └────────►│     Domain Renderer (injected)    │      │
│                 │                                   │      │
│                 │  "I know how to draw this board"  │      │
│                 │                                   │      │
│                 │  return ASCII_ART                 │      │
│                 └───────────────────────────────────┘      │
│       │                                                     │
│       ▼                                                     │
│   Display in terminal                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**This is the classic "Hollywood Principle": Don't call us, we'll call you.**

| Concern | Owner |
|---------|-------|
| When to render | Lab |
| Event routing | Lab |
| Layout structure | Lab (default) or Domain (custom) |
| What to render | Domain |
| How to render | Domain |

**Renderers are pure functions:**

```typescript
// Pure: same input → same output, no side effects
type SnapshotRenderer = (
  snapshot: Snapshot,    // Immutable input
  context: RenderContext // Immutable context
) => string | ReactNode; // Output only, no state mutation
```

This enables:
- Testing in isolation
- Caching/memoization
- Safe concurrent rendering
- No hidden dependencies

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Lab renders everything | Can't know domain semantics |
| Domain controls Lab | Coupling, breaks Lab's abstraction |
| Template system | Too rigid, can't handle complex domains |
| Subclassing | Inheritance hell, not composable |

### Consequences

- Lab remains domain-agnostic
- Domains provide only rendering logic
- Clear separation of concerns
- Renderers are testable pure functions
- BabyBench, TaskFlow, etc. can have custom visualizations
- Default layout works without any components

---

## FDR-N017: HITL Structured Prompting

*(Added in v1.1)*

### Decision

When Authority returns `pending`, Lab generates a **structured HITLPrompt** that can be sent to an Agent (LLM) for autonomous resolution.

```typescript
type HITLPrompt = {
  situation: string;
  currentState: string;      // Rendered by SnapshotRenderer
  yourProposal: unknown;
  whyPending: PendingReason; // Structured reason
  options: HITLAction[];     // Available actions
  responseFormat: unknown;   // Expected response schema
};
```

### Context

Traditional HITL is human-only:

```
Agent → Authority → "pending" → Human decides → continue

Problem: Human must always be present
Problem: Human doesn't scale
```

Modern Agent systems need Agent-to-Agent HITL:

```
Agent A → Authority → "pending" → Agent B (or same Agent) decides → continue

Requirement: Agent B needs structured information to decide
```

### Rationale

**Structure enables reasoning.**

```
Unstructured HITL:
  "Your action was rejected. Please try again."
  
  Agent: "???" (no information to improve)

Structured HITL:
  {
    whyPending: {
      reason: "LOW_CONFIDENCE",
      details: { actual: 0.45, required: 0.70 }
    },
    options: [
      { type: "retry", hint: "Add more reasoning" },
      { type: "modify", allowedModifications: ["direction"] }
    ]
  }
  
  Agent: "I need to increase confidence. Let me add reasoning..."
```

**Reuse of SnapshotRenderer:**

```typescript
// Same renderer used for:
// 1. Projection (human watching)
// 2. HITL prompt (agent deciding)

const prompt = context.toPrompt({
  stateRenderer: myDomainRenderer,  // Reused!
});

// currentState is rendered the same way in both contexts
```

This means:
- Single source of truth for visualization
- Agent sees what human would see
- No separate "agent view" to maintain

**PendingReason ≠ FailureReason:**

| Aspect | PendingReason | FailureReason |
|--------|---------------|---------------|
| Timing | Before decision | After decision |
| Purpose | Enable recovery | Explain failure |
| Actionable | Yes (retry/modify) | No (terminal) |

```
Proposal ──► Authority
                │
                ├── pending + PendingReason ──► HITL ──► recovery possible
                │
                └── rejected + FailureReason ──► terminal, explain only
```

**Available actions are explicit:**

```typescript
// Not "figure out what you can do"
// But "here are your options"

options: [
  { type: 'retry', description: 'Try again with more reasoning' },
  { type: 'modify', allowedModifications: ['direction', 'speed'] },
  { type: 'request_info', suggestedQuestions: ['Is path clear?'] },
  { type: 'abort', description: 'Give up on this goal' },
]
```

Agent doesn't have to guess. Options are enumerated.

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Human-only HITL | Doesn't scale |
| Unstructured error message | Agent can't reason |
| Separate agent view | Maintenance burden |
| Implicit available actions | Agent must guess |

### Consequences

- Agents can autonomously handle HITL
- Same visualization for human and agent
- Structured recovery path
- PendingReason distinct from FailureReason
- Available actions are explicit, not implicit
- Enables "Agent teams" where one agent reviews another

---

## Summary Table

| FDR | Decision | Key Principle |
|-----|----------|---------------|
| N001 | Structural Necessity | LLM only when determinism impossible |
| N002 | LLM as Actor | Equal treatment, equal governance |
| N003 | Proposal-Only Rule | LLM proposes, Authority disposes |
| N004 | Trace-as-Evidence | No trace = not an experiment |
| N005 | Failure-as-Structure | Explain structure, not blame |
| N006 | Four-Level Taxonomy | Distinct structural boundaries |
| N007 | Level Inheritance | Higher levels include lower |
| N008 | Level Detection | Computed, not configured |
| N009 | withLab Pattern | Subject-first, no reuse anti-pattern |
| N010 | World Events | Subscribe, don't plug in |
| N011 | Observer-Only Lab | Observation ≠ participation |
| N012 | Projection Modes | Spectrum from silent to debug |
| N013 | HITL via Authority | Single governance channel |
| N014 | Level Verification | Match verification to provability |
| N015 | Counterfactuals | Minimal change to success |
| N016 | Projection Components | Inject domain-specific renderers *(v1.1)* |
| N017 | HITL Structured Prompting | Enable agent-to-agent HITL *(v1.1)* |

---

## Cross-Reference: Related FDRs

### From World Protocol FDR

| World FDR | Relevance to Lab |
|-----------|------------------|
| Actor registration | LLM uses same Actor interface |
| Authority binding | Level-appropriate Authority |
| Proposal lifecycle | Lab traces proposal events |
| DecisionRecord | HITL decisions recorded here |

### From World Events FDR

| Events FDR | Relevance to Lab |
|------------|------------------|
| FDR-E001 (First-class events) | Lab's observation channel |
| FDR-E002 (Synchronous delivery) | Deterministic trace recording |
| FDR-E003 (Subscribe over plugin) | Lab wraps without plugin |
| FDR-E006 (Non-interference) | Lab as pure observer |

### From Host Contract FDR

| Host FDR | Relevance to Lab |
|----------|------------------|
| Effect execution | Lab traces effect events |
| Patch application | Lab traces patch events |
| Snapshot as channel | Lab observes via snapshot events |

---

*End of Manifesto LLM Necessity & Lab FDR v1.0*
