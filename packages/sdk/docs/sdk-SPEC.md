# Manifesto SDK Specification

> **Status:** Normative (Living Document)
> **Scope:** Manifesto SDK Layer - Public Developer API
> **Compatible with:** Core SPEC v4.0.0, Host Contract v4.0.0, Compiler SPEC v0.7.0, Compiler SPEC v0.8.0 addendum, Lineage SPEC v3.0.0, Governance SPEC v3.0.0
> **Supersedes:** SDK SPEC v2.0.0
> **Implements:** ADR-017 v3.1

> **Historical Note:** Pre-ADR-017 SDK surfaces live in Git history. They are no longer kept as active package docs in the working tree.
>
> **Current v3.1.0 Status:** The projected introspection additions in §5.5 and §7.4-§7.5 are now part of the current living SDK contract. The compiler-side extraction contract currently lives in the companion addendum [SPEC-v0.8.0](../../compiler/docs/SPEC-v0.8.0.md).

## 1. Purpose

This document defines the current SDK v3.1.0 public contract.

The SDK still owns exactly one concept, `createManifesto()`, but that concept is no longer a ready-to-run runtime factory. In v3, `createManifesto()` returns a **composable manifesto**. Runtime verbs appear only after `activate()`.

The SDK no longer presents top-level `@manifesto-ai/world` as part of its public story. Governed composition is expressed by decorating the composable manifesto with `withLineage()` and `withGovernance()` from their owning packages.

This document is normative for SDK-owned behavior. It does not restate the full lineage or governance runtime contracts. Those remain the responsibility of their owning package specs.

## 2. Normative Language

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

Normative rule prefixes:

| Prefix | Domain |
|--------|--------|
| `SDK-ROLE-*` | SDK ownership and package boundary |
| `SDK-PHASE-*` | phase and lifecycle rules |
| `SDK-CREATE-*` | factory and schema resolution |
| `SDK-TYPE-*` | public type rules |
| `SDK-BASE-*` | activated base runtime surface |
| `SDK-DISPATCH-*` | `dispatchAsync()` semantics |
| `SDK-GRAPH-*` | `getSchemaGraph()` and `SchemaGraph` semantics |
| `SDK-SIM-*` | `simulate()` semantics |
| `SDK-SUB-*` | subscription semantics |
| `SDK-EVENT-*` | telemetry channel semantics |
| `SDK-SNAP-*` | snapshot visibility and immutability |
| `SDK-DISPOSE-*` | disposal semantics |
| `SDK-ERR-*` | SDK-owned error model |
| `SDK-BOUNDARY-*` | decorator boundary rules |
| `SDK-HC-*` | hard-cut removal rules |

## 3. SDK Role and Boundaries

The SDK owns the present-only application entrypoint. It does not own lineage continuity, governance legitimacy, or world facade assembly.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-ROLE-1 | MUST | SDK MUST own exactly one concept: `createManifesto()` |
| SDK-ROLE-2 | MUST | `createManifesto()` MUST return `ComposableManifesto<T, BaseLaws>`, not a runtime instance |
| SDK-ROLE-3 | MUST NOT | SDK MUST NOT expose app-facing governed assembly through `@manifesto-ai/world` re-exports |
| SDK-ROLE-4 | MUST | SDK MUST define only the present-only base runtime contract; lineage and governance verb promotion belong to their owning packages |
| SDK-ROLE-5 | MUST NOT | SDK v3 MUST NOT preserve v2 compatibility aliases or helper surfaces that compete with the activation model |
| SDK-ROLE-6 | MUST | SDK MAY continue to pass through selected Core and Host exports, but those pass-through exports are not the subject of this SDK-owned contract unless referenced explicitly by SDK-owned signatures below |

## 4. Phase Model

SDK v3 has two phases:

1. **Law composition** — `createManifesto()` returns a composable manifesto with no live runtime verbs.
2. **Runtime execution** — `activate()` opens the runtime and returns the final instance for the currently composed laws.

### 4.1 Phase Marker Types

```typescript
type BaseLaws = { readonly __kind: "BaseLaws" };
type LineageLaws = { readonly __kind: "LineageLaws" };
type GovernanceLaws = { readonly __kind: "GovernanceLaws" };
```

These are phantom marker types. Their representation is compile-time only. Runtime presence is implementation-defined.

### 4.2 Composable Manifesto

```typescript
type ComposableManifesto<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws = BaseLaws,
> = {
  readonly _laws: Laws;
  readonly schema: DomainSchema;
  activate(): ActivatedInstance<T, Laws>;
};
```

### 4.3 Activation Result Mapping

```typescript
type ActivatedInstance<
  T extends ManifestoDomainShape,
  Laws,
> =
  Laws extends GovernanceLaws
    ? GovernanceInstance<T>
    : Laws extends LineageLaws
      ? LineageInstance<T>
      : ManifestoBaseInstance<T>;
```

