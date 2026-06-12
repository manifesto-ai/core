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
import type { HostDispatchOptions, LineageRuntimeKernel } from "@manifesto-ai/sdk/provider";

import type { LineageConfig } from "./runtime-types.js";
import type {
  BranchId,
  BranchInfo,
  BranchSwitchResult,
  LineageService,
  PreparedNextCommit,
  WorldHead,
  WorldId,
  WorldLineage,
  WorldRecord,
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
  WorldId,
  WorldRecord,
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
  readonly branchId?: BranchId;
  readonly baseWorldId?: WorldId;
  readonly proposalRef?: string;
  readonly decisionRef?: string;
  readonly executionKey?: HostDispatchOptions["key"];
  readonly externalContext?: HostDispatchOptions["externalContext"];
  readonly context?: HostDispatchOptions["context"];
  readonly publishOnCompleted?: boolean;
  readonly assumeEnqueued?: boolean;
  /**
   * Reject a non-terminal host result before sealing.
   *
   * `true` rejects every pending result. `"unless-failed"` rejects only
   * pending results that carry no recorded failure evidence — a failed
   * effect execution legitimately leaves the snapshot pending while the
   * failure itself is the terminal outcome to seal.
   */
  readonly rejectPendingBeforeSeal?: boolean | "unless-failed";
};

type LineageControllerKernel<T extends ManifestoDomainShape> = Pick<
  LineageRuntimeKernel<T>,
  | "schema"
  | "getVisibleCoreSnapshot"
  | "setVisibleSnapshot"
  | "rehydrateSnapshot"
  | "restoreVisibleSnapshot"
  | "isDisposed"
  | "ensureIntentId"
  | "isActionAvailable"
  | "getCanonicalSnapshot"
  | "validateIntentInputFor"
  | "isIntentDispatchableFor"
  | "rejectUnavailable"
  | "rejectInvalidInput"
  | "rejectNotDispatchable"
  | "executeHost"
  | "createComputeContext"
  | "captureExternalContext"
  | "enqueue"
>;

export type SealedIntentResult<T extends ManifestoDomainShape> = {
  readonly intent: TypedIntent<T>;
  readonly hostResult: Awaited<ReturnType<LineageControllerKernel<T>["executeHost"]>>;
  readonly preparedCommit: PreparedNextCommit;
  readonly publishedSnapshot?: Snapshot<T["state"]>;
};

export type LineageSealRuntimeFailure<T extends ManifestoDomainShape = ManifestoDomainShape> =
  Error & {
    readonly stage: "host" | "seal";
    readonly hostResult?: Awaited<ReturnType<LineageControllerKernel<T>["executeHost"]>>;
  };

export interface LineageRuntimeController<T extends ManifestoDomainShape> {
  ensureReady(): Promise<void>;
  sealIntent(intent: TypedIntent<T>, options?: SealIntentOptions): Promise<SealedIntentResult<T>>;
  getWorld(worldId: WorldId): Promise<WorldRecord | null>;
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

function createLineageSealRuntimeFailure<T extends ManifestoDomainShape>(
  error: unknown,
  stage: "host" | "seal",
  hostResult?: Awaited<ReturnType<LineageControllerKernel<T>["executeHost"]>>,
): LineageSealRuntimeFailure<T> {
  const failure = toError(error) as LineageSealRuntimeFailure<T>;
  return Object.assign(failure, hostResult !== undefined ? { stage, hostResult } : { stage });
}

export function toLineageSealRuntimeFailure<T extends ManifestoDomainShape>(
  error: unknown,
): LineageSealRuntimeFailure<T> | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const candidate = error as LineageSealRuntimeFailure<T>;
  return candidate.stage === "host" || candidate.stage === "seal" ? candidate : null;
}

