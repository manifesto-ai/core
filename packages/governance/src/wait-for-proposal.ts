import {
  DisposedError,
  ManifestoError,
  type CanonicalSnapshot,
  type DispatchExecutionOutcome,
  type ManifestoDomainShape,
  type Snapshot,
} from "@manifesto-ai/sdk";
import type { WaitForProposalRuntimeKernel } from "@manifesto-ai/sdk/provider";

import type { GovernanceInstance } from "./runtime-types.js";
import { deriveErrorInfo } from "./error-info.js";
import type {
  ErrorInfo,
  Proposal,
  ProposalId,
  WorldId,
} from "./types.js";

const WAIT_FOR_PROPOSAL_RUNTIME = Symbol("manifesto-governance.wait-for-proposal");

type WaitForProposalRuntimeState<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = WaitForProposalRuntimeKernel<T>;

export type WaitForProposalOptions = {
  readonly timeoutMs?: number;
  readonly pollIntervalMs?: number;
};

export type ProposalSettlement<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> =
  | {
      readonly kind: "completed";
      readonly proposal: Proposal & { readonly status: "completed"; readonly resultWorld: WorldId };
      readonly snapshot: Snapshot<T["state"]>;
      readonly resultWorld: WorldId;
    }
  | {
      readonly kind: "failed";
      readonly proposal: Proposal & { readonly status: "failed" };
      readonly resultWorld?: WorldId;
      readonly error: ErrorInfo;
    }
  | {
      readonly kind: "rejected";
      readonly proposal: Proposal & { readonly status: "rejected" };
    }
  | {
      readonly kind: "superseded";
      readonly proposal: Proposal & { readonly status: "superseded" };
    }
  | {
      readonly kind: "pending";
      readonly proposal: Proposal;
    }
  | {
      readonly kind: "timed_out";
      readonly proposal: Proposal;
    };

export type ProposalSettlementReport<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> =
  | {
      readonly kind: "completed";
      readonly proposal: Proposal & { readonly status: "completed"; readonly resultWorld: WorldId };
      readonly baseWorld: WorldId;
      readonly resultWorld: WorldId;
      readonly outcome: DispatchExecutionOutcome<T>;
    }
  | {
      readonly kind: "failed";
      readonly proposal: Proposal & { readonly status: "failed" };
      readonly baseWorld: WorldId;
      readonly published: false;
      readonly error: ErrorInfo;
      readonly resultWorld?: WorldId;
      readonly sealedOutcome?: DispatchExecutionOutcome<T>;
    }
  | {
      readonly kind: "rejected";
      readonly proposal: Proposal & { readonly status: "rejected" };
    }
  | {
      readonly kind: "superseded";
      readonly proposal: Proposal & { readonly status: "superseded" };
    }
  | {
      readonly kind: "pending";
      readonly proposal: Proposal;
    }
  | {
      readonly kind: "timed_out";
      readonly proposal: Proposal;
    };

export function attachWaitForProposalRuntime<
  T extends ManifestoDomainShape,
>(
  runtime: GovernanceInstance<T>,
  state: WaitForProposalRuntimeState<T>,
): GovernanceInstance<T> {
  Object.defineProperty(runtime, WAIT_FOR_PROPOSAL_RUNTIME, {
    enumerable: false,
    configurable: false,
    writable: false,
    value: state,
  });

  return runtime;
}

export async function waitForProposal<
  T extends ManifestoDomainShape,
>(
  app: GovernanceInstance<T>,
  proposalOrId: Proposal | ProposalId,
  options?: WaitForProposalOptions,
): Promise<ProposalSettlement<T>> {
  const proposalId = typeof proposalOrId === "string"
    ? proposalOrId
    : proposalOrId.proposalId;
  const timeoutMs = normalizeDuration(options?.timeoutMs, 0);
  const pollIntervalMs = normalizeDuration(options?.pollIntervalMs, 50);
  const startedAt = Date.now();

  while (true) {
    assertNotDisposed(app);

    const proposal = await app.getProposal(proposalId);
    if (!proposal) {
      throw new ManifestoError(
        "GOVERNANCE_PROPOSAL_NOT_FOUND",
        `Proposal "${proposalId}" was not found`,
      );
    }

    if (proposal.status === "completed") {
      const completedProposal = proposal as Proposal & {
        readonly status: "completed";
        readonly resultWorld: WorldId;
      };
      const resultWorld = requireResultWorld(completedProposal, "completed");
      assertNotDisposed(app);
      return {
        kind: "completed",
        proposal: completedProposal,
        snapshot: app.snapshot(),
        resultWorld,
      };
    }

    if (proposal.status === "failed") {
      const failedProposal = proposal as Proposal & {
        readonly status: "failed";
      };
      const failureInfo = await loadFailureInfo(app, failedProposal);
      return {
        kind: "failed",
        proposal: failedProposal,
        ...(failureInfo.resultWorld !== undefined
          ? { resultWorld: failureInfo.resultWorld }
          : {}),
        error: failureInfo.error,
      };
    }

    if (proposal.status === "rejected") {
      const rejectedProposal = proposal as Proposal & { readonly status: "rejected" };
      return {
        kind: "rejected",
        proposal: rejectedProposal,
      };
    }

    if (proposal.status === "superseded") {
      const supersededProposal = proposal as Proposal & {
        readonly status: "superseded";
      };
      return {
        kind: "superseded",
        proposal: supersededProposal,
      };
    }

    if (timeoutMs === 0) {
      return {
        kind: "pending",
        proposal,
      };
    }

    const remainingMs = timeoutMs - (Date.now() - startedAt);
    if (remainingMs <= 0) {
      return {
        kind: "timed_out",
        proposal,
      };
    }

    await sleep(Math.min(pollIntervalMs, remainingMs));
  }
}

