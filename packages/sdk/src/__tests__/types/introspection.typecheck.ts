import { createManifesto } from "../../index.ts";
import {
  createCounterSchema,
  type CounterDomain,
} from "../helpers/schema.ts";

const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

const fieldName: string = world.MEL.state.count.name;
const computedName: string = world.MEL.computed.doubled.name;
const actionName: "increment" = world.MEL.actions.increment.name;

const graph = world.getSchemaGraph();
void graph.traceDown(world.MEL.state.count);
void graph.traceUp("state:count");

const simulated = world.simulate(world.MEL.actions.increment);
const changedPaths: readonly string[] = simulated.changedPaths;
const available: readonly (keyof CounterDomain["actions"])[] = simulated.newAvailableActions;

void fieldName;
void computedName;
void actionName;
void changedPaths;
void available;

// @ts-expect-error FieldRef no longer exposes path in the public type surface
world.MEL.state.count.path;
// @ts-expect-error ComputedRef no longer exposes path in the public type surface
world.MEL.computed.doubled.path;

export {};
