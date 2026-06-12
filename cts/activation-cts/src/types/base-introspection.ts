import { createManifesto, type BaseSubmissionResult, type PreviewResult } from "@manifesto-ai/sdk";
import { createCounterSchema, type CounterDomain } from "../helpers/schema.js";

const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

const graph = app.inspect.graph();
void graph.traceUp("state:count");
const schemaHash: string = app.inspect.schemaHash();
const canonicalSchemaHash: string = app.inspect.canonicalSnapshot().meta.schemaHash;

const actionName: string = app.action.increment.info().name;
const preview: PreviewResult<CounterDomain, "increment"> = app.action.increment.preview();
const changedPaths: readonly {
  readonly path: readonly (string | number)[];
  readonly kind: "set" | "unset" | "changed";
}[] = preview.admitted ? preview.changes : [];
const reportPromise: Promise<BaseSubmissionResult<CounterDomain, "increment">> =
  app.action.increment.submit();
const scalarBound = app.action.add.bind(1);
const scalarInput: number = scalarBound.input;
// @ts-expect-error scalar positional actions do not accept canonical object-valued submit input
app.action.add.submit({ amount: 1 });
// @ts-expect-error scalar positional actions do not accept canonical object-valued bind input
app.action.add.bind({ amount: 1 });
const objectBound = app.action.replace.bind({ count: 2 });
const objectInput: { readonly count: number } = objectBound.input;
// @ts-expect-error object-shaped actions require object input
app.action.replace.submit(2);
// @ts-expect-error object-shaped actions require object input
app.action.replace.bind(2);
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
void scalarInput;
void objectInput;
void unsubscribeState;
void unsubscribeEvent;

// @ts-expect-error v5 root no longer exposes MEL refs
app.MEL;
// @ts-expect-error v5 root no longer exposes actions.*
app.actions;
// @ts-expect-error v5 root no longer exposes action(name)
app.action("increment");
// @ts-expect-error v5 root no longer exposes v3 schema graph getter
app.getSchemaGraph();
// @ts-expect-error v5 root no longer exposes v3 dispatch report verb
app.dispatchAsyncWithReport;
// @ts-expect-error legacy dispatch event names are not canonical v5 observe events
app.observe.event("dispatch:completed", () => {});

export {};
