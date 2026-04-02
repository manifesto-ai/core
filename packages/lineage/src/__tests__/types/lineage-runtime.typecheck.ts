import type { Intent } from "@manifesto-ai/core";
import type { Snapshot } from "../../../../sdk/src/index.ts";

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
const lineageWorldSnapshot: Promise<Snapshot<CounterDomain["state"]> | null> = lineage.getWorldSnapshot("world-1");
void lineageWorldSnapshot;

// @ts-expect-error lineage runtime removes dispatchAsync after verb promotion
lineage.dispatchAsync(
  lineage.createIntent(lineage.MEL.actions.increment),
);

const rawIntent: Intent = {
  type: "increment",
  intentId: "raw-intent",
};

// @ts-expect-error commitAsync only accepts typed intents created for this domain
void lineage.commitAsync(rawIntent);

const foreignLineage = withLineage<ForeignDomain>(
  createManifesto<ForeignDomain>(createForeignSchema(), {}),
  { store: createInMemoryLineageStore() },
).activate();

const foreignIntent = foreignLineage.createIntent(foreignLineage.MEL.actions.toggle);

// @ts-expect-error commitAsync rejects intents branded for a different domain
void lineage.commitAsync(foreignIntent);

export {};
