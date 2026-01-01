# Manifesto Constitution

**Version:** 1.2  
**Status:** Normative  
**Effective Date:** 2025-12-31

---

## Preamble

This document defines the immutable constitutional principles of the Manifesto system.

These principles do not describe how Manifesto is implemented.
They define what Manifesto **is** and **is not**.

Any system that violates these principles—regardless of naming, APIs, or surface similarity—
is not considered a Manifesto-compliant system.

This Constitution exists to protect semantic integrity, accountability, and determinism.
It is intentionally restrictive.

---

## Normative Scope and References

This Constitution is the highest normative authority in the Manifesto project.

Specifications (SPECs) define formal contracts that operate under this Constitution.
Where a SPEC appears to conflict with this Constitution, the Constitution prevails.

Terms used in this Constitution (e.g., Intent, Actor, Authority, Snapshot)
are defined precisely in their respective SPECs.
This Constitution establishes constraints; SPECs provide definitions and contracts.

---

## I. Foundational Axioms

### Axiom 1 — Snapshot Immutability

A Snapshot is immutable once created.

No component may mutate a Snapshot in place.
All state transitions MUST result in the creation of a new Snapshot.

A system that mutates state without Snapshot replacement
violates this Constitution.

---

### Axiom 2 — Snapshot as the Sole Medium

Snapshot is the only medium of communication between Core and Host.

There are no other valid channels:
no return values carrying semantic state,
no callbacks,
no events,
no shared context objects.

Effect execution outcomes (success, failure, data)
MUST be represented in Snapshot before Core can observe them.

**Canonical Statement:** If it is not represented in Snapshot, it does not exist.

---

### Axiom 3 — Patch Exclusivity

Patch is the only legal mechanism for changing state.

All state transitions MUST be expressible as a set of Patches
applied to a prior Snapshot.

Any state change not representable as Patch application
is invalid.

---

### Axiom 4 — Deterministic Computation

Given the same inputs, Core MUST always produce the same outputs.

Core computation is pure and deterministic.
Hidden state, randomness, IO, or temporal dependence
are forbidden within Core.

---

### Axiom 5 — Separation of Meaning and Execution

Core computes semantic meaning.
Host executes external effects.

**Core Constraints:**
Core MUST NOT perform IO, side effects, or execution.

**Host Constraints:**
Host MUST NOT perform semantic judgment, interpretation, or policy decision-making.
Host MAY observe and report execution outcomes (success, failure, timeout, error).
Host MUST NOT use those outcomes to alter system behavior
beyond faithfully representing them in Snapshot.

This separation is absolute.

---

### Axiom 6 — World as the Unit of Governed Reality

A World represents a committed version of reality.

World operates above Core and Host.
It governs which Intent-level transitions are permitted,
but does not replace computation or execution.

**World Constraints:**
World does not compute meaning (Core responsibility).
World does not execute effects (Host responsibility).
World governs admissibility and accountability.

---

### Axiom 7 — Explicit Governance at Intent Level

All Intent-level state transitions are governed.

Every Intent MUST be attributable to:

* a Proposal submitted by an Actor
* a Decision rendered by an Authority

**Implicit Authorization:**
Patches produced by Core during execution of a governed Intent,
and patches returned by Host effect handlers during that Intent's execution,
are implicitly authorized by the original Intent approval.

Governance occurs at Intent boundaries, not at individual Patch boundaries.

---

### Axiom 8 — Flow Is Not a General-Purpose Language

Flow is a declarative description of state transitions.

Flow is intentionally not Turing-complete.
Flow is intentionally not a general-purpose programming language.

Systems MUST NOT rely on Flow as an arbitrary execution model.

Any system that treats Flow as a general execution engine
violates this Constitution.

---

## II. Roles and Sovereignty

### Actor Sovereignty

Actors propose change.
Actors do not apply change.

Actors do not mutate state.
Actors do not execute effects.
Actors do not make governance decisions.

