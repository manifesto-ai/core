import type { Intent } from "@manifesto-ai/core";
import type {
  CanonicalSnapshot,
  DispatchBlocker,
} from "../../../../sdk/src/index.ts";

import { createManifesto } from "../../../../sdk/src/index.ts";
import {
  createForeignSchema,
  type ForeignDomain,
} from "../../../../sdk/src/__tests__/helpers/foreign-schema.ts";
import {
  createCounterSchema,
  type CounterDomain,
} from "../../../../sdk/src/__tests__/helpers/schema.ts";
import {
  type CommitReport,
  createInMemoryLineageStore,
  withLineage,
} from "../../index.ts";

const lineage = withLineage<CounterDomain>(
  createManifesto<CounterDomain>(createCounterSchema(), {}),
  { store: createInMemoryLineageStore() },
).activate();

void lineage.commitAsync(
  lineage.createIntent(lineage.MEL.actions.increment),
);
const lineageReport: Promise<CommitReport<CounterDomain>> = lineage.commitAsyncWithReport(
  lineage.createIntent(lineage.MEL.actions.increment),
);
const lineageWorldSnapshot: Promise<CanonicalSnapshot<CounterDomain["state"]> | null> = lineage.getWorldSnapshot("world-1");
const lineageDispatchable: boolean = lineage.isIntentDispatchable(lineage.MEL.actions.increment);
const lineageBlockers: readonly DispatchBlocker[] = lineage.getIntentBlockers(lineage.MEL.actions.increment);
void lineageWorldSnapshot;
void lineageDispatchable;
void lineageBlockers;
void lineageReport;

// @ts-expect-error lineage runtime removes dispatchAsync after verb promotion
lineage.dispatchAsync(
  lineage.createIntent(lineage.MEL.actions.increment),
);
// @ts-expect-error lineage runtime removes base dispatchAsyncWithReport after verb promotion
lineage.dispatchAsyncWithReport(
  lineage.createIntent(lineage.MEL.actions.increment),
);

const rawIntent: Intent = {
  type: "increment",
  intentId: "raw-intent",
};

// @ts-expect-error commitAsync only accepts typed intents created for this domain
void lineage.commitAsync(rawIntent);
// @ts-expect-error commitAsyncWithReport only accepts typed intents created for this domain
void lineage.commitAsyncWithReport(rawIntent);

const foreignLineage = withLineage<ForeignDomain>(
  createManifesto<ForeignDomain>(createForeignSchema(), {}),
  { store: createInMemoryLineageStore() },
).activate();

const foreignIntent = foreignLineage.createIntent(foreignLineage.MEL.actions.toggle);

// @ts-expect-error commitAsync rejects intents branded for a different domain
void lineage.commitAsync(foreignIntent);
// @ts-expect-error commitAsyncWithReport rejects intents branded for a different domain
void lineage.commitAsyncWithReport(foreignIntent);

export {};
