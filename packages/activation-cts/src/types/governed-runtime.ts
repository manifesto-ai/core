import {
  createInMemoryGovernanceStore,
  withGovernance,
} from "@manifesto-ai/governance";
import { createInMemoryLineageStore } from "@manifesto-ai/lineage";
import { createManifesto } from "@manifesto-ai/sdk";
import {
  createAutoBinding,
  createCounterSchema,
  createExecutionConfig,
  type CounterDomain,
} from "../helpers/schema.js";

const governed = withGovernance(
  createManifesto<CounterDomain>(createCounterSchema(), {}),
  {
    lineage: { store: createInMemoryLineageStore() },
    governanceStore: createInMemoryGovernanceStore(),
    bindings: [createAutoBinding()],
    execution: createExecutionConfig("acts-types-governed"),
  },
).activate();

// @ts-expect-error governed runtime removes direct dispatchAsync
governed.dispatchAsync;

void governed.proposeAsync(
  governed.createIntent(governed.MEL.actions.increment),
);
void governed.getLatestHead();

export {};
