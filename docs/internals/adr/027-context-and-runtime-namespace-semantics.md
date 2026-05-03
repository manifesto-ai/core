# ADR-027: Context and Runtime Namespace Semantics

> **Status:** Accepted
> **Date:** 2026-05-03
> **Deciders:** Manifesto Architecture Team (Seongwoo Jung)
> **Reviewers:** Codex architecture review
> **Scope:** Core, Compiler, Host, SDK, Lineage, Governance, Constitution, Docs
> **Type:** Breaking / Major Hard Cut
> **Release Vehicle:** Manifesto v5 (compute-input layer)
>
> **Supersedes:**
> - Public/canonical Core `HostContext` compute input
> - The interim ADR-027 draft that folded runtime frame into `CoreIntent`
> - `$meta.*` as MEL/runtime expression surface
> - `$system.*` as MEL/runtime expression surface
> - `$mel.sys` or hidden namespace storage as a runtime-value transport
> - `intentGuard` as the canonical Core IR primitive name for per-causal-intent idempotency
>
> **Related:**
> - ADR-002 (`$mel` namespace and `onceIntent`)
> - ADR-009 (Structured PatchPath)
> - ADR-015 (Snapshot ontological classes)
> - ADR-020 (`dispatchable when`)
> - ADR-025 (Snapshot ontology hard cut)
> - ADR-026 (SDK v5 action candidate surface)
>
> **Non-Goals:** Effect handler API redesign, user-defined runtime expression namespaces, user-defined context generator/resolver APIs, Governance authority policy, Lineage storage policy, ADR-025 `state` / `namespaces` separation.

---

## 1. Context

Manifesto's determinism claim has always been stronger than ordinary application determinism, but the input boundary was under-specified. "Same input -> same output" is only meaningful when the full input set is explicit.

The v5 grounding axiom is:

```text
schema   = the structure and law of the world
snapshot = schema-driven self/world state, the existence information of "me"
intent   = the requested change vector
context  = the captured external environment for this computation
```

The canonical Core equation is therefore:

```text
compute(schema, snapshot, intent, context) -> (snapshot', requirements, trace)
```

Determinism is defined over all four inputs:

```text
same schema
+ same snapshot
+ same intent
+ same context
= same result
```

If the external environment changes, a different result is not nondeterminism. Nondeterminism exists when Core observes external environment that was not first captured into `context`.

Pre-v5 code had three overlapping mechanisms for external/runtime values:

1. `HostContext` passed `now`, `randomSeed`, and other runtime facts directly into Core.
2. `$system.*` and `$meta.*` exposed runtime-ish values to MEL expressions.
3. `$mel` and later `snapshot.namespaces.*` were used or considered as places to store operational bookkeeping.

ADR-025 did not create this problem. ADR-025 made it visible by separating domain state from owner namespaces. Once `snapshot.state` became pure domain state, the remaining ambiguity around runtime values, Host context, and MEL bookkeeping could no longer be hidden under `data.$*`.

## 2. Problem

### 2.1 Snapshot and context were not separated

`snapshot` and `context` answer different questions.

```text
snapshot: What is my current schema-driven existence information?
context:  What external environment has been captured for this computation?
```

Time, random seed, request facts, and other external environment captures are not domain existence information. Placing them in Snapshot as hidden runtime state pollutes Snapshot. Omitting them from the Core input list hides nondeterminism.

### 2.2 `HostContext` names the wrong owner at the Core boundary

Core must not know Host exists. Naming the public/canonical Core input `HostContext` bakes Host into the Core interface, even if the value is technically plain data.

The correct boundary name is simply `context`. It is not Host-owned. Host or SDK may materialize it, tests may provide it directly, and Core-only execution remains possible when a caller supplies it.

### 2.3 Folding context into intent blurs responsibility

An interim ADR-027 draft attempted to remove the fourth input by folding runtime frame into `CoreIntent`.

That was too aggressive. It mixed:

```text
intent  = the requested change
context = the captured external environment
```

Both are part of a compute call, but they are different axes. Keeping them separate makes tests, audit, and determinism easier to explain.

### 2.4 `$system` is overloaded

`$system.uuid` and `$system.time.now` look like system calls. That name suggests IO, wall-clock access, or Host-owned behavior. Some values are actually deterministic once a context seed exists; other values require external work.

Those two classes must not share one namespace.

