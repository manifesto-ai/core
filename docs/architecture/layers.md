# Architecture

> **Version:** 3.0
> **Status:** Normative
> **Last Updated:** 2026-04-06

---

## Overview

Manifesto's current architecture is a layered system with one semantic core, one execution engine, one default application runtime, and two optional governed decorators.

The current package story is:

- `@manifesto-ai/compiler` optionally lowers MEL into `DomainSchema`
- `@manifesto-ai/sdk` is the default application entry
- `@manifesto-ai/host` executes requirements and applies transitions
- `@manifesto-ai/core` computes semantic meaning
- `@manifesto-ai/lineage` adds continuity, sealing, restore, and history
- `@manifesto-ai/governance` adds legitimacy, proposal flow, and authority

There is no current top-level `@manifesto-ai/world` facade in the active public runtime story.

---

## Current Layer Model

### Base Runtime

```text
caller -> SDK (`createManifesto` -> `activate`)
       -> Host
       -> Core
```

### Governed Composition

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
3. **SDK owns the direct-dispatch runtime.** It is the default application-facing surface.
4. **Governance and Lineage are explicit decorators.** They add legitimacy and continuity without replacing Host/Core boundaries.
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
| **Does NOT Know** | Runtime execution, approval decisions, effect fulfillment |

### Core

> **One-liner:** Pure semantic computation.

| Aspect | Definition |
|--------|------------|
| **Role** | Compute meaning from schema + snapshot + intent |
| **Primary API** | `compute()`, `apply()`, `applySystemDelta()` |
| **Owns** | Semantic truth, patch/system transitions, computed evaluation |
| **Does NOT Know** | IO, execution loops, authority, lineage, runtime assembly |

### Host

> **One-liner:** Effect execution and convergence engine.

| Aspect | Definition |
|--------|------------|
| **Role** | Execute requirements, apply patches/system delta, drive compute to terminal state |
| **Primary API** | `createHost()`, `dispatch()`, effect registration |
| **Owns** | Mailbox/job model, effect execution, deterministic host context |
| **Does NOT Know** | Proposal legitimacy, authority policy, branch/head history |

### SDK

> **One-liner:** Default application runtime.

| Aspect | Definition |
|--------|------------|
| **Role** | Compose the direct-dispatch runtime and present the public app-facing API |
| **Primary API** | `createManifesto()`, `activate()`, `createIntent()`, `dispatchAsync()` |
| **Owns** | Direct runtime assembly, telemetry, projected reads, public instance surface |
| **Does NOT Know** | Core internals, authority policy internals, lineage storage internals |

### Lineage

> **One-liner:** Continuity and history decorator.

| Aspect | Definition |
|--------|------------|
| **Role** | Add sealing, restore, branch/head queries, and stored world snapshots |
| **Primary API** | `withLineage()`, `commitAsync()`, `restore()`, lineage queries |
| **Owns** | World history, branch/head refs, seal records, stored canonical snapshots |
| **Does NOT Know** | Host execution micro-steps, approval policy semantics |

### Governance

> **One-liner:** Legitimacy and proposal decorator.

| Aspect | Definition |
|--------|------------|
| **Role** | Add proposal lifecycle, approval/rejection, authority evaluation, and governed publication |
| **Primary API** | `withGovernance()`, `proposeAsync()`, proposal queries, authority seams |
| **Owns** | Proposal legitimacy, decision recording, governed execution admission |
| **Does NOT Know** | Host execution micro-steps, Core semantic internals, implicit lineage creation |

---

## Boundary Matrix

| Layer | Must Not Know |
|-------|---------------|
| **Compiler** | Runtime execution, effect fulfillment, governance policy |
| **Core** | IO, wall-clock behavior, execution loops, lineage/governance policy |
| **Host** | Authority decisions, proposal semantics, branch/head legitimacy |
| **SDK** | Core internals, lineage storage internals, governance policy internals |
| **Lineage** | Host execution micro-steps, authority logic |
| **Governance** | Host execution micro-steps, implicit continuity ownership |

---

## Dependency Direction

```text
Application -> Compiler (optional)
Application -> SDK
Application -> withLineage -> withGovernance -> activate

Governance -> Lineage
Lineage -> SDK
SDK -> Host
Host -> Core
Compiler -> Core (schema contract)
```

The important current ownership rule is that governed composition builds on the SDK runtime. SDK no longer re-exports or owns a facade-level governed bootstrap package.

---

## Runtime Ownership

### Base Runtime Surface

The base activated instance lives in SDK and owns:

- projected `getSnapshot()`
- canonical `getCanonicalSnapshot()`
- intent construction and dispatch
- availability queries
- projected introspection such as `getSchemaGraph()` and `simulate()`
- execution telemetry for the direct runtime

### Governed Runtime Surface

When Lineage and Governance are composed in, they add:

- continuity and sealing
- restore and stored world snapshot lookup
- branch/head queries
- proposal lifecycle and authority decisions

They do not replace Host or Core and they do not reintroduce a facade-owned execution layer.

---

## Public Composition Patterns

### Direct Dispatch

```typescript
const instance = createManifesto(schema, effects).activate();
await instance.dispatchAsync(
  instance.createIntent(instance.MEL.actions.someAction),
);
```

### Governed Composition

```typescript
const manifesto = createManifesto(schema, effects);
const lineage = withLineage(manifesto, lineageOptions);
const governed = withGovernance(lineage, governanceOptions).activate();
```

---

## Evolution Rules

### When Core Changes

- Host absorbs execution-side consequences
- SDK surface adjusts only where public runtime exposure changes
- Lineage and Governance adjust only if their stored/runtime contracts depend on the changed substrate

### When Host Changes

- SDK absorbs direct-runtime integration changes
- Lineage and Governance adapt only as consumers of the SDK runtime/decorator chain

### When Governance Or Lineage Changes

- their owning package specs and guides change first
- SDK does not become the owner of governed policy or continuity semantics

### Adding New Features

| Feature Type | Where It Belongs |
|--------------|------------------|
| New MEL syntax | Compiler |
| New semantic operator or transition rule | Core |
| New effect execution behavior | Host |
| New direct-runtime convenience | SDK |
| New continuity/history capability | Lineage |
| New legitimacy/proposal capability | Governance |

---

## Compliance Checklist

An implementation is aligned with the current architecture only if:

- [ ] Core stays pure and deterministic
- [ ] Host executes requirements without making legitimacy decisions
- [ ] SDK remains the default direct-dispatch runtime entry
- [ ] governed composition is expressed through `withLineage()` and `withGovernance()`
- [ ] no maintained public story depends on a top-level `@manifesto-ai/world` facade
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
| Governance | Legitimacy and approval |

---

## Related Documents

- [Architecture Index](/architecture/)
- [World Concept](/concepts/world)
- [SDK API](/api/sdk)
- [Lineage API](/api/lineage)
- [Governance API](/api/governance)
- [SPEC Index](/internals/spec/)
