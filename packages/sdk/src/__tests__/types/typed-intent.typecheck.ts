import type { Intent } from "@manifesto-ai/core";

import { createManifesto } from "../../index.ts";
import type {
  ActionHandle,
  Admission,
  BaseSubmissionResult,
  BoundAction,
  PreviewResult,
} from "../../index.ts";
import { createCounterSchema, type CounterDomain } from "../helpers/schema.ts";

const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

const increment: ActionHandle<CounterDomain, "increment", "base"> = app.action.increment;
const boundIncrement: BoundAction<CounterDomain, "increment", "base"> = increment.bind();
const rawIntent: Intent | null = boundIncrement.intent();
const admission: Admission<"increment"> = boundIncrement.check();
const preview: PreviewResult<CounterDomain, "increment"> = app
  .with({ diagnostics: "summary" })
  .action.increment.bind()
  .preview();
const submitted: Promise<BaseSubmissionResult<CounterDomain, "increment">> = app
  .with({ report: "summary" })
  .action.increment.bind()
  .submit();

const add = app.action.add;
const boundAdd = add.bind(3);
const addInput: number = boundAdd.input;
const addSubmitted: Promise<BaseSubmissionResult<CounterDomain, "add">> = add.submit(3);

void rawIntent;
void admission;
void preview;
void submitted;
void addInput;
void addSubmitted;

// @ts-expect-error action is a static namespace, not a callable dynamic accessor
app.action("missing");
// @ts-expect-error typed action args reject wrong argument types
app.action.add.submit("wrong");
// @ts-expect-error v5 root no longer exposes createIntent
app.createIntent;
// @ts-expect-error v5 root no longer exposes dispatchAsync
app.dispatchAsync;

export {};
