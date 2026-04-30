# Manifesto SDK Specification

> **Status:** Normative (Living Document)
> **Scope:** Manifesto SDK Layer - Public Developer API
> **Compatible with:** Manifesto v5 substrate, ADR-025 Snapshot Ontology, Core SPEC v5, Host Contract v5, Lineage SPEC v5, Governance SPEC v5
> **Replaces:** SDK v3 activated-runtime caller ladder as the current SDK contract
> **Implements:** ADR-017, ADR-019, ADR-020, ADR-025, ADR-026

> **Historical Note:** SDK v3 APIs remain available in Git history and in the v3
> FDR companion for rationale. They are not compatibility targets for the v5
> canonical public surface.
>
> **Current Contract Status:** SDK v5 exposes an activation-first
> `ManifestoApp` organized around the action-candidate ladder:
> `snapshot() -> actions.* -> check() -> preview() -> submit()`. The canonical
> root surface is `snapshot()`, `actions`, `action(name)`, `observe`, `inspect`,
> and `dispose()`. Raw `Intent` construction is an advanced protocol escape
> hatch reachable through `BoundAction.intent()`, not the primary app path.

## 1. Purpose

This document defines the current SDK public contract.

The SDK owns the base activation-first application runtime surface. It exposes
the present application view, typed action-candidate handles, projected reads,
observation, and advanced inspection. It does not own lineage continuity or
governance legitimacy. Those remain the responsibility of their owning package
specs.

The v5 public model is:

```typescript
const app = createManifesto<TodoDomain>(schema, effects).activate();

app.snapshot();
app.actions.addTodo.info();
app.actions.addTodo.available();
app.actions.addTodo.check({ title: "Ship v5" });
app.actions.addTodo.preview({ title: "Ship v5" });
await app.actions.addTodo.submit({ title: "Ship v5" });
```

The SDK does not present `@manifesto-ai/world` as part of its public story.
Governed composition is expressed by decorating the composable manifesto with
`withLineage()` and `withGovernance()` from their owning packages.

