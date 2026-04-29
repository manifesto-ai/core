import type {
  BaseLaws,
  CanonicalSnapshot,
  ComposableManifesto,
  DispatchReport,
  DispatchExecutionOutcome,
  ExecutionDiagnostics,
  ExecutionFailureInfo,
  IntentAdmission,
  LineageLaws,
  ManifestoBaseInstance,
  ManifestoDomainShape,
  Snapshot,
  TypedIntent,
  TypedDispatchAsync,
} from "@manifesto-ai/sdk";

import type {
  BranchId,
  BranchInfo,
  BranchSwitchResult,
  LineageService,
  LineageStore,
  World,
  WorldHead,
  WorldId,
  WorldLineage,
} from "./types.js";

export type LineageConfig =
  | {
      readonly service: LineageService;
      readonly branchId?: BranchId;
    }
  | {
      readonly store: LineageStore;
      readonly branchId?: BranchId;
    };

export type BaseComposableLaws = BaseLaws & {
  readonly __lineageLaws?: never;
  readonly __governanceLaws?: never;
};

export type LineageComposableLaws = BaseLaws & LineageLaws & {
  readonly __governanceLaws?: never;
};

type TypedCommitAsync<T extends ManifestoDomainShape> = TypedDispatchAsync<T>;
type TypedCommitAsyncWithReport<T extends ManifestoDomainShape> = (
  intent: TypedIntent<T>,
) => Promise<CommitReport<T>>;

type DispatchCompletedReport<T extends ManifestoDomainShape> = Extract<
  DispatchReport<T>,
  { readonly kind: "completed" }
>;

type DispatchRejectedReport<T extends ManifestoDomainShape> = Extract<
  DispatchReport<T>,
  { readonly kind: "rejected" }
>;

type DispatchFailedReport<T extends ManifestoDomainShape> = Extract<
  DispatchReport<T>,
  { readonly kind: "failed" }
>;

export type CommitReport<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> =
  | (DispatchCompletedReport<T> & {
      readonly resultWorld: WorldId;
      readonly branchId: BranchId;
      readonly headAdvanced: true;
    })
  | DispatchRejectedReport<T>
  | (Omit<DispatchFailedReport<T>, "published" | "outcome"> & {
      readonly published: false;
      readonly diagnostics?: ExecutionDiagnostics;
      readonly resultWorld?: WorldId;
      readonly branchId?: BranchId;
      readonly headAdvanced?: false;
      readonly sealedOutcome?: DispatchExecutionOutcome<T>;
      readonly error: ExecutionFailureInfo;
      readonly admission: Extract<IntentAdmission<T>, { readonly kind: "admitted" }>;
      readonly beforeSnapshot: Snapshot<T["state"]>;
      readonly beforeCanonicalSnapshot: CanonicalSnapshot<T["state"]>;
    });

export type LineageInstance<T extends ManifestoDomainShape> =
  Omit<ManifestoBaseInstance<T>, "dispatchAsync" | "dispatchAsyncWithReport"> & {
    readonly commitAsync: TypedCommitAsync<T>;
    readonly commitAsyncWithReport: TypedCommitAsyncWithReport<T>;
    readonly restore: (worldId: WorldId) => Promise<void>;
    readonly getWorld: (worldId: WorldId) => Promise<World | null>;
    readonly getWorldSnapshot: (
      worldId: WorldId,
    ) => Promise<CanonicalSnapshot<T["state"]> | null>;
    readonly getLineage: () => Promise<WorldLineage>;
    readonly getLatestHead: () => Promise<WorldHead | null>;
    readonly getHeads: () => Promise<readonly WorldHead[]>;
    readonly getBranches: () => Promise<readonly BranchInfo[]>;
    readonly getActiveBranch: () => Promise<BranchInfo>;
    readonly switchActiveBranch: (branchId: BranchId) => Promise<BranchSwitchResult>;
    readonly createBranch: (name: string, fromWorldId?: WorldId) => Promise<BranchId>;
  };

export type LineageCommitRuntime<T extends ManifestoDomainShape> = Pick<
  LineageInstance<T>,
  "commitAsync" | "commitAsyncWithReport"
>;

export type LineageComposableManifesto<
  T extends ManifestoDomainShape,
> = Omit<ComposableManifesto<T, LineageComposableLaws>, "activate"> & {
  activate(): LineageInstance<T>;
};

declare module "@manifesto-ai/sdk" {
  interface ManifestoDecoratedRuntimeByLaws<T extends ManifestoDomainShape> {
    readonly lineage: LineageInstance<T>;
  }
}

export type BaseComposableManifesto<
  T extends ManifestoDomainShape,
> = ComposableManifesto<T, BaseComposableLaws>;
