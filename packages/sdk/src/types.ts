import type {
  ComputeStatus,
  DomainSchema,
  ExprNode,
  Intent,
  Patch,
  Requirement,
  TraceGraph,
} from "@manifesto-ai/core";
import type {
  SchemaGraph as CompilerSchemaGraph,
  SchemaGraphEdge,
  SchemaGraphEdgeRelation,
  SchemaGraphNode,
  SchemaGraphNodeId,
  SchemaGraphNodeKind,
} from "@manifesto-ai/compiler";
import type {
  CanonicalPlatformNamespaces,
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

export type TypedMEL<T extends ManifestoDomainShape> = {
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

export type ActionArgs<
  T extends ManifestoDomainShape,
  K extends keyof T["actions"],
> = T["actions"][K] extends (...args: infer P) => unknown ? P : never;

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

export type Selector<T, R> = (snapshot: Snapshot<T>) => R;
export type Unsubscribe = () => void;

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
) => Promise<Snapshot<T["state"]>>;
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
  readonly snapshot: Snapshot<T["state"]>;
  readonly changedPaths: readonly string[];
  readonly newAvailableActions: readonly (keyof T["actions"])[];
  readonly requirements: readonly Requirement[];
  readonly status: ComputeStatus;
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

export type ProjectedDiff<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = {
  readonly beforeSnapshot: Snapshot<T["state"]>;
  readonly afterSnapshot: Snapshot<T["state"]>;
  readonly changedPaths: readonly string[];
  readonly availability: AvailableActionDelta<T>;
};

export type CanonicalOutcome<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = {
  readonly beforeCanonicalSnapshot: CanonicalSnapshot<T["state"]>;
  readonly afterCanonicalSnapshot: CanonicalSnapshot<T["state"]>;
  readonly pendingRequirements: readonly Requirement[];
  readonly status: CanonicalSnapshot<T["state"]>["system"]["status"];
};

export type ExecutionOutcome<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = {
  readonly projected: ProjectedDiff<T>;
  readonly canonical: CanonicalOutcome<T>;
};

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
      readonly outcome: ExecutionOutcome<T>;
      readonly diagnostics?: ExecutionDiagnostics;
    }
  | {
      readonly kind: "rejected";
      readonly intent: TypedIntent<T>;
      readonly admission: Extract<IntentAdmission<T>, { readonly kind: "blocked" }>;
      readonly beforeSnapshot: Snapshot<T["state"]>;
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
      readonly beforeSnapshot: Snapshot<T["state"]>;
      readonly beforeCanonicalSnapshot: CanonicalSnapshot<T["state"]>;
      readonly error: ExecutionFailureInfo;
      readonly published: boolean;
      readonly diagnostics?: ExecutionDiagnostics;
      readonly outcome?: ExecutionOutcome<T>;
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
      readonly snapshot: Snapshot<T["state"]>;
      readonly newAvailableActions: readonly (keyof T["actions"])[];
      readonly changedPaths: readonly string[];
    };

export type TypedSimulate<T extends ManifestoDomainShape> = <
  K extends keyof T["actions"],
>(
  action: TypedActionRef<T, K>,
  ...args: CreateIntentArgs<T, K>
) => SimulateResult<T>;

export type TypedSubscribe<T extends ManifestoDomainShape> = <R>(
  selector: Selector<T["state"], R>,
  listener: (value: R) => void,
) => Unsubscribe;

export type TypedActionMetadata<
  T extends ManifestoDomainShape,
  K extends keyof T["actions"] = keyof T["actions"],
> = {
  readonly name: K;
  readonly params: readonly string[];
  readonly input: DomainSchema["actions"][string]["input"];
  readonly description: string | undefined;
  readonly hasDispatchableGate: boolean;
};

export type TypedGetActionMetadata<T extends ManifestoDomainShape> = {
  (): readonly TypedActionMetadata<T>[];
  <K extends keyof T["actions"]>(name: K): TypedActionMetadata<T, K>;
};

export type DispatchBlocker = {
  readonly layer: "available" | "dispatchable";
  readonly expression: ExprNode;
  readonly evaluatedResult: unknown;
  readonly description?: string;
};

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

export interface ManifestoEventMap<T extends ManifestoDomainShape> {
  "dispatch:completed": {
    readonly intentId: string;
    readonly intent: TypedIntent<T>;
    readonly snapshot: Snapshot<T["state"]>;
  };
  "dispatch:rejected": {
    readonly intentId: string;
    readonly intent: TypedIntent<T>;
    readonly code: "ACTION_UNAVAILABLE" | "INTENT_NOT_DISPATCHABLE" | "INVALID_INPUT";
    readonly reason: string;
  };
  "dispatch:failed": {
    readonly intentId: string;
    readonly intent: TypedIntent<T>;
    readonly error: Error;
    readonly snapshot?: Snapshot<T["state"]>;
  };
}

export type ManifestoEvent =
  | "dispatch:completed"
  | "dispatch:rejected"
  | "dispatch:failed";

export type ManifestoEventPayload<T extends ManifestoDomainShape> =
  ManifestoEventMap<T>[ManifestoEvent];

export type TypedOn<T extends ManifestoDomainShape> = <
  K extends ManifestoEvent,
>(
  event: K,
  handler: (payload: ManifestoEventMap<T>[K]) => void,
) => Unsubscribe;

export type ManifestoBaseInstance<T extends ManifestoDomainShape> = {
  readonly createIntent: TypedCreateIntent<T>;
  readonly dispatchAsync: TypedDispatchAsync<T>;
  readonly dispatchAsyncWithReport: (
    intent: TypedIntent<T>,
  ) => Promise<DispatchReport<T>>;
  readonly subscribe: TypedSubscribe<T>;
  readonly on: TypedOn<T>;
  readonly getSnapshot: () => Snapshot<T["state"]>;
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
  readonly MEL: TypedMEL<T>;
  readonly schema: DomainSchema;
  readonly dispose: () => void;
};

export interface ManifestoRuntimeByLaws<T extends ManifestoDomainShape> {
  readonly base: ManifestoBaseInstance<T>;
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
  CanonicalPlatformNamespaces,
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