export async function waitForProposalWithReport<
  T extends ManifestoDomainShape,
>(
  app: GovernanceInstance<T>,
  proposalOrId: Proposal | ProposalId,
  options?: WaitForProposalOptions,
): Promise<ProposalSettlementReport<T>> {
  const settlement = await waitForProposal(app, proposalOrId, options);

  if (settlement.kind === "completed") {
    const outcome = await loadStoredOutcome(
      app,
      settlement.proposal.baseWorld,
      settlement.resultWorld,
    );
    return {
      kind: "completed",
      proposal: settlement.proposal,
      baseWorld: settlement.proposal.baseWorld,
      resultWorld: settlement.resultWorld,
      outcome,
    };
  }

  if (settlement.kind === "failed") {
    if (settlement.resultWorld) {
      const sealedOutcome = await loadStoredOutcome(
        app,
        settlement.proposal.baseWorld,
        settlement.resultWorld,
      );
      return {
        kind: "failed",
        proposal: settlement.proposal,
        baseWorld: settlement.proposal.baseWorld,
        published: false,
        error: settlement.error,
        resultWorld: settlement.resultWorld,
        sealedOutcome,
      };
    }

    return {
      kind: "failed",
      proposal: settlement.proposal,
      baseWorld: settlement.proposal.baseWorld,
      published: false,
      error: settlement.error,
    };
  }

  return settlement;
}

async function loadFailureInfo<T extends ManifestoDomainShape>(
  app: GovernanceInstance<T>,
  proposal: Proposal & { readonly status: "failed" },
): Promise<{ readonly error: ErrorInfo; readonly resultWorld?: WorldId }> {
  if (!proposal.resultWorld) {
    return {
      error: {
        summary: "Execution failed before a result world was recorded",
      },
    };
  }

  const resultWorld = proposal.resultWorld;
  assertNotDisposed(app);
  const snapshot = await app.getWorldSnapshot(resultWorld);
  if (!snapshot) {
    throw new ManifestoError(
      "GOVERNANCE_RESULT_WORLD_NOT_FOUND",
      `Failed proposal "${proposal.proposalId}" references missing world "${resultWorld}"`,
    );
  }

  return {
    resultWorld,
    error: deriveErrorInfo(snapshot),
  };
}

async function loadStoredOutcome<T extends ManifestoDomainShape>(
  app: GovernanceInstance<T>,
  baseWorld: WorldId,
  resultWorld: WorldId,
): Promise<DispatchExecutionOutcome<T>> {
  const runtime = getWaitForProposalRuntime(app);

  assertNotDisposed(app);
  const beforeSnapshot = await app.getWorldSnapshot(baseWorld);
  if (!beforeSnapshot) {
    throw new ManifestoError(
      "GOVERNANCE_BASE_WORLD_NOT_FOUND",
      `Proposal references missing base world "${baseWorld}"`,
    );
  }

  assertNotDisposed(app);
  const afterSnapshot = await app.getWorldSnapshot(resultWorld);
  if (!afterSnapshot) {
    throw new ManifestoError(
      "GOVERNANCE_RESULT_WORLD_NOT_FOUND",
      `Proposal references missing result world "${resultWorld}"`,
    );
  }

  return runtime.deriveExecutionOutcome(beforeSnapshot, afterSnapshot);
}

function requireResultWorld(
  proposal: Proposal & { readonly status: "completed" },
  status: "completed",
): WorldId {
  if (!proposal.resultWorld) {
    throw new ManifestoError(
      "GOVERNANCE_RESULT_WORLD_MISSING",
      `Proposal "${proposal.proposalId}" reached ${status} without a result world`,
    );
  }

  return proposal.resultWorld;
}

function assertNotDisposed<T extends ManifestoDomainShape>(app: GovernanceInstance<T>): void {
  const runtime = getWaitForProposalRuntime(app);

  if (runtime.isDisposed()) {
    throw new DisposedError();
  }
}

function getWaitForProposalRuntime<T extends ManifestoDomainShape>(
  app: GovernanceInstance<T>,
): WaitForProposalRuntimeState<T> {
  const internal = app as GovernanceInstance<T> & {
    readonly [WAIT_FOR_PROPOSAL_RUNTIME]?: WaitForProposalRuntimeState<T>;
  };

  const runtime = internal[WAIT_FOR_PROPOSAL_RUNTIME];
  if (!runtime) {
    throw new ManifestoError(
      "GOVERNANCE_RUNTIME_UNSUPPORTED",
      "waitForProposal helpers require a runtime created by withGovernance().activate()",
    );
  }

  return runtime;
}

function normalizeDuration(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}
