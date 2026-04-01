import {
  createInMemoryGovernanceStore,
  withGovernance,
} from "@manifesto-ai/governance";
import {
  createInMemoryLineageStore,
  withLineage,
} from "@manifesto-ai/lineage";
import { createManifesto } from "@manifesto-ai/sdk";
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

void lineage.commitAsync(
  lineage.createIntent(lineage.MEL.actions.increment),
);

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
// @ts-expect-error governed runtime removes lineage commitAsync
governed.commitAsync;

void governed.proposeAsync(
  governed.createIntent(governed.MEL.actions.increment),
);
void governed.getLatestHead();

export {};
