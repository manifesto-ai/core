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

const increment: ActionHandle<CounterDomain, "increment", "base"> =
  app.actions.increment;
const incrementByName = app.action("increment");
const boundIncrement: BoundAction<CounterDomain, "increment", "base"> =
  increment.bind();
const rawIntent: Intent | null = boundIncrement.intent();
const admission: Admission<"increment"> = boundIncrement.check();
const preview: PreviewResult<CounterDomain, "increment"> =
  boundIncrement.preview({ __kind: "PreviewOptions", diagnostics: "summary" });
const submitted: Promise<BaseSubmissionResult<CounterDomain, "increment">> =
  boundIncrement.submit({ __kind: "SubmitOptions", report: "summary" });

const add = app.actions.add;
const boundAdd = add.bind(3);
const addInput: number = boundAdd.input;
const addSubmitted: Promise<BaseSubmissionResult<CounterDomain, "add">> =
  add.submit(3);

void incrementByName;
void rawIntent;
void admission;
void preview;
void submitted;
void addInput;
void addSubmitted;

// @ts-expect-error action() only accepts domain action names
app.action("missing");
// @ts-expect-error typed action args reject wrong argument types
app.actions.add.submit("wrong");
// @ts-expect-error v5 root no longer exposes createIntent
app.createIntent;
// @ts-expect-error v5 root no longer exposes dispatchAsync
app.dispatchAsync;

export {};