### 2.5 `snapshot.namespaces` can become a backdoor semantic channel

ADR-025 introduced `snapshot.namespaces` to keep platform/runtime/tooling-owned bookkeeping out of domain state. That does not make namespaces a new expression source.

If Core reads `snapshot.namespaces.host`, `snapshot.namespaces.mel`, or any package-owned shape as semantic input, Core is polluted by the owner of that namespace.

### 2.6 `onceIntent` exposed a naming error in Core IR

`onceIntent` source syntax is still the correct user-facing sugar for "run this block once for this submitted intent." The issue is not the MEL syntax.

The issue is the Core primitive name `intentGuard`. It makes the primitive sound tied to MEL's `onceIntent` feature rather than to the owner-neutral fact it enforces: "this causal transition block has already run for this intent id."

## 3. Decision

### 3.1 Core compute has four explicit pure inputs

The canonical Core compute signature is:

```ts
compute(
  schema: DomainSchema,
  snapshot: Snapshot,
  intent: Intent,
  context: Context
): ComputeResult
```

No public/canonical Core compute API accepts `HostContext`, `RuntimeFrameProvider`, a live provider, a callback, a service object, or any owner-specific context shape.

`context` is an explicit pure input. It is not a hidden channel.

### 3.2 `Context` captures external environment

The built-in v5 runtime context partition is:

```ts
type Context<TExternalContext = Record<string, unknown>> = {
  readonly runtime: {
    readonly time: {
      readonly timestamp: number;
    };
    readonly random: {
      readonly seed: string;
    };
  };
  readonly external: TExternalContext;
};
```

The context value is:

- JSON-serializable data
- materialized before Core is called
- stable for the whole transition attempt, including Host re-entry after fulfilled requirements
- supplied directly by tests and Core-only callers
- not a live service, callback, provider, promise, mutable object, or IO handle

Host/SDK may provide default Manifesto-owned materialization for `context.runtime`. Core never imports, instantiates, calls, or names that provider.

`context.external` is the only place for schema-declared user context. SDKs may expose the external partition as a convenient submit/preview option, but the Core context object always keeps Manifesto-owned runtime facts and user-supplied external facts in separate partitions:

```ts
const coreContext = {
  runtime: {
    time: { timestamp: 1777564800000 },
    random: { seed: "seed-1" },
  },
  external: {
    tenantId: "acme",
    locale: "ko-KR",
  },
};
```

### 3.3 Snapshot and context have separate sovereignty

| Axis | Meaning | Lifetime | Mutation | Example |
|------|---------|----------|----------|---------|
| `snapshot` | schema-driven self/world state | persists across computations | changed only by patches | todos, balance, phase, syncStatus |
| `context` | captured external environment | one transition attempt | never mutated by Core | timestamp, random seed, injected request locale |

Snapshot remains the communication medium between computations. If an external fact must persist, be observed later, or affect future computation, it must enter Snapshot through normal effect/patch flow.

Context does not replace Snapshot. Context makes the external environment explicit so deterministic tests can freeze it the same way they freeze Snapshot fixtures.

Use this guide:

- Put a value in `snapshot` when it is part of the domain world, should persist without being re-supplied by the caller, should be visible to future transitions, or should change only through patches.
- Put a value in `context.external` when it is an external condition captured at the transition boundary and must be supplied again for replay.
- Put a value behind an `effect` when Core must request external work during the transition.

For example, `tenantId` belongs in `snapshot` for a single-tenant persisted world where the tenant is part of domain identity. It belongs in `context.external` for a shared runtime where each request carries the tenant as an external execution condition.

### 3.4 `$runtime.*` is the built-in Manifesto runtime contract

MEL and other expression surfaces use one built-in runtime namespace:

```text
$runtime
```

The built-in runtime partition is intentionally small. Manifesto owns only values that are near-universal transition facts and unsafe to leave implicit: current intent identity, captured logical time, and deterministic randomness. Domain-specific environment such as locale, tenant, region, feature flags, auth claims, or request metadata is not built in; it must be declared as user context or modeled as domain state/effects according to §3.3.

The v5 built-in surface is:

