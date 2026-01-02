# Glossary

<!-- INSTRUCTION:
"같은 단어를 다르게 쓰는 사고"를 방지하는 문서입니다.
프로젝트에서 사용하는 용어의 정확한 정의를 제공합니다.
알파벳/가나다 순으로 정렬하세요.
-->

> **Purpose:** Canonical definitions for all terms used in [PROJECT_NAME].  
> **Rule:** If a term is used differently elsewhere, the definition here takes precedence within this project.

---

## How to Use This Glossary

- Terms are listed **alphabetically**
- Each term includes:
  - **Definition**: What it means in this project
  - **Not to be confused with**: Common misconceptions
  - **See also**: Related terms
- When in doubt, **this glossary is authoritative**

---

## A

### Actor

**Definition:** An entity capable of proposing changes to a World. All actors—human, agent, system—are first-class citizens with equal protocol requirements.

**Not to be confused with:**
- Actor Model (Erlang/Akka) — different concept
- User — Actor is more general, includes non-human entities

**See also:** [Authority](#authority), [Proposal](#proposal)

---

### Authority

**Definition:** An entity that judges Proposals and issues decisions. An Authority does not execute; it only decides.

**Not to be confused with:**
- Authentication — Authority is about decision rights, not identity verification
- Permission — Authority is about judgment, not access control

**See also:** [Actor](#actor), [Decision Record](#decision-record)

---

## C

### Computed

**Definition:** Derived values that are calculated from the current Snapshot state. Computed values are not stored; they are recalculated on demand.

**Not to be confused with:**
- Cached values — Computed has no caching guarantee
- Stored state — Computed is never persisted

**See also:** [Snapshot](#snapshot)

---

### Core

**Definition:** The pure computation layer that evaluates semantic meaning. Core has no side effects, no IO, no network access. Given the same inputs, Core always produces the same outputs.

**Not to be confused with:**
- Runtime — Core is a subset of runtime functionality
- Engine — Core does not "run" anything; it computes

**See also:** [Host](#host), [Snapshot](#snapshot)

---

## D

### Decision Record

**Definition:** An immutable audit log entry created when an Authority issues a terminal decision (approved or rejected) on a Proposal.

**Key properties:**
- Created only for terminal decisions
- Never modified after creation
- Contains approvedScope when approved

**See also:** [Authority](#authority), [Proposal](#proposal)

---

### Domain

**Definition:** The business logic layer defined by the application. A Domain consists of state shape, computed values, actions, and flows.

**Not to be confused with:**
- Domain in DDD — similar but not identical
- Schema — Domain is more than just types

**See also:** [Schema](#schema)

---

## E

### Effect

**Definition:** A declaration of an external operation that Host must execute. Effects are not executed by Core; they are declarations of intent to perform IO.

**Key properties:**
- Declared, not executed (by Core)
- Has a deterministic requirementId
- Results come back as Patches

**Not to be confused with:**
- Side effect — Effects are explicit, not "side"
- Action — Action may produce Effects, but they are different

**See also:** [Requirement](#requirement), [Host](#host)

---

## F

### Flow

**Definition:** A declarative description of a computation sequence. Flows are evaluated by Core and may produce Patches, Effects, or both.

**Key properties:**
- Must be re-entrant (safe to evaluate multiple times)
- Evaluated from the beginning each time
- Progress tracked via Snapshot, not execution position

**Not to be confused with:**
- Workflow — Flow is a lower-level primitive
- Function — Flow is declarative, not imperative

**See also:** [Patch](#patch), [Effect](#effect)

---

## H

### Host

**Definition:** The execution layer that runs Effects and applies Patches. Host is the bridge between Core (pure computation) and the outside world (IO, network, persistence).

**Key properties:**
- Executes Effects declared by Core
- Applies Patches to Snapshots
- Has no intelligence; follows protocol

**Not to be confused with:**
- Server — Host can run anywhere (browser, CLI, server)
- Runtime — Host is a specific role, not the entire runtime

**See also:** [Core](#core), [Effect](#effect)

---

## I

### Intent

**Definition:** A command requesting a domain action. An Intent has a type, optional input, and metadata about its origin.

**Variants:**
- `IntentBody`: The command structure (type + input)
- `IntentInstance`: A specific invocation with unique intentId

**Not to be confused with:**
- Event — Intent is a request, Event is a fact
- Action — Action is the handler, Intent is the request

**See also:** [Proposal](#proposal), [Action](#action)

---

## L

### Lineage

**Definition:** The directed acyclic graph (DAG) of World ancestry. Each World knows its parent World (except genesis).

**Key properties:**
- Fork-only in v1.0 (no merge)
- Append-only (never rewritten)
- Acyclic (no loops)

**See also:** [World](#world)

---

## P

### Patch

**Definition:** A single, atomic mutation to Snapshot data. Patches are the only way to change state.

**Format:** JSON Patch (RFC 6902) operations: `add`, `remove`, `replace`

**Not to be confused with:**
- Diff — Patch is prescriptive, diff is descriptive
- Mutation — Patch is the instruction, mutation is the result

**See also:** [Snapshot](#snapshot)

---

### Proposal

**Definition:** An accountability envelope wrapping an IntentInstance with its submission context. A Proposal tracks who proposed what, from which World, and what decision was made.

**Lifecycle:** `submitted → pending → approved/rejected → executing → completed/failed`

**See also:** [Intent](#intent), [Authority](#authority)

---

## R

### Requirement

**Definition:** A pending Effect waiting to be executed by Host. Requirements are stored in `snapshot.system.pendingRequirements`.

**Key properties:**
- Has deterministic requirementId (content-addressable)
- Must be cleared after execution
- Contains Effect type and parameters

**See also:** [Effect](#effect), [Host](#host)

---

## S

### Schema

**Definition:** The type definition for a Domain. Schema defines the shape of state, validation rules, and computed value specifications.

**See also:** [Domain](#domain), [Snapshot](#snapshot)

---

### Snapshot

**Definition:** The complete state of a system at a point in time. Snapshot is the single source of truth and the only communication channel between Core and Host.

**Structure:**
- `data`: Domain state
- `system`: Runtime state (status, errors, requirements)
- `meta`: Metadata (version, timestamp, hash)
- `computed`: Derived values
- `input`: Transient input data

**Not to be confused with:**
- State — Snapshot is immutable; "state" often implies mutability
- Checkpoint — Snapshot is the active state, not just a backup

**See also:** [Patch](#patch), [World](#world)

---

## W

### World

**Definition:** An immutable snapshot of reality, identified by its content hash. A World is created when a Proposal completes execution (success or failure).

**Key properties:**
- Immutable after creation
- Identified by deterministic worldId
- Forms a lineage DAG

**Not to be confused with:**
- Snapshot — World wraps a Snapshot with governance metadata
- State — World is a committed, immutable record

**See also:** [Snapshot](#snapshot), [Lineage](#lineage), [Proposal](#proposal)

---

## Quick Reference Table

| Term | One-Liner |
|------|-----------|
| Actor | Entity that proposes changes |
| Authority | Entity that judges proposals |
| Computed | Derived values from state |
| Core | Pure computation layer |
| Decision Record | Immutable audit of judgment |
| Domain | Business logic definition |
| Effect | Declaration of external operation |
| Flow | Declarative computation sequence |
| Host | Execution layer (IO bridge) |
| Intent | Command requesting action |
| Lineage | DAG of World ancestry |
| Patch | Atomic state mutation |
| Proposal | Accountability envelope for Intent |
| Requirement | Pending Effect to execute |
| Schema | Type definition for Domain |
| Snapshot | Complete state at a point in time |
| World | Immutable committed Snapshot |

---

*End of Glossary*
