# Manifesto Host v2.0.2 Compliance Roadmap

## Scope
- Align implementation, SPEC, and FDR to Host Contract v2.0.2.
- Prioritize MUST-level gaps: mailbox/job model, context determinism, snapshot ownership.
- Keep Core pure and deterministic; Host remains IO executor only.

## Target Decisions (Baseline)
- Execution policy: ORD-SERIAL (single in-flight requirement per ExecutionKey).
- Host-owned state location: data.$host only.
- Job handlers: synchronous, no await; Host uses Core sync compute path.
- Error recording: host writes to data.$host (or domain error paths), never system.*.

## Phase 1 - Documentation and FDR Alignment
- Add `packages/host/docs/host-FDR-v2.0.2.md` with a strong FDR for snapshot ownership:
  - FDR-H025: Snapshot Ownership Alignment (Host MUST NOT write system.*; Host-owned state lives in data.$host).
  - Explicit consequences: replay safety, determinism, zero hidden state.
- Update `packages/host/docs/VERSION-INDEX.md` to reference FDR v2.0.2.
- Update `packages/host/docs/host-SPEC-v2.0.2.md`:
  - Clarify host-owned error paths (data.$host) and remove system.* examples.
  - Add explicit ORD-SERIAL default statement and reference to policy.
  - Emphasize JOB-2/INV-EX-3 with sync job handlers.
- Mark `docs/rationale/host-fdr.md` as historical or superseded by package FDR to avoid normative conflict.

## Phase 2 - Core API Alignment (Sync Compute Path)
- Add sync requirement-id path using sha256Sync and JCS inputs from v2.0.2.
- Provide `computeSync(...)` or equivalent in Core while keeping async API for compatibility.
- Ensure sync path shares logic with async path to avoid divergence.
- Update Core SPEC to document sync entrypoint and browser-safe hashing.
- Add/extend Core tests: determinism, parity between compute and computeSync.

## Phase 3 - Host Implementation Changes
- Job handlers:
  - Remove await in job handlers and runner; use Core sync compute.
  - Reset frozen context at each job start.
- Snapshot ownership:
  - Move intent slots and host bookkeeping into data.$host via patches.
  - Remove any Host writes to system.status, system.lastError, system.errors, system.currentAction.
- Effect execution and ordering:
  - Enforce ORD-SERIAL per ExecutionKey (single in-flight requirement).
  - Reinject results strictly in pendingRequirements order.
- Error handling:
  - Record effect failures under data.$host (or domain path), not system.*.
  - Always clear requirement and enqueue ContinueCompute.

## Phase 4 - Tests and Compliance
- Update Host HCTS suite to reflect data.$host error recording and snapshot ownership.
- Add explicit tests for:
  - No system.* writes by Host.
  - Per-job frozen context (CTX-1..5).
  - ORD-SERIAL ordering and deterministic reinjection.
  - Requirement clear even on apply failure.
- Update golden traces to include new context and host-owned state behavior.

## Phase 5 - Migration and Examples
- Update `packages/host/docs/MIGRATION.md` with breaking changes.
- Update examples in Core/Host docs to avoid system.* writes by Host.

## Risks and Open Items
- API change surface: introducing computeSync affects public API and tooling.
- RequirementId algorithm alignment may change hashes; verify downstream expectations.
- ExecutionKey mapping for dispatch API: decide if dispatch must accept an explicit key.
