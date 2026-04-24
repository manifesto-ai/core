import type {
  CreateIntentArgs,
  ManifestoDomainShape,
  ManifestoLegalityRuntime,
  Snapshot,
  TypedActionRef,
  TypedIntent,
} from "../../../../sdk/src/index.ts";
import { createManifesto } from "../../../../sdk/src/index.ts";
import {
  createCounterSchema,
  type CounterDomain,
} from "../../../../sdk/src/__tests__/helpers/schema.ts";
import {
  type LineageCommitRuntime,
  createInMemoryLineageStore,
  withLineage,
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

function commitPrepared<
  T extends ManifestoDomainShape,
  K extends keyof T["actions"],
>(
  prep: ManifestoLegalityRuntime<T>,
  write: LineageCommitRuntime<T>,
  action: TypedActionRef<T, K>,
  ...intentArgs: CreateIntentArgs<T, K>
): Promise<Snapshot<T["state"]>> {
  return write.commitAsync(prepareIntent(prep, action, ...intentArgs));
}

const lineage = withLineage<CounterDomain>(
  createManifesto<CounterDomain>(createCounterSchema(), {}),
  { store: createInMemoryLineageStore() },
).activate();

const legalityRuntime: ManifestoLegalityRuntime<CounterDomain> = lineage;
const commitRuntime: LineageCommitRuntime<CounterDomain> = lineage;
const preparedIncrement: TypedIntent<CounterDomain, "increment"> = prepareIntent(
  lineage,
  lineage.MEL.actions.increment,
);
const committedIncrement: Promise<Snapshot<CounterDomain["state"]>> = commitPrepared(
  lineage,
  lineage,
  lineage.MEL.actions.increment,
);
void legalityRuntime;
void commitRuntime;
void preparedIncrement;
void committedIncrement;

// @ts-expect-error lineage execution helpers must not assume base dispatch
commitRuntime.dispatchAsync(preparedIncrement);

export {};
