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
  createInMemoryLineageStore,
  withLineage,
} from "../../../../lineage/src/index.ts";
import {
  createInMemoryGovernanceStore,
  type ProposalSettlement,
  waitForProposal,
  withGovernance,
} from "../../index.ts";

const base = createManifesto<CounterDomain>(createCounterSchema(), {});

// @ts-expect-error governance requires an explicitly lineage-composed manifesto
withGovernance(base, {
  bindings: [],
  execution: {
    projectionId: "proj:missing-lineage",
    deriveActor: () => ({ actorId: "actor:auto", kind: "agent" as const }),
    deriveSource: () => ({ kind: "agent" as const, eventId: "evt:missing-lineage" }),
  },
});

const governed = withGovernance<CounterDomain>(
  withLineage<CounterDomain>(base, {
    store: createInMemoryLineageStore(),
  }),
  {
    governanceStore: createInMemoryGovernanceStore(),
    bindings: [],
    execution: {
      projectionId: "proj:governed-runtime",
      deriveActor: () => ({ actorId: "actor:auto", kind: "agent" as const }),
      deriveSource: () => ({ kind: "agent" as const, eventId: "evt:governed-runtime" }),
    },
  },
).activate();

void governed.proposeAsync(
  governed.createIntent(governed.MEL.actions.increment),
);
const governedWorldSnapshot: Promise<CanonicalSnapshot<CounterDomain["state"]> | null> = governed.getWorldSnapshot("world-1");
const governedDispatchable: boolean = governed.isIntentDispatchable(governed.MEL.actions.increment);
const governedBlockers: readonly DispatchBlocker[] = governed.getIntentBlockers(governed.MEL.actions.increment);
void governedWorldSnapshot;
void governedDispatchable;
void governedBlockers;
void governed.getLatestHead();
void governed.getBranches();
const governedSettlement: Promise<ProposalSettlement<CounterDomain>> = waitForProposal(
  governed,
  "proposal-1",
);
void governedSettlement;

// @ts-expect-error governed runtime removes base dispatchAsync
governed.dispatchAsync(
  governed.createIntent(governed.MEL.actions.increment),
);

// @ts-expect-error governed runtime removes lineage commitAsync
governed.commitAsync(
  governed.createIntent(governed.MEL.actions.increment),
);

const rawIntent: Intent = {
  type: "increment",
  intentId: "raw-intent",
};

// @ts-expect-error proposeAsync only accepts typed intents created for this domain
void governed.proposeAsync(rawIntent);

const foreignGoverned = withGovernance<ForeignDomain>(
  withLineage<ForeignDomain>(
    createManifesto<ForeignDomain>(createForeignSchema(), {}),
    { store: createInMemoryLineageStore() },
  ),
  {
    governanceStore: createInMemoryGovernanceStore(),
    bindings: [],
    execution: {
      projectionId: "proj:foreign-runtime",
      deriveActor: () => ({ actorId: "actor:foreign", kind: "agent" as const }),
      deriveSource: () => ({ kind: "agent" as const, eventId: "evt:foreign-runtime" }),
    },
  },
).activate();

const foreignIntent = foreignGoverned.createIntent(foreignGoverned.MEL.actions.toggle);

// @ts-expect-error proposeAsync rejects intents branded for a different domain
void governed.proposeAsync(foreignIntent);

async function checkSettlementNarrowing() {
  const settlement = await waitForProposal(governed, "proposal-2");

  if (settlement.kind === "completed") {
    const count: number = settlement.snapshot.data.count;
    const worldId: string = settlement.resultWorld;
    void count;
    void worldId;
  }

  if (settlement.kind === "failed") {
    const summary: string = settlement.error.summary;
    void summary;
    if (settlement.resultWorld) {
      const worldId: string = settlement.resultWorld;
      void worldId;
    }
  }
}

void checkSettlementNarrowing();

export {};
