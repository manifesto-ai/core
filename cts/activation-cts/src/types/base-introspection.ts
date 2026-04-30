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
const schemaHash: string = app.inspect.schemaHash();
const canonicalSchemaHash: string = app.inspect.canonicalSnapshot().meta.schemaHash;

const actionName: string = app.actions.increment.info().name;
const preview: PreviewResult<CounterDomain, string> =
  app.actions.increment.preview();
const changedPaths: readonly string[] = preview.admitted ? preview.changes : [];
const reportPromise: Promise<BaseSubmissionResult<CounterDomain, string>> =
  app.actions.increment.submit();
const unsubscribeState = app.observe.state(
  (snapshot) => snapshot.state.count,
  (next, prev) => {
    const nextCount: number = next;
    const previousCount: number = prev;
    void nextCount;
    void previousCount;
  },
);
const unsubscribeEvent = app.observe.event("submission:settled", (payload) => {
  const payloadAction: string = payload.action;
  const payloadSchemaHash: string = payload.schemaHash;
  // @ts-expect-error observe.event payloads do not embed projected snapshots
  payload.snapshot;
  // @ts-expect-error observe.event payloads do not embed canonical snapshots
  payload.canonicalSnapshot;
  void payloadAction;
  void payloadSchemaHash;
});

void actionName;
void schemaHash;
void canonicalSchemaHash;
void changedPaths;
void reportPromise;
void unsubscribeState;
void unsubscribeEvent;

// @ts-expect-error v5 root no longer exposes MEL refs
app.MEL;
// @ts-expect-error v5 root no longer exposes v3 schema graph getter
app.getSchemaGraph();
// @ts-expect-error v5 root no longer exposes v3 dispatch report verb
app.dispatchAsyncWithReport;
// @ts-expect-error legacy dispatch event names are not canonical v5 observe events
app.observe.event("dispatch:completed", () => {});

export {};
