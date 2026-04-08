import * as sdk from "../../index.ts";
import {
  createSimulationSession,
  getExtensionKernel,
  type ExtensionKernel,
  type ExtensionSimulateResult,
  type SimulationSession,
} from "../../extensions.ts";
import { createCounterSchema, type CounterDomain } from "../helpers/schema.ts";

const world = sdk.createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
const ext: ExtensionKernel<CounterDomain> = getExtensionKernel(world);
const session: SimulationSession<CounterDomain> = createSimulationSession(world);
const canonical = ext.getCanonicalSnapshot();
const available = ext.getAvailableActionsFor(canonical);
const isAvailable = ext.isActionAvailableFor(canonical, "increment");
const intent = ext.createIntent(ext.MEL.actions.increment);
const isDispatchable = ext.isIntentDispatchableFor(canonical, intent);
const simulated: ExtensionSimulateResult<CounterDomain> = ext.simulateSync(canonical, intent);
const projected = ext.projectSnapshot(simulated.snapshot);
const next = session.next(world.MEL.actions.increment);
const finished = next.finish();

// @ts-expect-error root sdk entrypoint does not expose getExtensionKernel
void sdk.getExtensionKernel;
// @ts-expect-error root sdk entrypoint does not expose createSimulationSession
void sdk.createSimulationSession;

void available;
void isAvailable;
void isDispatchable;
void projected;
void finished;

export {};
