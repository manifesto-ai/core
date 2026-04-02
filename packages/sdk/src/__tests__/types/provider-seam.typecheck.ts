import type {
  BaseComposableLaws,
  ComposableManifesto,
  ManifestoDomainShape,
} from "../../index.ts";
import type {
  ActivationState,
  HostDispatchOptions,
  RuntimeKernel,
  RuntimeKernelFactory,
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

void activationState;
void metadata;
void hostDispatchOptions;
activateComposable(manifesto);

export {};
