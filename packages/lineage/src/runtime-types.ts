import type {
  BaseLaws,
  CanonicalSnapshot,
  ComposableManifesto,
  LineageLaws,
  ManifestoApp,
  ManifestoDomainShape,
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

export type LineageContinuitySurface<T extends ManifestoDomainShape> = {
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

export type LineageInstance<T extends ManifestoDomainShape> =
  ManifestoApp<T, "lineage"> & LineageContinuitySurface<T>;

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
