import {
  createInMemoryGovernanceStore,
  withGovernance,
} from "@manifesto-ai/governance";
import {
  createInMemoryLineageStore,
  withLineage,
} from "@manifesto-ai/lineage";
import {
  type GovernanceSubmissionResult,
  type LineageSubmissionResult,
  type ManifestoApp,
  type ProposalRef,
  type SubmitResultFor,
  createManifesto,
} from "@manifesto-ai/sdk";
import {
  createAutoBinding,
  createCounterSchema,
  createExecutionConfig,
  type CounterDomain,
} from "../helpers/schema.js";

const lineage = withLineage(
  createManifesto<CounterDomain>(createCounterSchema(), {}),
  { store: createInMemoryLineageStore() },
).activate();

// @ts-expect-error lineage runtime removes direct dispatchAsync
lineage.dispatchAsync;
// @ts-expect-error lineage runtime removes direct dispatchAsyncWithReport
lineage.dispatchAsyncWithReport;
// @ts-expect-error lineage runtime removes v3 commitAsync
lineage.commitAsync;
// @ts-expect-error lineage runtime removes v3 commitAsyncWithReport
lineage.commitAsyncWithReport;

const lineageSubmit: Promise<LineageSubmissionResult<CounterDomain, string>> =
  lineage.actions.increment.submit();
const lineageSubmitFor: Promise<SubmitResultFor<"lineage", CounterDomain, string>> =
  lineage.action("increment").submit();
void lineageSubmit;
void lineageSubmitFor;

const lineageApp: ManifestoApp<CounterDomain, "lineage"> = lineage;
// @ts-expect-error lineage app does not expose governance settlement re-attachment
lineageApp.waitForSettlement("prop-example");

const baseApp: ManifestoApp<CounterDomain, "base"> =
  createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
// @ts-expect-error base app does not expose governance settlement re-attachment
baseApp.waitForSettlement("prop-example");

const governed = withGovernance(
  withLineage(
    createManifesto<CounterDomain>(createCounterSchema(), {}),
    { store: createInMemoryLineageStore() },
  ),
  {
    governanceStore: createInMemoryGovernanceStore(),
    bindings: [createAutoBinding()],
    execution: createExecutionConfig("acts-types-governed"),
  },
).activate();

// @ts-expect-error governed runtime removes direct dispatchAsync
governed.dispatchAsync;
// @ts-expect-error governed runtime removes direct dispatchAsyncWithReport
governed.dispatchAsyncWithReport;
// @ts-expect-error governed runtime removes lineage commitAsync
governed.commitAsync;
// @ts-expect-error governed runtime removes lineage commitAsyncWithReport
governed.commitAsyncWithReport;
// @ts-expect-error governed v5 surface does not expose raw intent creation as an app-facing helper
governed.createIntent;
// @ts-expect-error governed v5 surface does not expose MEL as an app-facing helper
governed.MEL;
// @ts-expect-error governed v5 surface does not expose legacy simulation helpers
governed.simulateIntent;
// @ts-expect-error governed v5 surface removes v3 proposal write verb
governed.proposeAsync;
// @ts-expect-error governed v5 surface does not expose root waitForProposal helper
governed.waitForProposal;
// @ts-expect-error governed v5 surface does not expose root waitForProposalWithReport helper
governed.waitForProposalWithReport;

const governedApp: ManifestoApp<CounterDomain, "governance"> = governed;
const proposalRef = "prop-example" as ProposalRef;
void governed.waitForSettlement(proposalRef);
void governedApp.waitForSettlement(proposalRef);
void governed.getLatestHead();

const governanceSubmit: Promise<GovernanceSubmissionResult<CounterDomain, string>> =
  governed.actions.increment.submit();
const governanceSubmitFor: Promise<SubmitResultFor<"governance", CounterDomain, string>> =
  governed.action("increment").submit();
void governanceSubmit;
void governanceSubmitFor;

export {};
