import type {
  LineageSubmissionResult,
  ManifestoApp,
  SubmitResultFor,
  WorldRecord,
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

const actionSubmit: Promise<SubmitResultFor<"lineage", CounterDomain, "increment">> =
  app.actions.increment.submit();
const collisionSafeSubmit: Promise<LineageSubmissionResult<CounterDomain, "increment">> =
  app.action("increment").submit();
const boundSubmit: Promise<LineageSubmissionResult<CounterDomain, "increment">> =
  app.actions.increment.bind().submit();

async function readLineageResult(): Promise<void> {
  const result = await actionSubmit;

  if (result.ok) {
    const world: WorldRecord = result.world;
    const mode: "lineage" = result.mode;
    const status: "settled" = result.status;
    const action: "increment" = result.action;
    const count: number = result.after.state.count;

    void world;
    void mode;
    void status;
    void action;
    void count;
    return;
  }

  const mode: "lineage" = result.mode;
  const action: "increment" = result.action;
  const code: "ACTION_UNAVAILABLE" | "INVALID_INPUT" | "INTENT_NOT_DISPATCHABLE" =
    result.admission.code;

  void mode;
  void action;
  void code;
}

void collisionSafeSubmit;
void boundSubmit;
void readLineageResult;

// @ts-expect-error canonical v5 lineage app exposes no governance settlement helper
app.waitForSettlement("proposal:1");

// @ts-expect-error canonical v5 lineage app exposes no root base dispatch verb
app.dispatchAsync;

// @ts-expect-error canonical v5 lineage app exposes no root base report verb
app.dispatchAsyncWithReport;

// @ts-expect-error canonical v5 lineage app exposes no root v3 lineage commit verb
app.commitAsync;

// @ts-expect-error canonical v5 lineage app exposes no root v3 lineage report verb
app.commitAsyncWithReport;

export {};
