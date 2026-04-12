import {
  DisposedError,
  ManifestoError,
  type ManifestoDomainShape,
  type Snapshot,
} from "@manifesto-ai/sdk";

import type { GovernanceInstance } from "./runtime-types.js";
import { deriveErrorInfo } from "./error-info.js";
import type {
  ErrorInfo,
  Proposal,
  ProposalId,
  WorldId,
} from "./types.js";

const WAIT_FOR_PROPOSAL_RUNTIME = Symbol("manifesto-governance.wait-for-proposal");

type WaitForProposalRuntimeState = {
  readonly isDisposed: () => boolean;
};

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
      readonly proposal: Proposal & { readonly status: "failed"; readonly resultWorld: WorldId };
      readonly resultWorld: WorldId;
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

export function attachWaitForProposalRuntime<
  T extends ManifestoDomainShape,
>(
  runtime: GovernanceInstance<T>,
  state: WaitForProposalRuntimeState,
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
        snapshot: app.getSnapshot(),
        resultWorld,
      };
    }

    if (proposal.status === "failed") {
      const failedProposal = proposal as Proposal & {
        readonly status: "failed";
        readonly resultWorld: WorldId;
      };
      const resultWorld = requireResultWorld(failedProposal, "failed");
      return {
        kind: "failed",
        proposal: failedProposal,
        resultWorld,
        error: await loadFailureInfo(app, failedProposal, resultWorld),
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

async function loadFailureInfo<T extends ManifestoDomainShape>(
  app: GovernanceInstance<T>,
  proposal: Proposal & { readonly status: "failed"; readonly resultWorld: WorldId },
  resultWorld: WorldId,
): Promise<ErrorInfo> {
  assertNotDisposed(app);
  const snapshot = await app.getWorldSnapshot(resultWorld);
  if (!snapshot) {
    throw new ManifestoError(
      "GOVERNANCE_RESULT_WORLD_NOT_FOUND",
      `Failed proposal "${proposal.proposalId}" references missing world "${resultWorld}"`,
    );
  }

  return deriveErrorInfo(snapshot);
}

function requireResultWorld(
  proposal: Proposal & { readonly status: "completed" | "failed" },
  status: "completed" | "failed",
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
  const internal = app as GovernanceInstance<T> & {
    readonly [WAIT_FOR_PROPOSAL_RUNTIME]?: WaitForProposalRuntimeState;
  };

  if (internal[WAIT_FOR_PROPOSAL_RUNTIME]?.isDisposed()) {
    throw new DisposedError();
  }
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
