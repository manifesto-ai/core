/**
 * Public decorator/provider authoring seam for activation-first runtime composition.
 * App code should prefer the main sdk entry point; decorator and provider authors
 * can rely on this subpath when composing or promoting runtime verbs.
 */
export type {
  ActivationState,
  HostDispatchOptions,
  RuntimeKernel,
  RuntimeKernelFactory,
  SimulateResult,
} from "./internal.js";
export {
  activateComposable,
  assertComposableNotActivated,
  attachRuntimeKernelFactory,
  createRuntimeKernel,
  getActivationState,
  getRuntimeKernelFactory,
} from "./internal.js";
