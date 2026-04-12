# Manifesto SDK Specification

> **Status:** Normative (Living Document)
> **Scope:** Manifesto SDK Layer - Public Developer API
> **Compatible with:** Core SPEC v4.2.0, Host Contract v4.0.0, Compiler SPEC v1.0.0, Lineage SPEC v3.0.0, Governance SPEC v3.0.0
> **Supersedes:** SDK SPEC v2.0.0
> **Implements:** ADR-017 v3.1, ADR-019 v1.1, ADR-020 v1

> **Historical Note:** Pre-ADR-017 SDK surfaces live in Git history. They are no longer kept as active package docs in the working tree.
>
> **Current v3.6.0 Status:** The projected introspection additions, the intent-level dispatchability additions, refined single-parameter object binding in `createIntent()`, the `@manifesto-ai/sdk/extensions` Extension Kernel, the first-party `createSimulationSession()` helper on that seam, and additive intent explanation reads via `explainIntentFor()`, `explainIntent()`, `why()`, and `whyNot()` are now part of the current living SDK contract. The compiler-side extraction contract now lives in [SPEC-v1.0.0](../../compiler/docs/SPEC-v1.0.0.md).

## 1. Purpose

This document defines the current SDK v3.6.0 public contract.

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
| `SDK-EXT-*` | `@manifesto-ai/sdk/extensions` semantics |
| `SDK-EXT-EXPLAIN-*` | extension-kernel intent explanation semantics |
| `SDK-EXPLAIN-RT-*` | activated-runtime explanation convenience semantics |
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

### 5.5 Effect Authoring Subpath

The root SDK contract remains centered on `createManifesto()`. Typed effect authoring helpers live on the adjunct `@manifesto-ai/sdk/effects` subpath.

```typescript
type MergeableObject<TValue> = TValue extends readonly unknown[]
  ? never
  : TValue extends object
    ? TValue
    : never;

type PatchBuilder = {
  set<TValue>(ref: FieldRef<TValue>, value: TValue): Patch;
  unset<TValue>(ref: FieldRef<TValue>): Patch;
  merge<TValue>(
    ref: FieldRef<MergeableObject<TValue>>,
    value: Partial<MergeableObject<TValue>>,
  ): Patch;
};

declare function defineEffects<T extends ManifestoDomainShape>(
  factory: (
    ops: PatchBuilder,
    MEL: TypedMEL<T>,
  ) => Record<string, EffectHandler>,
): Record<string, EffectHandler>;
```

`defineEffects()` is an authoring helper, not a runtime seam. It MUST return the same `Record<string, EffectHandler>` contract consumed by `createManifesto(schema, effects)`. v1 lowering is limited to top-level `MEL.state.*` refs via `FieldRef.name`. Implementations MAY attach runtime metadata to refs internally, but effect handlers MUST still return concrete `Patch[]`.

### 5.6 Runtime Helper Types

```typescript
type ActionArgs<
  T extends ManifestoDomainShape,
  K extends keyof T["actions"],
> = T["actions"][K] extends (...args: infer P) => unknown ? P : never;

type ActionObjectBindingArgs<
  T extends ManifestoDomainShape,
  K extends keyof T["actions"],
> = ActionArgs<T, K> extends [unknown, ...unknown[]]
  ? readonly [Record<string, unknown>]
  : never;

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
  readonly hasDispatchableGate: boolean;
  readonly description?: string;
};

type TypedGetActionMetadata<T extends ManifestoDomainShape> = {
  (): readonly TypedActionMetadata<T>[];
  <K extends keyof T["actions"]>(name: K): TypedActionMetadata<T, K>;
};

type DispatchBlocker = {
  readonly layer: "available" | "dispatchable";
  readonly expression: ExprNode;
  readonly evaluatedResult: unknown;
  readonly description?: string;
};

type TypedIntent<
  T extends ManifestoDomainShape,
  K extends keyof T["actions"] = keyof T["actions"],
> = Intent & {
  readonly __typedIntent__?: {
    readonly domain: T;
    readonly action: K;
  };
};

type TypedCreateIntent<T extends ManifestoDomainShape> = <
  K extends keyof T["actions"],
>(
  action: TypedActionRef<T, K>,
  ...args: CreateIntentArgs<T, K>
) => TypedIntent<T, K>;

type TypedDispatchAsync<T extends ManifestoDomainShape> = (
  intent: Intent,
) => Promise<Snapshot<T["state"]>>;

type TypedIsIntentDispatchable<T extends ManifestoDomainShape> = <
  K extends keyof T["actions"],
>(
  action: TypedActionRef<T, K>,
  ...args: CreateIntentArgs<T, K>
) => boolean;

type TypedGetIntentBlockers<T extends ManifestoDomainShape> = <
  K extends keyof T["actions"],
>(
  action: TypedActionRef<T, K>,
  ...args: CreateIntentArgs<T, K>
) => readonly DispatchBlocker[];

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

type IntentExplanation<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> =
  | {
      readonly kind: "blocked";
      readonly actionName: keyof T["actions"] & string;
      readonly available: false;
      readonly dispatchable: false;
      readonly blockers: readonly DispatchBlocker[];
    }
  | {
      readonly kind: "blocked";
      readonly actionName: keyof T["actions"] & string;
      readonly available: true;
      readonly dispatchable: false;
      readonly blockers: readonly DispatchBlocker[];
    }
  | {
      readonly kind: "admitted";
      readonly actionName: keyof T["actions"] & string;
      readonly available: true;
      readonly dispatchable: true;
      readonly status: ComputeStatus;
      readonly requirements: readonly Requirement[];
      readonly canonicalSnapshot: CanonicalSnapshot<T["state"]>;
      readonly snapshot: Snapshot<T["state"]>;
      readonly newAvailableActions: readonly (keyof T["actions"])[];
      readonly changedPaths: readonly string[];
    };
```

