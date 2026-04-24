import type {
  CreateIntentArgs,
  ManifestoDomainShape,
  ManifestoLegalityRuntime,
  TypedActionRef,
  TypedIntent,
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
  type GovernanceProposalRuntime,
  type Proposal,
  withGovernance,
} from "../../index.ts";

function prepareIntent<
  T extends ManifestoDomainShape,
  K extends keyof T["actions"],
>(
  runtime: ManifestoLegalityRuntime<T>,
  action: TypedActionRef<T, K>,
  ...intentArgs: CreateIntentArgs<T, K>
): TypedIntent<T, K> {
  const intent = runtime.createIntent(action, ...intentArgs);
  const blockers = runtime.whyNot(intent);
  if (blockers === null) {
    void runtime.simulateIntent(intent);
  }
  return intent;
}

function proposePrepared<
  T extends ManifestoDomainShape,
  K extends keyof T["actions"],
>(
  prep: ManifestoLegalityRuntime<T>,
  write: GovernanceProposalRuntime<T>,
  action: TypedActionRef<T, K>,
  ...intentArgs: CreateIntentArgs<T, K>
): Promise<Proposal> {
  return write.proposeAsync(prepareIntent(prep, action, ...intentArgs));
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

const legalityRuntime: ManifestoLegalityRuntime<CounterDomain> = governed;
const proposalRuntime: GovernanceProposalRuntime<CounterDomain> = governed;
const preparedIncrement: TypedIntent<CounterDomain, "increment"> = prepareIntent(
  governed,
  governed.MEL.actions.increment,
);
const proposedIncrement: Promise<Proposal> = proposePrepared(
  governed,
  governed,
  governed.MEL.actions.increment,
);
void legalityRuntime;
void proposalRuntime;
void preparedIncrement;
void proposedIncrement;

// @ts-expect-error governed execution helpers must not assume lineage commit
proposalRuntime.commitAsync(preparedIncrement);
// @ts-expect-error governed execution helpers must not assume base dispatch
proposalRuntime.dispatchAsync(preparedIncrement);

export {};
