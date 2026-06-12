import type {
  ComputeStatus,
  DomainSchema,
  ErrorValue,
  ExprNode,
  Intent,
  JsonValue,
  Patch,
  Requirement,
  TraceGraph,
} from "@manifesto-ai/core";

export type { JsonValue } from "@manifesto-ai/core";
import type {
  SchemaGraph as CompilerSchemaGraph,
  SchemaGraphEdge,
  SchemaGraphEdgeRelation,
  SchemaGraphNode,
  SchemaGraphNodeId,
  SchemaGraphNodeKind,
} from "@manifesto-ai/compiler";
import type {
  CanonicalNamespaces,
  CanonicalSnapshot,
  Snapshot,
} from "./projection/snapshot-projection.js";

type ActionFn = {
  bivarianceHack(...args: unknown[]): unknown;
}["bivarianceHack"];

export type ManifestoDomainShape = {
  readonly actions: Record<string, ActionFn>;
  readonly state: Record<string, unknown>;
  readonly computed: Record<string, unknown>;
  readonly context?: ExternalContext;
};

export type BaseLaws = { readonly __baseLaws: true };
export type LineageLaws = { readonly __lineageLaws: true };
export type GovernanceLaws = { readonly __governanceLaws: true };
export type BaseComposableLaws = BaseLaws & {
  readonly __lineageLaws?: never;
  readonly __governanceLaws?: never;
};
export type LineageComposableLaws = BaseLaws & LineageLaws & {
  readonly __governanceLaws?: never;
};
export type GovernedComposableLaws = BaseLaws & LineageLaws & GovernanceLaws;

export type EffectContext<T = unknown> = {
  readonly snapshot: Readonly<Snapshot<T>>;
};

export type EffectHandler = (
  params: unknown,
  ctx: EffectContext,
) => Promise<readonly Patch[]>;

export type TypedActionRef<
  T extends ManifestoDomainShape,
  K extends keyof T["actions"] = keyof T["actions"],