`TypedActionMetadata<T, K>.input` MUST carry the same machine-readable action input schema that the runtime uses for validation and inspection.

`TypedActionMetadata<T, K>.hasDispatchableGate` MUST expose whether the action declares `dispatchable when` in the compiled schema.

`TypedIntent<T, K>` is the SDK's typed view of a Core `Intent`. Its runtime branding strategy is implementation-defined.

`IntentExplanation<T>.dispatchable` in blocked results reflects admission state. In the `available: false` branch, `dispatchable: false` MUST NOT be interpreted as evidence that dispatchability was evaluated.

`IntentExplanation<T>.canonicalSnapshot` is a canonical inspection surface. The stable parity surface for repeated explanation reads is the projected `snapshot` plus the summary fields documented below. Host-managed canonical metadata such as logical `timestamp` is not the intended byte-for-byte comparison surface across repeated dry-run reads.

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
    readonly code: "ACTION_UNAVAILABLE" | "INTENT_NOT_DISPATCHABLE" | "INVALID_INPUT";
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
| SDK-TYPE-9 | MUST | `DispatchBlocker.layer` MUST distinguish coarse action availability from fine intent dispatchability |
| SDK-TYPE-10 | MUST | `dispatch:rejected` event payloads MUST expose a stable machine-readable rejection `code` |

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
  readonly isIntentDispatchable: TypedIsIntentDispatchable<T>;
  readonly getIntentBlockers: TypedGetIntentBlockers<T>;
  readonly explainIntent: (intent: TypedIntent<T>) => IntentExplanation<T>;
  readonly why: (intent: TypedIntent<T>) => IntentExplanation<T>;
  readonly whyNot: (intent: TypedIntent<T>) => readonly DispatchBlocker[] | null;
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

The members in §7.3.1-§7.5 are part of the current v3.6.0 SDK surface. They remain read-only SDK conveniences layered over the same activated schema and canonical runtime substrate.

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

For compiled actions with positional metadata, positional and object forms are both valid public contract. This includes single-parameter actions, where object form means `{ paramName: value }` when the single parameter is not itself object-like. If the single parameter is object-like, the runtime preserves direct-value packing to avoid ambiguous double interpretation.

For actions whose public input is already a single object shape without positional metadata, only object form is guaranteed.

### 7.2 `dispatchAsync()`

`dispatchAsync()` is the sole base-runtime execution verb.

It MUST serialize intents per activated base instance. Concurrent calls on the same instance MUST be processed FIFO.

Action availability and intent dispatchability MUST be evaluated at **dequeue time**, not call time. This guarantees that an earlier queued intent can change the snapshot before a later queued intent is admitted or rejected.

The dequeue-time admission order is normative:

1. evaluate `isActionAvailable()`
2. if available, validate bound intent input against the activated action contract
3. if input is valid, evaluate `isIntentDispatchable()`

If the action is unavailable at dequeue time, `dispatchAsync()` MUST reject without mutating the visible snapshot, MUST emit `dispatch:rejected` with code `ACTION_UNAVAILABLE`, and MUST NOT notify subscribers.

If the action is available but the bound intent input is invalid at dequeue time, `dispatchAsync()` MUST reject without mutating the visible snapshot, MUST emit `dispatch:rejected` with code `INVALID_INPUT`, and MUST NOT notify subscribers.

If the action is available but the bound intent is not dispatchable at dequeue time, `dispatchAsync()` MUST reject without mutating the visible snapshot, MUST emit `dispatch:rejected` with code `INTENT_NOT_DISPATCHABLE`, and MUST NOT notify subscribers.

If execution succeeds, `dispatchAsync()` MUST publish the new terminal snapshot, notify subscribers, emit `dispatch:completed`, and resolve with that same snapshot.

If Host execution produces a terminal error result that also carries a new terminal snapshot, SDK MUST publish that snapshot, notify subscribers, emit `dispatch:failed` with the published snapshot attached, and reject the Promise with the associated error.

If execution fails before a new terminal snapshot exists, SDK MUST emit `dispatch:failed`, MUST leave the visible snapshot unchanged, and MUST reject the Promise.

### 7.3 Availability, Dispatchability, Explanation, and Metadata Queries

`getAvailableActions()`, `isActionAvailable()`, `isIntentDispatchable()`, `getIntentBlockers()`, `explainIntent()`, `why()`, `whyNot()`, and `getActionMetadata()` are observational reads over the current visible snapshot plus the activated schema metadata.

