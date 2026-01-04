# LLM Necessity Profile — Foundational Design Rationale (FDR)

> **Version:** 1.0  
> **Status:** Normative  
> **Purpose:** Document the "Why" behind every constitutional decision in the LLM Necessity Profile

---

## Overview

This document records the foundational design decisions that shape the LLM Necessity Profile.

Each FDR entry follows the format:

- **Decision**: What was decided
- **Context**: Why this decision was needed
- **Rationale**: The reasoning behind the choice
- **Alternatives Rejected**: Other options considered and why they were rejected
- **Consequences**: What this decision enables and constrains

---

## Table of Contents

1. [FDR-N001: LLM as Actor, Not Special Entity](#fdr-n001-llm-as-actor-not-special-entity)
2. [FDR-N002: Structural Necessity as Sole Justification](#fdr-n002-structural-necessity-as-sole-justification)
3. [FDR-N003: Level-Specific Authority, Not Separate Protocol](#fdr-n003-level-specific-authority-not-separate-protocol)
4. [FDR-N004: Level 0 NullLLM Principle](#fdr-n004-level-0-nullllm-principle)
5. [FDR-N005: Proposer-Verifier Separation is Absolute](#fdr-n005-proposer-verifier-separation-is-absolute)
6. [FDR-N006: Verification Strength Degradation is Explicit](#fdr-n006-verification-strength-degradation-is-explicit)
7. [FDR-N007: BeliefState as StateSpec, Not Special Type](#fdr-n007-beliefstate-as-statespec-not-special-type)
8. [FDR-N008: Level Inheritance is Monotonic](#fdr-n008-level-inheritance-is-monotonic)
9. [FDR-N009: Over-Use is Architectural Flaw](#fdr-n009-over-use-is-architectural-flaw)
10. [FDR-N010: Governance Pattern, Not Framework](#fdr-n010-governance-pattern-not-framework)
11. [FDR-N011: Four Levels, Not Continuous Spectrum](#fdr-n011-four-levels-not-continuous-spectrum)
12. [FDR-N012: Rejection Without Retry](#fdr-n012-rejection-without-retry)
13. [FDR-N013: HITL at Level 2+, Not Universal](#fdr-n013-hitl-at-level-2-not-universal)
14. [FDR-N014: Confirmation Level by Stakes](#fdr-n014-confirmation-level-by-stakes)
15. [Summary Table](#summary-table)
16. [Cross-Reference: Related FDRs](#cross-reference-related-fdrs)

---

## FDR-N001: LLM as Actor, Not Special Entity

### Decision

LLM is modeled as an **Actor** with `kind: 'agent'`, following the same World Protocol as humans and systems.

```typescript
world.registerActor({
  actorId: 'llm-gpt4',
  kind: 'agent',  // Same protocol as 'human' and 'system'
  meta: { role: 'belief_proposer', level: 1 },
});
```

### Context

When designing LLM governance, two approaches emerged:

| Approach | Description |
|----------|-------------|
| **Special Entity** | LLM has its own protocol, verification rules, and state management |
| **Actor Model** | LLM is just another Actor in World Protocol |

Initial instinct was to treat LLM as special because:
- LLM outputs are probabilistic
- LLM can hallucinate
- LLM verification is complex

### Rationale

**LLM is not special. Its governance needs are.**

World Protocol already defines:
- Actor registration and identity
- Proposal submission
- Authority binding
- Decision recording

These are exactly what LLM governance needs. The "specialness" is in:
- What Authority validates (verification rules)
- What state LLM can modify (scope)
- How decisions are traced (audit)

**Not in the protocol itself.**

| Concern | Special Entity Approach | Actor Model |
|---------|------------------------|-------------|
| Proposal submission | New protocol | Same protocol ✅ |
| Authority binding | New binding system | Same binding ✅ |
| Decision recording | New audit log | Same DecisionRecord ✅ |
| Verification rules | Custom | Authority handler (composable) ✅ |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Separate LLMProtocol | Duplicates World Protocol, inconsistent |
| LLM as "privileged system" | Bypasses governance, defeats purpose |
| No Actor identity | Can't trace "who" proposed what |

### Consequences

- LLM follows same protocol as all Actors
- Authority binding configures verification per Actor
- DecisionRecord captures LLM decisions
- No special-case code in World Protocol
- LLM governance is composable with existing system

---

## FDR-N002: Structural Necessity as Sole Justification

### Decision

LLM is justified **only** when structurally necessary—when no deterministic function can solve the task.

```typescript
// Structural necessity defined as:
// ∄ f: observable_state → action where f achieves correctness for all instances
```

### Context

LLM usage in AI systems often follows "convenience" rationale:
- "LLM is easier than writing rules"
- "LLM handles edge cases"
- "We don't know the rules, so use LLM"

This leads to systems that:
- Can't explain decisions
- Can't guarantee correctness
- Can't be audited reliably

### Rationale

**Convenience is not necessity. Structural impossibility is.**

| Justification | Valid? | Example |
|--------------|--------|---------|
| "No deterministic solution exists" | ✅ | Hidden state requires belief inference |
| "Rules are complex" | ❌ | Complex ≠ impossible; write the rules |
| "LLM is faster to implement" | ❌ | Speed ≠ necessity |
| "We might miss edge cases" | ❌ | Then enumerate them |

**The question is not "can LLM help?" but "does a non-LLM solution exist?"**

If a deterministic solution exists:
1. It's provably correct
2. It's fully explainable
3. It's reproducible
4. LLM adds only risk, not value

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Allow LLM for "complex" tasks | Subjective, slippery slope |
| Allow LLM when "faster" | Convenience ≠ necessity |
| No structural requirement | Every task uses LLM (anti-pattern) |

### Consequences

- Level 0 tasks MUST be solvable without LLM
- Over-use is a bug, not a feature
- System designers must prove necessity
- Auditors can challenge LLM usage

---

## FDR-N003: Level-Specific Authority, Not Separate Protocol

### Decision

Level-specific verification is implemented as **Authority handlers**, not a separate protocol.

```typescript
// NOT a new protocol
// Just different Authority implementations
const level0Authority = createLevel0Authority(); // Deterministic verification
const level1Authority = createLevel1Authority(); // Posterior consistency
const level2Authority = createLevel2Authority(); // HITL + semantic
const level3Authority = createLevel3Authority(); // User confirmation
```

### Context

Verification requirements differ dramatically by Level:

| Level | Verification | Guarantee |
|-------|-------------|-----------|
| 0 | Deterministic simulation | 100% certain |
| 1 | Posterior consistency | Probabilistically consistent |
| 2 | Semantic audit + human | Plausible |
| 3 | User confirmation | Confirmed |

This could be modeled as:
1. Separate verification protocol per Level
2. Authority handlers with Level-specific logic

### Rationale

**Authority is already the judgment mechanism. Extend it, don't replace it.**

World Protocol defines Authority as:
- Receives Proposal
- Makes decision (approve/reject/pending)
- Records reasoning

This is exactly what Level verification needs. Different Levels need different:
- Validation logic (what to check)
- Decision criteria (when to approve)
- Escalation paths (when to involve humans)

**Not a different protocol—different handler implementations.**

```typescript
// Level 1 Authority: posterior consistency
async evaluate(proposal) {
  const checks = [
    checkObservationConsistency(proposal),
    checkPossibility(proposal),
    checkConfidenceBounds(proposal),
  ];
  
  if (checks.every(c => c.passed)) {
    return { decision: 'approve' };
  }
  return { decision: 'reject', reason: violations.join('; ') };
}
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| LevelVerificationProtocol | Duplicates Authority, inconsistent |
| Verification before Authority | Two-phase approval, complex |
| Single Authority for all Levels | No Level-specific logic |

### Consequences

- One Authority handler per Level
- Authority binding assigns Level-appropriate handler to LLM
- DecisionRecord includes verification details
- Composable with existing HITL patterns

---

## FDR-N004: Level 0 NullLLM Principle

### Decision

A Level 0 compliant system **MUST** achieve equal success rate with `NullLLM` (zero LLM calls) as with actual LLM.

```typescript
// NullLLM: never proposes anything
const nullLLM = {
  propose: () => null,
  callCount: 0,
};

// Level 0 conformance test
expect(
  successRate(system, testSuite, realLLM)
).toEqual(
  successRate(system, testSuite, nullLLM)
);
```

### Context

Level 0 is defined as "fully observable, deterministic, formally specified goal."

If this is true, a deterministic solution exists. If a deterministic solution exists, LLM is unnecessary. If LLM is unnecessary, NullLLM should work.

### Rationale

**NullLLM is the litmus test for Level 0 compliance.**

| Scenario | NullLLM Result | Implication |
|----------|---------------|-------------|
| Equal success rate | Level 0 correct | LLM was optional |
| Lower success rate | Level 0 incorrect | Task is actually Level 1+ |
| Higher success rate | LLM is deciding | FP-U1 violation |

This is falsifiable and testable:

```typescript
// Test suite
const tests = generateLevel0Tasks(1000);

// With real LLM
const llmResults = tests.map(t => solve(t, gpt4));
const llmSuccess = llmResults.filter(r => r.success).length;

// With NullLLM
const nullResults = tests.map(t => solve(t, nullLLM));
const nullSuccess = nullResults.filter(r => r.success).length;

// Level 0 conformance
assert(llmSuccess === nullSuccess);
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| "LLM improves efficiency" | Efficiency ≠ necessity |
| "LLM reduces code complexity" | Shifts complexity, doesn't remove it |
| No NullLLM test | Can't prove Level 0 compliance |

### Consequences

- Every Level 0 system has NullLLM conformance test
- LLM at Level 0 is only for Fact Proposer role (optional)
- If NullLLM fails, task is misclassified
- Clear pass/fail criteria for Level 0

---

## FDR-N005: Proposer-Verifier Separation is Absolute

### Decision

LLM **MUST** never verify its own outputs. Proposer and Verifier **MUST** be separate entities.

```
┌─────────────────────────────────────────┐
│        ABSOLUTE SEPARATION              │
├─────────────────────────────────────────┤
│                                         │
│  LLM (Proposer)                         │
│    │                                    │
│    ▼                                    │
│  Proposal                               │
│    │                                    │
│    ▼                                    │
│  Authority (Verifier) ← NOT LLM         │
│    │                                    │
│    ▼                                    │
│  Decision                               │
│                                         │
└─────────────────────────────────────────┘
```

### Context

Some systems use LLM for "self-verification":
- LLM generates answer
- Same LLM (or another LLM) checks the answer
- If "verified," proceed

This creates a circular trust problem.

### Rationale

**Self-verification is no verification.**

| Verification Type | Mechanism | Trust Level |
|-------------------|-----------|-------------|
| Deterministic | Simulation | Absolute ✅ |
| Human-in-the-Loop | Human judgment | High ✅ |
| LLM-by-LLM | Probability × Probability | Low ❌ |
| Self-check | Same failure mode | Zero ❌ |

If LLM hallucinates "fact X", why would it catch itself when checking "is X true?"

The failure mode is identical—both rely on the same probabilistic model.

**Verifier must have different epistemic access:**
- Level 0: Simulator (deterministic truth)
- Level 1: Observation history (ground truth)
- Level 2: Human (external judgment)
- Level 3: User (intent authority)

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| LLM self-check | Same failure mode, circular trust |
| Multiple LLMs cross-check | Correlated errors, still probabilistic |
| LLM as "sanity check" | Verification theater, false confidence |

### Consequences

- Authority handler MUST NOT invoke proposing LLM
- Verification MUST use independent source of truth
- "LLM said so" is never evidence
- DecisionRecord traces actual verification method

---

## FDR-N006: Verification Strength Degradation is Explicit

### Decision

Higher Levels have weaker verification guarantees. This degradation **MUST** be explicit in trace and documentation.

| Level | Guarantee | Can Prove Correct? | Can Prove Incorrect? |
|-------|-----------|-------------------|---------------------|
| 0 | Certain | ✅ Yes | ✅ Yes |
| 1 | Consistent | ❌ No | ✅ Yes (contradiction) |
| 2 | Plausible | ❌ No | ⚠️ Partially |
| 3 | Confirmed | ❌ No | ⚠️ Partially |

### Context

There's a temptation to claim "all Levels are equally verified" or hide the degradation.

This creates false confidence:
- "The system verified it" (but at what strength?)
- "Authority approved" (but human or auto?)
- "Passed checks" (but what checks?)

### Rationale

**Honest acknowledgment enables appropriate trust calibration.**

Users and auditors need to know:
- What was verified
- How it was verified
- What residual risk remains

```typescript
// Trace entry makes degradation explicit
{
  level: 2,
  verification: {
    method: 'semantic_audit',
    guarantee: 'plausible',  // NOT 'certain'
    residualRisk: 'Interpretation may be wrong',
    humanValidated: false,
    autoChecks: ['internal_consistency', 'assumption_explicit'],
  }
}
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Claim equal verification | Dishonest, creates false confidence |
| Hide Level in trace | Auditors can't assess risk |
| Level as implementation detail | Users need to know |

### Consequences

- Trace includes Level and verification guarantee
- Documentation states residual risk per Level
- Users can make informed trust decisions
- Auditors can identify weak verification

---

## FDR-N007: BeliefState as StateSpec, Not Special Type

### Decision

BeliefState (Level 1), InterpretedRule (Level 2), and GroundingState (Level 3) are defined as **StateSpec fields** using Zod schemas.

```typescript
// NOT special types
// Just Zod schemas in StateSpec
const Level1Schema = NecessityBaseSchema.extend({
  belief: z.object({
    hypotheses: z.array(HypothesisSchema),
    observations: z.array(ObservationSchema),
    beliefUpdatedAt: z.number().nullable(),
  }),
});
```

### Context

Level-specific state could be:
1. Special types with custom runtime
2. StateSpec fields with Zod schemas

### Rationale

**Builder already provides type-safe state definition. Use it.**

| Approach | Type Safety | IDE Support | Validation | Serialization |
|----------|-------------|-------------|------------|---------------|
| Special types | Custom | None | Custom | Custom |
| StateSpec + Zod | ✅ Inferred | ✅ Full | ✅ Built-in | ✅ Built-in |

BeliefState is just state with specific structure:

```typescript
// This is StateSpec, not magic
const belief = {
  hypotheses: [
    { id: 'h1', hiddenState: {...}, confidence: 0.7, ... }
  ],
  observations: [...],
  beliefUpdatedAt: 1704067200000,
};
```

It lives in Snapshot. It's patched by flows. It's computed and explained.

**All Builder/Core features work automatically.**

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| BeliefState runtime | Duplicates Core, inconsistent |
| Special serialization | JSON works fine |
| Custom validation | Zod does this better |

### Consequences

- BeliefState is `/data/belief/*` in Snapshot
- Patches use standard flow operations
- Computed values can derive from belief
- No special runtime needed
- Full IDE autocomplete via Zod inference

---

## FDR-N008: Level Inheritance is Monotonic

### Decision

Higher Levels **inherit all requirements** from lower Levels. A Level 2 system MUST satisfy Level 0 and Level 1 requirements.

```
Level 3 ⊃ Level 2 ⊃ Level 1 ⊃ Level 0
```

### Context

Real-world tasks often combine Levels:

```
"Clean the kitchen" (robot)
├── Level 2: "clean" is ambiguous → Rule interpretation
└── Level 1: sensor uncertainty → Belief state
```

Question: Does Level 2 compliance mean Level 1 requirements can be ignored?

### Rationale

**Higher uncertainty doesn't remove lower uncertainty requirements.**

| Level | Requirement | Inherited By |
|-------|-------------|-------------|
| 0 | Deterministic facts verified | 1, 2, 3 |
| 1 | Beliefs grounded in observations | 2, 3 |
| 2 | Assumptions explicit | 3 |

A Level 3 task still has:
- Observable facts (verify deterministically)
- Hidden state (verify posterior consistency)
- Ambiguous goals (require human validation)
- Language grounding (require user confirmation)

**Each component uses its appropriate verification.**

```typescript
// Task: "Book the usual flight" (Level 3)
// Step 1: Parse language → Level 3 verification (user confirm)
// Step 2: Interpret "usual" → Level 2 verification (semantic audit)
// Step 3: Check availability → Level 0 verification (deterministic)
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Highest Level only | Ignores verifiable components |
| Separate verification tracks | Overcomplicated |
| "Level dominates" | Loses strong verification where available |

### Consequences

- Effective Level = max(Level_observation, Level_rules, Level_language)
- Each component verified at appropriate Level
- Strong verification used where possible
- No "escape hatch" to avoid verification

---

## FDR-N009: Over-Use is Architectural Flaw

### Decision

Using LLM when a deterministic solution exists is an **architectural flaw**, not a feature request or bug.

### Context

Development teams often request:
- "Add LLM to improve UX"
- "Use LLM to handle edge cases"
- "LLM makes it more flexible"

Without clear criteria, LLM proliferates:

```typescript
// Before: deterministic
function getDiscount(tier) {
  return DISCOUNT_TABLE[tier] ?? 0;
}

// After: "improved with AI"
async function getDiscount(tier) {
  return await llm.ask(`What discount for ${tier}?`);
}
```

### Rationale

**Over-use is not a bug that can be fixed. It's a design choice that must be prevented.**

| Classification | Response |
|----------------|----------|
| Bug | Fix the code |
| Feature request | Evaluate and implement |
| **Architectural flaw** | Reject the approach |

Over-use creates:
- Unexplainable decisions
- Non-reproducible behavior
- Audit failures
- Unnecessary costs
- Latency penalties

**The fix is not "better LLM" but "remove LLM."**

```typescript
// Over-use detection
function detectOverUse(task, solution) {
  const hasDeterministicSolution = canSolveDeterministically(task);
  const usesLLM = solution.llmCallCount > 0;
  
  if (hasDeterministicSolution && usesLLM) {
    throw new ArchitecturalFlawError(
      'Task can be solved deterministically but uses LLM'
    );
  }
}
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Log warning for over-use | Ignored, doesn't prevent |
| "LLM is optional optimization" | Enables over-use rationalization |
| No enforcement | LLM proliferates unchecked |

### Consequences

- NullLLM test catches Level 0 over-use
- Code review checks necessity justification
- Architectural review required for LLM addition
- "LLM improves X" is not sufficient justification

---

## FDR-N010: Governance Pattern, Not Framework

### Decision

LLM Necessity Profile is a **governance pattern** using existing Manifesto primitives, not a new framework.

```typescript
// NOT this
import { LLMNecessityFramework } from '@manifesto-ai/necessity';
const system = new LLMNecessityFramework(config);

// BUT this
import { createManifestoWorld } from '@manifesto-ai/world';
import { defineDomain } from '@manifesto-ai/builder';
import { createLevel1Authority } from './necessity-authorities';

// Use existing primitives with necessity pattern
const world = createManifestoWorld({ ... });
world.bindAuthority('llm-actor', 'auth-level-1', createLevel1Authority());
```

### Context

When designing LLM governance, two paths:

| Path | Description |
|------|-------------|
| **New Framework** | Separate package with its own primitives |
| **Pattern** | Conventions for using existing primitives |

### Rationale

**Manifesto already has the right primitives. Combine them, don't replace them.**

| Governance Need | Existing Primitive |
|-----------------|-------------------|
| Actor identity | `world.registerActor()` |
| Proposal submission | `world.submitProposal()` |
| Verification | Authority handler |
| Decision audit | DecisionRecord |
| State schema | Builder StateSpec |
| Level detection | Computed values |

New framework would:
- Duplicate existing functionality
- Create inconsistency
- Require learning new concepts
- Not compose with existing code

**Pattern approach:**
- Reuses existing concepts
- Composes naturally
- No new learning curve
- Documentation, not code

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| `@manifesto-ai/llm-framework` | Duplicates World Protocol |
| Extend Core with LLM primitives | Violates Core purity |
| New verification protocol | Authority already does this |

### Consequences

- No new package required (optional helper utilities)
- Uses existing `@manifesto-ai/world` and `@manifesto-ai/builder`
- Documentation defines the pattern
- Existing Manifesto knowledge applies

---

## FDR-N011: Four Levels, Not Continuous Spectrum

### Decision

Necessity is quantized into **four discrete Levels** (0, 1, 2, 3), not a continuous spectrum.

### Context

Necessity could be modeled as:
- Continuous: 0.0 to 1.0 scale
- Fine-grained: 10+ categories
- Discrete: 4 Levels

### Rationale

**Each Level introduces a qualitatively different LLM role and verification method.**

| Level | New Uncertainty Source | New LLM Role | New Verification |
|-------|----------------------|--------------|------------------|
| 0 | None | None/Fact Proposer | Deterministic |
| 1 | Hidden state | Belief Proposer | Posterior consistency |
| 2 | Implicit rules | Rule Interpreter | Semantic audit |
| 3 | Language meaning | Intent Parser | User confirmation |

These are **categorical differences**, not degree differences:
- Belief vs. Fact is categorical
- Implicit vs. Explicit rules is categorical
- Language vs. Formal specification is categorical

**Continuous spectrum would blur these distinctions.**

Finer granularity (e.g., Level 1.5 for adversarial) can be handled as **sub-profiles**, not new Levels.

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Continuous 0-1 | No clear verification boundaries |
| 10 Levels | Overcomplicates, fuzzy boundaries |
| 2 Levels (LLM/no-LLM) | Loses nuance in verification |

### Consequences

- Clear Level assignment for each task
- Clear verification method per Level
- Sub-profiles can extend without adding Levels
- Simple mental model (4 categories)

---

## FDR-N012: Rejection Without Retry

### Decision

When Authority rejects an LLM proposal, there is **no automatic retry**. The rejection is final for that proposal.

```typescript
// Authority rejects
{ decision: 'reject', reason: 'CONTRADICTS_OBSERVATION' }

// System does NOT:
// - Ask LLM to "try again"
// - Reduce confidence threshold
// - Fall back to different prompt
```

### Context

When LLM output fails verification, intuitive response is:
- "Ask LLM again with different prompt"
- "Maybe it will get it right this time"
- "Retry until verified"

### Rationale

**Retry masks the failure. The failure is information.**

If LLM proposes X and X fails verification:
- LLM's understanding is flawed
- Retry with same context → same flaw
- Different prompt → different but still flawed

**The correct response is:**
1. Log the failure
2. Return to previous state
3. Potentially alert human
4. NOT pretend it didn't happen

```
┌─────────────────────────────────────────┐
│        REJECTION IS FINAL               │
├─────────────────────────────────────────┤
│                                         │
│  LLM proposes X                         │
│    │                                    │
│    ▼                                    │
│  Authority rejects X                    │
│    │                                    │
│    ├──✗──▶ Retry (FORBIDDEN)           │
│    │                                    │
│    └──✓──▶ DecisionRecord logged        │
│            No state change              │
│            Human may intervene          │
│                                         │
└─────────────────────────────────────────┘
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Retry with different prompt | Masks failure, probabilistic fishing |
| Retry until success | Infinite loop risk, no learning |
| Lower threshold on retry | Degrades verification integrity |

### Consequences

- DecisionRecord captures all rejections
- Audit trail shows verification failures
- No "retry until it works" pattern
- Human intervention is explicit, not hidden retry

---

## FDR-N013: HITL at Level 2+, Not Universal

### Decision

Human-in-the-Loop (HITL) is **required at Level 2+ for non-high-confidence interpretations**, not universally required.

| Level | HITL Requirement |
|-------|-----------------|
| 0 | Never (deterministic) |
| 1 | Never (observation-based) |
| 2 | Required for medium/low confidence |
| 3 | Required for active/critical actions |

### Context

Some frameworks require human approval for every LLM output.

This creates:
- Approval fatigue
- Bottleneck on humans
- Defeats LLM automation purpose

### Rationale

**HITL should match verification gap, not be universal.**

| Level | What Can Be Verified Automatically | Gap |
|-------|-----------------------------------|-----|
| 0 | Everything | None → No HITL |
| 1 | Consistency with observations | Hidden state → No HITL (grounded belief sufficient) |
| 2 | Internal consistency | Semantic correctness → HITL needed |
| 3 | Parse success | Intent correctness → HITL needed |

Level 0 and 1 have automated verification sufficient for the guarantee level.

Level 2+ has semantic gaps that only humans (or users) can fill.

```typescript
// Level 2 Authority
if (interpretation.confidence === 'high' && semanticChecks.allPassed) {
  // Auto-approve with flag
  return { decision: 'approve', note: 'auto-high-confidence' };
}

// Medium/low confidence → HITL
return hitlHandler.evaluate(proposal);
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| HITL for all LLM outputs | Approval fatigue, bottleneck |
| No HITL ever | No semantic verification at Level 2+ |
| HITL only for "dangerous" | Subjective, hard to define |

### Consequences

- Level 0/1 operate without HITL
- Level 2 HITL for non-high-confidence interpretations
- Level 3 HITL for active/critical confirmations
- Humans involved only where necessary

---

## FDR-N014: Confirmation Level by Stakes

### Decision

Level 3 user confirmation requirements are determined by **action stakes**, not uniform.

| Stakes | Confirmation Level | Mechanism |
|--------|-------------------|-----------|
| Routine, reversible | Passive | Show intent, proceed unless objected |
| High stakes, external | Active | Require explicit "confirm" |
| Irreversible, financial, legal | Critical | Require re-statement |

### Context

If all Level 3 actions require the same confirmation:
- Low-stakes actions feel burdensome
- High-stakes actions may get rubber-stamped
- Users develop "confirm fatigue"

### Rationale

**Confirmation friction should match stakes.**

```typescript
function determineConfirmation(intent): ConfirmationLevel {
  if (intent.irreversible || intent.financial || intent.legal) {
    return 'critical';  // Must re-state intent
  }
  if (intent.highStakes || intent.externalEffect) {
    return 'active';    // Must click confirm
  }
  if (intent.routine && intent.reversible) {
    return 'passive';   // Proceed unless objected
  }
  return 'active';      // Default
}
```

| Action | Stakes | Confirmation |
|--------|--------|--------------|
| "Set reminder for tomorrow" | Low | Passive |
| "Send email to team" | Medium | Active |
| "Delete all messages" | High (irreversible) | Critical |
| "Transfer $10,000" | High (financial) | Critical |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Uniform "active" for all | Confirmation fatigue |
| No confirmation (auto-proceed) | Dangerous for high stakes |
| User-configured per action | Too complex, users won't configure |

### Consequences

- Low-friction for routine actions
- High-friction for high-stakes actions
- Confirmation requirements documented per action type
- Authority can verify confirmation level matches stakes

---

## Summary Table

| FDR | Decision | Key Principle |
|-----|----------|---------------|
| N001 | LLM as Actor | Protocol uniformity |
| N002 | Structural necessity | Only use LLM when unavoidable |
| N003 | Level-specific Authority | Extend, don't replace |
| N004 | NullLLM principle | Level 0 is LLM-free |
| N005 | Proposer-Verifier separation | No self-verification |
| N006 | Verification degradation explicit | Honest uncertainty |
| N007 | BeliefState as StateSpec | Use existing primitives |
| N008 | Level inheritance | Higher includes lower |
| N009 | Over-use is flaw | Not a feature |
| N010 | Pattern, not framework | Reuse over rebuild |
| N011 | Four discrete Levels | Categorical differences |
| N012 | Rejection without retry | Failure is information |
| N013 | HITL at Level 2+ | Match verification gap |
| N014 | Confirmation by stakes | Friction matches risk |

---

## Cross-Reference: Related FDRs

### From World Protocol FDR

| World FDR | Relevance to Necessity Profile |
|-----------|-------------------------------|
| FDR-W001 (Intent-level governance) | LLM proposals are Intents |
| FDR-W002 (Proposal = Actor + Intent) | LLM has Actor identity |
| FDR-W003 (Actor as first-class) | LLM follows same protocol |
| FDR-W004 (Actor-Authority binding) | Level determines Authority |
| FDR-W005 (Pending is not decision) | HITL waiting is deliberation |
| FDR-W011 (Rejected → no World) | LLM rejection doesn't change state |

### From Builder FDR

| Builder FDR | Relevance to Necessity Profile |
|-------------|-------------------------------|
| FDR-B001 (No string paths) | BeliefState uses FieldRef |
| FDR-B002 (Computed as named facts) | Level detection as computed |
| FDR-B003 (Builder produces schema) | Level state is schema |
| FDR-B007 (Zod-first typing) | BeliefState is Zod schema |

### From Host Contract FDR

| Host FDR | Relevance to Necessity Profile |
|----------|-------------------------------|
| FDR-H001 (Core-Host boundary) | LLM governance in World, not Host |
| FDR-H005 (Handlers never throw) | LLM rejection as data, not exception |
| FDR-H006 (Intent identity) | LLM proposal has stable intentId |
| FDR-H007 (Flow re-entry) | BeliefState updates are re-entry safe |

### From Schema FDR

| Schema FDR | Relevance to Necessity Profile |
|------------|-------------------------------|
| FDR-001 (Core as calculator) | LLM doesn't bypass Core |
| FDR-002 (Snapshot as only medium) | BeliefState in Snapshot |
| FDR-005 (Errors as values) | LLM failure as data |
| FDR-006 (Flow not Turing-complete) | LLM doesn't add complexity to Flow |

---

*End of LLM Necessity Profile FDR v1.0*
