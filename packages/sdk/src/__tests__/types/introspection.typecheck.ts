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
const preview = app.actions.increment.preview();
const changedPaths: readonly string[] = preview.admitted ? preview.changes : [];

void graph.traceUp("state:count");
void availableActions;
void actionName;
void schemaHash;
void canonical.namespaces;
void snapshot.state.count;
void changedPaths;

// @ts-expect-error canonical substrate reads are inspect-only in the v5 root
app.getCanonicalSnapshot();
// @ts-expect-error schema graph reads are inspect-only in the v5 root
app.getSchemaGraph();

export {};
