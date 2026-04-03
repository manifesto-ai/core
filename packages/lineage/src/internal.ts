import {
  type CanonicalSnapshot,
  DisposedError,
  ManifestoError,
  type BaseLaws,
  type ComposableManifesto,
  type LineageLaws,
  type ManifestoDomainShape,
  type Snapshot,
  type TypedIntent,
} from "@manifesto-ai/sdk";
import type { HostDispatchOptions, RuntimeKernel } from "@manifesto-ai/sdk/provider";

import type { LineageConfig } from "./runtime-types.js";
import type {
  BranchId,
  BranchInfo,
  BranchSwitchResult,
  LineageService,
  PreparedNextCommit,
  World,
  WorldHead,
  WorldId,
  WorldLineage,
} from "./types.js";

export type {
  ArtifactRef,
  BranchId,
  BranchInfo,
  BranchSwitchResult,
  LineageService,
  LineageStore,
  PreparedLineageCommit,
  SealAttempt,
  World,
  WorldId,
} from "./types.js";
export {
  DefaultLineageService,
  createLineageService,
} from "./service/lineage-service.js";

export const LINEAGE_DECORATION = Symbol("manifesto-lineage.decoration");

export type ResolvedLineageConfig = LineageConfig & {
  readonly service: LineageService;
};

export type LineageDecoration = {
  readonly service: LineageService;
  readonly config: ResolvedLineageConfig;
};

export type InternalLineageComposableManifesto<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
> = ComposableManifesto<T, Laws & LineageLaws> & {
  readonly [LINEAGE_DECORATION]: LineageDecoration;
};

export type SealIntentOptions = {
  readonly proposalRef?: string;
  readonly decisionRef?: string;
  readonly executionKey?: HostDispatchOptions["key"];
  readonly publishOnCompleted?: boolean;
  readonly assumeEnqueued?: boolean;
};

export type SealedIntentResult<T extends ManifestoDomainShape> = {
  readonly intent: TypedIntent<T>;
  readonly hostResult: Awaited<ReturnType<RuntimeKernel<T>["executeHost"]>>;
  readonly preparedCommit: PreparedNextCommit;
  readonly publishedSnapshot?: Snapshot<T["state"]>;
};

export interface LineageRuntimeController<T extends ManifestoDomainShape> {
  ensureReady(): Promise<void>;
  sealIntent(
    intent: TypedIntent<T>,
    options?: SealIntentOptions,
  ): Promise<SealedIntentResult<T>>;
  getWorld(worldId: WorldId): Promise<World | null>;
  getWorldSnapshot(worldId: WorldId): Promise<CanonicalSnapshot<T["state"]> | null>;
  getLineage(): Promise<WorldLineage>;
  getLatestHead(): Promise<WorldHead | null>;
  getHeads(): Promise<readonly WorldHead[]>;
  getBranches(): Promise<readonly BranchInfo[]>;
  getActiveBranch(): Promise<BranchInfo>;
  getCurrentBranchId(): Promise<BranchId>;
  getCurrentCompletedWorldId(): Promise<WorldId>;
  restore(worldId: WorldId): Promise<void>;
  switchActiveBranch(branchId: BranchId): Promise<BranchSwitchResult>;
  createBranch(name: string, fromWorldId?: WorldId): Promise<BranchId>;
}

export function attachLineageDecoration<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
>(
  manifesto: ComposableManifesto<T, Laws & LineageLaws>,
  decoration: LineageDecoration,
): InternalLineageComposableManifesto<T, Laws> {
  Object.defineProperty(manifesto, LINEAGE_DECORATION, {
    enumerable: false,
    configurable: false,
    writable: false,
    value: decoration,
  });

  return manifesto as InternalLineageComposableManifesto<T, Laws>;
}

export function getLineageDecoration<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
>(
  manifesto: ComposableManifesto<T, Laws>,
): LineageDecoration | null {
  const internal = manifesto as Partial<InternalLineageComposableManifesto<T, Laws>>;
  return internal[LINEAGE_DECORATION] ?? null;
}

