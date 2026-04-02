import type { Intent } from "@manifesto-ai/core";

import { createManifesto } from "../../index.ts";
import { createForeignSchema, type ForeignDomain } from "../helpers/foreign-schema.ts";
import { createCounterSchema, type CounterDomain } from "../helpers/schema.ts";

const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
const typedIntent = world.createIntent(world.MEL.actions.increment);

void world.dispatchAsync(typedIntent);

const rawIntent: Intent = {
  type: "increment",
  intentId: "raw-intent",
};

// @ts-expect-error dispatchAsync only accepts typed intents created for this domain
void world.dispatchAsync(rawIntent);

const foreign = createManifesto<ForeignDomain>(createForeignSchema(), {}).activate();
const foreignIntent = foreign.createIntent(foreign.MEL.actions.toggle);

// @ts-expect-error dispatchAsync rejects intents branded for a different domain
void world.dispatchAsync(foreignIntent);

export {};