An Actor that mutates state directly
is not Manifesto-compliant.

---

### Authority Sovereignty

Authorities judge proposals.

Authorities may:
* approve proposed changes
* reject proposed changes
* constrain the scope of proposed changes

**Authority Constraints:**
Authorities MUST NOT alter the semantic content of an Intent.
Authorities do not execute effects.
Authorities do not compute meaning.
Authorities do not apply patches.

An Authority that executes effects, applies patches,
or rewrites Intent semantics
violates this Constitution.

---

### World Sovereignty

World governs admissibility and accountability of Intent-level transitions.

**World Obligations:**
World MUST produce auditable artifacts for governance decisions,
including proposal records, decision records, lineage, and attributable metadata.

**World Constraints:**
World MUST NOT execute effects.
World MUST NOT apply patches.
World MUST NOT introduce hidden decision channels outside Snapshot.

---

### Core Sovereignty

Core computes meaning only.

Core evaluates flows, expressions, and transitions.
Core produces patches and effect declarations.

**Core has no knowledge of:**
* IO
* networks
* persistence
* wall-clock time
* external systems

Any Core implementation that performs execution
is invalid.

---

### Host Sovereignty

Host executes effects faithfully and applies approved patches mechanically.

**Host Responsibilities:**
Host applies Patches (approved through governance).
Host executes Effects (declared by Core).
Host reports outcomes faithfully through Snapshot.

**Host Constraints:**
Host makes no semantic decisions.
Host makes no policy decisions.
Execution feedback enters the system only through Snapshot (Axiom 2).

A Host that suppresses, alters, or reinterprets Effects
violates this Constitution.

---

### Bridge Sovereignty

Bridge is a projection and routing layer.

Bridge routes SourceEvents into Intent creation.
Bridge routes Snapshot updates to subscribers.

**Bridge Constraints:**
Bridge is bound by the same prohibitions as Host.
Bridge MUST NOT mutate Snapshot.
Bridge MUST NOT apply Patches.
Bridge MUST NOT execute Effects.
Bridge MUST NOT perform governance decisions.

Bridge is a projection layer, not an authoritative actor.

---

## III. Forbidden Patterns

### Forbidden — Intelligent Host

A Host that suppresses, alters, or reinterprets an Effect declared by Core
is forbidden.

Host MAY fail effect execution due to external circumstances
(network failure, timeout, resource unavailability).
Host MUST report such failures faithfully through Snapshot.

Host MUST NOT introduce independent decision logic
that changes the meaning or admissibility of Core-declared Effects.

**Valid:** Reporting that an API call returned 429 (rate limited).
**Invalid:** Deciding not to execute an Effect because Host deems it unnecessary.

---

### Forbidden — Direct State Mutation

Any system where application state is mutated
outside Patch application
is invalid.

This includes:
* in-place mutation of Snapshot
* hidden backchannels between components
* implicit side effects that modify state without Patch representation

---

### Forbidden — Implicit Authority

Any system where approval or rejection of change
is implicit, automatic, or untraceable
violates this Constitution.

All governance decisions MUST be explicit and auditable.

Even "auto-approve" authorities MUST produce decision records.

---

### Forbidden — Execution-Aware Core

A Core that branches logic based on execution outcomes,
external state, or side-effect results
is forbidden.

Core computes meaning only.
Execution feedback enters solely through Snapshots (Axiom 2).

Core MAY read effect results from Snapshot.
Core MUST NOT have direct knowledge of execution.

---

### Forbidden — Hidden Continuation State

A runtime that relies on hidden execution cursors, suspended stacks,
or opaque resumable state outside Snapshot
is forbidden.

**Progress Representation:**
If execution progress exists, it MUST be represented in Snapshot.

Examples of progress that MUST be in Snapshot:
* which effects have been fulfilled
* intermediate computation results needed for continuation
* pending requirements awaiting fulfillment

Examples that MAY remain outside Snapshot:
* transient retry counts within a single effect execution attempt
* Host-internal instrumentation and metrics
* logging and observability data

