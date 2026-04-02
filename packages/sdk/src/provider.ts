export type {
  ActivationState,
  HostDispatchOptions,
  RuntimeKernel,
  RuntimeKernelFactory,
} from "./internal.js";
export {
  activateComposable,
  assertComposableNotActivated,
  attachRuntimeKernelFactory,
  createRuntimeKernel,
  getActivationState,
  getRuntimeKernelFactory,
} from "./internal.js";
