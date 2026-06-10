# Architecture

> **Version:** 3.0
> **Status:** Normative
> **Last Updated:** 2026-04-06

---

## Overview

Manifesto computes deterministic domain state transitions. The conceptual core
is:

```text
MEL -> Core -> Host
rules  compute execute
```

MEL declares domain transition rules. Core computes semantic transitions from
schema, snapshot, intent, and context. Host fulfills declared effects and
converges snapshots.

The current package story follows that base runtime first:

- `@manifesto-ai/compiler` optionally lowers MEL into `DomainSchema`
- `@manifesto-ai/core` computes semantic meaning
- `@manifesto-ai/host` executes requirements and applies transitions
- `@manifesto-ai/sdk` is the default application-facing runtime surface
- `@manifesto-ai/lineage` optionally adds history, sealing, restore, and branch/head queries
- `@manifesto-ai/governance` optionally adds proposal flow, approval, policy, and delegation

No top-level facade sits above SDK, Lineage, and Governance in the active public runtime story.

---

## Current Layer Model

### Base Runtime

```text
caller -> SDK (`createManifesto` -> `activate`)
       -> Host
       -> Core
```

### Optional Approval/History Runtime

```text
caller -> withLineage -> withGovernance -> activate
       -> SDK runtime
       -> Host
       -> Core
```

### Optional MEL Frontend

```text
MEL source -> Compiler -> DomainSchema -> SDK / Host / Core
```

---

## Design Principles

1. **Core computes meaning.** It remains pure and deterministic.
2. **Host fulfills declared work.** It executes effects and applies transitions.
3. **SDK owns the direct-submit runtime.** It is the default application-facing surface.
4. **Approval and history are optional decorators.** They add policy and continuity concerns without replacing Host/Core boundaries.
5. **Snapshot remains the only medium.** Cross-layer information still flows through Snapshot, not hidden callbacks or side channels.

---

## Layer Definitions

### Compiler

> **One-liner:** Optional MEL frontend.

| Aspect | Definition |
|--------|------------|
| **Role** | Parse, validate, and lower MEL into `DomainSchema` |
| **Primary API** | MEL plugins, compiler entrypoints, schema extraction helpers |
| **Owns** | MEL syntax, validation, lowering, schema derivation |
| **Does NOT Know** | Runtime execution, dynamic patch target resolution, approval decisions, effect fulfillment |

### Core

> **One-liner:** Pure semantic computation.

| Aspect | Definition |
|--------|------------|
| **Role** | Compute meaning from schema + snapshot + intent |
| **Primary API** | `compute()`, `apply()`, `applySystemDelta()` |
| **Owns** | Semantic truth, patch/system transitions, computed evaluation |
| **Does NOT Know** | IO, execution loops, approval policy, lineage, runtime assembly |

### Host

> **One-liner:** Effect execution and convergence engine.

| Aspect | Definition |
|--------|------------|
| **Role** | Execute requirements, apply domain patches, namespace deltas, and system deltas, drive compute to terminal state |
| **Primary API** | `createHost()`, `dispatch()`, effect registration |
| **Owns** | Mailbox/job model, effect execution, ADR-027 context materialization |
| **Does NOT Know** | Approval policy, proposal semantics, branch/head history |

### SDK

> **One-liner:** Default application runtime.

| Aspect | Definition |
|--------|------------|
| **Role** | Compose the base runtime and present the public app-facing API |
| **Primary API** | `createManifesto()`, `activate()`, `action.<name>.submit()`, `snapshot()` |
| **Owns** | Runtime assembly, telemetry, projected reads, public action surface |
| **Does NOT Know** | Core internals, approval policy internals, lineage storage internals |

### Lineage

> **One-liner:** Continuity and history decorator.

| Aspect | Definition |
|--------|------------|
| **Role** | Add sealing, restore, branch/head queries, and stored Lineage records |
| **Primary API** | `withLineage()`, `action.<name>.submit()`, `restore()`, lineage queries |
| **Owns** | Lineage records, branch/head refs, seal records, stored canonical snapshots |
| **Does NOT Know** | Host execution micro-steps, approval policy semantics |

### Governance

> **One-liner:** Approval and policy decorator.