`getAvailableActions()` and `isActionAvailable()` are **snapshot-bound present-tense reads**, not durable capability grants or lease-like tokens. A name returned now MAY become unavailable after any later publication, restore, or other state change. Callers MUST re-read current legality instead of treating a prior action name as a stable future promise.

Availability and dispatchability reads MUST delegate to Core legality semantics rather than reconstructing policy in SDK.

`getActionMetadata()` MUST expose the SDK-known action metadata only:

- action name
- parameter names
- machine-readable input schema
- `hasDispatchableGate`
- optional description

`getActionMetadata()` MUST NOT invent app-defined extension fields or richer ownership/routing protocols.

`getIntentBlockers()` is an SDK-owned explanation surface. It MUST return:

- an empty list when the bound intent is dispatchable
- one or more `DispatchBlocker` values when the action is unavailable or the bound intent fails `dispatchable`

#### 7.3.1 Intent Explanation Reads

`explainIntent(intent)` returns `IntentExplanation<T>` for a bound typed intent against the runtime's current visible canonical snapshot.

It MUST be observationally pure and MUST delegate to the extension-kernel explanation substrate rather than reimplementing a second explanation path.

The legality ordering is normative:

1. evaluate action availability
2. if available, validate bound intent input against the activated action contract
3. if input is valid, evaluate bound-intent dispatchability
4. if admitted, perform the same dry-run transition contract as `simulate()`

The intended public legality ladder is:

1. coarse availability via `getAvailableActions()` / `isActionAvailable()`
2. first-failing-layer blocker or explanation reads via `getIntentBlockers()`, `whyNot()`, or `explainIntent()`
3. admitted dry-run via `simulate()`
4. runtime execution via `dispatchAsync()`

`getIntentBlockers()` and `whyNot()` are the lightweight first-failing-layer reads. `simulate()` is the admitted dry-run step. SDK MUST NOT require a second agent-only legality surface for that caller decision path.

If the action is unavailable, explanation reads MUST return the unavailable blocked result and MUST NOT surface invalid-input failures hidden behind that unavailable action.

If the action is available but the supplied bound intent input is invalid, `explainIntent()` MUST throw `ManifestoError` with code `INVALID_INPUT` before dispatchability evaluation or blocker projection. `why()` and `whyNot()` inherit the same validation semantics.

Blocked results MUST expose blockers for the first failing layer only. They MUST NOT combine availability and dispatchability blockers into one mixed result.

Admitted results MUST expose the canonical simulated snapshot, the projected public snapshot, status, requirements, new available actions, and changed paths.

`why(intent)` is a convenience alias of `explainIntent(intent)`.

`whyNot(intent)` is a convenience projection over `explainIntent(intent)`. It MUST return blockers for the first failing layer, or `null` if the intent is admitted.

`whyNot()` does not replace `getIntentBlockers()`. `getIntentBlockers()` remains the empty-array current-snapshot blocker query surface; `whyNot()` is an additive convenience read with a `null` admitted sentinel.

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

Input-dependent `dispatchable when` predicates MUST NOT be projected into `SchemaGraph`. The public graph remains a static schema-derived artifact over `available when`, writes, and computed dependencies only.

### 7.5 `simulate()`

`simulate()` performs a pure dry-run of an action against the current canonical snapshot without committing the result.

It MUST use the same intent packing as `createIntent()` and the same deterministic HostContext construction as `dispatchAsync()`.

If the action is unavailable against the current canonical snapshot, `simulate()` MUST throw `ManifestoError` with code `ACTION_UNAVAILABLE`.

If the action is available but the bound intent input is invalid against the current canonical snapshot, `simulate()` MUST throw `ManifestoError` with code `INVALID_INPUT`.

If the action is available but the bound intent is not dispatchable against the current canonical snapshot, `simulate()` MUST throw `ManifestoError` with code `INTENT_NOT_DISPATCHABLE`.

For a successful dry-run, `simulate()` MUST:

1. call Core `computeSync()`
2. apply the emitted patches with Core `apply()`
3. apply the emitted system transition with Core `applySystemDelta()`
4. project the resulting canonical snapshot through the same public lens as `getSnapshot()`

`simulate().snapshot` is the projected public snapshot that would become visible if the action ran now.

`changedPaths` is an inspection/debug-only diff of the projected public snapshot. Callers SHOULD use `snapshot`, `getAvailableActions()`, `isActionAvailable()`, or explicit snapshot reads for programmatic branching instead of branching on display-path strings.

`newAvailableActions` MUST be evaluated against the canonical simulated snapshot, not the projected snapshot, because action availability may depend on canonical-only substrate even when that substrate is excluded from the public projection.

`newAvailableActions` remains the coarse action-family read. It MUST NOT be reinterpreted as a list of fully dispatchable bound intents.

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

### 7.10 `@manifesto-ai/sdk/extensions`

ADR-019 defines the SDK seam for post-activation, arbitrary-snapshot, observationally pure tooling:

```typescript
import { getExtensionKernel } from "@manifesto-ai/sdk/extensions";

const ext = getExtensionKernel(instance);
```

`getExtensionKernel()` accepts an activated SDK runtime:

```typescript
getExtensionKernel<T extends ManifestoDomainShape, Laws extends BaseLaws>(
  app: ActivatedInstance<T, Laws>,
): ExtensionKernel<T>;
```