| Expression | Meaning | Source |
|------------|---------|--------|
| `$runtime.intent.id` | Current intent id | `intent.intentId` |
| `$runtime.intent.action` | Current action name/type | `intent.type` |
| `$runtime.time.timestamp` | Captured external timestamp | `context.runtime.time.timestamp` |
| `$runtime.time.iso` | ISO string derived from timestamp | deterministic Core derivation |
| `$runtime.random.seed` | Captured external random seed | `context.runtime.random.seed` |
| `$runtime.random.uuid` | Deterministic UUID allocation | deterministic Core derivation from context seed and evaluation position |

`$runtime` is not an alias for `snapshot.namespaces.runtime`, `snapshot.namespaces.host`, `snapshot.meta`, or `HostContext`.

`$runtime.random.uuid` is deterministic derivation, not random generation. The derivation input is:

```text
context.runtime.random.seed
+ intent identity
+ canonical UUID allocation site
```

The canonical allocation site is the traceable evaluation position of the UUID expression: action/flow node path, expression path, collection/index stack when applicable, and occurrence ordinal within that expression. A package MUST NOT derive runtime UUIDs from wall-clock time, ambient process randomness, or a mutable global counter. Adding or moving a UUID expression is a semantic schema change; replay of an already-recorded transition uses the schema and context recorded for that transition.

### 3.5 User-defined context is direct injection only

User-defined context, if exposed by a schema/MEL surface, is limited to direct injection of already-materialized JSON values.

A MEL context declaration is a shape declaration only:

```mel
context {
  tenantId: string
  locale: string
}
```

It may allow expressions such as:

```mel
patch tenantId = $context.tenantId
```

but `$context.*` reads only values supplied at the compute/preview/submit boundary. Manifesto v5 does not support user-defined context generators, resolvers, providers, lazy getters, callbacks, promises, or function-valued context fields.

`$context.*` maps to `context.external.*`. It never reads `context.runtime.*`; built-in runtime facts are exposed only through `$runtime.*`.

Allowed:

```ts
await app.actions.addTodo.submit(
  { title: "Ship v5" },
  {
    context: {
      tenantId: "acme",
      locale: "ko-KR",
    },
  }
);
```

Forbidden:

```ts
let count = 0;

await app.actions.addTodo.submit(
  { title: "Ship v5" },
  {
    context: {
      getId: () => `id-${count++}`,
    },
  }
);
```

If user code needs to compute a context value, it must do so before entering Manifesto and pass only the resulting JSON value. Manifesto determinism starts at the materialized context boundary.

### 3.6 Context value lifecycle is explicit and non-reactive

Context is not a parallel mutable state slot. It is the external environment
value that a runtime captures for a transition attempt.

SDK-facing runtimes MAY expose three public routes for user external context:

```ts
const app = createManifesto(schema, effects, {
  context: { tenantId: "acme", locale: "ko-KR" },
}).activate();

app.injectContext({ tenantId: "acme", locale: "en-US" });

await app.actions.addTodo.submit(
  { title: "Ship v5" },
  {
    context: { tenantId: "other", locale: "ko-KR" },
  }
);
```

Those public values are the flat user external context partition. The runtime
wraps them as `Context.external` before calling Core. Users do not provide or
override `Context.runtime`.

Public external context values must conform to the schema-declared `context {}`
shape. If a schema declares no user context, the valid external context is the
empty object.

`injectContext(next)` is a full replacement of the current user external
context for future transition attempts. It is not a partial merge. A convenience
helper such as:

```ts
app.updateContext((current) => ({ ...current, locale: "en-US" }));
```

is allowed only as SDK call-site syntax. The callback must run synchronously at
the SDK boundary and must immediately materialize a JSON value. Async callbacks,
promise returns, providers, getters, and function-valued context fields are
rejected.

Changing context does not create an intent, patch, effect, transition, lineage
event, or automatic recomputation. It only changes the external context value
that will be captured by the next transition attempt. If an environment change
should affect the domain world, user code must submit an explicit action after
injecting the new context.

For `preview()` and `submit()`, context capture happens at call-entry. The
runtime must clone, validate, freeze, and retain the materialized Core `Context`
for that transition attempt before any awaited work can observe a later
`injectContext()` call. Host/Core re-entry caused by effects reuses the same
captured context. A transition must never span two different external context
values.

`PreviewOptions.context` and `SubmitOptions.context`, when supplied, are
transition-local full overrides. They do not mutate the runtime's current
external context and they are not merged with it.

### 3.7 `$runtime` is not a user-defined effect alias channel

The following model is rejected:

```mel
patch user = $fetch.api.getUser
```