## 2. Normative Language

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
"SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document
are to be interpreted as described in
[RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

Normative rule prefixes:

| Prefix | Domain |
|--------|--------|
| `SDK-ROLE-*` | SDK ownership and package boundary |
| `SDK-PHASE-*` | phase and lifecycle rules |
| `SDK-CREATE-*` | factory and schema resolution |
| `SDK-ROOT-*` | runtime root and mode-specific surface rules |
| `SDK-ACTION-*` | action handle and bound action rules |
| `SDK-ADMISSION-*` | `check()` and first-failing-layer rules |
| `SDK-PREVIEW-*` | `preview()` dry-run rules |
| `SDK-SUBMIT-*` | law-aware `submit()` rules |
| `SDK-RESULT-*` | result envelope and outcome rules |
| `SDK-SNAPSHOT-*` | projected/canonical snapshot visibility |
| `SDK-OBSERVE-*` | state/event observation |
| `SDK-INSPECT-*` | advanced inspection surface |
| `SDK-EXT-*` | `@manifesto-ai/sdk/extensions` boundary |
| `SDK-DISPOSE-*` | disposal semantics |
| `SDK-ERR-*` | SDK-owned error model |
| `SDK-HC-*` | hard-cut removal rules |

## 3. SDK Role and Boundaries

The SDK exposes the app-facing runtime grammar. Core computes, Host executes,
Lineage records continuity, and Governance authorizes legitimacy.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-ROLE-1 | MUST | SDK MUST own `createManifesto()` as the base public entrypoint. |
| SDK-ROLE-2 | MUST | `createManifesto()` MUST return `ComposableManifesto<TDomain, "base">`, not a ready runtime instance. |
| SDK-ROLE-3 | MUST | SDK MUST define the common `ManifestoApp` action-candidate grammar for all runtime modes. |
| SDK-ROLE-4 | MUST NOT | SDK MUST NOT compute semantic meaning, execute effects directly, own authority policy, or own lineage storage semantics. |
| SDK-ROLE-5 | MUST NOT | SDK MUST NOT expose app-facing governed assembly through `@manifesto-ai/world` re-exports. |
| SDK-ROLE-6 | MUST | Lineage and Governance packages MUST own their mode-specific decorators and settlement semantics. |
| SDK-ROLE-7 | MUST | SDK MAY pass through selected Core and Host public exports, but those pass-through exports are not SDK-owned runtime surface unless referenced explicitly here. |

## 4. Phase Model

SDK v5 has two phases:

1. **Law composition** - `createManifesto()` returns a composable manifesto with
   no live runtime verbs.
2. **Runtime activation** - `activate()` opens the runtime and returns the final
   `ManifestoApp<TDomain, TMode>` for the currently composed runtime mode.

```typescript
export type RuntimeMode = "base" | "lineage" | "governance";

export type ComposableManifesto<
  TDomain extends ManifestoDomainShape,
  TMode extends RuntimeMode = "base",
> = {
  readonly mode: TMode;
  readonly schema: DomainSchema;
  activate(): ManifestoApp<TDomain, TMode>;
};
```

Decorators from other packages promote the mode:

```typescript
// Owned by @manifesto-ai/lineage
declare function withLineage<TDomain extends ManifestoDomainShape>(
  app: ComposableManifesto<TDomain, "base">,
  options: LineageOptions,
): ComposableManifesto<TDomain, "lineage">;

// Owned by @manifesto-ai/governance
declare function withGovernance<TDomain extends ManifestoDomainShape>(
  app: ComposableManifesto<TDomain, "lineage">,
  options: GovernanceOptions,
): ComposableManifesto<TDomain, "governance">;
```

The signatures above are boundary sketches only. Their full contracts belong to
Lineage and Governance SPECs.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-PHASE-1 | MUST NOT | Pre-activation composable manifesto objects MUST NOT expose runtime verbs or reads such as `submit`, `snapshot`, `observe`, `inspect`, or `dispose`. |
| SDK-PHASE-2 | MUST | `activate()` MUST be the only SDK boundary that produces a runtime instance. |
| SDK-PHASE-3 | MUST | `activate()` MUST be one-shot; a second call on the same composable manifesto MUST throw `AlreadyActivatedError`. |
| SDK-PHASE-4 | MUST NOT | No path from runtime instance back to mutable composable state may exist. |
| SDK-PHASE-5 | MUST NOT | SDK MUST NOT define a top-level helper path that bypasses activation. |
| SDK-PHASE-6 | MUST | `ComposableManifesto.schema` MUST expose the normalized schema used for activation. |

## 5. Public Types

### 5.1 Domain Shape

```typescript
export type ActionFunction = {
  bivarianceHack(...args: unknown[]): unknown;
}["bivarianceHack"];

export type ManifestoDomainShape = {
  readonly actions: Record<string, ActionFunction>;
  readonly state: Record<string, unknown>;
  readonly computed: Record<string, unknown>;
};

export type ActionName<TDomain extends ManifestoDomainShape> =
  keyof TDomain["actions"] & string;
```

`ManifestoDomainShape` is the minimum type shape required for SDK generic
propagation. It is not a serialized schema format. `ActionFunction` is
intentionally bivariant so ordinary domain function declarations can satisfy the
shape without forcing every user action parameter to accept `unknown`.

### 5.2 Snapshot Types

SDK v5 follows ADR-025. Domain state is `snapshot.state`; platform, runtime, and
tooling bookkeeping lives under `snapshot.namespaces`.

```typescript
export type ProjectedSnapshot<TDomain extends ManifestoDomainShape> = {
  readonly state: Readonly<TDomain["state"]>;
  readonly computed: Readonly<TDomain["computed"]>;
  readonly system: {
    readonly status: "idle" | "computing" | "pending" | "error";
    readonly lastError: ErrorValue | null;
  };
  readonly meta: {
    readonly schemaHash: string;
  };
};

export type CanonicalSnapshot = CoreSnapshot;
```

`ProjectedSnapshot` is the app-facing visible snapshot. It MUST NOT expose
`namespaces`, `input`, `system.pendingRequirements`, `system.currentAction`,
or host-provided operational metadata. `CanonicalSnapshot` is the full
substrate, including those fields, and is reachable only through
`inspect.canonicalSnapshot()`.

### 5.3 Effect Types

```typescript
export type EffectContext<TDomain extends ManifestoDomainShape = ManifestoDomainShape> = {
  readonly snapshot: Readonly<ProjectedSnapshot<TDomain>>;
};

export type EffectHandler = (
  params: unknown,
  ctx: EffectContext,
) => Promise<readonly Patch[]>;
```

Effect handlers return patches. They do not return semantic values to Core.

### 5.4 Typed References

```typescript
export type TypedActionRef<
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain> = ActionName<TDomain>,
> = {
  readonly __kind: "ActionRef";
  readonly name: Name;
};

export type FieldRef<TValue> = {
  readonly __kind: "FieldRef";
  readonly name: string;
  readonly _type?: TValue;
};

export type ComputedRef<TValue> = {
  readonly __kind: "ComputedRef";
  readonly name: string;
  readonly _type?: TValue;
};
```

Typed refs remain the canonical user-facing reference surface. String paths are
not user-facing APIs.

### 5.5 Typed MEL Surface

```typescript
export type TypedMEL<TDomain extends ManifestoDomainShape> = {
  readonly actions: {
    readonly [Name in ActionName<TDomain>]: TypedActionRef<TDomain, Name>;
  };
  readonly state: {
    readonly [Name in keyof TDomain["state"]]: FieldRef<TDomain["state"][Name]>;
  };
  readonly computed: {
    readonly [Name in keyof TDomain["computed"]]: ComputedRef<TDomain["computed"][Name]>;
  };
};
```

The typed MEL surface is still available for authoring helpers and advanced
protocol work. It is no longer the default runtime action path.

### 5.6 Effect Authoring Subpath

The root SDK contract remains centered on `createManifesto()`. Typed effect
authoring helpers live on `@manifesto-ai/sdk/effects`.

```typescript
export type MergeableObject<TValue> = TValue extends readonly unknown[]
  ? never
  : TValue extends object
    ? TValue
    : never;

export type PatchBuilder = {
  set<TValue>(ref: FieldRef<TValue>, value: TValue): Patch;
  unset<TValue>(ref: FieldRef<TValue>): Patch;
  merge<TValue>(
    ref: FieldRef<MergeableObject<TValue>>,
    value: Partial<MergeableObject<TValue>>,
  ): Patch;
};

declare function defineEffects<TDomain extends ManifestoDomainShape>(
  factory: (
    ops: PatchBuilder,
    MEL: TypedMEL<TDomain>,
  ) => Record<string, EffectHandler>,
): Record<string, EffectHandler>;
```

`defineEffects()` is an authoring helper, not a runtime seam. It MUST return the
same `Record<string, EffectHandler>` contract consumed by `createManifesto()`.

### 5.7 Action Input Helpers

```typescript
export type ActionArgs<
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain>,
> = TDomain["actions"][Name] extends (...args: infer P) => unknown ? P : never;

export type ActionInput<
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain>,
> = ActionArgs<TDomain, Name> extends []
  ? undefined
  : ActionArgs<TDomain, Name> extends [infer One]
    ? One
    : Readonly<ActionArgs<TDomain, Name>>;
```

`ActionArgs` is the public call-site tuple. `ActionInput` is the SDK-bound
candidate input preserved on `BoundAction.input`; it is not necessarily the same
value as Core `Intent.input`.

When `BoundAction.intent()` returns a non-null `Intent`, SDK MUST pack the
candidate into Core's canonical action-input shape using the activated action
contract:

- zero public arguments -> `Intent.input === undefined`
- one public argument for an object-shaped single input -> `BoundAction.input`
  preserves the direct public value, while `Intent.input` is packed under the
  declared single parameter name when Core requires that canonical shape
- one or more positional parameters -> object keyed by the compiled action
  parameter names, preserving declared order

The parameter-name metadata used for this packing MUST come from the activated
schema or compiler-produced action contract, not from runtime argument
introspection.

For example, `action toggleTodo(id: string)` has a scalar positional public
argument and the canonical SDK call is `submit(id)`. If callers want
`submit({ id })` as the canonical public call, the MEL source SHOULD declare a
named object input such as `type ToggleTodoInput = { id: string }` and
`action toggleTodo(input: ToggleTodoInput)`. In that case `BoundAction.input`
is `{ id }`, while `BoundAction.intent()?.input` is the Core-packed
`{ input: { id } }`.

### 5.8 Invocation Options, Diffs, and Reports

```typescript
export type PreviewOptions = {
  readonly __kind: "PreviewOptions";
  readonly diagnostics?: "none" | "summary" | "trace";
  readonly includeAvailableActions?: boolean;
};

export type SubmitOptions = {
  readonly __kind: "SubmitOptions";
  readonly report?: "none" | "summary" | "full";
};

export type PathSegment = string | number;

export type ChangedPath = {
  readonly path: readonly PathSegment[];
  readonly kind: "set" | "unset" | "changed";
};

export type PreviewDiagnostics = {
  readonly trace?: TraceGraph;
  readonly warnings?: readonly Diagnostic[];
  readonly detail?: Readonly<Record<string, unknown>>;
};

export type BaseWriteReport = {
  readonly mode: "base";
  readonly action: string;
  readonly changes: readonly ChangedPath[];
  readonly requirements: readonly Requirement[];
  readonly outcome: ExecutionOutcome;
};
```

`PreviewOptions` and `SubmitOptions` use explicit `__kind` discriminants to keep
SDK option bags distinguishable from domain action input objects.

`LineageWriteReport` and `GovernanceSettlementReport` are boundary names owned
by Lineage and Governance. SDK fixes only where those reports attach in the
common result skeleton; their field-level meaning belongs to the owning SPECs.

### 5.9 Boundary Type Sources

The snippets in this SPEC reference the following boundary types without
redefining their owning semantics:

```typescript
export type Unsubscribe = () => void;

// Core-owned public types
type DomainSchema = import("@manifesto-ai/core").DomainSchema;
type CoreSnapshot = import("@manifesto-ai/core").Snapshot;
type ErrorValue = import("@manifesto-ai/core").ErrorValue;
type Intent = import("@manifesto-ai/core").Intent;
type Patch = import("@manifesto-ai/core").Patch;
type Requirement = import("@manifesto-ai/core").Requirement;
type TraceGraph = import("@manifesto-ai/core").TraceGraph;
type Diagnostic = Readonly<Record<string, unknown>>;

// Compiler-owned public types
type SchemaGraph = import("@manifesto-ai/compiler").SchemaGraph;

// Lineage-owned public types
type WorldRecord = import("@manifesto-ai/lineage").WorldRecord;
type LineageWriteReport = import("@manifesto-ai/lineage").LineageWriteReport;

// Governance-owned public types
type ProposalRef = import("@manifesto-ai/governance").ProposalRef;
type DecisionRecord = import("@manifesto-ai/governance").DecisionRecord;
type GovernanceSettlementReport =
  import("@manifesto-ai/governance").GovernanceSettlementReport;
```

These imports are illustrative ownership markers. The SDK MUST NOT import
lineage or governance internals; only public boundary types may cross package
surfaces.

## 6. `createManifesto()`

### 6.1 Signature

```typescript
export type ActionAnnotations = Readonly<Record<string, ActionAnnotation>>;

export type CreateManifestoOptions = {
  readonly annotations?: ActionAnnotations;
};

declare function createManifesto<TDomain extends ManifestoDomainShape>(
  schema: DomainSchema | string,
  effects?: Record<string, EffectHandler>,
  options?: CreateManifestoOptions,
): ComposableManifesto<TDomain, "base">;
```

`schema` MAY be a normalized `DomainSchema` or MEL source text. Compiler tooling
artifacts such as `DomainModule` MUST NOT be accepted in place of `DomainSchema`.

`options.annotations` is the only caller-provided v5 route for compiler-produced
`@meta` annotations to reach `ActionHandle.info()`. This preserves the runtime
entrypoint as `DomainSchema`-first while allowing tooling metadata to travel as
an explicit sidecar.

When `schema` is MEL source text and the SDK compiles it internally, any
annotations produced by that compilation are SDK-resolved annotations. If
`options.annotations` is also supplied, SDK MUST shallow-merge annotations by
action name with caller-provided annotations taking precedence over
compiler-resolved annotations for the same action key.

When `schema` is already a `DomainSchema`, SDK MUST NOT infer annotations from
the schema. Callers that need action metadata beyond the schema contract MUST
provide `options.annotations`.

### 6.2 Schema Resolution and Normalization

If `schema` is MEL text, the SDK MUST compile it before activation. Compilation
failures MUST throw `CompileError` with collected diagnostics.

If `schema` is already a `DomainSchema`, the SDK MUST normalize it before
exposing `ComposableManifesto.schema`.

### 6.3 Reserved Effects and Namespaces

SDK MUST reject user effects that override reserved effect types with
`ReservedEffectError`.

SDK MUST reject domain identifiers using reserved platform namespace prefixes
with `ManifestoError` code `RESERVED_NAMESPACE`.

### 6.4 Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-CREATE-1 | MUST | `createManifesto()` MUST accept schema as the first positional argument and effects as the second. |
| SDK-CREATE-2 | MUST | `createManifesto()` MAY accept `CreateManifestoOptions` as the third positional argument. |
| SDK-CREATE-3 | MUST | `options.annotations` MUST be the only caller-provided SDK v5 sidecar for `@meta` propagation into `ActionHandle.info()`. |
| SDK-CREATE-4 | MUST NOT | SDK MUST NOT accept `DomainModule` in place of `DomainSchema`. |
| SDK-CREATE-5 | MUST NOT | SDK MUST NOT accept guard callbacks, restore snapshots, lineage stores, or governance authorities at factory time. |
| SDK-CREATE-6 | MUST NOT | SDK MUST NOT expose a ready runtime instance directly from `createManifesto()`. |
| SDK-CREATE-7 | MUST | SDK MUST preserve the simplified SDK `EffectHandler` contract and adapt it internally to Host requirements. |
| SDK-CREATE-8 | MUST | For MEL source strings, compiler-resolved annotations MUST be available to `ActionHandle.info()` unless overridden by `options.annotations`. |
| SDK-CREATE-9 | MUST | For `DomainSchema` inputs, annotations MUST come only from `options.annotations`. |

## 7. Runtime Root Surface

```typescript
export type BaseManifestoApp<
  TDomain extends ManifestoDomainShape,
  TMode extends RuntimeMode,
> = {
  readonly actions: ActionSurface<TDomain, TMode>;
  readonly observe: ObserveSurface<TDomain>;
  readonly inspect: InspectSurface<TDomain>;

  snapshot(): ProjectedSnapshot<TDomain>;

  action<Name extends ActionName<TDomain>>(
    name: Name,
  ): ActionHandle<TDomain, Name, TMode>;

  dispose(): void;
};

export type GovernanceSettlementSurface<
  TDomain extends ManifestoDomainShape,
> = {
  waitForSettlement(
    ref: ProposalRef,
  ): Promise<GovernanceSettlementResult<TDomain, ActionName<TDomain>>>;
};

type EmptySurface = Record<never, never>;

export type ManifestoApp<
  TDomain extends ManifestoDomainShape,
  TMode extends RuntimeMode,
> = BaseManifestoApp<TDomain, TMode>
  & ([TMode] extends ["governance"]
      ? GovernanceSettlementSurface<TDomain>
      : EmptySurface);
```

`actions.*` is the ergonomic property accessor. `action(name)` is the normative
collision-safe accessor.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-ROOT-1 | MUST | `ManifestoApp` MUST expose exactly the canonical root groups shown above plus mode-specific extensions. |
| SDK-ROOT-2 | MUST | `snapshot()` MUST be the only root-level snapshot read in the canonical v5 public surface. |
| SDK-ROOT-3 | MUST | `action(name)` MUST work for every declared action name, including names that collide with runtime or JavaScript reserved properties. |
| SDK-ROOT-4 | MUST | User action names MUST NOT corrupt root members such as `then`, `constructor`, `bind`, `inspect`, `snapshot`, `dispose`, or `action`. |
| SDK-ROOT-5 | MUST | Governance `waitForSettlement(ref)` MUST be type-level reachable only on governance-mode runtimes. |
| SDK-ROOT-6 | MUST | The `ManifestoApp` governance extension conditional MUST use a non-distributive form equivalent to `[TMode] extends ["governance"]`. |
| SDK-ROOT-7 | MUST NOT | The empty-surface branch MUST NOT use `Record<string, never>`. |

## 8. Action Candidate Surface

### 8.1 Action Surface

```typescript
export type ActionSurface<
  TDomain extends ManifestoDomainShape,
  TMode extends RuntimeMode,
> = {
  readonly [Name in ActionName<TDomain>]:
    ActionHandle<TDomain, Name, TMode>;
};
```

### 8.2 Action Handle

```typescript
export type ActionHandle<
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain>,
  TMode extends RuntimeMode,
> = {
  info(): ActionInfo<Name>;
  available(): boolean;
  check(...args: ActionArgs<TDomain, Name>): Admission<Name>;
  preview(
    ...args: [...ActionArgs<TDomain, Name>, PreviewOptions?]
  ): PreviewResult<TDomain, Name>;
  submit(
    ...args: [...ActionArgs<TDomain, Name>, SubmitOptions?]
  ): Promise<SubmitResultFor<TMode, TDomain, Name>>;
  bind(...args: ActionArgs<TDomain, Name>): BoundAction<TDomain, Name, TMode>;
};
```

### 8.3 Bound Action

```typescript
export type BoundAction<
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain>,
  TMode extends RuntimeMode,
> = {
  readonly action: Name;
  readonly input: ActionInput<TDomain, Name>;

  check(): Admission<Name>;
  preview(options?: PreviewOptions): PreviewResult<TDomain, Name>;
  submit(options?: SubmitOptions): Promise<SubmitResultFor<TMode, TDomain, Name>>;

  intent(): Intent | null;
};
```

`bind()` makes an action candidate a first-class value. `intent()` is a method,
not an always-present property, because invalid input cannot produce a valid raw
protocol `Intent`.

### 8.4 Action Info

```typescript
export type ActionInfo<Name extends string = string> = {
  readonly name: Name;
  readonly title?: string;
  readonly description?: string;
  readonly parameters: readonly ActionParameterInfo[];
  readonly annotations?: ActionAnnotation;
};

export type ActionParameterInfo = {
  readonly name: string;
  readonly required: boolean;
  readonly type?: string;
  readonly description?: string;
};

export type ActionAnnotation = Readonly<Record<string, unknown>>;
```

`ActionInfo.annotations` is populated from resolved action annotations:
compiler-produced annotations from MEL source plus caller-provided
`createManifesto(..., { annotations })` sidecar values, with caller values taking
precedence. The SDK MUST NOT infer or invent annotation values from unrelated
runtime state.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-ACTION-1 | MUST | `ActionHandle` MUST expose `info`, `available`, `check`, `preview`, `submit`, and `bind`. |
| SDK-ACTION-2 | MUST | `BoundAction` MUST expose `check`, `preview`, `submit`, and nullable method-style `intent()`. |
| SDK-ACTION-3 | MUST | `available()` MUST be input-free and snapshot-bound. |
| SDK-ACTION-4 | MUST | `info()` MUST return static/public action contract metadata. |
| SDK-ACTION-5 | MUST NOT | `info()` MUST NOT read hidden execution state or act as an authority decision channel. |
| SDK-ACTION-6 | MUST | `ActionInfo.annotations` MUST be derived only from resolved action annotations. |

### 8.5 Option Argument Disambiguation

`ActionHandle.preview()` and `ActionHandle.submit()` accept inline options only
when the call has exactly one more argument than the action's public arity and
the final argument carries the matching SDK option discriminant:

```typescript
app.actions.addTodo.preview(
  { title: "Ship v5" },
  { __kind: "PreviewOptions", diagnostics: "summary" },
);

await app.actions.addTodo.submit(
  { title: "Ship v5" },
  { __kind: "SubmitOptions", report: "summary" },
);
```

If the final value is part of the action's declared public arity, it MUST be
treated as domain input even if it structurally resembles an SDK option bag.

`BoundAction.preview(options?)` and `BoundAction.submit(options?)` do not have
this ambiguity because the action input has already been bound.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-ACTION-7 | MUST | Inline `PreviewOptions` MUST be recognized only as an extra final argument with `__kind: "PreviewOptions"`. |
| SDK-ACTION-8 | MUST | Inline `SubmitOptions` MUST be recognized only as an extra final argument with `__kind: "SubmitOptions"`. |
| SDK-ACTION-9 | MUST | Values inside the declared action arity MUST be treated as domain input, not SDK options. |

## 9. Admission

`check()` is the canonical admission API.

```typescript
export type Admission<Name extends string = string> =
  | AdmissionOk<Name>
  | AdmissionFailure<Name>;

export type AdmissionOk<Name extends string = string> = {
  readonly ok: true;
  readonly action: Name;
};

export type AdmissionFailure<Name extends string = string> = {
  readonly ok: false;
  readonly action: Name;
  readonly layer: "availability" | "input" | "dispatchability";
  readonly code:
    | "ACTION_UNAVAILABLE"
    | "INVALID_INPUT"
    | "INTENT_NOT_DISPATCHABLE";
  readonly message: string;
  readonly blockers: readonly Blocker[];
};

export type Blocker = {
  readonly path: ReadonlyArray<string | number>;
  readonly code: string;
  readonly message: string;
  readonly detail?: Readonly<Record<string, unknown>>;
};
```

Admission evaluates the same semantic ordering as the v3 caller ladder, but now
through one discriminated union:

1. availability
2. input validation
3. dispatchability

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-ADMISSION-1 | MUST | `check()` MUST evaluate availability before input validation. |
| SDK-ADMISSION-2 | MUST NOT | `check()` MUST NOT evaluate dispatchability when availability fails. |
| SDK-ADMISSION-3 | MUST NOT | `check()` MUST NOT evaluate dispatchability when input validation fails. |
| SDK-ADMISSION-4 | MUST | `check()` MUST return only the first failing layer. |
| SDK-ADMISSION-5 | MUST | Known candidate-admission failures MUST be returned as values, not thrown. |
| SDK-ADMISSION-6 | MAY | Unknown action names, disposed runtime access, or malformed internal runtime state MAY throw programmer errors. |

This contract supersedes the public need for `isIntentDispatchable()`,
`getIntentBlockers()`, `why()`, `whyNot()`, and `explainIntent()` in the
canonical v5 path.

## 10. Preview

`preview()` replaces public `simulate()` and `simulateIntent()` in the canonical
v5 action path.

```typescript
export type PreviewResult<
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain>,
> =
  | {
      readonly admitted: false;
      readonly admission: AdmissionFailure<Name>;
    }
  | {
      readonly admitted: true;
      readonly status: "complete" | "pending" | "halted" | "error";
      readonly before: ProjectedSnapshot<TDomain>;
      readonly after: ProjectedSnapshot<TDomain>;
      readonly changes: readonly ChangedPath[];
      readonly requirements: readonly Requirement[];
      readonly newAvailableActions?: readonly ActionInfo[];
      readonly diagnostics?: PreviewDiagnostics;
      readonly error?: ErrorValue | null;
    };
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-PREVIEW-1 | MUST | `preview()` MUST be pure and non-committing. |
| SDK-PREVIEW-2 | MUST NOT | `preview()` MUST NOT publish state. |
| SDK-PREVIEW-3 | MUST NOT | `preview()` MUST NOT enqueue runtime work. |
| SDK-PREVIEW-4 | MUST | `preview()` MUST apply the same admission ordering as `check()`. |
| SDK-PREVIEW-5 | MUST | `preview()` MUST preserve Core status: `complete`, `pending`, `halted`, or `error`. |
| SDK-PREVIEW-6 | MUST | `admitted: true` MUST mean dry-run computation was admitted, not that the action would settle successfully. |
| SDK-PREVIEW-7 | MUST | `admitted: false` MUST include the same first-failing admission layer as `check()`. |

## 11. Submit

`submit()` is the v5 law-aware ingress verb.

```typescript
await app.actions.addTodo.submit({ title: "Ship v5" });
```

`submit()` means: submit this bound action candidate to the currently active
runtime law boundary.

It does not mean direct execution, immediate mutation, world sealing, governance
approval, or authority bypass. Authority differences are visible through result
types and decorator-owned implementations.

### 11.1 Execution Outcome

```typescript
export type ExecutionOutcome =
  | { readonly kind: "ok"; readonly detail?: ExecutionDetail }
  | { readonly kind: "stop"; readonly reason: string; readonly detail?: ExecutionDetail }
  | { readonly kind: "fail"; readonly error: ErrorValue; readonly detail?: ExecutionDetail };

export type ExecutionDetail = Readonly<Record<string, unknown>>;
```

`ExecutionOutcome` represents what the domain action did. Pending governance
settlement is not an `ExecutionOutcome`; it is runtime settlement state.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-RESULT-1 | MUST | Core `complete` MUST map to `ExecutionOutcome { kind: "ok" }`. |
| SDK-RESULT-2 | MUST | Core `halted` MUST map to `ExecutionOutcome { kind: "stop", reason }`. |
| SDK-RESULT-3 | MUST | Core `error` MUST map to `ExecutionOutcome { kind: "fail", error }`. |
| SDK-RESULT-4 | MUST NOT | Core `pending` MUST NOT be represented as an `ExecutionOutcome`. |

### 11.2 Result Envelope

`result.ok` represents protocol/admission envelope success. It is not domain
success.

This is valid:

```typescript
{
  ok: true,
  status: "settled",
  outcome: { kind: "fail", error }
}
```

Callers that care about domain success MUST narrow twice:

```typescript
const result = await app.actions.addTodo.submit({ title: "Ship v5" });

if (!result.ok) {
  result.admission;
} else if (result.status === "settled" && result.outcome.kind === "ok") {
  result.after;
}
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-RESULT-5 | MUST | `result.ok` MUST represent protocol/admission envelope success, not domain success. |
| SDK-RESULT-6 | MUST | Domain success, stop, or fail MUST be carried by `ExecutionOutcome`. |
| SDK-RESULT-7 | SHOULD NOT | Examples SHOULD NOT use `if (result.ok)` as a one-step domain success check unless the caller explicitly does not need domain outcome. |

### 11.3 Mode-Specific Result Typing

```typescript
export type SubmitResultFor<
  TMode extends RuntimeMode,
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain>,
> =
  TMode extends "base"
    ? BaseSubmissionResult<TDomain, Name>
    : TMode extends "lineage"
      ? LineageSubmissionResult<TDomain, Name>
      : TMode extends "governance"
        ? GovernanceSubmissionResult<TDomain, Name>
        : SubmissionResult<TDomain, Name>;

export type SubmissionResult<
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain>,
> =
  | BaseSubmissionResult<TDomain, Name>
  | LineageSubmissionResult<TDomain, Name>
  | GovernanceSubmissionResult<TDomain, Name>;
```

### 11.4 Base Result

```typescript
export type BaseSubmissionResult<
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain>,
> =
  | {
      readonly ok: true;
      readonly mode: "base";
      readonly status: "settled";
      readonly action: Name;
      readonly before: ProjectedSnapshot<TDomain>;
      readonly after: ProjectedSnapshot<TDomain>;
      readonly outcome: ExecutionOutcome;
      readonly report?: BaseWriteReport;
    }
  | {
      readonly ok: false;
      readonly mode: "base";
      readonly action: Name;
      readonly admission: AdmissionFailure<Name>;
    };
```

The SDK owns the full base result shape.

### 11.5 Lineage Result Skeleton

```typescript
export type LineageSubmissionResult<
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain>,
> =
  | {
      readonly ok: true;
      readonly mode: "lineage";
      readonly status: "settled";
      readonly action: Name;
      readonly before: ProjectedSnapshot<TDomain>;
      readonly after: ProjectedSnapshot<TDomain>;
      readonly world: WorldRecord;
      readonly outcome: ExecutionOutcome;
      readonly report?: LineageWriteReport;
    }
  | {
      readonly ok: false;
      readonly mode: "lineage";
      readonly action: Name;
      readonly admission: AdmissionFailure<Name>;
    };
```

SDK fixes the discriminant and common result envelope. The full meaning of
`WorldRecord`, lineage sealing, branch/head behavior, and `LineageWriteReport`
belongs to the Lineage SPEC.

### 11.6 Governance Result Skeleton

```typescript
export type GovernanceSubmissionResult<
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain>,
> =
  | {
      readonly ok: true;
      readonly mode: "governance";
      readonly status: "pending";
      readonly action: Name;
      readonly proposal: ProposalRef;
      waitForSettlement(): Promise<GovernanceSettlementResult<TDomain, Name>>;
    }
  | {
      readonly ok: false;
      readonly mode: "governance";
      readonly action: Name;
      readonly admission: AdmissionFailure<Name>;
    };

export type GovernanceSettlementResult<
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain>,
> =
  | {
      readonly ok: true;
      readonly mode: "governance";
      readonly status: "settled";
      readonly action: Name;
      readonly proposal: ProposalRef;
      readonly world: WorldRecord;
      readonly before: ProjectedSnapshot<TDomain>;
      readonly after: ProjectedSnapshot<TDomain>;
      readonly outcome: ExecutionOutcome;
      readonly report?: GovernanceSettlementReport;
    }
  | {
      readonly ok: true;
      readonly mode: "governance";
      readonly status: "rejected" | "superseded" | "expired" | "cancelled";
      readonly action: Name;
      readonly proposal: ProposalRef;
      readonly decision?: DecisionRecord;
      readonly report?: GovernanceSettlementReport;
    }
  | {
      readonly ok: false;
      readonly mode: "governance";
      readonly status: "settlement_failed";
      readonly action: Name;
      readonly proposal: ProposalRef;
      readonly error: ErrorValue;
      readonly report?: GovernanceSettlementReport;
    };
```

SDK fixes the discriminant, proposal-bearing pending result, and durable
reattachment surface. The full meaning of `ProposalRef`, decision states,
authority policy, and governance reports belongs to the Governance SPEC.

`ProposalRef` MUST be serializable to a stable string representation and stable
across runtime restarts. The exact representation is governance-owned.

### 11.7 Submit Payload Size Guidance

Base and settled lineage/governance submit results carry `before` and `after`
projected snapshots as part of the v5 result contract. SDK MUST NOT silently
omit, truncate, or replace those projected snapshots with opaque refs based on
payload size.

Large-result optimization belongs to explicit additive surfaces:

- callers MAY ask for smaller additive write reports through `SubmitOptions`
- Lineage and Governance MAY define report-specific compaction in their owning
  report types
- future streaming or ref-based payload APIs MUST be additive and explicitly
  named, not hidden behind the default `submit()` result

This keeps `submit()` deterministic at the public contract boundary: the same
terminal state produces the same result shape regardless of payload size.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-SUBMIT-14 | MUST | Settled `submit()` results MUST include full projected `before` and `after` snapshots where their result type declares those fields. |
| SDK-SUBMIT-15 | MUST NOT | SDK MUST NOT omit, truncate, or replace projected submit snapshots because a payload is large. |
| SDK-SUBMIT-16 | MUST | Any compact, streaming, or ref-based submit payload mode MUST be explicit and additive rather than the default result shape. |

### 11.8 Submit Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-SUBMIT-1 | MUST | `submit()` MUST run admission before entering the runtime write boundary. |
| SDK-SUBMIT-2 | MUST | `submit()` MUST re-check legality against the then-current runtime state. |
| SDK-SUBMIT-3 | MUST NOT | Prior `available()` or `check()` results MUST NOT be treated as capability tokens. |
| SDK-SUBMIT-4 | MUST | `submit()` MUST be implemented by each active runtime or decorator. |
| SDK-SUBMIT-5 | MUST NOT | A generic public helper that bypasses decorator authority MUST NOT exist. |
| SDK-SUBMIT-6 | MAY | Base `submit()` MAY delegate internally to base dispatch implementation. |
| SDK-SUBMIT-7 | MUST | Lineage `submit()` MUST preserve lineage sealing and continuity semantics. |
| SDK-SUBMIT-8 | MUST | Governance `submit()` MUST create or enter the proposal path. |
| SDK-SUBMIT-9 | MUST NOT | Governed runtimes MUST NOT expose lower-authority direct execution through `submit()` or any other canonical public verb. |
| SDK-SUBMIT-10 | MUST | When runtime mode is statically known, result types MUST be mode-specific. |
| SDK-SUBMIT-11 | MUST | In generic mode, callers MUST narrow `SubmissionResult` by `mode` before consuming mode-specific fields. |
| SDK-SUBMIT-12 | MUST | Governance settlement observation MUST be named `waitForSettlement()`, not `settle()`. |
| SDK-SUBMIT-13 | MUST | `ProposalRef` alone MUST be sufficient to re-observe governance settlement after process restart or agent handoff. |

### 11.9 Operational Failure Before Settlement

Admission failures are represented by `ok: false` result values. Domain
stop/fail after a terminal snapshot exists is represented by `ok: true` plus
`ExecutionOutcome`.

If the runtime cannot produce a terminal result after admission has passed, the
`submit()` Promise MUST reject with `SubmissionFailedError` and emit
`submission:failed`. SDK MUST NOT fabricate a projected `after` snapshot or an
`ExecutionOutcome` when no terminal snapshot exists.

If a terminal snapshot exists and its domain outcome is failure, `submit()` MUST
resolve with `ok: true`, `status: "settled"`, and
`outcome.kind === "fail"`. That case is not an operational rejection.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-SUBMIT-FAIL-1 | MUST | Admission failure MUST resolve as `ok: false` with `AdmissionFailure`. |
| SDK-SUBMIT-FAIL-2 | MUST | Operational failure before terminal result MUST reject with `SubmissionFailedError` and emit `submission:failed`. |
| SDK-SUBMIT-FAIL-3 | MUST NOT | SDK MUST NOT synthesize `ExecutionOutcome` or projected `after` snapshots for failures that produced no terminal snapshot. |
| SDK-SUBMIT-FAIL-4 | MUST | Terminal domain failure MUST resolve as `ok: true`, `status: "settled"`, and `outcome.kind === "fail"`. |

## 12. Snapshot Boundary

The root snapshot read is:

```typescript
app.snapshot();
```

The canonical substrate read is:

```typescript
app.inspect.canonicalSnapshot();
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-SNAPSHOT-1 | MUST | `snapshot()` MUST return the projected app-facing snapshot. |
| SDK-SNAPSHOT-2 | MUST | `snapshot()` MUST NOT expose `namespaces`. |
| SDK-SNAPSHOT-3 | MUST | `snapshot()` MUST NOT expose canonical-only `input`, `system.pendingRequirements`, `system.currentAction`, `meta.version`, `meta.timestamp`, or `meta.randomSeed`. |
| SDK-SNAPSHOT-4 | MUST | Canonical substrate reads MUST live under `inspect`. |
| SDK-SNAPSHOT-5 | MUST | `inspect.canonicalSnapshot()` MUST return the full canonical substrate. |
| SDK-SNAPSHOT-6 | MUST NOT | SDK MUST NOT introduce a root `getCanonicalSnapshot()` compatibility alias in the canonical v5 surface. |

## 13. Observe Surface

```typescript
export type ObserveSurface<TDomain extends ManifestoDomainShape> = {
  state<S>(
    selector: (snapshot: ProjectedSnapshot<TDomain>) => S,
    listener: (next: S, prev: S) => void,
  ): Unsubscribe;

  event<Event extends ManifestoEventName>(
    event: Event,
    listener: (payload: ManifestoEventPayload<Event>) => void,
  ): Unsubscribe;
};
```

Event payloads are telemetry, not semantic truth. They are intentionally compact
and reference-oriented; callers that need authoritative state MUST read
`snapshot()`, `inspect.canonicalSnapshot()`, `SubmitResult`, `WorldRecord`, or
Governance records from their owning surfaces.

`observe.state()` is a projected-state observer, not a canonical-substrate
observer. The selector receives the same projected shape returned by
`snapshot()`. Registration MUST capture the selector's current value when
selection succeeds, but MUST NOT call the listener immediately. A listener is
called only when the selected value changes by `Object.is(prev, next)` after a
terminal projected snapshot publication, and `prev` is the last successfully
selected value for that registration. Canonical-only movement such as
`namespaces`, `meta`, Host bookkeeping, or other substrate diagnostics MUST NOT
wake state observers when the projected snapshot is unchanged. Selector and
listener exceptions are isolated from runtime semantics. If a selector fails
during registration or publication, the runtime MUST keep the registration
alive and retry selection on later terminal projected snapshot publications.

```typescript
export type SubmissionEventBase = {
  readonly action: string;
  readonly mode: RuntimeMode;
  readonly intentId?: string;
  readonly schemaHash: string;
  readonly snapshotVersion?: number;
};

export type ProposalEventBase = {
  readonly proposal: ProposalRef;
  readonly action: string;
  readonly schemaHash: string;
};

export type ManifestoEventPayloadMap = {
  readonly "submission:admitted": SubmissionEventBase & {
    readonly admission: AdmissionOk;
  };

  readonly "submission:rejected": SubmissionEventBase & {
    readonly admission: AdmissionFailure;
  };

  readonly "submission:submitted": SubmissionEventBase;

  readonly "submission:pending": SubmissionEventBase & {
    readonly mode: "governance";
    readonly proposal: ProposalRef;
  };

  readonly "submission:settled": SubmissionEventBase & {
    readonly mode: "base" | "lineage" | "governance";
    readonly outcome: ExecutionOutcome;
    readonly proposal?: ProposalRef;
    readonly worldId?: string;
  };

  readonly "submission:failed": SubmissionEventBase & {
    readonly stage: "runtime" | "settlement";
    readonly error: ErrorValue;
    readonly proposal?: ProposalRef;
  };

  readonly "proposal:created": ProposalEventBase;

  readonly "proposal:decided": ProposalEventBase & {
    readonly decision: DecisionRecord;
  };

  readonly "proposal:superseded": ProposalEventBase & {
    readonly supersededBy?: ProposalRef;
  };

  readonly "proposal:expired": ProposalEventBase & {
    readonly reason?: string;
  };

  readonly "proposal:cancelled": ProposalEventBase & {
    readonly reason?: string;
  };
};

export type ManifestoEventName = keyof ManifestoEventPayloadMap;

export type ManifestoEventPayload<Event extends ManifestoEventName> =
  ManifestoEventPayloadMap[Event];
```

V5 lifecycle events use the `submission:*` namespace as the primary taxonomy:

```text
submission:admitted
submission:rejected
submission:submitted
submission:pending
submission:settled
submission:failed

proposal:created
proposal:decided
proposal:superseded
proposal:expired
proposal:cancelled
```

The payload types above are normative for SDK v5. `worldId` and `proposal`
fields in telemetry are correlation hints only; they do not replace the
authoritative lineage or governance records.

`submission:*` events are the shared SDK runtime submission lifecycle taxonomy
for base, lineage, and governance runtimes. `proposal:*` events are governance
proposal lifecycle telemetry and MUST only be emitted by a governance runtime.
Base and lineage runtimes MUST NOT synthesize `proposal:*` events. Event handler
exceptions MUST be isolated from runtime semantics and from other handlers for
the same event. The canonical v5 Observe surface is limited to the event names
in `ManifestoEventPayloadMap`; legacy `dispatch:*` names are not canonical v5
Observe events.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-OBSERVE-1 | MUST | State observation and runtime telemetry MUST remain separate channels. |
| SDK-OBSERVE-2 | MUST | `observe.state()` MUST observe projected snapshot values only. |
| SDK-OBSERVE-3 | MUST | `observe.event()` MUST observe runtime lifecycle events. |
| SDK-OBSERVE-4 | MUST NOT | Telemetry MUST NOT be used as semantic truth for lineage world identity or governance proposal identity. |
| SDK-OBSERVE-5 | MUST | V5 event taxonomy MUST align with submission lifecycle rather than base dispatch lifecycle. |
| SDK-OBSERVE-6 | MUST | Event payloads MUST use the `ManifestoEventPayloadMap` shapes defined in this section. |
| SDK-OBSERVE-7 | MUST NOT | Event payloads MUST NOT embed full projected or canonical snapshots. |
| SDK-OBSERVE-8 | MUST | `observe.state()` MUST NOT notify for namespace-only or other canonical-only substrate changes when the projected snapshot is unchanged. |
| SDK-OBSERVE-9 | MUST | `observe.state()` MUST compare selector results with `Object.is`. |
| SDK-OBSERVE-10 | MUST | Selector and listener failures MUST be isolated from runtime semantics. |
| SDK-OBSERVE-11 | MUST | `proposal:*` events MUST be emitted only by governance runtimes. |
| SDK-OBSERVE-12 | MUST | `observe.state()` registration MUST NOT invoke the listener immediately. |
| SDK-OBSERVE-13 | MUST | `observe.state()` MUST keep registrations alive after selector failures and retry on later terminal projected snapshot publications. |
| SDK-OBSERVE-14 | MUST | `observe.event()` handler failures MUST be isolated from runtime semantics and other handlers. |
| SDK-OBSERVE-15 | MUST NOT | Legacy `dispatch:*` events MUST NOT be part of the canonical v5 `observe.event()` surface. |

## 14. Inspect Surface

```typescript
export type InspectSurface<TDomain extends ManifestoDomainShape> = {
  graph(): SchemaGraph;
  canonicalSnapshot(): CanonicalSnapshot;
  action<Name extends ActionName<TDomain>>(name: Name): ActionInfo<Name>;
  availableActions(): readonly ActionInfo[];
  schemaHash(): string;
};
```

`inspect.*` is the advanced/debug/tooling namespace.

`inspect.canonicalSnapshot()` is the app root's canonical-substrate read
boundary. It exposes ADR-025 `namespaces` and other canonical fields for
debugging, restore-aware tooling, and seal-aware inspection. Normal application
logic SHOULD use `snapshot()` unless it explicitly needs substrate data.

`inspect.graph()` returns the projected schema graph. ADR-025 platform
namespaces such as host, mel, system, and other runtime/tooling namespaces are
not domain state and MUST NOT appear as state nodes in this graph.

`inspect.availableActions()` returns current action contract information for
the actions available against the current visible projected state. It is an
observational read, not a durable capability token for later submission.

`inspect.schemaHash()` reads the current canonical snapshot's `meta.schemaHash`.
It is an inspection read over the active runtime substrate, not an independent
schema fingerprint channel.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-INSPECT-1 | MUST | `inspect.graph()` MUST expose the schema graph formerly reached as `getSchemaGraph()`. |
| SDK-INSPECT-2 | MUST | `inspect.action(name)` MUST expose the same static action metadata as `actions.x.info()` for the named action. |
| SDK-INSPECT-3 | MUST | `inspect.availableActions()` MUST return currently available action info values. |
| SDK-INSPECT-4 | MUST | `inspect.canonicalSnapshot()` MUST be the only canonical snapshot read in the canonical SDK root object graph. |
| SDK-INSPECT-5 | MUST NOT | `actions.$available()` or other mixed action-meta names MUST NOT be introduced. |
| SDK-INSPECT-6 | MUST | `inspect.graph()` MUST NOT expose ADR-025 platform namespace values as domain state graph nodes. |
| SDK-INSPECT-7 | MUST | `inspect.availableActions()` MUST be a current visible-state read, not a durable capability token. |
| SDK-INSPECT-8 | MUST | `inspect.schemaHash()` MUST return the current canonical snapshot schema hash. |

## 15. Extension Kernel Boundary

`@manifesto-ai/sdk/extensions` remains explicit:

```typescript
import {
  createSimulationSession,
  getExtensionKernel,
} from "@manifesto-ai/sdk/extensions";
```

The extension kernel operates on static schemas and hypothetical snapshots. It
does not enter the active runtime's law boundary.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-EXT-1 | MUST | Extension kernel APIs MUST remain under `@manifesto-ai/sdk/extensions` for v5. |
| SDK-EXT-2 | MUST NOT | SDK MUST NOT introduce `app.kernel` as a root property. |
| SDK-EXT-3 | MUST NOT | Extension kernel APIs MUST NOT become runtime mutation backdoors. |
| SDK-EXT-4 | MUST | Arbitrary-snapshot preview/session APIs MUST remain read-only and non-committing. |

## 16. Disposal

`dispose()` closes the activated runtime and releases SDK-owned subscriptions and
runtime resources.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-DISPOSE-1 | MUST | `dispose()` MUST be idempotent. |
| SDK-DISPOSE-2 | MUST | Post-dispose `submit()` MUST reject with `DisposedError`. |
| SDK-DISPOSE-3 | MUST | Post-dispose `observe.state()` and `observe.event()` registrations MUST be inert no-op registrations. |
| SDK-DISPOSE-4 | MUST | `snapshot()` and `inspect.canonicalSnapshot()` MAY continue returning the last visible terminal snapshots after disposal. |

## 17. v3 Hard-Cut Removals

SDK v5 removes the v3 canonical public surface entirely. No
`@manifesto-ai/sdk/compat-v4` package is part of the v5 contract.

The Observe and Inspect replacements are part of the hard cut, not optional
aliases. `subscribe()` and `on()` are replaced by `observe.state()` and
`observe.event()` so state observation and telemetry remain separate channels.
`getCanonicalSnapshot()`, `getSchemaGraph()`, `getActionMetadata()`, and
`getAvailableActions()` are replaced by `inspect.*` reads so canonical/debug
inspection stays under the advanced tooling namespace.

The following names MUST NOT appear on the canonical v5 runtime root:

```text
createIntent
dispatchAsync
dispatchAsyncWithReport
commitAsync
commitAsyncWithReport
proposeAsync
waitForProposal
waitForProposalWithReport
getSnapshot
getCanonicalSnapshot
getAvailableActions
isActionAvailable
isIntentDispatchable
getIntentBlockers
why
whyNot
explainIntent
getActionMetadata
getSchemaGraph
simulate
simulateIntent
subscribe
on
```

The migration map is:

| v3 API | v5 API |
|--------|--------|
| `getSnapshot()` | `snapshot()` |
| `getCanonicalSnapshot()` | `inspect.canonicalSnapshot()` |
| `getSchemaGraph()` | `inspect.graph()` |
| `getActionMetadata(name)` | `inspect.action(name)` or `actions.x.info()` |
| `getAvailableActions()` | `inspect.availableActions()` |
| `isActionAvailable(name)` | `actions.x.available()` |
| `createIntent(MEL.actions.x, input)` | `actions.x.bind(input).intent()` |
| `getIntentBlockers(intent)` | `actions.x.check(input).blockers` after narrowing |
| `isIntentDispatchable(intent)` | `actions.x.check(input).ok` |
| `whyNot(intent)` | `actions.x.check(input)` |
| `why(intent)` | `actions.x.check(input)` plus `preview().diagnostics` |
| `simulate(action, ...args)` | `actions.x.preview(...args)` |
| `simulateIntent(intent)` | `actions.x.bind(input).preview()` |
| `dispatchAsync(intent)` | `actions.x.submit(input)` on base runtime |
| `commitAsync(intent)` | `actions.x.submit(input)` on lineage runtime |
| `proposeAsync(intent)` | `actions.x.submit(input)` on governance runtime |
| `waitForProposal(id)` | `submission.waitForSettlement()` or `app.waitForSettlement(ref)` |
| `subscribe(selector, listener)` | `observe.state(selector, listener)` |
| `on(event, handler)` | `observe.event(event, handler)` |

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-HC-1 | MUST | v3 root runtime methods listed above MUST NOT be present on the canonical v5 runtime root. |
| SDK-HC-2 | MUST NOT | SDK v5 MUST NOT ship a canonical `compat-v4` subpath. |
| SDK-HC-3 | MUST | Migration documentation MAY reference v3 names only as historical mapping guidance. |

## 18. Error Model

Known domain and admission failures are values. SDK programmer errors may throw.

### 18.1 Failure Observation Surfaces

`snapshot.system.lastError` is the current semantic error surface.

`namespaces.host.lastError` is Host-owned execution diagnostic state. It is
visible only through the canonical substrate and MUST NOT be automatically
promoted into `snapshot.system.lastError`.

`getLastError()` MUST NOT be introduced as a canonical v5 SDK root method.
Callers read semantic state from `snapshot().system.lastError`, per-attempt
domain outcome from `submit()` results, and Host diagnostics from
`inspect.canonicalSnapshot().namespaces.host.lastError`.

```typescript
export class AlreadyActivatedError extends Error {}
export class DisposedError extends Error {}
export class CompileError extends Error {
  readonly diagnostics: readonly Diagnostic[];
}
export class ReservedEffectError extends Error {
  readonly effectType: string;
}
export class SubmissionFailedError extends Error {
  readonly error: ErrorValue;
  readonly stage: "runtime" | "settlement";
}
export class ManifestoError extends Error {
  readonly code: string;
}
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-ERR-1 | MUST | Admission failures MUST be represented as `AdmissionFailure` values. |
| SDK-ERR-2 | MUST | Domain execution outcomes MUST be represented as `ExecutionOutcome` values. |
| SDK-ERR-3 | MUST | SDK failure observation MUST keep `snapshot.system.lastError`, `submit()` results, and `namespaces.host.lastError` distinct. |
| SDK-ERR-4 | MUST NOT | SDK MUST NOT introduce `getLastError()` as a canonical v5 root method. |
| SDK-ERR-5 | MUST | Operational submit failures before terminal result MUST reject with `SubmissionFailedError`. |
| SDK-ERR-6 | MAY | Compile failures, double activation, disposed access, unknown action names, or malformed SDK inputs MAY throw programmer errors. |

## 19. Compliance Checklist

An implementation satisfies this SPEC when:

- `createManifesto()` returns a composable manifesto and `activate()` returns `ManifestoApp<TDomain, TMode>`.
- The root exposes `snapshot`, `actions`, `action`, `observe`, `inspect`, and `dispose`.
- `ActionHandle` exposes `info`, `available`, `check`, `preview`, `submit`, and `bind`.
- `BoundAction.intent()` returns `Intent | null`.
- `check()` returns the first failing admission layer.
- `preview()` is non-mutating and preserves Core status.
- `submit()` returns mode-specific result types and re-checks legality at submit time.
- `ExecutionOutcome` is the canonical `ok | stop | fail` domain-outcome union.
- `result.ok` is documented and implemented as protocol envelope success, not domain success.
- settled submit results preserve full projected `before` and `after` snapshots; large payloads do not change the default result shape.
- `snapshot()` returns projected state and never exposes canonical-only fields.
- `inspect.canonicalSnapshot()` returns the canonical substrate.
- `observe.state()` and `observe.event()` remain separate channels.
- Extension kernel APIs remain under `@manifesto-ai/sdk/extensions`.
- v3 root APIs are absent from the canonical v5 runtime root.
- resolved action annotations are the only SDK-owned path for `@meta` into `ActionHandle.info()`.
- inline `PreviewOptions` and `SubmitOptions` use explicit `__kind` discriminants and cannot be mistaken for action input.
- `observe.event()` payloads use the normative `ManifestoEventPayloadMap` shapes and do not embed snapshots.

## 20. CTS and Hardening Requirements

The SDK v5 CTS suite MUST cover:

- `check()` first-failing-layer ordering: availability before input before dispatchability.
- `preview()` does not mutate, publish, enqueue, or collapse `halted`/`error` into admission failure.
- Base `submit()` publishes a settled result and maps Core terminal status to `ExecutionOutcome`.
- `result.ok: true` with `outcome.kind: "stop"` and `outcome.kind: "fail"` are valid combinations.
- Settled `submit()` results include full projected `before` and `after` snapshots even for large payloads.
- Generic `SubmissionResult` requires narrowing by `mode` before mode-specific field access.
- Operational submit failure before terminal result rejects with `SubmissionFailedError` and emits `submission:failed`.
- Governance-only `waitForSettlement(ref)` is type-level reachable only on governance runtimes.
- `ProposalRef` can reattach settlement observation through a later governance runtime instance.
- Action names colliding with `then`, `bind`, `constructor`, `inspect`, `snapshot`, `dispose`, or `action` remain accessible through `action(name)`.
- `snapshot()` excludes canonical-only fields; `inspect.canonicalSnapshot()` includes the canonical substrate.
- MEL source annotations populate `ActionHandle.info()`, and caller-provided `options.annotations` overrides same-action compiler annotations.
- Inline option objects are recognized only as extra final arguments with matching `__kind` discriminants.
- `observe.event()` payloads match `ManifestoEventPayloadMap` and contain no full snapshot payloads.
- The v3 root API removal list is absent from canonical v5 runtime types.

## 21. References

- [ADR-017 Capability Decorator Pattern](../../../docs/internals/adr/017-capability-decorator-pattern.md)
- [ADR-019 Post-Activation Extension Kernel](../../../docs/internals/adr/019-post-activation-extension-kernel.md)
- [ADR-020 Intent-Level Dispatchability](../../../docs/internals/adr/020-intent-level-dispatchability.md)
- [ADR-025 Snapshot Ontology Hard Cut](../../../docs/internals/adr/025-snapshot-ontology-hard-cut-data-retirement-and-namespace-separation.md)
- [ADR-026 SDK v5 Action Candidate Surface and Law-Aware `submit()` Ingress](../../../docs/internals/adr/026-sdk-v5-action-candidate-surface-and-law-aware-submit-ingress.md)
- [Core SPEC](../../core/docs/core-SPEC.md)
- [Host SPEC](../../host/docs/host-SPEC.md)
- [Lineage SPEC](../../lineage/docs/lineage-SPEC.md)
- [Governance SPEC](../../governance/docs/governance-SPEC.md)