It MUST NOT accept a pre-activation `ComposableManifesto`.

The public surface is:

```typescript
interface ExtensionKernel<T extends ManifestoDomainShape> {
  readonly MEL: TypedMEL<T>;
  readonly schema: DomainSchema;

  createIntent: TypedCreateIntent<T>;
  getCanonicalSnapshot(): CanonicalSnapshot<T["state"]>;

  projectSnapshot(
    snapshot: CanonicalSnapshot<T["state"]>,
  ): Snapshot<T["state"]>;

  simulateSync(
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ): ExtensionSimulateResult<T>;

  getAvailableActionsFor(
    snapshot: CanonicalSnapshot<T["state"]>,
  ): readonly (keyof T["actions"])[];

  isActionAvailableFor(
    snapshot: CanonicalSnapshot<T["state"]>,
    actionName: keyof T["actions"],
  ): boolean;

  isIntentDispatchableFor(
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ): boolean;

  explainIntentFor(
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ): IntentExplanation<T>;
}

type ExtensionSimulateResult<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = {
  readonly snapshot: CanonicalSnapshot<T["state"]>;
  readonly patches: readonly Patch[];
  readonly requirements: readonly Requirement[];
  readonly status: ComputeStatus;
};
```

`ExtensionKernel.MEL`, `schema`, `createIntent`, and `getCanonicalSnapshot()` are observational equivalents of the corresponding activated-runtime members. The extension seam narrows capability, not meaning.

All arbitrary-snapshot operations accept **canonical** snapshots only. Passing projected `Snapshot` values, or canonical snapshots that do not conform to the activated runtime's schema, is out of contract.

The Extension Kernel is the safe public subset for helper and tool authors. It MUST remain observationally pure: no publication, execution, event emission, queue control, or visible runtime mutation.

`ExtensionSimulateResult` is intentionally canonical and minimal. `simulateSync()` itself does not bundle projected `changedPaths`, `newAvailableActions`, or blocker explanations. Callers that need structured intent explanation SHOULD use `explainIntentFor()`. Callers that need lower-level composition MAY still combine `projectSnapshot()`, `getAvailableActionsFor()`, and `isIntentDispatchableFor()` explicitly.

Extension-kernel acquisition and use are post-activation only, but they are not part of runtime execution. The seam remains analytical after `dispose()`: observationally pure methods MUST NOT reject solely because the source runtime has been disposed.

#### 7.10.1 `explainIntentFor()`

`explainIntentFor(snapshot, intent)` provides structured intent-level explanation over a caller-supplied canonical snapshot and returns `IntentExplanation<T>` as defined in §5.5.

Its purpose is to compose, in one observationally pure call:

1. coarse availability check
2. input validation against the activated action contract
3. fine dispatchability check
4. structured blocker construction for the first failing layer
5. dry-run simulation when the bound intent is admitted

It MUST remain post-activation and observationally pure.

It MUST NOT publish, mutate, dispatch, enqueue, subscribe, emit runtime events, or expose provider-only runtime-control surfaces.

If the action is unavailable, `explainIntentFor()` MUST return the unavailable blocked result and MUST NOT surface invalid-input failures hidden behind that unavailable action.

If the action is available but the supplied bound intent input is invalid, `explainIntentFor()` MUST throw `ManifestoError` with code `INVALID_INPUT` before dispatchability evaluation, blocker projection, or dry-run simulation.

Blocked results MUST expose blockers for the first failing layer only. They MUST NOT combine availability and dispatchability blockers into one mixed result.

Blocker construction reuses the same internal blocker path as the base runtime's `getIntentBlockers()`. No new public `getIntentBlockersFor()` is added to the extension seam.

For `snapshot === app.getCanonicalSnapshot()` and an intent created from the same activated runtime:

- blocked results MUST be semantically equivalent to `getIntentBlockers()` at the first failing layer
- admitted results MUST be semantically equivalent to `simulate()` for projected snapshot, status, requirements, new available actions, and changed paths

#### 7.10.2 `createSimulationSession()`

`@manifesto-ai/sdk/extensions` also exposes a first-party immutable branching helper:

```typescript
createSimulationSession<T extends ManifestoDomainShape, Laws extends BaseLaws>(
  app: ActivatedInstance<T, Laws>,
): SimulationSession<T>;
```

The helper is intentionally thin over the Extension Kernel:

```typescript
type SimulationSessionStatus = ComputeStatus | "idle";

type SimulationActionRef<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = TypedActionRef<T, keyof T["actions"]>;

type SimulationSessionStep<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = {
  readonly intent: TypedIntent<T>;
  readonly snapshot: Snapshot<T["state"]>;
  readonly canonicalSnapshot: CanonicalSnapshot<T["state"]>;
  readonly availableActions: readonly SimulationActionRef<T>[];
  readonly requirements: readonly Requirement[];
  readonly status: ComputeStatus;
  readonly isTerminal: boolean;
};

type SimulationSessionResult<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = {
  readonly snapshot: Snapshot<T["state"]>;
  readonly canonicalSnapshot: CanonicalSnapshot<T["state"]>;
  readonly depth: number;
  readonly trajectory: readonly SimulationSessionStep<T>[];
  readonly availableActions: readonly SimulationActionRef<T>[];
  readonly requirements: readonly Requirement[];
  readonly status: SimulationSessionStatus;
  readonly isTerminal: boolean;
};

interface SimulationSession<T extends ManifestoDomainShape> {
  readonly snapshot: Snapshot<T["state"]>;
  readonly canonicalSnapshot: CanonicalSnapshot<T["state"]>;
  readonly depth: number;
  readonly trajectory: readonly SimulationSessionStep<T>[];
  readonly availableActions: readonly SimulationActionRef<T>[];
  readonly requirements: readonly Requirement[];
  readonly status: SimulationSessionStatus;
  readonly isTerminal: boolean;

  next<K extends keyof T["actions"]>(
    action: TypedActionRef<T, K>,
    ...args: CreateIntentArgs<T, K>
  ): SimulationSession<T>;

  next(intent: TypedIntent<T>): SimulationSession<T>;

  finish(): SimulationSessionResult<T>;
}
```

The root session starts from the current canonical runtime snapshot and projects that snapshot to the normal public `Snapshot` surface. Each `next()` call performs one arbitrary-snapshot `simulateSync()` step and returns a new branch. The original session MUST remain unchanged.

### 7.11 `dispose()`

`dispose()` is idempotent.

After disposal:

- `dispatchAsync()` MUST reject with `DisposedError`
- `subscribe()` MUST return a no-op unsubscriber and MUST NOT register the listener
- `on()` MUST return a no-op unsubscriber and MUST NOT register the handler
- `getSnapshot()` MUST continue returning the last visible terminal snapshot
- `getCanonicalSnapshot()` MUST continue returning the last visible canonical snapshot
- `explainIntent()`, `why()`, and `whyNot()` MUST continue operating as observational reads over the last visible canonical snapshot

