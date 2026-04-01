import { withGovernance } from "@manifesto-ai/governance";
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

const base = createManifesto<CounterDomain>(createCounterSchema(), {});

// @ts-expect-error governance requires lineage config when lineage is not already composed
withGovernance(base, {
  bindings: [createAutoBinding()],
  execution: createExecutionConfig("acts-types-missing-lineage"),
});

const explicitLineage = withLineage(base, {
  store: createInMemoryLineageStore(),
});

const governed = withGovernance(explicitLineage, {
  bindings: [createAutoBinding()],
  execution: createExecutionConfig("acts-types-explicit-lineage"),
});

void governed.activate();

export {};