where `$fetch.api.getUser` would be resolved by registering an effect named `fetch.api.getUser`.

Host-required domain work remains explicit effects:

```mel
effect "fetch.api.getUser" {
  params { userId: input.userId }
  into user
}
```

`$runtime` is for the small set of transition constants that Manifesto itself treats as part of the canonical compute environment. Domain-specific external data belongs to effects.

### 3.8 `$meta.*` and `$system.*` are retired as runtime expression surfaces

v5 is a hard cut. There is no compatibility alias from:

```text
$meta.*
$system.*
```

to:

```text
$runtime.*
```

Migration is explicit:

| Before | After |
|--------|-------|
| `$meta.intentId` | `$runtime.intent.id` |
| `$meta.actionName` | `$runtime.intent.action` |
| `$meta.timestamp` | `$runtime.time.timestamp` |
| `$system.uuid` | `$runtime.random.uuid` |
| `$system.timestamp` | `$runtime.time.iso` |
| `$system.time.now` | `$runtime.time.timestamp` |

### 3.9 Runtime and context namespace legality is phase-bound

`$runtime.*` and `$context.*` are legal only where a bound transition is being computed.

In v5, `$runtime.*` and `$context.*` are legal in action flow expressions, including patch values, effect params, and guarded action-body expressions.

They are illegal in:

- state initializers
- computed values
- `available when`
- `dispatchable when`

Those phases must remain pure over schema, snapshot, and explicit admission inputs. `available when` must not change answer when a caller changes request-local context such as locale. A later ADR may define narrower legality if a concrete need appears.

### 3.10 Snapshot metadata is not the runtime expression source

`snapshot.meta.timestamp` and `snapshot.meta.randomSeed` are snapshot envelope facts. They may record facts about the produced snapshot version.

They are not the source of "current external time" or "current external random" for MEL expressions. Expressions read `$runtime.*`, which is derived from `intent` and `context`.

### 3.11 `snapshot.namespaces` is owner bookkeeping only

`snapshot.namespaces` remains the ADR-025 container for non-domain owner state. It is not a general semantic read model.

Core rules:

- Core owns the opaque `namespaces` container shape only as a Snapshot partition.
- Core may own Core-generic bookkeeping under a Core-owned namespace.
- Core MUST NOT know `host`, `mel`, `sdk`, `lineage`, `governance`, or tooling namespace shapes.
- Core expressions MUST NOT read owner namespaces as domain, runtime, or context values.

Owner rules:

- Host-owned operational state belongs under a Host-owned namespace.
- Compiler/MEL-owned tooling state belongs under a Compiler/MEL-owned namespace.
- Owner namespaces are excluded from domain projection by default.
- Owner namespaces do not define MEL expression namespaces.

### 3.12 `onceIntent` lowers to an owner-neutral Core primitive

MEL source keeps:

```mel
onceIntent {
  ...
}
```

Compiler lowering targets a Core primitive named:

```ts
{ kind: "causalGuard", ... }
```

The Core primitive is not MEL-specific. Its semantics are:

```text
Run this guarded block at most once for the current causal intent id.
```

Implementation may temporarily carry `intentGuard` as a compatibility name during migration, but the accepted v5 Core IR name is `causalGuard`.

## 4. Examples

### 4.1 User-facing time and uuid

```mel
action addTodo(title: string) {
  onceIntent {
    patch todos = append(todos, {
      id: $runtime.random.uuid,
      title: input.title,
      createdAt: $runtime.time.timestamp
    })
  }
}
```

This is supported. Host, SDK, tests, or a Core-only caller provide `context` before calling Core. Core deterministically evaluates `$runtime.random.uuid` and `$runtime.time.timestamp` from `intent` and `context`.

### 4.2 Deterministic test fixture

```ts
const context = {
  runtime: {
    time: { timestamp: 1777564800000 },
    random: { seed: "test-seed-1" },
  },
  external: {},
};

const result = compute(schema, snapshot, intent, context);
```

This test freezes the external environment explicitly. Re-running with the same four inputs must produce the same result.

### 4.3 User-defined context direct injection

```mel
context {
  tenantId: string
  locale: string
}

action addTodo(title: string) {
  onceIntent {
    patch todos = append(todos, {
      title: input.title,
      tenantId: $context.tenantId,
      localeAtCreation: $context.locale
    })
  }
}
```