Dispose MUST release all SDK-owned resources for the activated base instance, including subscription storage, telemetry listeners, and queued runtime bookkeeping.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-BASE-1 | MUST | `ManifestoBaseInstance<T>` MUST expose exactly the fields shown in §7 |
| SDK-BASE-2 | MUST | `dispatchAsync()` MUST be the canonical base execution verb |
| SDK-BASE-3 | MUST | `createIntent()` MUST be typed from `MEL.actions.*`, not raw string action names |
| SDK-BASE-4 | MUST | `getAvailableActions()`, `isActionAvailable()`, `isIntentDispatchable()`, `getIntentBlockers()`, and `getActionMetadata()` MUST be typed from `keyof T["actions"]` |
| SDK-BASE-5 | MUST | The canonical public surface MUST be the instance object; destructuring is optional ergonomics only |
| SDK-BASE-6 | MUST NOT | The base SDK contract MUST NOT define top-level `dispatchAsync(instance, intent)` as normative execution surface |
| SDK-BASE-7 | MUST | `getSchemaGraph()` and `simulate()` MUST remain read-only instance conveniences; they MUST NOT commit or publish runtime state |
| SDK-EXPLAIN-RT-1 | MUST | `explainIntent()` MUST evaluate against the runtime's current visible canonical snapshot only |
| SDK-EXPLAIN-RT-2 | MUST | `explainIntent()` MUST be observationally pure |
| SDK-EXPLAIN-RT-3 | MUST | `explainIntent()` MUST delegate to the extension-kernel explanation substrate rather than reimplementing a second explanation model |
| SDK-EXPLAIN-RT-4 | MUST | `why()` MUST be provided as an alias of `explainIntent()` |
| SDK-EXPLAIN-RT-5 | MUST | `whyNot()` MUST be provided as a convenience projection over blocked explanations |
| SDK-EXPLAIN-RT-6 | MUST | `whyNot()` MUST return `null` for admitted intents, not an empty array |
| SDK-EXPLAIN-RT-7 | MUST | If the action is available but the bound intent input is invalid, `explainIntent()`, `why()`, and `whyNot()` MUST throw `ManifestoError` code `INVALID_INPUT` before blocker projection or dispatchability evaluation |
| SDK-EXPLAIN-RT-7a | MUST | If the action is unavailable, `explainIntent()`, `why()`, and `whyNot()` MUST short-circuit before invalid-input evaluation and return the unavailable blocked result |
| SDK-DISPATCH-1 | MUST | `dispatchAsync()` MUST serialize intent processing FIFO per activated base instance |
| SDK-DISPATCH-2 | MUST | availability checks for queued intents MUST run at dequeue time against the then-current visible snapshot |
| SDK-DISPATCH-3 | MUST | if the action is available, bound intent input validation for queued intents MUST run at dequeue time against the then-current visible snapshot before dispatchability checks |
| SDK-DISPATCH-3a | MUST | if the action is available and input is valid, dispatchability checks for queued intents MUST also run at dequeue time against the then-current visible snapshot |
| SDK-DISPATCH-4 | MUST | unavailable actions MUST reject without snapshot publication |
| SDK-DISPATCH-4a | MUST | invalid-input intents MUST reject without snapshot publication |
| SDK-DISPATCH-5 | MUST | available but non-dispatchable intents MUST reject without snapshot publication |
| SDK-DISPATCH-6 | MUST | `dispatch:rejected` payloads MUST distinguish `ACTION_UNAVAILABLE`, `INVALID_INPUT`, and `INTENT_NOT_DISPATCHABLE` |
| SDK-DISPATCH-7 | MUST | successful completion MUST resolve with the same snapshot that became visible through `getSnapshot()` and `dispatch:completed` |
| SDK-DISPATCH-8 | MUST | terminal failures with a new published snapshot MUST reject and emit `dispatch:failed` with that snapshot attached |
| SDK-DISPATCH-9 | MUST | pre-publication failures MUST reject without changing the visible snapshot |
| SDK-GRAPH-1 | MUST | `getSchemaGraph()` MUST expose a static graph derived from the activated `DomainSchema` alone, with no snapshot dependency |
| SDK-GRAPH-2 | MUST | the public graph MUST exclude `data.$*` nodes, edges touching excluded `$*` nodes, and computed nodes tainted by transitive `$*` dependencies |
| SDK-GRAPH-3 | SHOULD | the SDK SHOULD compute the graph once at activation time and cache it for the instance lifetime |
| SDK-GRAPH-4 | MUST | the only public relation labels are `feeds`, `mutates`, and `unlocks` |
| SDK-GRAPH-5 | MUST | `traceUp()` and `traceDown()` ref overloads are the canonical SDK query surface |
| SDK-GRAPH-6 | MUST | string lookup overloads MUST accept only kind-prefixed node ids and MUST be treated as convenience/debug-only |
| SDK-SIM-1 | MUST NOT | SDK implementations let `simulate()` mutate, commit, or publish runtime state |
| SDK-SIM-2 | MUST | unavailable simulated actions MUST throw `ManifestoError` code `ACTION_UNAVAILABLE` before dry-run compute begins |
| SDK-SIM-2b | MUST | available but invalid-input simulated intents MUST throw `ManifestoError` code `INVALID_INPUT` before dispatchability evaluation or dry-run compute begins |
| SDK-SIM-2a | MUST | available but non-dispatchable simulated intents MUST throw `ManifestoError` code `INTENT_NOT_DISPATCHABLE` before dry-run compute begins |
| SDK-SIM-3 | MUST | `simulate()` MUST use the same intent packing and HostContext construction as normal dispatch |
| SDK-SIM-4 | MUST | `simulate()` MUST apply both Core `apply()` and Core `applySystemDelta()` to produce a complete simulated snapshot |
| SDK-SIM-5 | MUST | `simulate().snapshot` MUST return the same projected surface shape as `getSnapshot()` |
| SDK-SIM-6 | MUST | `simulate().newAvailableActions` MUST be evaluated against the canonical simulated snapshot |
| SDK-SIM-7 | MUST | `simulate().changedPaths` MUST be diffed from the projected public snapshot only and MUST be treated as inspection/debug-only, not as the canonical branching API |
| SDK-SIM-8 | MUST | `simulate().status` MUST mirror Core `ComputeStatus` exactly, including `halted` |
| SDK-EXT-1 | MUST | `getExtensionKernel()` MUST accept only activated runtime instances and MUST return a frozen, bound Extension Kernel |
| SDK-EXT-2 | MUST | `ExtensionKernel.projectSnapshot()` MUST apply the same public projection boundary as `getSnapshot()` |
| SDK-EXT-3 | MUST | `ExtensionKernel.projectSnapshot()` MUST be observationally pure; it MUST NOT be implemented by mutating the visible runtime snapshot and reading it back |
| SDK-EXT-4 | MUST | `ExtensionKernel.simulateSync()` MUST use the same `computeSync -> apply -> applySystemDelta` transition contract as `simulate()` |
| SDK-EXT-5 | MUST | `ExtensionKernel.simulateSync()` MUST preserve the same unavailable-action and non-dispatchable-intent rejection semantics as `simulate()` |
| SDK-EXT-6 | MUST | `ExtensionKernel.getAvailableActionsFor()`, `isActionAvailableFor()`, and `isIntentDispatchableFor()` MUST evaluate against the caller-provided canonical snapshot |
| SDK-EXT-7 | MUST NOT | `@manifesto-ai/sdk/extensions` MUST expose publication-control, execution-control, queue-control, or provider-activation helpers |
| SDK-EXT-8 | MUST NOT | Calls through `ExtensionKernel` MUST mutate the visible runtime snapshot, trigger subscribers, emit runtime events, or enqueue work on the source runtime |
| SDK-EXT-9 | MUST | `ExtensionKernel.MEL`, `schema`, `createIntent`, and `getCanonicalSnapshot()` MUST remain observationally equivalent to the corresponding activated-runtime members |
| SDK-EXT-10 | MUST | `ExtensionSimulateResult` MUST remain canonical and minimal; projected `changedPaths` and `newAvailableActions` belong to `simulate()` or explicit follow-up extension calls, not to `simulateSync()` |
| SDK-EXT-11 | MUST | For `snapshot === app.getCanonicalSnapshot()` and an intent created from the same activated runtime, `projectSnapshot(result.snapshot)`, `result.status`, `result.requirements`, and `getAvailableActionsFor(result.snapshot)` from `simulateSync(snapshot, intent)` MUST match public `simulate()` semantics |
| SDK-EXT-12 | MUST | Observationally pure `ExtensionKernel` methods MUST remain callable after `dispose()` and MUST NOT reject solely because the source runtime has been disposed |
| SDK-EXT-13 | MUST | `createSimulationSession()` MUST share the same safe substrate as `ExtensionKernel`; it MUST NOT require provider-only access or bypass the extension boundary with provider-only capabilities |
| SDK-EXT-14 | MUST | The root `SimulationSession` MUST start from `getCanonicalSnapshot()` and expose both the projected `snapshot` and the canonical substrate explicitly as `canonicalSnapshot` |
| SDK-EXT-15 | MUST | `SimulationSession.next()` MUST be immutable: it returns a new session branch and MUST NOT mutate the original session |
| SDK-EXT-16 | MUST | `SimulationSession.availableActions` MUST expose typed MEL action refs for the current branch state, derived from `getAvailableActionsFor(canonicalSnapshot)` |
| SDK-EXT-17 | MUST | Terminal `SimulationSession` states (`pending`, `halted`, `error`) MUST reject further `next()` calls with an SDK error; `finish()` MUST remain available |
| SDK-EXT-EXPLAIN-1 | MUST | `explainIntentFor()` MUST be observationally pure and MUST NOT modify visible runtime state, canonical runtime state, subscriptions, events, or queues |
| SDK-EXT-EXPLAIN-2 | MUST | `explainIntentFor()` MUST preserve legality ordering: availability first, input validation second, dispatchability third, simulation fourth |
| SDK-EXT-EXPLAIN-3 | MUST | If the action is unavailable, `explainIntentFor()` MUST return a blocked result with `available: false` and MUST NOT evaluate input validation or dispatchability |
| SDK-EXT-EXPLAIN-3a | MUST | If the action is available but the bound intent input is invalid, `explainIntentFor()` MUST throw `ManifestoError` code `INVALID_INPUT` before dispatchability evaluation, blocker projection, or dry-run simulation |
| SDK-EXT-EXPLAIN-4 | MUST | If the action is available but the bound intent is not dispatchable, `explainIntentFor()` MUST return a blocked result with `available: true, dispatchable: false` and MUST NOT perform dry-run simulation |
| SDK-EXT-EXPLAIN-5 | MUST | If the bound intent is admitted, `explainIntentFor()` MUST perform the same dry-run transition contract as `simulateSync()` over the supplied canonical snapshot |
| SDK-EXT-EXPLAIN-6 | MUST | For admitted intents, the projected snapshot MUST equal `projectSnapshot(simulateSync(snapshot, intent).snapshot)` |
| SDK-EXT-EXPLAIN-7 | MUST | Blocked results MUST expose blockers for the first failing layer only. They MUST NOT combine availability and dispatchability blockers into one mixed result |
| SDK-EXT-EXPLAIN-8 | SHOULD | Admitted results SHOULD expose the resulting canonical snapshot, projected public snapshot, status, requirements, new available actions, and changed paths |
| SDK-EXT-EXPLAIN-9 | MUST | `changedPaths` in explanation results remain inspection/debug-only, consistent with `SDK-SIM-7` |
| SDK-EXT-EXPLAIN-10 | MUST | Blocked result blockers MUST be semantically equivalent to what `getIntentBlockers()` would return for the same snapshot and intent at the first failing layer |
| SDK-EXT-EXPLAIN-11 | MUST | Blocker construction MUST delegate to the existing internal blocker path, not reimplement blocker assembly |
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
| SDK-DISPOSE-4 | MUST | post-dispose `explainIntent()`, `why()`, and `whyNot()` MUST remain callable as read-only views over the last visible canonical snapshot |

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