`LineageInstance<T>` and `GovernanceInstance<T>` are boundary names owned by their packages. Their full runtime members are intentionally not restated in this SDK spec.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-PHASE-1 | MUST NOT | Pre-activation composable manifesto objects MUST NOT expose `dispatchAsync`, `proposeAsync`, `subscribe`, `on`, `getSnapshot`, or `dispose` |
| SDK-PHASE-2 | MUST | `activate()` MUST be the only SDK boundary that produces a runtime instance |
| SDK-PHASE-3 | MUST | `activate()` MUST be one-shot; the second call on the same composable manifesto MUST throw `AlreadyActivatedError` |
| SDK-PHASE-4 | MUST NOT | No path from runtime instance back to composable state may exist |
| SDK-PHASE-5 | MUST NOT | SDK MUST NOT define a competing top-level runtime helper path that bypasses activation |
| SDK-PHASE-6 | MUST | `ComposableManifesto.schema` MUST expose the normalized schema actually used for activation |

## 5. Public Types

### 5.1 Domain Shape

```typescript
type ManifestoDomainShape = {
  readonly actions: Record<string, (...args: unknown[]) => unknown>;
  readonly state: Record<string, unknown>;
  readonly computed: Record<string, unknown>;
};
```

This is the minimum type shape required for SDK generic propagation.

### 5.2 Snapshot and Effect Types

```typescript
type CanonicalPlatformNamespaces = {
  $host?: Record<string, unknown>;
  $mel?: Record<string, unknown>;
  [k: `$${string}`]: unknown;
};

type Snapshot<T = unknown> = {
  readonly data: T;
  readonly computed: Record<string, unknown>;
  readonly system: {
    readonly status: "idle" | "computing" | "pending" | "error";
    readonly lastError: ErrorValue | null;
  };
  readonly meta: {
    readonly schemaHash: string;
  };
};

type CanonicalSnapshot<T = unknown> = Omit<CoreSnapshot, "data"> & {
  readonly data: T & CanonicalPlatformNamespaces;
};

type EffectContext<T = unknown> = {
  readonly snapshot: Readonly<Snapshot<T>>;
};

type EffectHandler = (
  params: unknown,
  ctx: EffectContext,
) => Promise<readonly Patch[]>;
```

### 5.3 Reference Types

```typescript
type TypedActionRef<
  T extends ManifestoDomainShape,
  K extends keyof T["actions"] = keyof T["actions"],
> = {
  readonly __kind: "ActionRef";
  readonly name: K;
};

type FieldRef<TValue> = {
  readonly __kind: "FieldRef";
  readonly name: string;
  readonly _type?: TValue;
};

type ComputedRef<TValue> = {
  readonly __kind: "ComputedRef";
  readonly name: string;
  readonly _type?: TValue;
};
```

`TypedActionRef.name`, `FieldRef.name`, and `ComputedRef.name` are the normative identity carriers for SDK references. Implementations MAY attach additional runtime fields, but those extra fields remain non-normative and callers MUST NOT depend on them.

### 5.4 Typed MEL Surface

```typescript
type TypedMEL<T extends ManifestoDomainShape> = {
  readonly actions: {
    readonly [K in keyof T["actions"]]: TypedActionRef<T, K>;
  };
  readonly state: {
    readonly [K in keyof T["state"]]: FieldRef<T["state"][K]>;
  };
  readonly computed: {
    readonly [K in keyof T["computed"]]: ComputedRef<T["computed"][K]>;
  };
};
```

### 5.5 Runtime Helper Types