> = {
  readonly __kind: "ActionRef";
  readonly name: K;
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

export type TypedDomainRefs<T extends ManifestoDomainShape> = {
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

/**
 * @deprecated Use TypedDomainRefs. This compatibility alias is retained for
 * older helper/provider code that still names the typed ref surface "MEL".
 */
export type TypedMEL<T extends ManifestoDomainShape> = TypedDomainRefs<T>;

export type ActionArgs<
  T extends ManifestoDomainShape,
  K extends keyof T["actions"],
> = T["actions"][K] extends (...args: infer P) => unknown ? P : never;

export type RuntimeMode = "base" | "lineage" | "governance";

export type ActionName<T extends ManifestoDomainShape> =
  keyof T["actions"] & string;

type ActionInputFromArgs<TArgs extends readonly unknown[]> =
  TArgs extends readonly []
    ? undefined
    : 2 extends TArgs["length"]
      ? Readonly<TArgs>
      : TArgs extends readonly [unknown, unknown, ...unknown[]]
        ? Readonly<TArgs>
        : TArgs[0];

export type ActionInput<
  T extends ManifestoDomainShape,
  K extends ActionName<T>,
> = ActionInputFromArgs<ActionArgs<T, K>>;

export type ProjectedSnapshot<T extends ManifestoDomainShape> =
  Snapshot<T["state"], T["computed"]>;

export type ExternalContext = Readonly<Record<string, JsonValue>>;

export type DomainExternalContext<T extends ManifestoDomainShape> =
  T extends { readonly context: infer TContext extends ExternalContext }
    ? Readonly<TContext>
    : ExternalContext;

export type ContextUpdater<TContext extends ExternalContext = ExternalContext> = (
  current: Readonly<TContext>,
) => TContext;

export type PreviewDiagnosticsMode = "none" | "summary" | "trace";
export type SubmitReportMode = "none" | "summary" | "full";

export type ExecutionView<TContext extends ExternalContext = ExternalContext> = {
  readonly context?: TContext;
  readonly diagnostics?: PreviewDiagnosticsMode;
  readonly report?: SubmitReportMode;
};

export type ActionAnnotation = Readonly<Record<string, unknown>>;

export type CreateManifestoOptions<TContext extends ExternalContext = ExternalContext> = {
  readonly annotations?: Readonly<Record<string, ActionAnnotation>>;
  readonly context?: TContext;
};

export type ActionParameterInfo = {
  readonly name: string;
  readonly required: boolean;
  readonly type?: string;
  readonly description?: string;
};

export type ActionInfo<Name extends string = string> = {
  readonly name: Name;
  readonly title?: string;
  readonly description?: string;
  readonly parameters: readonly ActionParameterInfo[];
  readonly annotations?: ActionAnnotation;
};

/**
 * Coarse admission-stage blocker riding on {@link AdmissionFailure}.
 *
 * Admission stays cheap: a Blocker says THAT a candidate is blocked and at
 * which layer. To learn WHY in domain terms (the MEL expressions involved),
 * re-query the explanation seam — that richer stage uses
 * {@link ExplanationBlocker} (`DispatchBlocker`) on `IntentExplanation`.
 */
export type Blocker = {
  readonly path: ReadonlyArray<string | number>;
  readonly code: string;
  readonly message: string;
  readonly detail?: Readonly<Record<string, unknown>>;
};

/**
 * Stage-explicit name for {@link Blocker}: the admission-stage vocabulary.
 */
export type AdmissionBlocker = Blocker;

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

export type Admission<Name extends string = string> =
  | AdmissionOk<Name>
  | AdmissionFailure<Name>;

export type PathSegment = string | number;

export type ChangedPath = {
  readonly path: readonly PathSegment[];
  readonly kind: "set" | "unset" | "changed";
};

export type PreviewDiagnostics = {
  readonly trace?: TraceGraph;
};

export type PreviewResult<
  T extends ManifestoDomainShape,
  K extends ActionName<T>,
> =
  | {
      readonly admitted: false;
      readonly admission: AdmissionFailure<K>;
    }
  | {
      readonly admitted: true;
      readonly status: "complete" | "pending" | "halted" | "error";
      readonly before: ProjectedSnapshot<T>;
      readonly after: ProjectedSnapshot<T>;
      readonly changes: readonly ChangedPath[];
      readonly requirements: readonly Requirement[];
      readonly newAvailableActions?: readonly ActionInfo[];
      readonly diagnostics?: PreviewDiagnostics;
      readonly error?: ErrorValue | null;
    };

export type ExecutionDetail = Readonly<Record<string, unknown>>;

export type ExecutionOutcome =
  | { readonly kind: "ok"; readonly detail?: ExecutionDetail }
  | { readonly kind: "stop"; readonly reason: string; readonly detail?: ExecutionDetail }
  | { readonly kind: "fail"; readonly error: ErrorValue; readonly detail?: ExecutionDetail };

export type BaseWriteReport = {
  readonly mode: "base";
  readonly action: string;
  readonly changes: readonly ChangedPath[];
  readonly requirements: readonly Requirement[];
  readonly outcome: ExecutionOutcome;
  readonly diagnostics?: ExecutionDiagnostics;
};
export type WorldRecord = {
  readonly worldId: string;
  readonly schemaHash: string;
  readonly snapshotHash: string;
  readonly parentWorldId: string | null;
  readonly terminalStatus: "completed" | "failed";
};
export type LineageWriteReport = {
  readonly mode: "lineage";
  readonly action: string;
  readonly worldId: string;
  readonly branchId: string;
  readonly headAdvanced: boolean;
  readonly published: boolean;
  readonly outcome: ExecutionOutcome;
  readonly sealedSnapshotHash: string;
  readonly changes: readonly ChangedPath[];
  readonly requirements: readonly Requirement[];
  readonly diagnostics?: ExecutionDiagnostics;
};
export type GovernanceSettlementReport =
  | {
      readonly mode: "governance";
      readonly status: "settled";
      readonly action: string;
      readonly proposal: ProposalRef;
      readonly baseWorldId: string;
      readonly worldId: string;
      readonly sealedSnapshotHash: string;
      readonly published: boolean;
      readonly outcome: ExecutionOutcome;
      readonly changes: readonly ChangedPath[];
      readonly requirements: readonly Requirement[];
    }
  | {
      readonly mode: "governance";
      readonly status: "rejected" | "superseded" | "expired" | "cancelled";
      readonly action: string;
      readonly proposal: ProposalRef;
      readonly decision?: DecisionRecord;
    }
  | {
      readonly mode: "governance";
      readonly status: "settlement_failed";
      readonly action: string;
      readonly proposal?: ProposalRef;
      readonly stage: "authority" | "runtime" | "settlement" | "persistence" | "observation";
      readonly error: ErrorValue;
    };
export type ProposalRef = string;
export type DecisionRecord = Readonly<Record<string, unknown>>;

export type BaseSubmissionResult<
  T extends ManifestoDomainShape,
  K extends ActionName<T>,
> =
  | {
      readonly ok: true;
      readonly mode: "base";
      readonly status: "settled";
      readonly action: K;
      readonly before: ProjectedSnapshot<T>;
      readonly after: ProjectedSnapshot<T>;
      readonly outcome: ExecutionOutcome;
      readonly report?: BaseWriteReport;
    }
  | {
      readonly ok: false;
      readonly mode: "base";
      readonly action: K;
      readonly admission: AdmissionFailure<K>;
    };

export type LineageSubmissionResult<
  T extends ManifestoDomainShape,
  K extends ActionName<T>,
> =
  | {
      readonly ok: true;
      readonly mode: "lineage";
      readonly status: "settled";
      readonly action: K;
      readonly before: ProjectedSnapshot<T>;
      readonly after: ProjectedSnapshot<T>;
      readonly world: WorldRecord;
      readonly outcome: ExecutionOutcome;
      readonly report?: LineageWriteReport;
    }
  | {
      readonly ok: false;
      readonly mode: "lineage";
      readonly action: K;
      readonly admission: AdmissionFailure<K>;
    };

export type GovernanceSubmissionResult<
  T extends ManifestoDomainShape,
  K extends ActionName<T>,
> =
  | {
      readonly ok: true;
      readonly mode: "governance";
      readonly status: "pending";
      readonly action: K;
      readonly proposal: ProposalRef;
      waitForSettlement(): Promise<GovernanceSettlementResult<T, K>>;
    }
  | {
      readonly ok: false;
      readonly mode: "governance";
      readonly action: K;
      readonly admission: AdmissionFailure<K>;
    };

export type GovernanceSettlementResult<
  T extends ManifestoDomainShape,
  K extends ActionName<T>,
> =
  | {
      readonly ok: true;
      readonly mode: "governance";
      readonly status: "settled";
      readonly action: K;
      readonly proposal: ProposalRef;
      readonly world: WorldRecord;
      readonly before: ProjectedSnapshot<T>;
      readonly after: ProjectedSnapshot<T>;
      readonly outcome: ExecutionOutcome;
      readonly report?: GovernanceSettlementReport;
    }
  | {
      readonly ok: true;
      readonly mode: "governance";
      readonly status: "rejected" | "superseded" | "expired" | "cancelled";
      readonly action: K;
      readonly proposal: ProposalRef;
      readonly decision?: DecisionRecord;
      readonly report?: GovernanceSettlementReport;
    }
  | {
      readonly ok: false;
      readonly mode: "governance";
      readonly status: "settlement_failed";
      readonly action: K;
      readonly proposal: ProposalRef;
      readonly error: ErrorValue;
      readonly report?: GovernanceSettlementReport;
    };

export type SubmissionResult<
  T extends ManifestoDomainShape,
  K extends ActionName<T>,
> =
  | BaseSubmissionResult<T, K>
  | LineageSubmissionResult<T, K>
  | GovernanceSubmissionResult<T, K>;

export type SubmitResultFor<
  TMode extends RuntimeMode,
  T extends ManifestoDomainShape,
  K extends ActionName<T>,
> =
  TMode extends "base"
    ? BaseSubmissionResult<T, K>
    : TMode extends "lineage"
      ? LineageSubmissionResult<T, K>
      : TMode extends "governance"
        ? GovernanceSubmissionResult<T, K>
        : SubmissionResult<T, K>;

export type ActionHandle<
  T extends ManifestoDomainShape,
  K extends ActionName<T>,
  TMode extends RuntimeMode,
> = {
  info(): ActionInfo<K>;
  available(): boolean;
  check(...args: ActionArgs<T, K>): Admission<K>;
  preview(...args: ActionArgs<T, K>): PreviewResult<T, K>;
  submit(...args: ActionArgs<T, K>): Promise<SubmitResultFor<TMode, T, K>>;
  bind(...args: ActionArgs<T, K>): BoundAction<T, K, TMode>;
};

export type DynamicActionHandle<
  T extends ManifestoDomainShape,
  TMode extends RuntimeMode,
> = {
  info(): ActionInfo<ActionName<T>>;
  available(): boolean;
  check(...args: unknown[]): Admission<ActionName<T>>;
  preview(...args: unknown[]): PreviewResult<T, ActionName<T>>;
  submit(
    ...args: unknown[]
  ): Promise<SubmitResultFor<TMode, T, ActionName<T>>>;
  bind(...args: unknown[]): DynamicBoundAction<T, TMode>;
};

export type BoundAction<
  T extends ManifestoDomainShape,
  K extends ActionName<T>,
  TMode extends RuntimeMode,
> = {
  readonly action: K;
  readonly input: ActionInput<T, K>;
  check(): Admission<K>;
  preview(): PreviewResult<T, K>;
  submit(): Promise<SubmitResultFor<TMode, T, K>>;
  intent(): Intent | null;
};

export type DynamicBoundAction<
  T extends ManifestoDomainShape,
  TMode extends RuntimeMode,
> = {
  readonly action: ActionName<T>;
  readonly input: ActionInput<T, ActionName<T>>;
  check(): Admission<ActionName<T>>;
  preview(): PreviewResult<T, ActionName<T>>;
  submit(): Promise<SubmitResultFor<TMode, T, ActionName<T>>>;
  intent(): Intent | null;
};

export type ActionSurface<
  T extends ManifestoDomainShape,
  TMode extends RuntimeMode,
> = {
  readonly [K in ActionName<T>]: ActionHandle<T, K, TMode>;
};

type PreciseActionName<T extends ManifestoDomainShape> =
  string extends ActionName<T> ? never : ActionName<T>;

export type GetAction<
  T extends ManifestoDomainShape,
  TMode extends RuntimeMode,
> = {
  <K extends PreciseActionName<T>>(name: K): ActionHandle<T, K, TMode>;
  (name: string): DynamicActionHandle<T, TMode> | undefined;
};

export type ActionObjectBindingArgs<
  T extends ManifestoDomainShape,
  K extends keyof T["actions"],
> = ActionArgs<T, K> extends [unknown, ...unknown[]]
  ? [params: Record<string, unknown>]
  : never;

export type CreateIntentArgs<
  T extends ManifestoDomainShape,
  K extends keyof T["actions"],
> = ActionArgs<T, K> | ActionObjectBindingArgs<T, K>;

export type Selector<
  TState,
  R,
  TComputed = Record<string, unknown>,
> = (snapshot: Snapshot<TState, TComputed>) => R;
export type Unsubscribe = () => void;

export type ProjectedReadHandle<TValue, TRef> = {
  readonly name: string;
  readonly ref: TRef;
  value(): TValue;
  observe(listener: (next: TValue, prev: TValue) => void): Unsubscribe;
};

export type StateReadSurface<T extends ManifestoDomainShape> = {
  readonly [K in keyof T["state"]]: ProjectedReadHandle<
    T["state"][K],
    FieldRef<T["state"][K]>
  >;
};

export type ComputedReadSurface<T extends ManifestoDomainShape> = {
  readonly [K in keyof T["computed"]]: ProjectedReadHandle<
    T["computed"][K],
    ComputedRef<T["computed"][K]>
  >;
};

declare const MANIFESTO_INTENT_BRAND: unique symbol;

export type TypedIntent<
  T extends ManifestoDomainShape,
  K extends keyof T["actions"] = keyof T["actions"],
> = Intent & {
  readonly [MANIFESTO_INTENT_BRAND]: {
    readonly domain: T;
    readonly action: K;
  };
};

export type TypedCreateIntent<T extends ManifestoDomainShape> = <
  K extends keyof T["actions"],
>(
  action: TypedActionRef<T, K>,
  ...args: CreateIntentArgs<T, K>
) => TypedIntent<T, K>;

export type TypedDispatchAsync<T extends ManifestoDomainShape> = (
  intent: TypedIntent<T>,
) => Promise<ProjectedSnapshot<T>>;
export type TypedCommitAsync<T extends ManifestoDomainShape> =
  TypedDispatchAsync<T>;

export type SchemaGraphNodeRef =
  | TypedActionRef<ManifestoDomainShape>
  | FieldRef<unknown>
  | ComputedRef<unknown>;

export type SchemaGraph = CompilerSchemaGraph & {
  traceUp(ref: SchemaGraphNodeRef): SchemaGraph;
  traceUp(nodeId: SchemaGraphNodeId): SchemaGraph;
  traceDown(ref: SchemaGraphNodeRef): SchemaGraph;
  traceDown(nodeId: SchemaGraphNodeId): SchemaGraph;
};

export type SimulateResult<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = {
  readonly snapshot: ProjectedSnapshot<T>;
  readonly changedPaths: readonly ChangedPath[];
  readonly newAvailableActions: readonly (keyof T["actions"])[];
  readonly requirements: readonly Requirement[];
  readonly status: ComputeStatus;
  readonly diagnostics?: SimulationDiagnostics;
};

export type SimulationDiagnostics = {
  readonly trace: TraceGraph;
};

export type InvalidInputInfo = {
  readonly code: "INVALID_INPUT";
  readonly message: string;
};

export type IntentAdmissionFailure =
  | {
      readonly kind: "unavailable";
      readonly blockers: readonly DispatchBlocker[];
    }
  | {
      readonly kind: "invalid_input";
      readonly error: InvalidInputInfo;
    }
  | {
      readonly kind: "not_dispatchable";
      readonly blockers: readonly DispatchBlocker[];
    };

export type IntentAdmission<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> =
  | {
      readonly kind: "admitted";
      readonly actionName: keyof T["actions"] & string;
    }
  | {
      readonly kind: "blocked";
      readonly actionName: keyof T["actions"] & string;
      readonly failure: IntentAdmissionFailure;
    };

export type AvailableActionDelta<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = {
  readonly before: readonly (keyof T["actions"])[];
  readonly after: readonly (keyof T["actions"])[];
  readonly unlocked: readonly (keyof T["actions"])[];
  readonly locked: readonly (keyof T["actions"])[];
};

export type DispatchProjectedDiff<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = {
  readonly beforeSnapshot: ProjectedSnapshot<T>;
  readonly afterSnapshot: ProjectedSnapshot<T>;
  readonly changedPaths: readonly ChangedPath[];
  readonly availability: AvailableActionDelta<T>;
};

export type DispatchCanonicalOutcome<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = {
  readonly beforeCanonicalSnapshot: CanonicalSnapshot<T["state"]>;
  readonly afterCanonicalSnapshot: CanonicalSnapshot<T["state"]>;
  readonly pendingRequirements: readonly Requirement[];
  readonly status: CanonicalSnapshot<T["state"]>["system"]["status"];
};

export type DispatchExecutionOutcome<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = {
  readonly projected: DispatchProjectedDiff<T>;
  readonly canonical: DispatchCanonicalOutcome<T>;
};

export type ProjectedDiff<T extends ManifestoDomainShape = ManifestoDomainShape> =
  DispatchProjectedDiff<T>;

export type CanonicalOutcome<T extends ManifestoDomainShape = ManifestoDomainShape> =
  DispatchCanonicalOutcome<T>;

export type ExecutionFailureInfo = {
  readonly message: string;
  readonly code?: string;
  readonly name?: string;
  readonly stage?: "host" | "seal";
};

export type ExecutionDiagnostics = {
  readonly hostTraces?: readonly TraceGraph[];
};

export type DispatchReport<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> =
  | {
      readonly kind: "completed";
      readonly intent: TypedIntent<T>;
      readonly admission: {
        readonly kind: "admitted";
        readonly actionName: keyof T["actions"] & string;
      };
      readonly outcome: DispatchExecutionOutcome<T>;
      readonly diagnostics?: ExecutionDiagnostics;
    }
  | {
      readonly kind: "rejected";
      readonly intent: TypedIntent<T>;
      readonly admission: Extract<IntentAdmission<T>, { readonly kind: "blocked" }>;
      readonly beforeSnapshot: ProjectedSnapshot<T>;
      readonly beforeCanonicalSnapshot: CanonicalSnapshot<T["state"]>;
      readonly rejection: {
        readonly code: "ACTION_UNAVAILABLE" | "INTENT_NOT_DISPATCHABLE" | "INVALID_INPUT";
        readonly reason: string;
      };
    }
  | {
      readonly kind: "failed";
      readonly intent: TypedIntent<T>;
      readonly admission: {
        readonly kind: "admitted";
        readonly actionName: keyof T["actions"] & string;
      };
      readonly beforeSnapshot: ProjectedSnapshot<T>;
      readonly beforeCanonicalSnapshot: CanonicalSnapshot<T["state"]>;
      readonly error: ExecutionFailureInfo;
      readonly published: boolean;
      readonly diagnostics?: ExecutionDiagnostics;
      readonly outcome?: DispatchExecutionOutcome<T>;
    };

export type IntentExplanation<
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
      readonly snapshot: ProjectedSnapshot<T>;
      readonly newAvailableActions: readonly (keyof T["actions"])[];
      readonly changedPaths: readonly ChangedPath[];
    };

export type TypedSimulate<T extends ManifestoDomainShape> = <
  K extends keyof T["actions"],
>(
  action: TypedActionRef<T, K>,
  ...args: CreateIntentArgs<T, K>
) => SimulateResult<T>;

export type TypedSimulateIntent<T extends ManifestoDomainShape> = <
  K extends keyof T["actions"],
>(
  intent: TypedIntent<T, K>,
) => SimulateResult<T>;

export type TypedSubscribe<T extends ManifestoDomainShape> = <R>(
  selector: Selector<T["state"], R, T["computed"]>,
  listener: (value: R) => void,
) => Unsubscribe;

export type TypedActionMetadata<
  T extends ManifestoDomainShape,
  K extends keyof T["actions"] = keyof T["actions"],
> = {
  readonly name: K;
  readonly params: readonly string[];
  readonly publicArity: number;
  readonly requiredArity: number;
  readonly input: DomainSchema["actions"][string]["input"];
  readonly inputType?: DomainSchema["actions"][string]["inputType"];
  readonly description: string | undefined;
  readonly annotations?: ActionAnnotation;
  readonly hasDispatchableGate: boolean;
};

export type TypedGetActionMetadata<T extends ManifestoDomainShape> = {
  (): readonly TypedActionMetadata<T>[];
  <K extends keyof T["actions"]>(name: K): TypedActionMetadata<T, K>;
};

/**
 * Rich explanation-stage blocker riding on `IntentExplanation`.
 *
 * Carries the MEL expression behind the block. This is the upgrade target
 * when a UI showing "why is this blocked" needs more than the coarse
 * admission-stage {@link Blocker}: re-query the explanation seam to move
 * from one vocabulary to the other.
 */
export type DispatchBlocker = {
  readonly layer: "available" | "dispatchable";
  readonly expression: ExprNode;
  readonly evaluatedResult: unknown;
  readonly description?: string;
};

/**
 * Stage-explicit name for {@link DispatchBlocker}: the explanation-stage
 * vocabulary.
 */
export type ExplanationBlocker = DispatchBlocker;

export type TypedIsIntentDispatchable<T extends ManifestoDomainShape> = <
  K extends keyof T["actions"],
>(
  action: TypedActionRef<T, K>,
  ...args: CreateIntentArgs<T, K>
) => boolean;

export type TypedGetIntentBlockers<T extends ManifestoDomainShape> = <
  K extends keyof T["actions"],
>(
  action: TypedActionRef<T, K>,
  ...args: CreateIntentArgs<T, K>
) => readonly DispatchBlocker[];

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

export type ManifestoEvent = ManifestoEventName;

export type TypedOn<T extends ManifestoDomainShape> = <
  K extends ManifestoEvent,
>(
  event: K,
  handler: (payload: ManifestoEventPayloadMap[K]) => void,
) => Unsubscribe;

export type ObserveSurface<T extends ManifestoDomainShape> = {
  state<S>(
    selector: (snapshot: ProjectedSnapshot<T>) => S,
    listener: (next: S, prev: S) => void,
  ): Unsubscribe;
  event<Event extends ManifestoEventName>(
    event: Event,
    listener: (payload: ManifestoEventPayload<Event>) => void,
  ): Unsubscribe;
};

export type InspectSurface<T extends ManifestoDomainShape> = {
  graph(): SchemaGraph;
  canonicalSnapshot(): CanonicalSnapshot<T["state"]>;
  action<Name extends ActionName<T>>(name: Name): ActionInfo<Name>;
  availableActions(): readonly ActionInfo<ActionName<T>>[];
  schemaHash(): string;
};

export type BaseManifestoApp<
  T extends ManifestoDomainShape,
  TMode extends RuntimeMode,
> = {
  readonly action: ActionSurface<T, TMode>;
  readonly state: StateReadSurface<T>;
  readonly computed: ComputedReadSurface<T>;
  readonly observe: ObserveSurface<T>;
  readonly inspect: InspectSurface<T>;
  snapshot(): ProjectedSnapshot<T>;
  getAction: GetAction<T, TMode>;
  context(): DomainExternalContext<T>;
  injectContext(context: DomainExternalContext<T>): void;
  updateContext(
    updater: ContextUpdater<DomainExternalContext<T>>,
  ): DomainExternalContext<T>;
  with(view: ExecutionView<DomainExternalContext<T>>): ManifestoApp<T, TMode>;
  dispose(): void;
};

export type GovernanceSettlementSurface<T extends ManifestoDomainShape> = {
  waitForSettlement(
    ref: ProposalRef,
  ): Promise<GovernanceSettlementResult<T, ActionName<T>>>;
};

type EmptySurface = Record<never, never>;

export type ManifestoApp<
  T extends ManifestoDomainShape,
  TMode extends RuntimeMode,
> = BaseManifestoApp<T, TMode>
  & ([TMode] extends ["governance"]
      ? GovernanceSettlementSurface<T>
      : EmptySurface);

/**
 * v3-era intent-centric instance shape, retired from the public surface by
 * the v5 activation-first design. It is intentionally NOT exported from the
 * package entrypoints; it remains only as the internal compat seam's view.
 *
 * @deprecated Scheduled for removal in the next major release together with
 * the deprecated DispatchReport / IntentAdmission result types.
 */
export type ManifestoBaseInstance<T extends ManifestoDomainShape> = {
  readonly createIntent: TypedCreateIntent<T>;
  readonly dispatchAsync: TypedDispatchAsync<T>;
  readonly dispatchAsyncWithReport: (
    intent: TypedIntent<T>,
  ) => Promise<DispatchReport<T>>;
  readonly subscribe: TypedSubscribe<T>;
  readonly on: TypedOn<T>;
  readonly getSnapshot: () => ProjectedSnapshot<T>;
  readonly getCanonicalSnapshot: () => CanonicalSnapshot<T["state"]>;
  readonly getAvailableActions: () => readonly (keyof T["actions"])[];
  readonly isIntentDispatchable: TypedIsIntentDispatchable<T>;
  readonly getIntentBlockers: TypedGetIntentBlockers<T>;
  readonly explainIntent: (intent: TypedIntent<T>) => IntentExplanation<T>;
  readonly why: (intent: TypedIntent<T>) => IntentExplanation<T>;
  readonly whyNot: (intent: TypedIntent<T>) => readonly DispatchBlocker[] | null;
  readonly getActionMetadata: TypedGetActionMetadata<T>;
  readonly isActionAvailable: (name: keyof T["actions"]) => boolean;
  readonly getSchemaGraph: () => SchemaGraph;
  readonly simulate: TypedSimulate<T>;
  readonly simulateIntent: TypedSimulateIntent<T>;
  readonly refs: TypedDomainRefs<T>;
  /** @deprecated Use refs. */
  readonly MEL: TypedMEL<T>;
  readonly schema: DomainSchema;
  readonly dispose: () => void;
};

export type ManifestoLegalityRuntime<T extends ManifestoDomainShape> = Pick<
  ManifestoBaseInstance<T>,
  "createIntent" | "whyNot" | "simulate" | "simulateIntent" | "refs" | "MEL"
>;

export type ManifestoDispatchRuntime<T extends ManifestoDomainShape> = Pick<
  ManifestoBaseInstance<T>,
  "dispatchAsync" | "dispatchAsyncWithReport"
>;

export interface ManifestoRuntimeByLaws<T extends ManifestoDomainShape> {
  readonly base: ManifestoApp<T, "base">;
}

export interface ManifestoDecoratedRuntimeByLaws<
  T extends ManifestoDomainShape,
> {}

type ResolvedManifestoRuntimeByLaws<
  T extends ManifestoDomainShape,
> = ManifestoRuntimeByLaws<T> & ManifestoDecoratedRuntimeByLaws<T>;

export type ActivatedInstance<
  T extends ManifestoDomainShape,
  Laws,
> =
  Laws extends GovernanceLaws
    ? ResolvedManifestoRuntimeByLaws<T> extends { readonly governance: infer Runtime }
      ? Runtime
      : never
    : Laws extends LineageLaws
      ? ResolvedManifestoRuntimeByLaws<T> extends { readonly lineage: infer Runtime }
        ? Runtime
        : never
      : ManifestoRuntimeByLaws<T>["base"];

export type {
  CanonicalNamespaces,
  CanonicalSnapshot,
  Snapshot,
  SchemaGraphEdge,
  SchemaGraphEdgeRelation,
  SchemaGraphNode,
  SchemaGraphNodeId,
  SchemaGraphNodeKind,
};

export type ComposableManifesto<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws = BaseComposableLaws,
> = {
  readonly _laws: Laws;
  readonly schema: DomainSchema;
  activate(): ActivatedInstance<T, Laws>;
};