The post-activation extension seam lives at `@manifesto-ai/sdk/extensions`.
That subpath is for helper and tool authors who need safe arbitrary-snapshot read-only operations on an activated runtime.

The public decorator/provider authoring seam lives at `@manifesto-ai/sdk/provider`.
That subpath exposes `RuntimeKernel`, `RuntimeKernelFactory`, and the activation-state helpers used by `withLineage()` and `withGovernance()`.

For decorator authors that need hypothetical planning or dry-run analysis against caller-provided canonical snapshots, `RuntimeKernel` MUST additionally expose:

- `simulateSync(snapshot, intent)`
- `getAvailableActionsFor(snapshot)`
- `isActionAvailableFor(snapshot, actionName)`

Those methods are provider-authoring seams only. They operate on caller-provided canonical snapshots and MUST NOT mutate or publish the visible runtime snapshot.

Post-activation pure extension does not reopen pre-activation composition. `@manifesto-ai/sdk/extensions` is not a decorator seam and MUST NOT be used to model identity-changing capabilities.

The three SDK layers are intentionally distinct:

| Subpath | Audience | Capability Level |
|---------|----------|------------------|
| `@manifesto-ai/sdk` | App consumers | Safe current-snapshot runtime |
| `@manifesto-ai/sdk/extensions` | Helper and tool authors | Safe arbitrary-snapshot read-only runtime |
| `@manifesto-ai/sdk/provider` | Decorator/runtime authors | Full provider-authoring seam |

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
| SDK-BOUNDARY-6 | MUST | `@manifesto-ai/sdk/provider` MUST expose arbitrary-snapshot `RuntimeKernel` helpers `simulateSync()`, `getAvailableActionsFor()`, and `isActionAvailableFor()` for decorator authors |
| SDK-BOUNDARY-7 | MUST NOT | provider-seam arbitrary-snapshot helpers MUST NOT mutate, publish, or otherwise replace the visible runtime snapshot |
| SDK-BOUNDARY-8 | MUST | `@manifesto-ai/sdk/extensions` MUST expose post-activation observationally pure arbitrary-snapshot helpers for activated runtimes |
| SDK-BOUNDARY-9 | MUST NOT | `@manifesto-ai/sdk/extensions` MUST NOT expose runtime-control methods or provider-only activation/composition helpers |
| SDK-BOUNDARY-10 | MUST NOT | `@manifesto-ai/sdk/extensions` MUST NOT be treated as a decorator or law-composition seam; identity-changing capabilities remain pre-activation concerns |

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