```typescript
type ActionArgs<
  T extends ManifestoDomainShape,
  K extends keyof T["actions"],
> = T["actions"][K] extends (...args: infer P) => unknown ? P : never;

type ActionObjectBindingArgs<
  T extends ManifestoDomainShape,
  K extends keyof T["actions"],
> = readonly [Record<string, unknown>];

type CreateIntentArgs<
  T extends ManifestoDomainShape,
  K extends keyof T["actions"],
> = ActionArgs<T, K> | ActionObjectBindingArgs<T, K>;

type Selector<T, R> = (snapshot: Snapshot<T>) => R;
type Unsubscribe = () => void;

type TypedActionMetadata<
  T extends ManifestoDomainShape,
  K extends keyof T["actions"] = keyof T["actions"],
> = {
  readonly name: K;
  readonly params: readonly string[];
  readonly input: unknown;
  readonly description?: string;
};

type TypedGetActionMetadata<T extends ManifestoDomainShape> = {
  (): readonly TypedActionMetadata<T>[];
  <K extends keyof T["actions"]>(name: K): TypedActionMetadata<T, K>;
};

type TypedCreateIntent<T extends ManifestoDomainShape> = <
  K extends keyof T["actions"],
>(
  action: TypedActionRef<T, K>,
  ...args: CreateIntentArgs<T, K>
) => Intent;

type TypedDispatchAsync<T extends ManifestoDomainShape> = (
  intent: Intent,
) => Promise<Snapshot<T["state"]>>;

type TypedSubscribe<T extends ManifestoDomainShape> = <R>(
  selector: Selector<T["state"], R>,
  listener: (value: R) => void,
) => Unsubscribe;

type SchemaGraphNodeKind = "state" | "computed" | "action";

type SchemaGraphNodeId =
  | `state:${string}`
  | `computed:${string}`
  | `action:${string}`;

type SchemaGraphNode = {
  readonly id: SchemaGraphNodeId;
  readonly kind: SchemaGraphNodeKind;
  readonly name: string;
};

type SchemaGraphEdgeRelation = "feeds" | "mutates" | "unlocks";

type SchemaGraphEdge = {
  readonly from: SchemaGraphNodeId;
  readonly to: SchemaGraphNodeId;
  readonly relation: SchemaGraphEdgeRelation;
};

type SchemaGraphNodeRef =
  | TypedActionRef<ManifestoDomainShape>
  | FieldRef<unknown>
  | ComputedRef<unknown>;

type SchemaGraph = {
  readonly nodes: readonly SchemaGraphNode[];
  readonly edges: readonly SchemaGraphEdge[];
  traceUp(ref: SchemaGraphNodeRef): SchemaGraph;
  traceUp(nodeId: SchemaGraphNodeId): SchemaGraph;
  traceDown(ref: SchemaGraphNodeRef): SchemaGraph;
  traceDown(nodeId: SchemaGraphNodeId): SchemaGraph;
};

type SimulateResult<T extends ManifestoDomainShape = ManifestoDomainShape> = {
  readonly snapshot: Snapshot<T["state"]>;

  /**
   * Inspection/debug-only diff of the projected public snapshot.
   * Callers MUST NOT treat these display paths as the canonical branching API.
   */
  readonly changedPaths: readonly string[];

  readonly newAvailableActions: readonly (keyof T["actions"])[];
  readonly requirements: readonly Requirement[];
  readonly status: "complete" | "pending" | "halted" | "error";
};
```

`TypedActionMetadata<T, K>.input` MUST carry the same machine-readable action input schema that the runtime uses for validation and inspection.

### 5.6 Event Types

```typescript
interface ManifestoEventMap<T extends ManifestoDomainShape> {
  "dispatch:completed": {
    readonly intentId: string;
    readonly intent: Intent;
    readonly snapshot: Snapshot<T["state"]>;
  };
  "dispatch:rejected": {
    readonly intentId: string;
    readonly intent: Intent;
    readonly reason: string;
  };
  "dispatch:failed": {
    readonly intentId: string;
    readonly intent: Intent;
    readonly error: Error;
    readonly snapshot?: Snapshot<T["state"]>;
  };
}

type ManifestoEvent =
  | "dispatch:completed"
  | "dispatch:rejected"
  | "dispatch:failed";
type ManifestoEventPayload<T extends ManifestoDomainShape> =
  ManifestoEventMap<T>[ManifestoEvent];

type TypedOn<T extends ManifestoDomainShape> = <
  K extends ManifestoEvent,
>(
  event: K,
  handler: (payload: ManifestoEventMap<T>[K]) => void,
) => Unsubscribe;
```

### 5.7 Error Types

```typescript
class ManifestoError extends Error {
  readonly code: string;
}

class CompileError extends ManifestoError {
  readonly diagnostics: readonly CompileDiagnostic[];
}

class ReservedEffectError extends ManifestoError {
  readonly effectType: string;
}

class DisposedError extends ManifestoError {}
class AlreadyActivatedError extends ManifestoError {}
```

