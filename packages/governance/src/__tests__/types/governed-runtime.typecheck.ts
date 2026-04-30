import {
  createManifesto,
  type CanonicalSnapshot,
  type ActionName,
  type GovernanceSettlementResult,
  type GovernanceSubmissionResult,
  type ManifestoApp,
  type ProposalRef,
  type SubmitResultFor,
} from "../../../../sdk/src/index.ts";
import {
  createForeignSchema,
  type ForeignDomain,
} from "../../../../sdk/src/__tests__/helpers/foreign-schema.ts";
import {
  createCounterSchema,
  type CounterDomain,
} from "../../../../sdk/src/__tests__/helpers/schema.ts";
import {
  createInMemoryLineageStore,
  withLineage,
} from "../../../../lineage/src/index.ts";
import {
  createInMemoryGovernanceStore,
  type ProposalSettlement,
  type ProposalSettlementReport,
  waitForProposal,
  waitForProposalWithReport,
  withGovernance,
} from "../../index.ts";

const base = createManifesto<CounterDomain>(createCounterSchema(), {});

// @ts-expect-error governance requires an explicitly lineage-composed manifesto
withGovernance(base, {
  bindings: [],
  execution: {
    projectionId: "proj:missing-lineage",
    deriveActor: () => ({ actorId: "actor:auto", kind: "agent" as const }),
    deriveSource: () => ({ kind: "agent" as const, eventId: "evt:missing-lineage" }),
  },
});

const governed = withGovernance<CounterDomain>(
  withLineage<CounterDomain>(base, {
    store: createInMemoryLineageStore(),
  }),
  {
    governanceStore: createInMemoryGovernanceStore(),
    bindings: [],
    execution: {
      projectionId: "proj:governed-runtime",
      deriveActor: () => ({ actorId: "actor:auto", kind: "agent" as const }),
      deriveSource: () => ({ kind: "agent" as const, eventId: "evt:governed-runtime" }),
    },
  },
).activate();

const governedApp: ManifestoApp<CounterDomain, "governance"> = governed;
const proposalRef = "prop-example" as ProposalRef;
const submit: Promise<GovernanceSubmissionResult<CounterDomain, "increment">> =
  governed.actions.increment.submit();
const submitFor: Promise<SubmitResultFor<"governance", CounterDomain, "increment">> =
  governed.action("increment").submit();
const runtimeSettlement: Promise<GovernanceSettlementResult<CounterDomain, ActionName<CounterDomain>>> =
  governed.waitForSettlement(proposalRef);
const appSettlement: Promise<GovernanceSettlementResult<CounterDomain, ActionName<CounterDomain>>> =
  governedApp.waitForSettlement(proposalRef);
const governedWorldSnapshot: Promise<CanonicalSnapshot<CounterDomain["state"]> | null> =
  governed.getWorldSnapshot("world-1");

void submit;
void submitFor;
void runtimeSettlement;
void appSettlement;
void governedWorldSnapshot;
void governed.getLatestHead();
void governed.getBranches();

const governedSettlement: Promise<ProposalSettlement<CounterDomain>> = waitForProposal(
  governed,
  "proposal-1",
);
const governedSettlementReport: Promise<ProposalSettlementReport<CounterDomain>> = waitForProposalWithReport(
  governed,
  "proposal-1",
);
void governedSettlement;
void governedSettlementReport;

// @ts-expect-error governed runtime removes base dispatchAsync
governed.dispatchAsync;
// @ts-expect-error governed runtime removes lineage commitAsync
governed.commitAsync;
// @ts-expect-error governed runtime removes lineage commitAsyncWithReport
governed.commitAsyncWithReport;
// @ts-expect-error governed runtime removes v3 proposal write verb
governed.proposeAsync;
// @ts-expect-error governed runtime removes raw intent creation from app-facing root
governed.createIntent;
// @ts-expect-error governed runtime removes MEL refs from app-facing root
governed.MEL;
// @ts-expect-error governed runtime removes v3 legality helper from app-facing root
governed.isIntentDispatchable;
// @ts-expect-error governed runtime removes v3 blocker helper from app-facing root
governed.getIntentBlockers;
// @ts-expect-error governed runtime does not introduce proposeAsyncWithReport
governed.proposeAsyncWithReport;

const foreignGoverned = withGovernance<ForeignDomain>(
  withLineage<ForeignDomain>(
    createManifesto<ForeignDomain>(createForeignSchema(), {}),
    { store: createInMemoryLineageStore() },
  ),
  {
    governanceStore: createInMemoryGovernanceStore(),
    bindings: [],
    execution: {
      projectionId: "proj:foreign-runtime",
      deriveActor: () => ({ actorId: "actor:foreign", kind: "agent" as const }),
      deriveSource: () => ({ kind: "agent" as const, eventId: "evt:foreign-runtime" }),
    },
  },
).activate();

const foreignSubmit: Promise<GovernanceSubmissionResult<ForeignDomain, "toggle">> =
  foreignGoverned.actions.toggle.submit();
void foreignSubmit;

async function checkSettlementNarrowing() {
  const settlement = await waitForProposal(governed, "proposal-2");
  const report = await waitForProposalWithReport(governed, "proposal-3");

  if (settlement.kind === "completed") {
    const count: number = settlement.snapshot.state.count;
    const worldId: string = settlement.resultWorld;
    void count;
    void worldId;
  }

  if (settlement.kind === "failed") {
    const summary: string = settlement.error.summary;
    void summary;
    if (settlement.resultWorld) {
      const worldId: string = settlement.resultWorld;
      void worldId;
    }
  }

  if (report.kind === "completed") {
    const count: number = report.outcome.projected.afterSnapshot.state.count;
    const worldId: string = report.resultWorld;
    void count;
    void worldId;
  }

  if (report.kind === "failed") {
    const summary: string = report.error.summary;
    void summary;
    if (report.sealedOutcome) {
      const count: number = report.sealedOutcome.projected.afterSnapshot.state.count;
      void count;
    }
  }
}

void checkSettlementNarrowing();

export {};