The additive `@manifesto-ai/sdk/effects` subpath does not revive the removed v2 helper-first runtime surface. `defineEffects()` is constrained to effect authoring and does not alter the root `createManifesto()` contract.

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
| `INVALID_INPUT` | the action was available, but the bound intent input failed SDK validation against the activated action contract |
| `INTENT_NOT_DISPATCHABLE` | the action was available, but the bound intent failed the dispatchability gate against the current visible snapshot |

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-ERR-1 | MUST | `ManifestoError` MUST expose a stable string `code` |
| SDK-ERR-2 | MUST | `CompileError` MUST expose structured diagnostics |
| SDK-ERR-3 | MUST | `ReservedEffectError` MUST expose the attempted effect type |
| SDK-ERR-4 | MUST | `AlreadyActivatedError` MUST be thrown on second activation attempt |
| SDK-ERR-5 | MUST | unavailable queued dispatches MUST reject with `ManifestoError` code `ACTION_UNAVAILABLE` or an exact subclass carrying that code |
| SDK-ERR-5a | MUST | invalid-input queued dispatches MUST reject with `ManifestoError` code `INVALID_INPUT` or an exact subclass carrying that code |
| SDK-ERR-6 | MUST | available but non-dispatchable queued dispatches MUST reject with `ManifestoError` code `INTENT_NOT_DISPATCHABLE` or an exact subclass carrying that code |

## 11. Invariants

- The SDK owns one concept: `createManifesto()`.
- Runtime verbs do not exist before activation.
- Base execution is present-only and asynchronous.
- Governed semantics are expressed by decorator-owned verb promotion, not by SDK world assembly.
- SDK v3 is a super hard cut, not a migration layer.
- Re-activating the same composable manifesto is a programmer error.
- The visible snapshot is always mutation-safe from the caller side.

## 12. Compliance Checklist

An SDK v3.6.0 implementation complies with this living contract only if all of the following are true:

- `createManifesto()` returns a composable manifesto, not a runtime instance.
- Pre-activation objects expose no runtime verbs.
- `activate()` is one-shot and throws `AlreadyActivatedError` on repeat use.
- `ManifestoConfig` does not exist in the v3 contract.
- SDK no longer presents `@manifesto-ai/world` as part of its public story.
- The base activated runtime exposes `createIntent`, `dispatchAsync`, `subscribe`, `on`, `getSnapshot`, `getCanonicalSnapshot`, availability queries, dispatchability queries, intent explanation reads, `getSchemaGraph`, `simulate`, `MEL`, `schema`, and `dispose`.
- `createIntent()` is keyed by `MEL.actions.*`, not raw string action names.
- `dispatchAsync()` is FIFO per instance and evaluates availability, then input validation, then dispatchability at dequeue time.
- `getSchemaGraph()` exposes the projected static graph only and accepts refs as the canonical lookup surface.
- `simulate()` is a pure dry-run that applies both `apply()` and `applySystemDelta()` and treats `changedPaths` as inspection/debug-only.
- `@manifesto-ai/sdk/extensions` exposes `getExtensionKernel()` with pure canonical-input arbitrary-snapshot helpers, including `explainIntentFor()`, and no runtime-control methods.
- `explainIntent()`, `why()`, and `whyNot()` remain current-snapshot read-only conveniences layered over the same extension-kernel explanation substrate.
- `INVALID_INPUT` is a stable rejection/error code across dispatch, explanation, and dry-run validation paths.
- Subscribers fire only after visible terminal snapshot publication and use selector change detection.
- Event payloads are typed and correlated by `intentId`.
- Reserved effect override and reserved namespace misuse are rejected at factory time.
- Snapshot reads and callback inputs are protected from external mutation.

## 13. References

- [SDK Version Index](VERSION-INDEX.md)
- [ADR-017](../../../docs/internals/adr/017-capability-decorator-pattern.md)
- [Core SPEC v4.2.0](../../core/docs/core-SPEC.md)
- [Host Contract v4.0.0](../../host/docs/host-SPEC.md)
- [Compiler SPEC v1.0.0](../../compiler/docs/SPEC-v1.0.0.md)
- [SDK FDR v3.1.0 Rationale Track](FDR-v3.1.0-draft.md)