```typescript
type CompileDiagnostic = {
  readonly severity: "error" | "warning" | "info";
  readonly code: string;
  readonly message: string;
  readonly location: {
    readonly start: {
      readonly line: number;
      readonly column: number;
      readonly offset: number;
    };
    readonly end: {
      readonly line: number;
      readonly column: number;
      readonly offset: number;
    };
  };
  readonly source?: string;
  readonly suggestion?: string;
};
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-TYPE-1 | MUST | The public names in §5 are frozen for the current SDK v3 surface |
| SDK-TYPE-2 | MUST | `TypedMEL<T>` MUST preserve the key sets of `T["actions"]`, `T["state"]`, and `T["computed"]` exactly |
| SDK-TYPE-3 | MUST | `TypedCreateIntent<T>` MUST derive its argument list from the referenced action and MUST surface object binding when the action input is object-shaped |
| SDK-TYPE-4 | MUST | `TypedDispatchAsync<T>` MUST accept any Core `Intent`, including intents not created by `TypedCreateIntent<T>` |
| SDK-TYPE-5 | MUST | `TypedOn<T>` payload typing MUST narrow by event name |
| SDK-TYPE-6 | MUST | `TypedActionRef.name`, `FieldRef.name`, and `ComputedRef.name` MUST be stable public identifiers for the referenced action/state/computed node |
| SDK-TYPE-7 | MUST NOT | SDK-owned introspection depend on implementation-defined extra runtime fields on refs |
| SDK-TYPE-8 | MUST | `SchemaGraph` string lookup overloads use kind-prefixed node ids (`state:*`, `computed:*`, `action:*`); ref lookup remains the canonical surface |

## 6. `createManifesto()`

### 6.1 Signature

```typescript
function createManifesto<T extends ManifestoDomainShape>(
  schema: DomainSchema | string,
  effects: Record<string, EffectHandler>,
): ComposableManifesto<T, BaseLaws>;
```

`createManifesto()` is a positional API in v3.

`ManifestoConfig` is removed. Guard callbacks, restore snapshots, and governed-world inputs are not part of the v3 SDK factory surface.

### 6.2 Schema Resolution and Normalization

If `schema` is a string, SDK MUST compile it as MEL domain source before exposing the resulting composable manifesto.

If `schema` is a compiled `DomainSchema`, SDK MUST still normalize it before exposing `ComposableManifesto.schema`.

Normalization includes:

- platform namespace injection for `$host`
- platform namespace injection for `$mel.guards.intent`
- reserved namespace validation

The exposed `ComposableManifesto.schema` MUST be the normalized schema, not the raw caller input.

### 6.3 Reserved Effect and Namespace Protection

The SDK owns the reserved compiler/system effect channel `system.get`.

User-provided effects MUST NOT override that effect type.

User action names MUST NOT use the reserved namespace prefix `system.`.

If the caller explicitly declares `$host`, `$mel`, `$mel.guards`, or `$mel.guards.intent` as non-object fields, SDK MUST reject schema normalization with `ManifestoError` code `SCHEMA_ERROR`.

### 6.4 Effect Handler Contract

The activation model does not change the SDK-owned effect handler shape. The SDK-facing handler remains the simplified two-parameter contract in §5.2 and MUST be adapted internally to the Host execution contract.

The `snapshot` in `EffectContext` MUST reflect the current projected snapshot visible to the activated runtime at effect execution time. It MUST NOT expose canonical-only substrate such as `data.$*`, `system.pendingRequirements`, `system.currentAction`, `input`, `meta.version`, `meta.timestamp`, or `meta.randomSeed`.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-CREATE-1 | MUST | `createManifesto()` MUST accept `schema` as the first positional argument and `effects` as the second |
| SDK-CREATE-2 | MUST | SDK MUST normalize or compile schema input before exposing `ComposableManifesto.schema` |
| SDK-CREATE-3 | MUST | SDK MUST preserve the simplified SDK `EffectHandler` contract and adapt it internally to Host requirements |
| SDK-CREATE-4 | MUST NOT | SDK MUST NOT accept a config object shape such as `ManifestoConfig` in v3 |
| SDK-CREATE-5 | MUST NOT | SDK MUST NOT accept guard callbacks, restore snapshots, or governed-world inputs at factory time |
| SDK-CREATE-6 | MUST NOT | SDK MUST NOT expose a ready-to-use runtime instance directly from `createManifesto()` |
| SDK-CREATE-7 | MUST | When `schema` is MEL text, compilation failures MUST throw `CompileError` with collected diagnostics |
| SDK-CREATE-8 | MUST | SDK MUST reject user effects that override reserved effect types with `ReservedEffectError` |
| SDK-CREATE-9 | MUST | SDK MUST reject action names using reserved namespace prefixes with `ManifestoError` code `RESERVED_NAMESPACE` |
| SDK-CREATE-10 | MUST | SDK MUST inject platform namespaces needed by compiler/host coordination before activation |

## 7. Activated Base Surface

Activating an undecorated composable manifesto returns the present-only base runtime instance:

```typescript
type ManifestoBaseInstance<T extends ManifestoDomainShape> = {
  readonly createIntent: TypedCreateIntent<T>;
  readonly dispatchAsync: TypedDispatchAsync<T>;
  readonly subscribe: TypedSubscribe<T>;
  readonly on: TypedOn<T>;
  readonly getSnapshot: () => Snapshot<T["state"]>;
  readonly getCanonicalSnapshot: () => CanonicalSnapshot<T["state"]>;
  readonly getAvailableActions: () => readonly (keyof T["actions"])[];
  readonly isActionAvailable: (name: keyof T["actions"]) => boolean;
  readonly getActionMetadata: TypedGetActionMetadata<T>;
  readonly getSchemaGraph: () => SchemaGraph;
  readonly simulate: <K extends keyof T["actions"]>(
    action: TypedActionRef<T, K>,
    ...args: CreateIntentArgs<T, K>
  ) => SimulateResult<T>;
  readonly MEL: TypedMEL<T>;
  readonly schema: DomainSchema;
  readonly dispose: () => void;
};
```

The canonical public surface is the instance object. Destructuring is optional ergonomics only.

The members in §7.4 and §7.5 are part of the current v3.1.0 SDK surface. They remain read-only SDK conveniences layered over the same activated schema and canonical runtime substrate.

### 7.1 `createIntent()`

`createIntent()` is instance-owned and typed from `MEL.actions.*`.

The canonical forms are:

```typescript
const positionalIntent = instance.createIntent(instance.MEL.actions.someAction, ...args);
const objectIntent = instance.createIntent(instance.MEL.actions.someAction, { ...params });
```

The SDK MUST NOT treat string action names as the canonical SDK v3 creation path.

`createIntent()` MUST always return a valid Core `Intent` with a non-empty `intentId`.

If the referenced action has zero parameters, `Intent.input` MUST be `undefined`.

If the referenced action has one or more parameters, `createIntent()` MUST synthesize `Intent.input` in the canonical object shape expected by the compiled action, preserving MEL-declared parameter names and declared order. `TypedActionRef` is the carrier of the metadata required for that packing step.

For compiled multi-parameter actions with positional metadata, both positional and object forms are valid public contract.

For actions whose public input is already a single object shape without positional metadata, only object form is guaranteed.

### 7.2 `dispatchAsync()`

`dispatchAsync()` is the sole base-runtime execution verb.

It MUST serialize intents per activated base instance. Concurrent calls on the same instance MUST be processed FIFO.

Action availability MUST be evaluated at **dequeue time**, not call time. This guarantees that an earlier queued intent can change the snapshot before a later queued intent is admitted or rejected.

If the action is unavailable at dequeue time, `dispatchAsync()` MUST reject without mutating the visible snapshot, MUST emit `dispatch:rejected`, and MUST NOT notify subscribers.

If execution succeeds, `dispatchAsync()` MUST publish the new terminal snapshot, notify subscribers, emit `dispatch:completed`, and resolve with that same snapshot.

If Host execution produces a terminal error result that also carries a new terminal snapshot, SDK MUST publish that snapshot, notify subscribers, emit `dispatch:failed` with the published snapshot attached, and reject the Promise with the associated error.

If execution fails before a new terminal snapshot exists, SDK MUST emit `dispatch:failed`, MUST leave the visible snapshot unchanged, and MUST reject the Promise.

### 7.3 Availability and Metadata Queries

`getAvailableActions()`, `isActionAvailable()`, and `getActionMetadata()` are observational reads over the current visible snapshot plus the activated schema metadata.

Availability reads MUST delegate to Core action-availability semantics rather than reconstructing policy in SDK.

`getActionMetadata()` MUST expose the SDK-known action metadata only:

- action name
- parameter names
- machine-readable input schema
- optional description

`getActionMetadata()` MUST NOT invent app-defined extension fields or richer ownership/routing protocols.

### 7.4 `getSchemaGraph()`

`getSchemaGraph()` returns the current instance's projected static dependency graph.

The graph MUST be derived from the activated `DomainSchema` alone. It MUST NOT depend on the current snapshot or dispatch history.

The SDK SHOULD compute the graph once at activation time and cache it for the lifetime of the instance.

Graph nodes use kind-prefixed ids for debug lookup and a bare `name` for canonical ref identity mapping:

- `state:tasks` corresponds to `instance.MEL.state.tasks`
- `computed:todoCount` corresponds to `instance.MEL.computed.todoCount`
- `action:createTask` corresponds to `instance.MEL.actions.createTask`

`traceUp(ref)` and `traceDown(ref)` are the canonical query surface. The string overloads are convenience/debug-only and MUST accept only kind-prefixed node ids.

`getSchemaGraph()` MUST expose the projected graph only:

- `data.$host`, `data.$mel`, and every other `data.$*` namespace are excluded
- edges touching any excluded `$*` node are excluded
- computed nodes whose transitive dependency closure touches `data.$*` are excluded, consistent with the projection boundary of `getSnapshot()`

The only supported graph relations are `feeds`, `mutates`, and `unlocks`.

### 7.5 `simulate()`

`simulate()` performs a pure dry-run of an action against the current canonical snapshot without committing the result.

It MUST use the same intent packing as `createIntent()` and the same deterministic HostContext construction as `dispatchAsync()`.

If the action is unavailable against the current canonical snapshot, `simulate()` MUST throw `ManifestoError` with code `ACTION_UNAVAILABLE`.

For a successful dry-run, `simulate()` MUST:

1. call Core `computeSync()`
2. apply the emitted patches with Core `apply()`
3. apply the emitted system transition with Core `applySystemDelta()`
4. project the resulting canonical snapshot through the same public lens as `getSnapshot()`

`simulate().snapshot` is the projected public snapshot that would become visible if the action ran now.

`changedPaths` is an inspection/debug-only diff of the projected public snapshot. Callers SHOULD use `snapshot`, `getAvailableActions()`, `isActionAvailable()`, or explicit snapshot reads for programmatic branching instead of branching on display-path strings.

`newAvailableActions` MUST be evaluated against the canonical simulated snapshot, not the projected snapshot, because action availability may depend on canonical-only substrate even when that substrate is excluded from the public projection.

`status` MUST mirror Core `ComputeStatus` exactly: `complete`, `pending`, `halted`, or `error`.

### 7.6 `subscribe()`

`subscribe()` observes visible projected snapshot publication through selector projection.

It MUST NOT fire synchronously upon registration.

It MUST fire at most once per published terminal snapshot for a given subscription.

Selector-based change detection MUST use `Object.is` on the selected value.

`subscribe()` MUST NOT fire for rejected dispatches, and MUST NOT fire for failures that do not publish a new terminal snapshot.

Canonical-only changes that do not affect any projected field MUST NOT trigger subscribers.

Exceptions thrown by selectors or listeners MUST NOT alter dispatch outcome, visible snapshot state, queue state, or event emission. Implementations MAY swallow or externally report those callback errors, but MUST isolate them from runtime semantics.

### 7.7 `on()`

`on()` is the SDK telemetry channel.

It carries intent lifecycle events only. It MUST NOT be used for state change notification.

Exceptions thrown by event handlers MUST NOT alter dispatch outcome, visible snapshot state, queue state, or other event handlers.

### 7.8 `getSnapshot()`

`getSnapshot()` returns the current visible **projected** terminal snapshot synchronously.

The returned value MUST be protected from external mutation. The implementation MAY use freezing, cloning, proxies, or equivalent defensive techniques, but callers MUST NOT be able to mutate internal runtime state by mutating the returned value.

### 7.9 `getCanonicalSnapshot()`

`getCanonicalSnapshot()` returns the current visible **canonical** runtime substrate synchronously.

This is the explicit inspection seam for persistence-aware tooling, stored-world alignment, and low-level debugging. It is not the default application-facing read surface.

### 7.10 `dispose()`

`dispose()` is idempotent.

After disposal:

- `dispatchAsync()` MUST reject with `DisposedError`
- `subscribe()` MUST return a no-op unsubscriber and MUST NOT register the listener
- `on()` MUST return a no-op unsubscriber and MUST NOT register the handler
- `getSnapshot()` MUST continue returning the last visible terminal snapshot
- `getCanonicalSnapshot()` MUST continue returning the last visible canonical snapshot

Dispose MUST release all SDK-owned resources for the activated base instance, including subscription storage, telemetry listeners, and queued runtime bookkeeping.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-BASE-1 | MUST | `ManifestoBaseInstance<T>` MUST expose exactly the fields shown in §7 |
| SDK-BASE-2 | MUST | `dispatchAsync()` MUST be the canonical base execution verb |
| SDK-BASE-3 | MUST | `createIntent()` MUST be typed from `MEL.actions.*`, not raw string action names |
| SDK-BASE-4 | MUST | `getAvailableActions()`, `isActionAvailable()`, and `getActionMetadata()` MUST be typed from `keyof T["actions"]` |
| SDK-BASE-5 | MUST | The canonical public surface MUST be the instance object; destructuring is optional ergonomics only |
| SDK-BASE-6 | MUST NOT | The base SDK contract MUST NOT define top-level `dispatchAsync(instance, intent)` as normative execution surface |
| SDK-BASE-7 | MUST | `getSchemaGraph()` and `simulate()` MUST remain read-only instance conveniences; they MUST NOT commit or publish runtime state |
| SDK-DISPATCH-1 | MUST | `dispatchAsync()` MUST serialize intent processing FIFO per activated base instance |
| SDK-DISPATCH-2 | MUST | availability checks for queued intents MUST run at dequeue time against the then-current visible snapshot |
| SDK-DISPATCH-3 | MUST | unavailable actions MUST reject without snapshot publication |
| SDK-DISPATCH-4 | MUST | successful completion MUST resolve with the same snapshot that became visible through `getSnapshot()` and `dispatch:completed` |
| SDK-DISPATCH-5 | MUST | terminal failures with a new published snapshot MUST reject and emit `dispatch:failed` with that snapshot attached |
| SDK-DISPATCH-6 | MUST | pre-publication failures MUST reject without changing the visible snapshot |
| SDK-GRAPH-1 | MUST | `getSchemaGraph()` MUST expose a static graph derived from the activated `DomainSchema` alone, with no snapshot dependency |
| SDK-GRAPH-2 | MUST | the public graph MUST exclude `data.$*` nodes, edges touching excluded `$*` nodes, and computed nodes tainted by transitive `$*` dependencies |
| SDK-GRAPH-3 | SHOULD | the SDK SHOULD compute the graph once at activation time and cache it for the instance lifetime |
| SDK-GRAPH-4 | MUST | the only public relation labels are `feeds`, `mutates`, and `unlocks` |
| SDK-GRAPH-5 | MUST | `traceUp()` and `traceDown()` ref overloads are the canonical SDK query surface |
| SDK-GRAPH-6 | MUST | string lookup overloads MUST accept only kind-prefixed node ids and MUST be treated as convenience/debug-only |
| SDK-SIM-1 | MUST NOT | SDK implementations let `simulate()` mutate, commit, or publish runtime state |
| SDK-SIM-2 | MUST | unavailable simulated actions MUST throw `ManifestoError` code `ACTION_UNAVAILABLE` before dry-run compute begins |
| SDK-SIM-3 | MUST | `simulate()` MUST use the same intent packing and HostContext construction as normal dispatch |
| SDK-SIM-4 | MUST | `simulate()` MUST apply both Core `apply()` and Core `applySystemDelta()` to produce a complete simulated snapshot |
| SDK-SIM-5 | MUST | `simulate().snapshot` MUST return the same projected surface shape as `getSnapshot()` |
| SDK-SIM-6 | MUST | `simulate().newAvailableActions` MUST be evaluated against the canonical simulated snapshot |
| SDK-SIM-7 | MUST | `simulate().changedPaths` MUST be diffed from the projected public snapshot only and MUST be treated as inspection/debug-only, not as the canonical branching API |
| SDK-SIM-8 | MUST | `simulate().status` MUST mirror Core `ComputeStatus` exactly, including `halted` |
| SDK-SUB-1 | MUST | `subscribe()` MUST NOT fire synchronously on registration |
| SDK-SUB-2 | MUST | `subscribe()` listeners MUST fire only after visible terminal snapshot publication |
| SDK-SUB-3 | MUST | selector change detection MUST use `Object.is` |
| SDK-SUB-4 | MUST NOT | rejected dispatches MUST NOT trigger subscribers |
| SDK-SUB-5 | MUST NOT | canonical-only substrate changes MUST NOT trigger subscribers when the projected Snapshot is unchanged |
| SDK-EVENT-1 | MUST | `on()` MUST support exactly the event names defined in §5.6 for the base runtime instance |
| SDK-EVENT-2 | MUST | all event payloads MUST include `intentId` for correlation |
| SDK-EVENT-3 | MUST NOT | `on()` MUST NOT be a state-change channel |
| SDK-SNAP-1 | MUST | `getSnapshot()` MUST return the current visible terminal snapshot synchronously |
| SDK-SNAP-2 | MUST | `getSnapshot()` MUST return the projected Snapshot surface, not the canonical substrate |
| SDK-SNAP-3 | MUST | `getCanonicalSnapshot()` MUST return the current visible canonical substrate synchronously |
| SDK-SNAP-4 | MUST | returned snapshots and selector inputs MUST be mutation-safe |
| SDK-DISPOSE-1 | MUST | `dispose()` MUST be idempotent |
| SDK-DISPOSE-2 | MUST | post-dispose `dispatchAsync()` MUST reject with `DisposedError` |
| SDK-DISPOSE-3 | MUST | post-dispose `subscribe()` and `on()` MUST be inert registrations |

## 8. Decorator Boundary

The SDK does not define lineage or governance behavior, but it MUST define the composable boundary those packages consume:

```typescript
// @manifesto-ai/lineage
function withLineage<T extends ManifestoDomainShape, L extends BaseLaws>(
  manifesto: ComposableManifesto<T, L>,
  config: LineageConfig,
): ComposableManifesto<T, L & LineageLaws>;

