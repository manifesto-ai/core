import type {
  BaseComposableLaws,
  ComposableManifesto,
  DispatchBlocker,
  ManifestoDomainShape,
} from "../../index.ts";
import type {
  ActivationState,
  HostDispatchOptions,
  RuntimeKernel,
  RuntimeKernelFactory,
  SimulateResult,
} from "../../provider.ts";
import {
  activateComposable,
  assertComposableNotActivated,
  attachRuntimeKernelFactory,
  getActivationState,
  getRuntimeKernelFactory,
} from "../../provider.ts";

type DemoDomain = ManifestoDomainShape & {
  readonly actions: {
    ping: () => void;
  };
  readonly state: {
    ready: boolean;
  };
  readonly computed: {};
};

declare const manifesto: ComposableManifesto<DemoDomain, BaseComposableLaws>;
declare const factory: RuntimeKernelFactory<DemoDomain>;
declare const hostDispatchOptions: HostDispatchOptions | undefined;

attachRuntimeKernelFactory(manifesto, factory);
assertComposableNotActivated(manifesto);

const activationState: ActivationState = getActivationState(manifesto);
const resolvedFactory = getRuntimeKernelFactory(manifesto);
const kernel: RuntimeKernel<DemoDomain> = resolvedFactory();
const metadata = kernel.getActionMetadata();
const canonical = kernel.getCanonicalSnapshot();
const availableFor: readonly (keyof DemoDomain["actions"])[] = kernel.getAvailableActionsFor(canonical);
const isAvailableFor: boolean = kernel.isActionAvailableFor(canonical, "ping");
const intent = kernel.createIntent(kernel.MEL.actions.ping);
const isDispatchableFor: boolean = kernel.isIntentDispatchableFor(canonical, intent);
const blockersFor: readonly DispatchBlocker[] = kernel.getIntentBlockersFor(canonical, intent);
const simulation: SimulateResult<DemoDomain> = kernel.simulateSync(canonical, intent);

void activationState;
void availableFor;
void canonical;
void isAvailableFor;
void isDispatchableFor;
void intent;
void blockersFor;
void metadata;
void hostDispatchOptions;
void simulation;
activateComposable(manifesto);

export {};
