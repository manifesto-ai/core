import { describe, expect, it } from "vitest";
import {
  createInMemoryGovernanceStore,
  withGovernance,
} from "@manifesto-ai/governance";
import {
  createInMemoryLineageStore,
  withLineage,
} from "@manifesto-ai/lineage";
import { createLineageService } from "@manifesto-ai/lineage/provider";
import { AlreadyActivatedError, createManifesto } from "@manifesto-ai/sdk";
import { caseTitle, ACTS_CASES } from "../acts-coverage.js";
import {
  evaluateRule,
  expectAllCompliance,
  noteEvidence,
} from "../assertions.js";
import { getRuleOrThrow } from "../acts-rules.js";
import {
  createAutoBinding,
  createCounterSchema,
  createExecutionConfig,
  type CounterDomain,
} from "../helpers/schema.js";

type PendingGovernanceSubmit = {
  readonly ok: true;
  readonly mode: "governance";
  readonly status: "pending";
  readonly action: string;
  readonly proposal: string;
  waitForSettlement(): Promise<unknown>;
};

type ProposalCreatedEvent = {
  readonly proposal: string;
  readonly action: string;
  readonly schemaHash: string;
};

type ProposalEventRuntime = {
  readonly observe: {
    readonly event: (
      event: "proposal:created",
      listener: (payload: ProposalCreatedEvent) => void,
    ) => () => void;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPendingGovernanceSubmit(value: unknown): value is PendingGovernanceSubmit {
  return isRecord(value)
    && value.ok === true
    && value.mode === "governance"
    && value.status === "pending"
    && typeof value.action === "string"
    && typeof value.proposal === "string"
    && typeof value.waitForSettlement === "function";
}

function hasRuntimeSettlementSurface(
  value: unknown,
): value is { waitForSettlement(ref: string): Promise<unknown> } {
  return isRecord(value) && typeof value.waitForSettlement === "function";
}

function hasIncrementSubmitSurface(runtime: unknown): boolean {
  if (!isRecord(runtime)) {
    return false;
  }
  const actions = runtime.actions;
  if (!isRecord(actions)) {
    return false;
  }
  const increment = actions.increment;
  return isRecord(increment) && typeof increment.submit === "function";
}

function hasProposalEventSurface(runtime: unknown): runtime is ProposalEventRuntime {
  if (!isRecord(runtime)) {
    return false;
  }
  const observe = runtime.observe;
  return isRecord(observe) && typeof observe.event === "function";
}

async function getActiveBranchId(runtime: unknown): Promise<string | undefined> {
  if (!isRecord(runtime) || typeof runtime.getActiveBranch !== "function") {
    return undefined;
  }
  const branch = await runtime.getActiveBranch.call(runtime);
  return isRecord(branch) && typeof branch.id === "string"
    ? branch.id
    : undefined;
}

async function submitIncrementCandidate(runtime: unknown): Promise<unknown> {
  if (!isRecord(runtime)) {
    return undefined;
  }
  const actions = runtime.actions;
  if (!isRecord(actions)) {
    return undefined;
  }
  const increment = actions.increment;
  if (!isRecord(increment) || typeof increment.submit !== "function") {
    return undefined;
  }
  return await increment.submit.call(increment);
}

function isSettlementFor(value: unknown, proposal: string): boolean {
  return isRecord(value)
    && value.mode === "governance"
    && value.proposal === proposal
    && (
      value.status === "settled"
      || value.status === "rejected"
      || value.status === "superseded"
      || value.status === "expired"
      || value.status === "cancelled"
      || value.status === "settlement_failed"
    );
}

describe("ACTS Governance Suite", () => {
  it(
    caseTitle(
      ACTS_CASES.GOVERNANCE_COMPOSABLE_SURFACE,
      "withGovernance() stays pre-activation and one-shot until runtime opens.",
    ),
    () => {
      const base = createManifesto<CounterDomain>(createCounterSchema(), {});
      const lineage = withLineage(
        base,
        { store: createInMemoryLineageStore() },
      );
      const manifesto = withGovernance(
        lineage,
        {
          governanceStore: createInMemoryGovernanceStore(),
          bindings: [createAutoBinding()],
          execution: createExecutionConfig("acts-gov-surface"),
        },
      );
      const governed = manifesto.activate();

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("ACTS-GOV-1"),
          "activate" in manifesto
            && !("dispatchAsync" in manifesto)
            && !("proposeAsync" in manifesto)
            && !("getSnapshot" in manifesto),
          {
            passMessage: "Governance decorator stays pre-activation until activate().",
            failMessage: "Governance decorator leaked runtime verbs before activation.",
            evidence: [
              noteEvidence(
                "Checked withGovernance() result before activation for runtime-verb absence.",
              ),
            ],
          },
        ),
        evaluateRule(
          getRuleOrThrow("ACTS-GOV-5"),
          (() => {
            try {
              manifesto.activate();
            } catch (error) {
              if (!(error instanceof AlreadyActivatedError)) {
                return false;
              }
            }

            try {
              lineage.activate();
            } catch (error) {
              if (!(error instanceof AlreadyActivatedError)) {
                return false;
              }
            }

            try {
              base.activate();
              return false;
            } catch (error) {
              return error instanceof AlreadyActivatedError;
            }
          })(),
          {
            passMessage: "Governance-decorated composable shares one-shot activation with lineage and base composables.",
            failMessage: "Governance activation still leaves a re-activation backdoor on the governed, lineage, or base composable.",
            evidence: [
              noteEvidence(
                "Second activation attempt threw AlreadyActivatedError on the governed, lineage, and base composables.",
              ),
            ],
          },
        ),
      ]);

      governed.dispose();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.GOVERNANCE_EXPLICIT_LINEAGE,
      "Governance requires explicit lineage composition and removes direct lower-authority and v3 write verbs from the governed runtime.",
    ),
    async () => {
      const lineage = withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { store: createInMemoryLineageStore() },
      );
      const governed = withGovernance(
        lineage,
        {
          governanceStore: createInMemoryGovernanceStore(),
          bindings: [createAutoBinding()],
          execution: createExecutionConfig("acts-gov-auto"),
        },
      ).activate();

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("ACTS-GOV-2"),
          !("dispatchAsync" in governed)
            && !("dispatchAsyncWithReport" in governed)
            && !("commitAsync" in governed)
            && !("commitAsyncWithReport" in governed)
            && !("proposeAsync" in governed)
            && !("waitForProposal" in governed)
            && !("waitForProposalWithReport" in governed)
            && !("createIntent" in governed)
            && !("MEL" in governed)
            && !("simulateIntent" in governed),
          {
            passMessage: "Governed runtime removes direct lower-authority and v3 write backdoors.",
            failMessage: "Governed runtime still exposes a superseded execution or intent-construction verb.",
            evidence: [
              noteEvidence(
                "Checked runtime surface on governed activation output.",
              ),
            ],
          },
        ),
        evaluateRule(
          getRuleOrThrow("ACTS-GOV-8"),
          hasIncrementSubmitSurface(governed)
            && hasRuntimeSettlementSurface(governed),
          {
            passMessage: "Governed runtime exposes the v5 action-candidate and settlement observer surfaces.",
            failMessage: "Governed runtime is missing v5 action submit or runtime settlement observation.",
            evidence: [
              noteEvidence(
                "Checked for actions.increment.submit() and app.waitForSettlement(ref).",
              ),
            ],
          },
        ),
      ]);

      governed.dispose();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.GOVERNANCE_V5_SUBMIT_RESULT,
      "Governance submit creates a pending proposal result with raw ProposalRef identity.",
    ),
    async () => {
      const governanceStore = createInMemoryGovernanceStore();

      const governed = withGovernance(
        withLineage(
          createManifesto<CounterDomain>(createCounterSchema(), {}),
          { store: createInMemoryLineageStore() },
        ),
        {
          governanceStore,
          bindings: [createAutoBinding()],
          execution: createExecutionConfig("acts-gov-submit"),
        },
      ).activate();

      const proposalCreatedEvents: ProposalCreatedEvent[] = [];
      const stopProposalEvents = hasProposalEventSurface(governed)
        ? governed.observe.event("proposal:created", (event) => {
          proposalCreatedEvents.push(event);
        })
        : () => {};
      const result = await submitIncrementCandidate(governed);
      stopProposalEvents();
      const branchId = await getActiveBranchId(governed);
      const proposals = branchId === undefined
        ? []
        : await governanceStore.getProposalsByBranch(branchId);
      const proposalRef = isPendingGovernanceSubmit(result)
        ? result.proposal
        : undefined;
      const storedProposal = proposalRef === undefined
        ? null
        : await governanceStore.getProposal(proposalRef);
      const roundTrippedRef = proposalRef === undefined
        ? undefined
        : JSON.parse(JSON.stringify(proposalRef)) as string;
      const proposalCreatedEvent = proposalCreatedEvents[0];

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("ACTS-GOV-3"),
          isPendingGovernanceSubmit(result)
            && result.mode === "governance"
            && result.status === "pending"
            && result.action === "increment"
            && proposals.length === 1
            && storedProposal?.proposalId === result.proposal,
          {
            passMessage: "Governance submit returns a pending proposal-bearing result.",
            failMessage: "Governance submit did not create a pending governance proposal result.",
            evidence: [
              noteEvidence("Observed governance submit result", result),
              noteEvidence("Observed stored governance proposals", {
                branchId,
                proposals,
              }),
            ],
          },
        ),
        evaluateRule(
          getRuleOrThrow("ACTS-GOV-9"),
          proposalRef !== undefined
            && proposalCreatedEvents.length === 1
            && proposalCreatedEvent?.proposal === proposalRef
            && proposalCreatedEvent.action === "increment"
            && typeof proposalCreatedEvent.schemaHash === "string"
            && !("snapshot" in proposalCreatedEvent)
            && !("canonicalSnapshot" in proposalCreatedEvent),
          {
            passMessage: "Governance submit emits compact proposal:created telemetry for the created ProposalRef.",
            failMessage: "Governance submit did not emit compact proposal:created telemetry.",
            evidence: [
              noteEvidence("Observed proposal:created events", proposalCreatedEvents),
            ],
          },
        ),
        evaluateRule(
          getRuleOrThrow("ACTS-GOV-6"),
          proposalRef !== undefined
            && roundTrippedRef === proposalRef
            && storedProposal?.proposalId === proposalRef,
          {
            passMessage: "Governance ProposalRef is the raw stored ProposalId and survives JSON string round-trip.",
            failMessage: "Governance ProposalRef did not match the stored ProposalId or failed JSON round-trip.",
            evidence: [
              noteEvidence("Observed ProposalRef identity", {
                proposalRef,
                roundTrippedRef,
                storedProposalId: storedProposal?.proposalId,
              }),
            ],
          },
        ),
      ]);

      governed.dispose();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.GOVERNANCE_V5_SETTLEMENT_REATTACH,
      "Governance settlement can be observed from the pending result and from a round-tripped ProposalRef.",
    ),
    async () => {
      const explicitStore = createInMemoryLineageStore();
      const explicitService = createLineageService(explicitStore);
      const governanceStore = createInMemoryGovernanceStore();

      const governed = withGovernance(
        withLineage(
          createManifesto<CounterDomain>(createCounterSchema(), {}),
          { service: explicitService },
        ),
        {
          governanceStore,
          bindings: [createAutoBinding()],
          execution: createExecutionConfig("acts-gov-settlement"),
        },
      ).activate();

      const pending = await submitIncrementCandidate(governed);
      const proposalRef = isPendingGovernanceSubmit(pending)
        ? pending.proposal
        : undefined;
      const roundTrippedRef = proposalRef === undefined
        ? undefined
        : JSON.parse(JSON.stringify(proposalRef)) as string;
      const resultBoundSettlement = isPendingGovernanceSubmit(pending)
        ? await pending.waitForSettlement()
        : null;
      const runtimeSettlement = roundTrippedRef !== undefined
        && hasRuntimeSettlementSurface(governed)
        ? await governed.waitForSettlement(roundTrippedRef)
        : null;
      const branches = await explicitService.getBranches();

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("ACTS-GOV-4"),
          proposalRef !== undefined
            && isSettlementFor(resultBoundSettlement, proposalRef)
            && isSettlementFor(runtimeSettlement, proposalRef)
            && branches.length > 0,
          {
            passMessage: "Governance settlement re-attaches by ProposalRef and reuses the explicitly composed lineage service.",
            failMessage: "Governance settlement did not re-attach by ProposalRef or did not use the explicit lineage service.",
            evidence: [
              noteEvidence("Observed pending governance result", pending),
              noteEvidence("Observed result-bound settlement", resultBoundSettlement),
              noteEvidence("Observed runtime re-attached settlement", runtimeSettlement),
              noteEvidence("Observed explicit lineage branches", branches),
            ],
          },
        ),
        evaluateRule(
          getRuleOrThrow("ACTS-GOV-7"),
          proposalRef !== undefined
            && roundTrippedRef === proposalRef
            && isSettlementFor(runtimeSettlement, proposalRef),
          {
            passMessage: "Governance runtime waitForSettlement(ref) accepts a JSON round-tripped ProposalRef.",
            failMessage: "Governance runtime waitForSettlement(ref) did not accept the round-tripped ProposalRef.",
            evidence: [
              noteEvidence("Observed ProposalRef re-attachment", {
                proposalRef,
                roundTrippedRef,
                runtimeSettlement,
              }),
            ],
          },
        ),
      ]);

      governed.dispose();
    },
  );
});
