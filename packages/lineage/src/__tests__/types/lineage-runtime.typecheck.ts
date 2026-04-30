import type {
  Blocker,
  CanonicalSnapshot,
  LineageSubmissionResult,
  ManifestoApp,
  SubmitResultFor,
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

const lineage = withLineage<CounterDomain>(
  createManifesto<CounterDomain>(createCounterSchema(), {}),
  { store: createInMemoryLineageStore() },
).activate();

const app: ManifestoApp<CounterDomain, "lineage"> = lineage;
const submitResult: Promise<LineageSubmissionResult<CounterDomain, "increment">> =
  lineage.actions.increment.submit();
const submitResultFor: Promise<SubmitResultFor<"lineage", CounterDomain, "increment">> =
  lineage.action("increment").submit();
const boundSubmitResult: Promise<LineageSubmissionResult<CounterDomain, "increment">> =
  lineage.actions.increment.bind().submit();
const lineageWorldSnapshot: Promise<CanonicalSnapshot<CounterDomain["state"]> | null> =
  lineage.getWorldSnapshot("world-1");
const lineageAdmission = lineage.actions.increment.check();
const lineageDispatchable: boolean = lineageAdmission.ok;
const lineageBlockers: readonly Blocker[] = lineageAdmission.ok
  ? []
  : lineageAdmission.blockers;

void app;
void submitResult;
void submitResultFor;
void boundSubmitResult;
void lineageWorldSnapshot;
void lineageAdmission;
void lineageDispatchable;
void lineageBlockers;

// @ts-expect-error lineage runtime does not expose governance settlement helpers
app.waitForSettlement("proposal-1");

// @ts-expect-error lineage runtime removes base dispatchAsync after verb promotion
lineage.dispatchAsync;

// @ts-expect-error lineage runtime removes base dispatchAsyncWithReport after verb promotion
lineage.dispatchAsyncWithReport;

// @ts-expect-error lineage runtime removes v3 commitAsync after v5 submit promotion
lineage.commitAsync;

// @ts-expect-error lineage runtime removes v3 commitAsyncWithReport after v5 submit promotion
lineage.commitAsyncWithReport;

export {};
