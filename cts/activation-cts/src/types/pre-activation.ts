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

const base = createManifesto<CounterDomain>(createCounterSchema(), {});

// @ts-expect-error base composable has no runtime verbs before activation
base.dispatchAsync;
// @ts-expect-error base composable has no snapshot reads before activation
base.getSnapshot;
// @ts-expect-error base composable has no subscriptions before activation
base.subscribe;

const lineage = withLineage(base, { store: createInMemoryLineageStore() });

// @ts-expect-error lineage composable still has no runtime verbs before activation
lineage.commitAsync;
// @ts-expect-error lineage composable still has no snapshot reads before activation
lineage.getSnapshot;
// @ts-expect-error lineage composable still has no subscriptions before activation
lineage.subscribe;

const governedComposable = withGovernance(lineage, {
  governanceStore: createInMemoryGovernanceStore(),
  bindings: [createAutoBinding()],
  execution: createExecutionConfig("acts-types-pre"),
});

// @ts-expect-error governance composable has no proposeAsync before activation
governedComposable.proposeAsync;
// @ts-expect-error governance composable has no snapshot reads before activation
governedComposable.getSnapshot;

export {};
