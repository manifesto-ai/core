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

// @ts-expect-error governance requires an explicitly lineage-composed manifesto
withGovernance(base, {
  bindings: [createAutoBinding()],
  execution: createExecutionConfig("acts-types-missing-lineage"),
});

// @ts-expect-error withLineage requires either a store or a service
withLineage(base, {});

const explicitLineage = withLineage(base, {
  store: createInMemoryLineageStore(),
});

const governed = withGovernance(explicitLineage, {
  bindings: [createAutoBinding()],
  execution: createExecutionConfig("acts-types-explicit-lineage"),
});

// @ts-expect-error governed composables cannot be downgraded back into lineage composables
withLineage(governed, {
  store: createInMemoryLineageStore(),
});

void governed.activate();

export {};
