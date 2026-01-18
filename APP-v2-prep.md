# App v2 Prep Notes (Pre-FDR/SPEC)

Scope: These notes summarize constraints and decisions that must be respected
before drafting the App v2 FDR/SPEC. They align with Core v2.0.0, Host v2.0.2,
World v2.0.2, and ARCHITECTURE v2.0. Translator is deprecated in v2.

---

## Non-Negotiable Constraints

- Determinism: Same input must yield same output (Core must be pure).
- Snapshot is the sole medium for state and communication.
- Errors are values (no throw for Core/Host business errors).
- Separation of concerns:
  - Core computes semantics.
  - Host executes effects and applies patches.
  - World governs proposals and lineage.
  - App composes Host + World and owns telemetry.

---

## Core v2.0.0 Contract Highlights

- compute(schema, snapshot, intent) is pure, total, traceable.
- apply(schema, snapshot, patches) returns new Snapshot; no in-place mutation.
- Only patch ops: set, unset, merge.
- Snapshot fields are owned by Core except:
  - meta.timestamp, meta.randomSeed are Host-provided (job-frozen).
- Core never performs IO or uses wall-clock time.

---

## Host v2.0.2 Contract Highlights

- Host owns effect execution and job/run loop.
- Host MUST NOT write system.* fields directly (Core-owned).
- Host-owned state MUST live under data.$host (HOST-NS-*).
- ExecutionKey mailbox and job model are Host concerns.
- TraceEvent is Host-owned; App may transform it into telemetry.

---

## World v2.0.2 Contract Highlights

- World defines HostExecutor interface; App implements it.
- World derives outcome from terminalSnapshot:
  - failed if system.lastError != null or pendingRequirements non-empty.
- World emits governance events only via App-provided EventSink.
- World never imports Host or TraceEvent types.

WorldId / snapshotHash:
- snapshotHash inputs exclude non-deterministic fields.
- data.$host must be excluded from hash input.
- terminalStatus for hash is normalized to completed | failed.
- pendingDigest = hash of sorted requirement IDs.
- worldId = hash({ schemaHash, snapshotHash }) using JCS + SHA-256.
- Full snapshots must not be keyed by snapshotHash (ambiguous).

BaseSnapshot:
- World retrieves baseSnapshot via WorldStore.getSnapshot(baseWorld).
- App provides WorldStore implementation capable of restoring baseSnapshot.

ExecutionKey:
- ExecutionKeyPolicy now takes context:
  - { proposalId, actorId, baseWorld, attempt }
- Default: `${proposalId}:${attempt}`

---

## App v2 Responsibilities

App is the composition root. It is the only layer that imports both Host and
World. App MUST:
- Implement HostExecutor adapter (Host -> World).
- Provide WorldStore implementation for baseSnapshot retrieval.
- Define ExecutionKeyPolicy (default or customized).
- Own telemetry event model and listener mechanics.
- Transform Host TraceEvent into App telemetry events.
- Ensure governance flow goes through World (no direct Host bypass).
- Decide storage strategy for world snapshots and hash inputs.

App MUST NOT:
- Mutate snapshots directly (use Core apply or Host jobs).
- Emit governance events on behalf of World.
- Define or depend on Host internals from World.

---

## Event Ownership (ADR-001)

World-owned events (governance results):
- proposal:submitted, proposal:evaluating, proposal:decided, proposal:superseded
- execution:completed, execution:failed
- world:created, world:forked

App-owned events (telemetry):
- execution:started, execution:compute, execution:patches
- execution:effect:dispatched, execution:effect:fulfilled, etc.

Event constraints:
- Handlers must not mutate World state or await async work.
- Scheduled actions run after dispatch, not as microtasks.

---

## Data Contract: $host Namespace

- data.$host is reserved for Host-owned, transient execution state.
- World excludes data.$host from snapshotHash.
- App should not rely on $host for domain semantics.

---

## Open Decisions for App v2 Spec

1) WorldStore strategy
   - Full snapshot keyed by worldId vs data-only + recompute.
2) ExecutionKey policy defaults
   - Per-proposal vs per-actor vs per-base serialization.
3) Telemetry model
   - Event schema, retention, trace artifact storage.
4) HostExecutor adapter semantics
   - Timeout handling, cancellation (AbortSignal), traceRef handling.
5) App API surface
   - Do we expose raw World/Host or provide a higher-level facade?
6) Runtime structure
   - Internal modules: runtime/, policy/, session/, ui/.
7) Governance UX
   - HITL/tribunal async handling and event-driven updates.

---

## References

- ARCH: `ARCHITECTURE-v2.0.0.md`
- ADR: `ADR-001-layer-seperation.md`
- Core SPEC: `packages/core/docs/SPEC-v2.0.0.md`
- Host SPEC: `packages/host/docs/host-SPEC-v2.0.2.md`
- Host FDR: `packages/host/docs/host-FDR-v2.0.2.md`
- World SPEC: `packages/world/docs/world-SPEC-v2.0.2.md`
- World FDR: `packages/world/docs/world-FDR-v2.0.2.md`