export function attachLineageDecoration<T extends ManifestoDomainShape, Laws extends BaseLaws>(
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

export function getLineageDecoration<T extends ManifestoDomainShape, Laws extends BaseLaws>(
  manifesto: ComposableManifesto<T, Laws>,
): LineageDecoration | null {
  const internal = manifesto as Partial<InternalLineageComposableManifesto<T, Laws>>;
  return internal[LINEAGE_DECORATION] ?? null;
}

export function createLineageRuntimeController<T extends ManifestoDomainShape>(
  kernel: LineageControllerKernel<T>,
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
    kernel.setVisibleSnapshot(kernel.rehydrateSnapshot(restored), { notify: false });
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

      const scopedSealTarget =
        options?.branchId !== undefined || options?.baseWorldId !== undefined;
      if ((options?.branchId === undefined) !== (options?.baseWorldId === undefined)) {
        throw createLineageSealRuntimeFailure<T>(
          new ManifestoError(
            "LINEAGE_SCOPED_SEAL_TARGET_INCOMPLETE",
            "Scoped lineage sealing requires both branchId and baseWorldId",
          ),
          "seal",
        );
      }

      if (!currentBranchId || !currentCompletedWorldId) {
        throw createLineageSealRuntimeFailure<T>(
          new ManifestoError(
            "LINEAGE_STATE_ERROR",
            "Lineage runtime has no active branch continuity after bootstrap",
          ),
          "seal",
        );
      }

      const targetBranchId = options?.branchId ?? currentBranchId;
      const targetBaseWorldId = options?.baseWorldId ?? currentCompletedWorldId;
      const previousVisibleSnapshot = scopedSealTarget ? kernel.getVisibleCoreSnapshot() : null;
      let sealViewRestored = false;
      const restoreSealView = (): void => {
        if (sealViewRestored) {
          return;
        }
        sealViewRestored = true;

        if (previousVisibleSnapshot) {
          kernel.setVisibleSnapshot(previousVisibleSnapshot, { notify: false });
          return;
        }
        kernel.restoreVisibleSnapshot();
      };
      const restoreScopedSealViewOnThrow = <Result>(operation: () => Result): Result => {
        try {
          return operation();
        } catch (error) {
          if (scopedSealTarget) {
            restoreSealView();
          }
          throw error;
        }
      };

      if (scopedSealTarget) {
        const branch = await service.getBranch(targetBranchId);
        if (!branch) {
          throw createLineageSealRuntimeFailure<T>(
            new ManifestoError(
              "LINEAGE_BRANCH_NOT_FOUND",
              `Cannot seal intent on unknown branch "${targetBranchId}"`,
            ),
            "seal",
          );
        }
        if (branch.head !== targetBaseWorldId) {
          throw createLineageSealRuntimeFailure<T>(
            new ManifestoError(
              "LINEAGE_BRANCH_BASE_MISMATCH",
              `Cannot seal intent on branch "${targetBranchId}" from stale base "${targetBaseWorldId}"`,
            ),
            "seal",
          );
        }

        const restored = await service.restore(targetBaseWorldId);
        kernel.setVisibleSnapshot(kernel.rehydrateSnapshot(restored), {
          notify: false,
        });
      }

      const actionAvailable = restoreScopedSealViewOnThrow(() =>
        kernel.isActionAvailable(enrichedIntent.type as keyof T["actions"]),
      );
      if (!actionAvailable) {
        if (scopedSealTarget) {
          restoreSealView();
        }
        return kernel.rejectUnavailable(enrichedIntent);
      }
      const invalidInput = restoreScopedSealViewOnThrow(() =>
        kernel.validateIntentInputFor(kernel.getCanonicalSnapshot(), enrichedIntent),
      );
      if (invalidInput) {
        if (scopedSealTarget) {
          restoreSealView();
        }
        return kernel.rejectInvalidInput(enrichedIntent, invalidInput.message);
      }
      const intentDispatchable = restoreScopedSealViewOnThrow(() =>
        kernel.isIntentDispatchableFor(kernel.getCanonicalSnapshot(), enrichedIntent),
      );
      if (!intentDispatchable) {
        if (scopedSealTarget) {
          restoreSealView();
        }
        return kernel.rejectNotDispatchable(enrichedIntent);
      }

      const transitionContext =
        options?.context ??
        restoreScopedSealViewOnThrow(() =>
          kernel.createComputeContext(enrichedIntent, options?.externalContext),
        );

      let result: Awaited<ReturnType<LineageControllerKernel<T>["executeHost"]>>;
      try {
        result = await kernel.executeHost(enrichedIntent, {
          ...(options?.executionKey !== undefined ? { key: options.executionKey } : {}),
          context: transitionContext,
        });
      } catch (error) {
        restoreSealView();
        throw createLineageSealRuntimeFailure<T>(error, "host");
      }

      const pendingResult =
        result.status === "pending" || result.snapshot.system.status === "pending";
      const rejectPending =
        options?.rejectPendingBeforeSeal === true
          ? pendingResult
          : options?.rejectPendingBeforeSeal === "unless-failed"
            ? pendingResult && !hasRecordedFailureEvidence(result)
            : false;
      if (rejectPending) {
        restoreSealView();
        throw createLineageSealRuntimeFailure<T>(
          new ManifestoError(
            "LINEAGE_PENDING_RUNTIME",
            "Lineage seal requires a terminal runtime snapshot; host dispatch remained pending",
          ),
          "host",
          result,
        );
      }

      let prepared: PreparedNextCommit;
      try {
        prepared = await service.prepareSealNext({
          schemaHash: kernel.schema.hash,
          baseWorldId: targetBaseWorldId,
          branchId: targetBranchId,
          computeEnvelope: {
            intent: {
              type: enrichedIntent.type,
              intentId: enrichedIntent.intentId,
              ...(enrichedIntent.input !== undefined ? { input: enrichedIntent.input } : {}),
            },
            context: result.context ?? transitionContext,
          },
          terminalSnapshot: result.snapshot,
          createdAt: result.snapshot.meta.timestamp,
          advanceHead: shouldAdvanceLineageHead(result),
          ...(options?.proposalRef ? { proposalRef: options.proposalRef } : {}),
          ...(options?.decisionRef ? { decisionRef: options.decisionRef } : {}),
        });
        await service.commitPrepared(prepared);
      } catch (error) {
        restoreSealView();
        throw createLineageSealRuntimeFailure<T>(error, "seal", result);
      }

      if (prepared.branchChange.headAdvanced && prepared.branchId === currentBranchId) {
        currentCompletedWorldId = prepared.worldId;
      }

      if (
        prepared.branchChange.headAdvanced &&
        options?.publishOnCompleted !== false &&
        prepared.branchId === currentBranchId
      ) {
        return {
          intent: enrichedIntent,
          hostResult: result,
          preparedCommit: prepared,
          publishedSnapshot: kernel.setVisibleSnapshot(result.snapshot),
        };
      }

      restoreSealView();
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

  async function getWorld(worldId: WorldId): Promise<WorldRecord | null> {
    await ensureReady();
    return service.getWorld(worldId);
  }

  async function getWorldSnapshot(worldId: WorldId): Promise<CanonicalSnapshot<T["state"]> | null> {
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
      kernel.setVisibleSnapshot(kernel.rehydrateSnapshot(restored));
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
      kernel.setVisibleSnapshot(kernel.rehydrateSnapshot(restored));
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

function shouldAdvanceLineageHead(
  result: Awaited<ReturnType<LineageControllerKernel<ManifestoDomainShape>["executeHost"]>>,
): boolean {
  // Terminality is judged from the terminal snapshot plus the FINAL trace.
  // An effect-bearing dispatch legitimately records an intermediate trace
  // with terminatedBy "pending" before the settlement pass completes, and
  // requiring EVERY trace to be "complete" left the head permanently stale
  // after any effect (#490). The final trace still matters: halted outcomes
  // seal without advancing the visible head.
  const system = result.snapshot.system;
  if (
    result.status !== "complete" ||
    system.status !== "idle" ||
    system.lastError !== null ||
    system.pendingRequirements.length > 0
  ) {
    return false;
  }

  const finalTrace = result.traces[result.traces.length - 1];
  return finalTrace?.terminatedBy === "complete";
}

/**
 * Structural check for failure evidence on a host result: a host-level
 * error, a system lastError, or a host-owned lastError under
 * snapshot.namespaces.host. Lineage reads the snapshot as data only; it
 * does not import Host internals.
 */
function hasRecordedFailureEvidence(
  result: Awaited<ReturnType<LineageControllerKernel<ManifestoDomainShape>["executeHost"]>>,
): boolean {
  if (result.error !== undefined && result.error !== null) {
    return true;
  }

  if (result.snapshot.system.lastError !== null) {
    return true;
  }

  const hostNamespace = (result.snapshot.namespaces as Record<string, unknown> | undefined)?.host;
  if (
    hostNamespace !== null &&
    typeof hostNamespace === "object" &&
    (hostNamespace as { readonly lastError?: unknown }).lastError
  ) {
    return true;
  }

  return false;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
