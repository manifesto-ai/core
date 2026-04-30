import type {
  ActionArgs,
  ActionName,
  LineageSubmissionResult,
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
} from "../../index.ts";

function submitBound<
  T extends ManifestoDomainShape,
  K extends ActionName<T>,
>(
  app: ManifestoApp<T, "lineage">,
  action: K,
  ...intentArgs: ActionArgs<T, K>
): Promise<LineageSubmissionResult<T, K>> {
  const bound = app.action(action).bind(...intentArgs);
  const admission = bound.check();
  if (admission.ok) {
    void bound.preview();
  }
  return bound.submit();
}

const lineage = withLineage<CounterDomain>(
  createManifesto<CounterDomain>(createCounterSchema(), {}),
  { store: createInMemoryLineageStore() },
).activate();

const appRuntime: ManifestoApp<CounterDomain, "lineage"> = lineage;
const committedIncrement: Promise<LineageSubmissionResult<CounterDomain, "increment">> =
  submitBound(lineage, "increment");
const committedAdd: Promise<LineageSubmissionResult<CounterDomain, "add">> =
  submitBound(lineage, "add", 1);

void appRuntime;
void committedIncrement;
void committedAdd;

// @ts-expect-error lineage execution helpers must not assume base dispatch
appRuntime.dispatchAsync;

// @ts-expect-error lineage helpers must not assume v3 commit verbs
appRuntime.commitAsync;

export {};