// @manifesto-ai/governance
function withGovernance<T extends ManifestoDomainShape, L extends BaseLaws>(
  manifesto: ComposableManifesto<T, L>,
  config: GovernanceConfig<T, L>,
): ComposableManifesto<T, L & LineageLaws & GovernanceLaws>;
```

Those APIs are owned by their packages, not by SDK. SDK v3 guarantees only that its composable manifesto is the canonical input to that decorator chain.

This SDK spec does not restate:

- lineage seal semantics
- lineage publication boundary semantics
- governance proposal lifecycle
- governance lineage auto-guarantee details

Those are defined by ADR-017 and their owning package specs.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-BOUNDARY-1 | MUST | `ComposableManifesto<T, Laws>` MUST be the canonical input contract for package-level decorators |
| SDK-BOUNDARY-2 | MUST NOT | SDK MUST NOT re-export `createWorld()`, `GovernedWorldStore`, or other world facade assembly types |
| SDK-BOUNDARY-3 | MUST NOT | SDK MUST NOT present `@manifesto-ai/world` as part of the SDK public contract in v3 |
| SDK-BOUNDARY-4 | MUST | governed composition from the SDK story MUST be expressed as `createManifesto() -> withLineage() -> withGovernance() -> activate()` |
| SDK-BOUNDARY-5 | MUST | once lineage or governance laws are composed, `activate()` MUST return the runtime type defined by the owning package rather than the base SDK runtime |

## 9. Hard-Cut Removals

The following v2 surfaces are removed from the v3 SDK contract:

- `ManifestoConfig`
- `ManifestoInstance`
- synchronous `dispatch()`
- top-level `dispatchAsync(instance, intent)`
- `defineOps()` and typed operation-helper surface
- SDK thin world re-exports such as `createWorld()`
- string-name canonical intent creation
- v2 compatibility framing built around ready-to-use instances

This is an intentional hard cut. v2 usage patterns are not compatibility targets for the v3 spec.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-HC-1 | MUST NOT | SDK v3 MUST NOT carry forward removed v2 runtime handles or helper-first APIs as normative surface |
| SDK-HC-2 | MUST NOT | SDK v3 MUST NOT retain `@manifesto-ai/world` re-export surface for app-facing use |
| SDK-HC-3 | MUST | any runtime execution story in the SDK spec MUST begin after `activate()` |
| SDK-HC-4 | MUST NOT | string action names may not be documented as the canonical SDK v3 intent-construction path |

## 10. Error Model

SDK-owned errors remain exceptions, not snapshot values. They describe SDK boundary failures, not domain semantics.

`CompileError`, `ReservedEffectError`, `DisposedError`, and `AlreadyActivatedError` are the named SDK-owned failure types.

`ManifestoError` is the base SDK error. When no more specific subclass applies, SDK MAY use `ManifestoError` with a stable `code`.

Required stable codes:

| Code | Meaning |
|------|---------|
| `COMPILE_ERROR` | MEL compilation or SDK-side schema compilation failure |
| `RESERVED_EFFECT` | caller attempted to override a reserved effect type |
| `RESERVED_NAMESPACE` | caller used a reserved action namespace |
| `SCHEMA_ERROR` | caller declared a reserved platform namespace with the wrong shape |
| `DISPOSED` | post-dispose runtime call |
| `ALREADY_ACTIVATED` | second activation attempt on the same composable manifesto |
| `ACTION_UNAVAILABLE` | queued dispatch reached the front of the queue but the action was unavailable against the current visible snapshot |

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-ERR-1 | MUST | `ManifestoError` MUST expose a stable string `code` |
| SDK-ERR-2 | MUST | `CompileError` MUST expose structured diagnostics |
| SDK-ERR-3 | MUST | `ReservedEffectError` MUST expose the attempted effect type |
| SDK-ERR-4 | MUST | `AlreadyActivatedError` MUST be thrown on second activation attempt |
| SDK-ERR-5 | MUST | unavailable queued dispatches MUST reject with `ManifestoError` code `ACTION_UNAVAILABLE` or an exact subclass carrying that code |

## 11. Invariants

- The SDK owns one concept: `createManifesto()`.
- Runtime verbs do not exist before activation.
- Base execution is present-only and asynchronous.
- Governed semantics are expressed by decorator-owned verb promotion, not by SDK world assembly.
- SDK v3 is a super hard cut, not a migration layer.
- Re-activating the same composable manifesto is a programmer error.
- The visible snapshot is always mutation-safe from the caller side.

## 12. Compliance Checklist

An SDK v3.1.0 implementation complies with this living contract only if all of the following are true:

- `createManifesto()` returns a composable manifesto, not a runtime instance.
- Pre-activation objects expose no runtime verbs.
- `activate()` is one-shot and throws `AlreadyActivatedError` on repeat use.
- `ManifestoConfig` does not exist in the v3 contract.
- SDK no longer presents `@manifesto-ai/world` as part of its public story.
- The base activated runtime exposes `createIntent`, `dispatchAsync`, `subscribe`, `on`, `getSnapshot`, `getCanonicalSnapshot`, availability queries, `getSchemaGraph`, `simulate`, `MEL`, `schema`, and `dispose`.
- `createIntent()` is keyed by `MEL.actions.*`, not raw string action names.
- `dispatchAsync()` is FIFO per instance and evaluates availability at dequeue time.
- `getSchemaGraph()` exposes the projected static graph only and accepts refs as the canonical lookup surface.
- `simulate()` is a pure dry-run that applies both `apply()` and `applySystemDelta()` and treats `changedPaths` as inspection/debug-only.
- Subscribers fire only after visible terminal snapshot publication and use selector change detection.
- Event payloads are typed and correlated by `intentId`.
- Reserved effect override and reserved namespace misuse are rejected at factory time.
- Snapshot reads and callback inputs are protected from external mutation.

## 13. References

- [SDK Version Index](VERSION-INDEX.md)
- [ADR-017](../../../docs/internals/adr/017-capability-decorator-pattern.md)
- [Core SPEC v4.0.0](../../core/docs/core-SPEC.md)
- [Host Contract v4.0.0](../../host/docs/host-SPEC.md)
- [Compiler SPEC v0.7.0](../../compiler/docs/SPEC-v0.7.0.md)
- [Compiler SPEC v0.8.0 Addendum](../../compiler/docs/SPEC-v0.8.0.md)
- [SDK FDR v3.1.0 Rationale Track](FDR-v3.1.0-draft.md)