---

## IV. Non-Goals

This Constitution does not define:

* API shapes or method signatures
* programming languages or type systems
* UI frameworks or rendering strategies
* persistence layers or storage backends
* network protocols or transport mechanisms
* LLM integration strategies or prompt engineering

These choices are intentionally left open,
provided all constitutional principles are preserved.

---

## V. Amendments

This Constitution may be amended only if
a foundational contradiction or systemic failure
is demonstrated.

**Insufficient Grounds for Amendment:**
* convenience
* performance optimization
* developer preference
* stylistic consistency
* ecosystem compatibility

**Valid Grounds for Amendment:**
* two axioms that logically contradict each other
* an axiom that makes a required operation impossible
* a forbidden pattern that conflicts with a sovereignty rule
* a gap that allows Constitution-violating systems to claim compliance

**Preservation Requirements:**
Any amendment must preserve:
* determinism
* accountability
* explicit governance
* semantic integrity

---

## VI. Compliance

### Compliance Statement

A system claiming Manifesto compliance MUST:

1. Satisfy all Foundational Axioms (Section I)
2. Respect all Role Sovereignties (Section II)
3. Avoid all Forbidden Patterns (Section III)

Partial compliance is not recognized.
A system that violates any single axiom, sovereignty, or forbidden pattern
is not Manifesto-compliant.

### Compliance Verification

Compliance may be verified through:

* **Axiom Testing:** Demonstrate that each axiom holds under test scenarios
* **Boundary Testing:** Verify that sovereignty boundaries are not crossed
* **Pattern Detection:** Confirm absence of all forbidden patterns
* **Audit Trail:** Verify that governance produces traceable records

---

## Closing Statement

This Constitution exists to draw a hard boundary.

It does not promise ease of use.
It does not promise universality.
It does not promise compatibility with arbitrary systems.

It promises that every state change is meaningful,
every decision is accountable,
and every outcome is explainable.

Any system that compromises these principles
may be useful—but it is not Manifesto.

---

## Appendix A: Axiom Reference

For stable cross-referencing, axioms should be cited by name:

| Section | Name | Summary |
|---------|------|---------|
| Axiom 1 | Snapshot Immutability | Snapshots are never mutated in place |
| Axiom 2 | Snapshot as Sole Medium | All Core-Host communication through Snapshot |
| Axiom 3 | Patch Exclusivity | Only Patches may change state |
| Axiom 4 | Deterministic Computation | Same inputs produce same outputs |
| Axiom 5 | Separation of Meaning and Execution | Core computes, Host executes |
| Axiom 6 | World as Governed Reality | World governs Intent admissibility |
| Axiom 7 | Explicit Governance | All Intents require Proposal and Decision |
| Axiom 8 | Flow Is Not General-Purpose | Flow is declarative, not Turing-complete |

**Citation Format:** `Constitution Axiom 5 (Separation of Meaning and Execution)`

---

## Appendix B: Sovereignty Quick Reference

| Role | May Do | Must Not Do |
|------|--------|-------------|
| **Actor** | Propose change | Mutate state, execute effects, govern |
| **Authority** | Approve, reject, constrain scope | Execute, compute, apply patches, rewrite Intent |
| **World** | Govern, audit, maintain lineage | Execute, apply patches, hidden channels |
| **Core** | Compute meaning, declare effects | IO, execution, time-awareness |
| **Host** | Execute effects, apply patches, report | Decide, interpret, suppress effects |
| **Bridge** | Route events, project snapshots | Mutate, apply, execute, govern |

---

## Appendix C: Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-30 | Initial draft |
| 1.1 | 2025-12-31 | Added Axiom 2, 8; Bridge Sovereignty; Pause/Resume pattern |
| 1.2 | 2025-01-01 | Clarified Host judgment vs reporting; Authority scope constraints; implicit authorization scope; progress representation; compliance section; appendices |

---

*End of Manifesto Constitution v1.2*
