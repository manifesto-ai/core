import type {
  ActionArgs,
  ActionName,
  GovernanceSubmissionResult,
  ManifestoApp,
  ManifestoDomainShape,
} from "../../../../sdk/src/index.ts";
import { createManifesto } from "../../../../sdk/src/index.ts";
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
  withGovernance,
} from "../../index.ts";

function submitGoverned<
  T extends ManifestoDomainShape,
  K extends ActionName<T>,
>(
  runtime: ManifestoApp<T, "governance">,
  action: K,
  ...args: ActionArgs<T, K>
): Promise<GovernanceSubmissionResult<T, K>> {
  return runtime.action(action).bind(...args).submit();
}

const governed = withGovernance<CounterDomain>(
  withLineage<CounterDomain>(
    createManifesto<CounterDomain>(createCounterSchema(), {}),
    { store: createInMemoryLineageStore() },
  ),
  {
    governanceStore: createInMemoryGovernanceStore(),
    bindings: [],
    execution: {
      projectionId: "proj:helper-boundary",
      deriveActor: () => ({ actorId: "actor:auto", kind: "agent" as const }),
      deriveSource: () => ({ kind: "agent" as const, eventId: "evt:helper-boundary" }),
    },
  },
).activate();

const governedApp: ManifestoApp<CounterDomain, "governance"> = governed;
const proposedIncrement: Promise<GovernanceSubmissionResult<CounterDomain, "increment">> =
  submitGoverned(governed, "increment");

void governedApp;
void proposedIncrement;

// @ts-expect-error governed execution helpers must not assume lineage commit
governed.commitAsync;
// @ts-expect-error governed execution helpers must not assume base dispatch
governed.dispatchAsync;
// @ts-expect-error governed execution helpers must not assume v3 proposal writes
governed.proposeAsync;
// @ts-expect-error governed helpers use v5 action candidates instead of MEL refs
governed.MEL;

export {};
