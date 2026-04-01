import type {
  BaseLaws,
  ComposableManifesto,
  LineageLaws,
  ManifestoBaseInstance,
  ManifestoDomainShape,
  Snapshot,
} from "@manifesto-ai/sdk";
import type { Intent } from "@manifesto-ai/core";

import type {
  BranchId,
  BranchInfo,
  BranchSwitchResult,
  LineageService,
  LineageStore,
  World,
  WorldHead,
  WorldId,
} from "./types.js";

export type LineageConfig = {
  readonly service?: LineageService;
  readonly store?: LineageStore;
  readonly branchId?: BranchId;
};

export type LineageInstance<T extends ManifestoDomainShape> =
  Omit<ManifestoBaseInstance<T>, "dispatchAsync"> & {
    readonly dispatchAsync: (intent: Intent) => Promise<Snapshot<T["state"]>>;
    readonly restore: (worldId: WorldId) => Promise<void>;
    readonly getWorld: (worldId: WorldId) => Promise<World | null>;
    readonly getLatestHead: () => Promise<WorldHead | null>;
    readonly getHeads: () => Promise<readonly WorldHead[]>;
    readonly getBranches: () => Promise<readonly BranchInfo[]>;
    readonly getActiveBranch: () => Promise<BranchInfo>;
    readonly switchActiveBranch: (branchId: BranchId) => Promise<BranchSwitchResult>;
    readonly createBranch: (name: string, fromWorldId?: WorldId) => Promise<BranchId>;
  };

export type LineageComposableManifesto<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
> = Omit<ComposableManifesto<T, Laws & LineageLaws>, "activate"> & {
  activate(): LineageInstance<T>;
};