| Aspect | Definition |
|--------|------------|
| **Role** | Add proposal lifecycle, approval/rejection, policy evaluation, and review-gated publication |
| **Primary API** | `withGovernance()`, `action.<name>.submit()`, settlement/proposal queries, policy seams |
| **Owns** | Approval policy, decision recording, review-gated execution admission |
| **Does NOT Know** | Host execution micro-steps, Core semantic internals, implicit lineage creation |

---

## Boundary Matrix

| Layer | Must Not Know |
|-------|---------------|
| **Compiler** | Runtime execution, dynamic patch target resolution, effect fulfillment, governance policy |
| **Core** | IO, wall-clock behavior, execution loops, approval/history policy |
| **Host** | Dynamic patch target resolution, approval decisions, proposal semantics, branch/head policy |
| **SDK** | Core internals, lineage storage internals, governance policy internals |
| **Lineage** | Host execution micro-steps, approval logic |
| **Governance** | Host execution micro-steps, implicit continuity ownership |

---

## Dependency Direction

```text
Application -> Compiler (optional)
Application -> SDK

Optional extensions:
Application -> withLineage -> withGovernance -> activate

Governance -> Lineage
Lineage -> SDK
SDK -> Host
Host -> Core
Compiler -> Core (schema contract)
```

The important current ownership rule is that the approval/history runtime builds
on the SDK runtime. SDK no longer re-exports or owns a separate approval/history
bootstrap package.

---

## Runtime Ownership

### Base Runtime Surface

The base activated instance lives in SDK and owns:

- projected `snapshot()`
- canonical `inspect.canonicalSnapshot()`
- action check, preview, and submit
- availability queries through action handles and `inspect.availableActions()`
- projected introspection such as `inspect.graph()`
- execution telemetry for the base runtime

### Optional Approval/History Runtime Surface

When the approval/history packages are composed in, they add:

- continuity and sealing
- restore and stored Lineage record snapshot lookup
- branch/head queries
- proposal lifecycle and approval decisions

They do not replace Host or Core and they do not reintroduce a facade-owned execution layer.

---

## Public Composition Patterns

### Direct Dispatch

```typescript
const app = createManifesto(schema, effects).activate();
await app.action.someAction.submit();
```

### Optional Extension Composition

```typescript
const manifesto = createManifesto(schema, effects);
const lineage = withLineage(manifesto, lineageOptions);
const approvalRuntime = withGovernance(lineage, governanceOptions).activate();
```

---

## Evolution Rules

### When Core Changes

- Host absorbs execution-side consequences
- SDK surface adjusts only where public runtime exposure changes
- approval/history packages adjust only if their stored/runtime contracts depend on the changed substrate

### When Host Changes

- SDK absorbs direct-runtime integration changes
- approval/history packages adapt only as consumers of the SDK runtime/decorator chain

### When Governance Or Lineage Changes

- their owning package specs and guides change first
- SDK does not become the owner of approval policy or continuity semantics

### Adding New Features

| Feature Type | Where It Belongs |
|--------------|------------------|
| New MEL syntax | Compiler |
| New semantic operator or transition rule | Core |
| New effect execution behavior | Host |
| New direct-runtime convenience | SDK |
| New continuity/history capability | Lineage |
| New approval/proposal capability | Governance |

---

## Compliance Checklist

An implementation is aligned with the current architecture only if:

- [ ] Core stays pure and deterministic
- [ ] Host executes requirements without making approval or policy decisions
- [ ] SDK remains the default direct-submit runtime entry
- [ ] approval/history composition is explicit and happens before activation
- [ ] no maintained public story depends on a retired top-level facade
- [ ] Snapshot remains the only cross-compute communication medium

---

## Summary

| Layer | Owns |
|-------|------|
| Compiler | MEL frontend and lowering |
| Core | Semantic truth |
| Host | Execution and convergence |
| SDK | Direct runtime surface |
| Lineage | Continuity and history |
| Governance | Approval and policy |

---

## Related Documents

- [Architecture Index](/architecture/)
- [When You Need Approval or History](/guides/approval-and-history)
- [Lineage Records](/concepts/lineage-records)
- [SDK API](/api/sdk)
- [Lineage API](/api/lineage)
- [Governance API](/api/governance)
- [SPEC Index](/internals/spec/)