```ts
const app = createManifesto(schema, effects, {
  context: {
    tenantId: "acme",
    locale: "ko-KR",
  },
}).activate();

app.injectContext({
  tenantId: "acme",
  locale: "en-US",
});

await app.actions.addTodo.submit(
  { title: "Ship v5" },
  {
    context: {
      tenantId: "acme",
      locale: "ko-KR",
    },
  }
);
```

The SDK values above are flat user external context values. The submit option is
a transition-local full override. The Core compute envelope receives:

```ts
const context = {
  runtime: {
    time: { timestamp: 1777564800000 },
    random: { seed: "seed-1" },
  },
  external: {
    tenantId: "acme",
    locale: "ko-KR",
  },
};
```

The context value is data, not a resolver. Replay requires the same injected context value.

### 4.4 External server time is an effect

```mel
action syncServerClock() {
  onceIntent {
    effect "clock.server.now" {
      into serverClock
    }
  }
}
```

Server time is not `$runtime.time.*` because it requires external IO. Host executes the effect and writes the result through the normal effect/patch lifecycle.

## 5. Consequences

### 5.1 Positive consequences

- Determinism now names its full input set.
- Snapshot and context have separate meanings.
- Core no longer has a Host-shaped input.
- Intent is no longer overloaded with external environment.
- Runtime values have one user-facing namespace: `$runtime`.
- `$system` no longer blurs deterministic constants with external work.
- Snapshot owner namespaces cannot become hidden semantic inputs.
- Core-only execution remains possible by supplying an explicit context fixture.
- `onceIntent` remains good MEL syntax while Core IR becomes owner-neutral.

### 5.2 Negative consequences

- This is a hard cut for code using `compute(..., HostContext)`.
- The interim `CoreIntent.frame` plan is rejected and must not be implemented as the canonical API.
- MEL using `$meta.*` or `$system.*` must migrate.
- Compiler, Core, Host, SDK, docs, and compliance tests must move together.
- Runtime assembly carries responsibility for context materialization before Core execution.
- User-defined context must be passed as data; v5 intentionally does not provide context generator/resolver extension APIs.
- Lineage records grow because replayable transition records must include the context used with the intent.
- Context changes do not automatically trigger transitions; reactive behavior must be expressed by explicit actions.

The last point is intentional. Runtime assembly may capture external environment. Core may only compute from already-materialized data.

## 6. Migration Plan

### 6.1 Core

1. Introduce owner-neutral `Context`.
2. Keep `Intent` as the requested change vector, not the environment container.
3. Replace canonical `compute(schema, snapshot, intent, HostContext)` with `compute(schema, snapshot, intent, context)`.
4. Replace expression evaluation reads of `$meta.*` and `$system.*` with `$runtime.*`.
5. Derive `$runtime.time.*` and `$runtime.random.*` from `context`.
6. Resolve `$context.*` only from `context.external.*`.
7. Reject `$runtime.*` and `$context.*` outside bound action flow evaluation.
8. Rename Core IR `intentGuard` to `causalGuard`.
9. Keep namespace reads limited to Core-owned generic bookkeeping.

### 6.2 Compiler

1. Parse `$runtime.*` as the only runtime expression namespace.
2. Parse schema-declared `$context.*` as direct injected context reads.
3. Reject `$meta.*` and `$system.*` in v5 mode.
4. Reject `$runtime.*` and `$context.*` in state initializers, computed values, `available when`, and `dispatchable when`.
5. Lower `onceIntent` to `causalGuard`.
6. Remove `$mel.sys` and system-value lowering.
7. Preserve `onceIntent` as a contextual keyword.

### 6.3 Host and SDK

1. Capture external environment into `Context` before Core execution.
2. Pass exactly `schema`, `snapshot`, `intent`, and `context` into Core.
3. Combine Manifesto-owned `context.runtime` with direct-injected user context under `context.external`.
4. Reuse the same `context` across Host re-entry for the same transition attempt.
5. Do not hide runtime values in `intent.frame`, `snapshot.namespaces.host`, or `snapshot.namespaces.mel`.
6. Record context-derived facts through trace/report surfaces where accountability requires them.
7. Do not write fresh runtime values into hidden namespace storage for Core to read later.
8. Do not expose user-defined context generator, resolver, provider, or lazy getter APIs in v5.
9. Treat injected external context as a full replacement, not a partial merge.
10. Capture preview/submit context at call-entry and reuse it for the whole transition attempt.

