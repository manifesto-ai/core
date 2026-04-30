import { createManifesto } from "../../index.ts";
import {
  createCounterSchema,
  type CounterDomain,
} from "../helpers/schema.ts";

const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

const graph = app.inspect.graph();
const incrementInfo = app.inspect.action("increment");
const actionName: "increment" = incrementInfo.name;
const availableActions = app.inspect.availableActions();
const schemaHash: string = app.inspect.schemaHash();
const canonical = app.inspect.canonicalSnapshot();
const snapshot = app.snapshot();
const unsubscribeState = app.observe.state(
  (nextSnapshot) => nextSnapshot.state.count,
  (next, prev) => {
    const nextCount: number = next;
    const previousCount: number = prev;
    void nextCount;
    void previousCount;
  },
);
const unsubscribeEvent = app.observe.event("submission:settled", (payload) => {
  const actionNameFromPayload: string = payload.action;
  const mode: "base" | "lineage" | "governance" = payload.mode;
  const schemaHashFromPayload: string = payload.schemaHash;
  // @ts-expect-error observe.event payloads do not embed projected snapshots
  payload.snapshot;
  // @ts-expect-error observe.event payloads do not embed canonical snapshots
  payload.canonicalSnapshot;
  void actionNameFromPayload;
  void mode;
  void schemaHashFromPayload;
});
const preview = app.actions.increment.preview();
const changedPaths: readonly string[] = preview.admitted ? preview.changes : [];

void graph.traceUp("state:count");
void availableActions;
void actionName;
void schemaHash;
void canonical.namespaces;
void snapshot.state.count;
void unsubscribeState;
void unsubscribeEvent;
void changedPaths;

// @ts-expect-error canonical substrate reads are inspect-only in the v5 root
app.getCanonicalSnapshot();
// @ts-expect-error schema graph reads are inspect-only in the v5 root
app.getSchemaGraph();
// @ts-expect-error legacy dispatch event names are not canonical v5 observe events
app.observe.event("dispatch:completed", () => {});

export {};
