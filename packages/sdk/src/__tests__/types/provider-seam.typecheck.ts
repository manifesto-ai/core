import type {
  BaseComposableLaws,
  ComposableManifesto,
  DispatchBlocker,
  ManifestoApp,
  ManifestoDomainShape,
} from "../../index.ts";
import type {
  ActivationState,
  GovernanceRuntimeKernel,
  GovernanceRuntimeKernelFactory,
  HostDispatchOptions,
  LineageRuntimeKernel,
  LineageRuntimeKernelFactory,
  RuntimeKernel,
  RuntimeKernelFactory,
  SimulateResult,
  WaitForProposalRuntimeKernel,
} from "../../provider.ts";
import {
  activateComposable,
  assertComposableNotActivated,
  attachRuntimeKernelFactory,
  createBaseRuntimeInstance,
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
const lineageFactory: LineageRuntimeKernelFactory<DemoDomain> = resolvedFactory;
const lineageKernel: LineageRuntimeKernel<DemoDomain> = resolvedFactory();
const governanceFactory: GovernanceRuntimeKernelFactory<DemoDomain> = resolvedFactory;
const governanceKernel: GovernanceRuntimeKernel<DemoDomain> = resolvedFactory();
const waitForProposalKernel: WaitForProposalRuntimeKernel<DemoDomain> = resolvedFactory();
const metadata = kernel.getActionMetadata();
const canonical = kernel.getCanonicalSnapshot();
const availableFor: readonly (keyof DemoDomain["actions"])[] = kernel.getAvailableActionsFor(canonical);
const isAvailableFor: boolean = kernel.isActionAvailableFor(canonical, "ping");
const intent = kernel.createIntent(kernel.MEL.actions.ping);
const isDispatchableFor: boolean = kernel.isIntentDispatchableFor(canonical, intent);
const blockersFor: readonly DispatchBlocker[] = kernel.getIntentBlockersFor(canonical, intent);
const simulation: SimulateResult<DemoDomain> = kernel.simulateSync(canonical, intent);
const projectedSimulation = kernel.simulateIntent(intent);
const simulationTrace = simulation.diagnostics?.trace;
const baseRuntime: ManifestoApp<DemoDomain, "base"> = createBaseRuntimeInstance(kernel);

void activationState;
void availableFor;
void baseRuntime;
void canonical;
void governanceFactory;
void governanceKernel;
void isAvailableFor;
void isDispatchableFor;
void intent;
void blockersFor;
void lineageFactory;
void lineageKernel;
void metadata;
void projectedSimulation;
void hostDispatchOptions;
void simulation;
void simulationTrace;
void waitForProposalKernel;
activateComposable(manifesto);

export {};