### 6.4 Lineage and Governance

Lineage and Governance do not gain compute semantics from this ADR.

Lineage MUST record the submitted compute envelope needed for deterministic replay, including at minimum the intent and the exact context value used for the transition. Governance may inspect submitted compute envelopes for audit and legitimacy, but it must not reinterpret `$runtime.*`, execute effects, or compute state transitions.

## 7. Acceptance Criteria

| ID | Requirement |
|----|-------------|
| ADR027-COMP-1 | Canonical Core compute accepts exactly `schema`, `snapshot`, `intent`, and `context`. |
| ADR027-COMP-2 | Core has no public/canonical `HostContext` compute input. |
| ADR027-COMP-3 | Core does not import Host, SDK runtime internals, Lineage, Governance, or MEL compiler internals. |
| ADR027-CTX-1 | `Context` is owner-neutral JSON-serializable data, not a provider, callback, service, promise, or mutable object. |
| ADR027-CTX-2 | Same `schema + snapshot + intent + context` yields byte-identical semantic output. |
| ADR027-CTX-3 | Runtime time/random values used by Core come from `context.runtime`. |
| ADR027-CTX-4 | User-defined context is direct-injected JSON data only. |
| ADR027-CTX-5 | No v5 package exposes user-defined context generator, resolver, provider, lazy getter, promise, or callback APIs. |
| ADR027-CTX-6 | User-defined context is stored under `context.external`; `$context.*` reads only `context.external.*`. |
| ADR027-CTX-7 | Host re-entry for the same transition attempt reuses the same context. |
| ADR027-CTX-8 | Injecting external context replaces the current external context for future transitions and does not trigger computation by itself. |
| ADR027-CTX-9 | Preview/submit context overrides are transition-local full overrides and do not mutate runtime current context. |
| ADR027-CTX-10 | Runtime context capture happens at preview/submit call-entry before awaited work can observe later context changes. |
| ADR027-CTX-11 | Public external context values conform to schema-declared `context {}` shape; absent schema context means only empty external context is valid. |
| ADR027-INTENT-1 | Intent does not carry canonical runtime frame/environment fields. |
| ADR027-RUNTIME-1 | `$runtime.intent.*`, `$runtime.time.*`, and `$runtime.random.*` are the only built-in v5 runtime expression namespaces. |
| ADR027-RUNTIME-2 | `$meta.*` and `$system.*` are rejected in v5 MEL. |
| ADR027-RUNTIME-3 | `$runtime.*` and `$context.*` are illegal in state initializers, computed values, `available when`, and `dispatchable when`. |
| ADR027-RUNTIME-4 | `$runtime.random.uuid` is derived only from context seed, intent identity, and canonical allocation site. |
| ADR027-NS-1 | Core expressions cannot read `snapshot.namespaces.host`, `snapshot.namespaces.mel`, or owner-specific namespace shapes. |
| ADR027-NS-2 | Runtime values are not transported through `$mel.sys`, `namespaces.mel`, or `namespaces.host`. |
| ADR027-GUARD-1 | `onceIntent` source lowers to owner-neutral `causalGuard` Core IR. |
| ADR027-EFFECT-1 | Domain-specific external data remains modeled as effects, not as user-defined `$runtime` or `$fetch` aliases. |
| ADR027-LIN-1 | Lineage records the intent and exact context value used for each replayable transition record. |

## 8. Implementation Order

1. Land this revised ADR and index entry.
2. Update Core SPEC and Constitution statements to the four-input equation.
3. Update Core types/evaluator/tests for `Context` and `$runtime.*`.
4. Update Compiler parser/analyzer/lowering/tests.
5. Update Host and SDK runtime assembly to materialize `context`.
6. Update Lineage/Governance docs for compute-envelope audit language, including intent+context replay recording.
7. Remove compatibility hooks and stale docs for `$meta.*`, `$system.*`, `HostContext`, and `CoreIntent.frame`.
8. Keep user-defined context support, if implemented, to schema-declared direct injection only.

---

## Decision Summary

ADR-027 clarifies Manifesto determinism by naming the full Core input set: `schema`, `snapshot`, `intent`, and `context`. Snapshot is the schema-driven existence information of the world. Context is the captured external environment. `$runtime.*` becomes the built-in expression view over intent/context runtime facts. Snapshot namespaces remain owner bookkeeping, not semantic input.
