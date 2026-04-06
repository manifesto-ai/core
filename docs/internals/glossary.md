# Glossary

> **Purpose:** Canonical definitions for terms used in maintained Manifesto docs.
> **Rule:** If a term is used differently elsewhere, the current maintained package docs and living specs win over historical archive usage.
> **Current Model:** This glossary follows the current hard-cut surface: Core/Host as canonical substrate layers, SDK as the activation-first public runtime, and Lineage/Governance as explicit decorator protocols.

---

## How to Use This Glossary

- Terms are listed alphabetically.
- Each term includes:
  - **Definition**: What it means in the current project.
  - **Not to be confused with**: Common misconceptions or historical meanings.
  - **See also**: Related current terms.
- Historical or retired meanings are marked explicitly.

---

## A

### Actor

**Definition:** An entity that originates governed change requests. Actors matter on the governed path, where proposals, approval, and sealed history are tracked explicitly.

**Kinds:** `human`, `agent`, `system`

**Not to be confused with:**
- Actor Model - unrelated concurrency concept
- User - Actor is broader and includes non-human callers

**See also:** [Authority](#authority), [Governance](#governance), [Proposal](#proposal)

---

### ActionRef

**Definition:** A type-safe reference to an action on the activated `MEL.actions.*` surface. `ActionRef.name` is the stable public identifier used by `createIntent()`, runtime metadata queries, and SDK introspection.

**Not to be confused with:**
- Raw string action names - string names are not the canonical SDK v3 creation surface
- Intent - `ActionRef` identifies an action; `Intent` is a concrete request to run it

**See also:** [FieldRef](#fieldref), [ComputedRef](#computedref), [Intent](#intent)

---

### Authority

**Definition:** An entity that judges proposals and issues legitimacy decisions. Authority decides; it does not execute effects or apply state.

**Kinds:** `auto`, `human`, `policy`, `tribunal`

**Not to be confused with:**
- Authentication - identity verification
- Permission - static access control

**See also:** [Actor](#actor), [Decision Record](#decision-record), [Governance](#governance)

---

## B

### Bridge

**Definition:** Historical term for application-side translation or glue logic between external events and domain intents. In the current hard-cut model there is no standalone maintained Bridge package in the public runtime story.

**Not to be confused with:**
- Host - Host executes requirements and applies patches
- SDK - SDK owns the public activation/runtime surface

**See also:** [Intent](#intent), [Projection](#projection), [SourceEvent](#sourceevent)

---

## C

### Computed

**Definition:** Derived values calculated from current snapshot data under the schema. Computed values are not persisted as domain state; they are recalculated from the canonical substrate and may be filtered from projected public reads.

**Not to be confused with:**
- Cached values - Computed has no caching guarantee in the public contract
- Stored state - Computed is not authored through patches as domain state

**See also:** [ComputedRef](#computedref), [ExprNode](#exprnode), [Snapshot](#snapshot)

---

### ComputedRef

**Definition:** A type-safe reference to a computed node on the activated `MEL.computed.*` surface. `ComputedRef.name` is the stable public identifier used by SDK introspection and typed access.

**Not to be confused with:**
- Computed values themselves - `ComputedRef` identifies the node; it is not the evaluated value
- FieldRef - state field reference, not a computed reference

**See also:** [ActionRef](#actionref), [Computed](#computed), [FieldRef](#fieldref)

---

### Compiler

**Definition:** The package/layer that compiles MEL into `DomainSchema` and related artifacts consumed by Core and SDK. In the current model it also produces `SchemaGraph` extraction metadata used by SDK introspection.

**Not to be confused with:**
- Core - Core computes over compiled schema but does not compile MEL
- SDK - SDK consumes compiled schema and graph metadata but does not own MEL lowering

**See also:** [DomainModule](#domainmodule), [DomainSchema](#domainschema)

---

### Core

**Definition:** The pure computation layer that evaluates semantic meaning. Core performs deterministic semantic transitions with no IO, wall-clock access, or effect execution.

**Mantra:** "Core computes. Host executes. These concerns never mix."

**Not to be confused with:**
- Host - Host owns execution and requirement fulfillment
- Runtime - Core is only the pure semantic layer

**See also:** [Host](#host), [Semantic Space](#semantic-space), [Snapshot](#snapshot)

---

### Coordinate

**Definition:** A single point in semantic space, represented by snapshot state. At the Core/Host boundary this means the canonical snapshot substrate. At the SDK boundary applications usually observe a projected public read model derived from that same coordinate.

**Key insight:** Manifesto treats state as a position to navigate, not just mutable data to edit.

**See also:** [Semantic Space](#semantic-space), [Snapshot](#snapshot)

---

### Coordinate Calculation

**Definition:** The process by which Core determines the next valid position in semantic space from the current position and an intent.

**Equation:** `compute(schema, snapshot, intent) -> (snapshot', requirements, trace)`

**See also:** [Coordinate](#coordinate), [Core](#core)

---

## D

### Decision Record

**Definition:** A governance-owned immutable audit record created when authority issues a terminal decision on a proposal.

**Key properties:**
- Created for terminal legitimacy decisions
- Immutable once recorded
- Carries the decision outcome and any approved scope when applicable

**See also:** [Authority](#authority), [Governance](#governance), [Proposal](#proposal)

---

### DomainModule

**Definition:** The output of MEL compilation. At minimum it carries compiled `DomainSchema`; some compiler surfaces may also attach helper artifacts or generated facades around that schema.

**See also:** [Compiler](#compiler), [DomainSchema](#domainschema)

---

### DomainSchema

**Definition:** The compiled domain specification understood by Core. It defines state fields, computed fields, actions, and flow/evaluation structure in schema form.

**See also:** [DomainModule](#domainmodule), [Flow](#flow), [Intent](#intent)

---

## E

### Effect

**Definition:** A declaration of external work that Host must fulfill. Effects are declared by Core and executed by Host; Core never performs IO itself.

**Key properties:**
- Declared, not executed, by Core
- Produces requirements for Host fulfillment
- Results re-enter the system through patches/system deltas, not hidden return channels

**Not to be confused with:**
- Side effect - Effects are explicit protocol artifacts
- Action - Actions may declare effects, but are not effects themselves

**See also:** [Host](#host), [Requirement](#requirement)

---

### ExprNode

**Definition:** A node in the pure expression language evaluated by Core.

**Categories:**
- Literals: `string`, `number`, `boolean`, `null`
- Comparisons: `eq`, `ne`, `gt`, `lt`, `gte`, `lte`
- Logical: `and`, `or`, `not`
- Arithmetic: `add`, `sub`, `mul`, `div`
- Collection: `filter`, `map`, `find`, `length`
- Object/value access: `get`, `merge`

**See also:** [Computed](#computed), [FlowNode](#flownode)

---

## F

### FieldRef

**Definition:** A type-safe reference to a state field on the activated `MEL.state.*` surface. `FieldRef.name` is the stable public identifier for the referenced top-level state node.

**Not to be confused with:**
- String paths - user-facing APIs should not require string paths as the canonical surface
- ComputedRef - computed node reference, not state field reference

**See also:** [ActionRef](#actionref), [ComputedRef](#computedref)

---

### Flow

**Definition:** A declarative computation sequence evaluated by Core. A flow may emit patches, requirements, halts, or failures as values in the transition contract.

**Key properties:**
- Must be re-entry safe
- Is evaluated from the beginning on each compute cycle
- Encodes progress through snapshot state, not hidden execution context

**Not to be confused with:**
- Workflow engine - Flow is a smaller deterministic primitive
- Function call stack - Flow is declarative protocol structure

**See also:** [Effect](#effect), [FlowNode](#flownode), [Patch](#patch)

---

### FlowNode

**Definition:** A node in the flow DSL describing declarative state transition behavior.

**Kinds:**
- `seq` - Sequential execution
- `if` - Conditional branching
- `patch` - State mutation declaration
- `effect` - Requirement declaration
- `call` - Invoke another flow
- `halt` - Stop without error
- `fail` - Stop with failure encoded as value

**See also:** [ExprNode](#exprnode), [Flow](#flow)

---

## G

### Governance

**Definition:** The decorator/runtime layer that owns proposal legitimacy, approval flow, decision records, and governed execution. In the current public assembly it is added with `withGovernance()` on top of lineage.

**Not to be confused with:**
- Host - Host executes approved work; governance does not execute
- Lineage - Lineage owns continuity/history, not legitimacy decisions

**See also:** [Authority](#authority), [Lineage](#lineage), [Proposal](#proposal), [World](#world)

---

## H

### Host

**Definition:** The execution layer that fulfills requirements and applies patches/system deltas. Host bridges pure Core computation to external IO and persistence boundaries without owning domain meaning.

**Key properties:**
- Executes requirements declared by Core
- Applies patches to canonical snapshots
- Follows protocol rather than making semantic decisions

**Not to be confused with:**
- Server - Host can run in many environments
- Governance - Host executes; governance judges

**See also:** [Core](#core), [Effect](#effect), [Requirement](#requirement)

---

## I

### Intent

**Definition:** A command requesting a domain action. `Intent` is the current canonical public request object at the SDK/runtime boundary.

**Related low-level forms:**
- `IntentBody` - command body (`type` + input)
- `IntentInstance` - governance-oriented low-level object carrying extra provenance/materialization context

**Not to be confused with:**
- Event - Intent requests change; events describe facts
- ActionRef - `ActionRef` identifies an action; `Intent` requests that it run

**See also:** [ActionRef](#actionref), [Governance](#governance), [Proposal](#proposal)

---

## L

### Lineage

**Definition:** The continuity layer and DAG of sealed world history. In the current public assembly it is added with `withLineage()` and owns sealing, restore, branch/head queries, and stored world lookup.

**Key properties:**
- Append-only continuity/history
- Branch and head semantics are lineage-owned
- Lineage-only environments can create sealed worlds without proposals
- `getWorldSnapshot(worldId)` reads stored sealed canonical substrate

**Not to be confused with:**
- Governance - governance owns legitimacy; lineage owns continuity
- Current visible snapshot - lineage also stores sealed historical worlds

**See also:** [Governance](#governance), [Snapshot](#snapshot), [World](#world)

---

## P

### Patch

**Definition:** A single atomic state mutation instruction. Patches are the only way domain state changes are expressed in the semantic transition model.

**Operations:** `set`, `unset`, `merge`

**Not to be confused with:**
- Diff - a diff describes change after the fact; a patch prescribes change
- Mutable assignment - patches are declarative protocol operations

**See also:** [Flow](#flow), [Snapshot](#snapshot)

---

### Projection

**Definition:** A derived read model produced from canonical substrate. In the current maintained docs, the primary projection is the SDK `Snapshot` returned by `getSnapshot()`, which hides canonical-only substrate while preserving application-facing meaning.

**Not to be confused with:**
- Historical Bridge/App event routing usage - older docs sometimes used "projection" for event-to-intent translation
- Canonical substrate - projection is a derived public view, not the full runtime state

**See also:** [Snapshot](#snapshot), [SourceEvent](#sourceevent)

---

### Proposal

**Definition:** A governance-owned accountability record wrapping an intent with submission and legitimacy context. Proposals exist on governed runtimes; they are not part of the base SDK or lineage-only execution path.

**Key properties:**
- Tracks who requested what and under which legitimacy context
- Advances through governance-controlled judgment/execution states
- Produces decision visibility and auditability on the governed path

**Not to be confused with:**
- Intent - the requested action itself
- World - a sealed historical outcome, not the request record

**See also:** [Authority](#authority), [Decision Record](#decision-record), [Intent](#intent)

---

## R

### Requirement

**Definition:** A pending effect execution declaration awaiting Host fulfillment. Requirements live in canonical `snapshot.system.pendingRequirements` and are intentionally excluded from the projected SDK `getSnapshot()` surface.

**Key properties:**
- Deterministically identified
- Owned by the canonical execution substrate
- Fulfilled by Host, not by Core or SDK projections

**See also:** [Effect](#effect), [Host](#host), [Snapshot](#snapshot)

---

## S

### Semantic Space

**Definition:** The mathematical space defined by a `DomainSchema`. Schema defines dimensions and constraints, snapshots are coordinates in that space, and intents ask for valid movement.

**The foundational model:**
- Schema = space definition
- Snapshot = coordinate
- Intent = navigation command
- Computation = coordinate calculation

**Key insight:** Manifesto asks for the next valid semantic position, not just how to mutate arbitrary data.

**See also:** [Coordinate](#coordinate), [DomainSchema](#domainschema), [Snapshot](#snapshot)

---

### Snapshot

**Definition:** The complete state coordinate of a domain at a point in time. At the Core/Host boundary this means the full canonical substrate. At the SDK/application boundary `getSnapshot()` returns a projected public read model derived from that substrate, while `getCanonicalSnapshot()` exposes the current canonical runtime substrate directly.

**Structure:**
- `data` - domain state; canonical data may also contain reserved platform namespaces under `data.$*`
- `computed` - derived values
- `system` - projected reads expose `status` and `lastError`; canonical substrate also carries `pendingRequirements` and `currentAction`
- `meta` - projected reads expose `schemaHash`; canonical substrate also carries `version`, `timestamp`, and `randomSeed`
- `input` - canonical-only transient action input

**Current contract note:** accumulated `system.errors` is not part of the current canonical snapshot contract.

**Not to be confused with:**
- State - snapshot emphasizes immutable whole-truth state, not mutable variables
- World - a world is a sealed historical coordinate, not just the current visible runtime read

**See also:** [Coordinate](#coordinate), [Projection](#projection), [World](#world)

---

### SourceEvent

**Definition:** Historical term from older Bridge/App documents for an external signal that could be translated into an intent. It is not a primary term in the current maintained SDK/Lineage/Governance package surface.

**Not to be confused with:**
- Intent - current public command object
- Event payloads on runtime telemetry channels - those are runtime events, not this older routing term

**See also:** [Bridge](#bridge), [Intent](#intent), [Projection](#projection)

---

## W

### World

**Definition:** An immutable sealed point in lineage history. In the current hard-cut model, "world" is a concept and governed composition path, not a top-level facade package.

**Key properties:**
- Immutable once sealed
- Participates in lineage history/branch structure
- May exist with or without proposal provenance depending on whether governance is active
- Governed composition is expressed through `createManifesto() -> withLineage() -> withGovernance() -> activate()`

**Not to be confused with:**
- `@manifesto-ai/world` - retired facade package, no longer the current public entry
- Snapshot - snapshot is the runtime coordinate; world is the sealed historical record of such a coordinate

**See also:** [Governance](#governance), [Lineage](#lineage), [Snapshot](#snapshot)

---

## Quick Reference Table

| Term | One-Liner |
|------|-----------|
| ActionRef | Typed action identifier on `MEL.actions.*` |
| Actor | Entity that originates governed change requests |
| Authority | Entity that judges proposals |
| Bridge | Historical translation/glue term, not a current package |
| Computed | Derived value from snapshot state |
| ComputedRef | Typed computed identifier on `MEL.computed.*` |
| Compiler | MEL-to-schema and graph extraction layer |
| Core | Pure semantic computation layer |
| Coordinate | A point in semantic space |
| Coordinate Calculation | Finding the next valid semantic position |
| Decision Record | Immutable audit of a terminal legitimacy decision |
| DomainModule | Compiler output carrying compiled domain artifacts |
| DomainSchema | Compiled domain specification understood by Core |
| Effect | Declaration of external work |
| ExprNode | Pure expression node |
| FieldRef | Typed state-field identifier on `MEL.state.*` |
| Flow | Declarative transition sequence |
| FlowNode | Node in the flow DSL |
| Governance | Legitimacy/approval decorator layer |
| Host | Execution and fulfillment layer |
| Intent | Canonical public command object |
| Lineage | Continuity layer and world-history DAG |
| Patch | Atomic mutation instruction |
| Projection | Derived public read model from canonical substrate |
| Proposal | Governance-owned accountability record |
| Requirement | Pending effect execution declaration |
| Semantic Space | Mathematical space defined by `DomainSchema` |
| Snapshot | Complete state coordinate at a point in time |
| SourceEvent | Historical event-routing term |
| World | Immutable sealed point in lineage history |

---

*End of Glossary*