export function createLineageRuntimeController<T extends ManifestoDomainShape>(
  kernel: RuntimeKernel<T>,
  service: LineageService,
  config: ResolvedLineageConfig,
): LineageRuntimeController<T> {
  let readiness: Promise<void> | null = null;
  let currentBranchId: string | null = null;
  let currentCompletedWorldId: WorldId | null = null;

  async function ensureReady(): Promise<void> {
    if (readiness) {
      return readiness;
    }

    readiness = bootstrapLineage().catch((error) => {
      readiness = null;
      throw error;
    });

    return readiness;
  }

  async function bootstrapLineage(): Promise<void> {
    const branches = await service.getBranches();
    if (branches.length === 0) {
      if (config.branchId) {
        throw new ManifestoError(
          "LINEAGE_BRANCH_NOT_FOUND",
          `Configured branch "${config.branchId}" does not exist in the lineage store`,
        );
      }

      const genesisSnapshot = kernel.getVisibleCoreSnapshot();
      const prepared = await service.prepareSealGenesis({
        schemaHash: kernel.schema.hash,
        terminalSnapshot: genesisSnapshot,
        createdAt: genesisSnapshot.meta.timestamp,
      });
      await service.commitPrepared(prepared);
      currentBranchId = prepared.branchId;
      currentCompletedWorldId = prepared.worldId;
      return;
    }

    const branch = await bindInitialBranch(config.branchId);
    currentBranchId = branch.id;
    currentCompletedWorldId = branch.head;
    const restored = await service.restore(branch.head);
    kernel.setVisibleSnapshot(restored, { notify: false });
  }

  async function bindInitialBranch(branchId?: string): Promise<BranchInfo> {
    if (!branchId) {
      return service.getActiveBranch();
    }

    const branch = await service.getBranch(branchId);
    if (!branch) {
      throw new ManifestoError(
        "LINEAGE_BRANCH_NOT_FOUND",
        `Configured branch "${branchId}" does not exist in the lineage store`,
      );
    }

    const activeBranch = await service.getActiveBranch();
    if (activeBranch.id !== branch.id) {
      await service.switchActiveBranch(branch.id);
    }

    return branch;
  }

  async function sealIntent(
    intent: TypedIntent<T>,
    options?: SealIntentOptions,
  ): Promise<SealedIntentResult<T>> {
    if (kernel.isDisposed()) {
      throw new DisposedError();
    }

    const enrichedIntent = kernel.ensureIntentId(intent);

    const runSeal = async () => {
      if (kernel.isDisposed()) {
        throw new DisposedError();
      }

      await ensureReady();

      if (!kernel.isActionAvailable(enrichedIntent.type as keyof T["actions"])) {
        return kernel.rejectUnavailable(enrichedIntent);
      }

      let result: Awaited<ReturnType<RuntimeKernel<T>["executeHost"]>>;
      try {
        result = await kernel.executeHost(
          enrichedIntent,
          options?.executionKey !== undefined
            ? { key: options.executionKey }
            : undefined,
        );
      } catch (error) {
        kernel.restoreVisibleSnapshot();
        throw toError(error);
      }

      if (!currentBranchId || !currentCompletedWorldId) {
        kernel.restoreVisibleSnapshot();
        throw new ManifestoError(
          "LINEAGE_STATE_ERROR",
          "Lineage runtime has no active branch continuity after bootstrap",
        );
      }

      let prepared: PreparedNextCommit;
      try {
        prepared = await service.prepareSealNext({
          schemaHash: kernel.schema.hash,
          baseWorldId: currentCompletedWorldId,
          branchId: currentBranchId,
          terminalSnapshot: result.snapshot,
          createdAt: result.snapshot.meta.timestamp,
          ...(options?.proposalRef ? { proposalRef: options.proposalRef } : {}),
          ...(options?.decisionRef ? { decisionRef: options.decisionRef } : {}),
        });
        await service.commitPrepared(prepared);
      } catch (error) {
        kernel.restoreVisibleSnapshot();
        throw toError(error);
      }

      if (prepared.branchChange.headAdvanced) {
        currentCompletedWorldId = prepared.worldId;
      }

      if (prepared.branchChange.headAdvanced && options?.publishOnCompleted !== false) {
        return {
          intent: enrichedIntent,
          hostResult: result,
          preparedCommit: prepared,
          publishedSnapshot: kernel.setVisibleSnapshot(result.snapshot),
        };
      }

      kernel.restoreVisibleSnapshot();
      return {
        intent: enrichedIntent,
        hostResult: result,
        preparedCommit: prepared,
      };
    };

    if (options?.assumeEnqueued) {
      return runSeal();
    }

    return kernel.enqueue(runSeal);
  }

  async function getWorld(worldId: WorldId): Promise<World | null> {
    await ensureReady();
    return service.getWorld(worldId);
  }

  async function getWorldSnapshot(
    worldId: WorldId,
  ): Promise<CanonicalSnapshot<T["state"]> | null> {
    await ensureReady();
    const snapshot = await service.getSnapshot(worldId);
    return snapshot as CanonicalSnapshot<T["state"]> | null;
  }

  async function getLineage(): Promise<WorldLineage> {
    await ensureReady();
    return service.getLineage();
  }

  async function getLatestHead(): Promise<WorldHead | null> {
    await ensureReady();
    return service.getLatestHead();
  }

  async function getHeads(): Promise<readonly WorldHead[]> {
    await ensureReady();
    return service.getHeads();
  }

  async function getBranches(): Promise<readonly BranchInfo[]> {
    await ensureReady();
    return service.getBranches();
  }

  async function getActiveBranch(): Promise<BranchInfo> {
    await ensureReady();
    if (currentBranchId) {
      const branch = await service.getBranch(currentBranchId);
      if (branch) {
        return branch;
      }
    }
    return service.getActiveBranch();
  }

  async function getCurrentBranchId(): Promise<BranchId> {
    return (await getActiveBranch()).id;
  }

  async function getCurrentCompletedWorldId(): Promise<WorldId> {
    await ensureReady();
    if (!currentCompletedWorldId) {
      throw new ManifestoError(
        "LINEAGE_STATE_ERROR",
        "Lineage runtime has no completed world continuity",
      );
    }
    return currentCompletedWorldId;
  }

  async function restore(worldId: WorldId): Promise<void> {
    if (kernel.isDisposed()) {
      throw new DisposedError();
    }

    await kernel.enqueue(async () => {
      if (kernel.isDisposed()) {
        throw new DisposedError();
      }

      await ensureReady();
      const restored = await service.restore(worldId);
      kernel.setVisibleSnapshot(restored);
      currentCompletedWorldId = worldId;

      const branches = await service.getBranches();
      const matchingBranch = branches.find((branch) => branch.head === worldId);
      if (matchingBranch) {
        currentBranchId = matchingBranch.id;
      }
    });
  }

  async function switchActiveBranch(branchId: string): Promise<BranchSwitchResult> {
    if (kernel.isDisposed()) {
      throw new DisposedError();
    }

    return kernel.enqueue(async () => {
      if (kernel.isDisposed()) {
        throw new DisposedError();
      }

      await ensureReady();
      const result = await service.switchActiveBranch(branchId);
      const branch = await service.getBranch(branchId);

      if (!branch) {
        throw new ManifestoError(
          "LINEAGE_BRANCH_NOT_FOUND",
          `Cannot switch to unknown branch "${branchId}"`,
        );
      }

      const restored = await service.restore(branch.head);
      kernel.setVisibleSnapshot(restored);
      currentBranchId = branch.id;
      currentCompletedWorldId = branch.head;
      return result;
    });
  }

  async function createBranch(name: string, fromWorldId?: WorldId): Promise<BranchId> {
    if (kernel.isDisposed()) {
      throw new DisposedError();
    }

    return kernel.enqueue(async () => {
      if (kernel.isDisposed()) {
        throw new DisposedError();
      }

      await ensureReady();
      const headWorldId = fromWorldId ?? currentCompletedWorldId;
      if (!headWorldId) {
        throw new ManifestoError(
          "LINEAGE_STATE_ERROR",
          "Cannot create a branch before lineage continuity is bootstrapped",
        );
      }

      return service.createBranch(name, headWorldId);
    });
  }

  return {
    ensureReady,
    sealIntent,
    getWorld,
    getWorldSnapshot,
    getLineage,
    getLatestHead,
    getHeads,
    getBranches,
    getActiveBranch,
    getCurrentBranchId,
    getCurrentCompletedWorldId,
    restore,
    switchActiveBranch,
    createBranch,
  };
}

function toError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error(String(error));
}
