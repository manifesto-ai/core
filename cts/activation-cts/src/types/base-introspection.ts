import {
  createManifesto,
  type BaseSubmissionResult,
  type PreviewResult,
} from "@manifesto-ai/sdk";
import {
  createCounterSchema,
  type CounterDomain,
} from "../helpers/schema.js";

const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

const graph = app.inspect.graph();
void graph.traceUp("state:count");

const actionName: string = app.actions.increment.info().name;
const preview: PreviewResult<CounterDomain, string> =
  app.actions.increment.preview();
const changedPaths: readonly string[] = preview.admitted ? preview.changes : [];
const reportPromise: Promise<BaseSubmissionResult<CounterDomain, string>> =
  app.actions.increment.submit();

void actionName;
void changedPaths;
void reportPromise;

// @ts-expect-error v5 root no longer exposes MEL refs
app.MEL;
// @ts-expect-error v5 root no longer exposes v3 schema graph getter
app.getSchemaGraph();
// @ts-expect-error v5 root no longer exposes v3 dispatch report verb
app.dispatchAsyncWithReport;

export {};
