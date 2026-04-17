/**
 * Public decorator/provider authoring seam for activation-first runtime composition.
 * App code should prefer the main sdk entry point; decorator and provider authors
 * can rely on this subpath when composing or promoting runtime verbs.
 */
export type {
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
} from "./compat/internal.js";
export {
  activateComposable,
  assertComposableNotActivated,
  attachExtensionKernel,
  attachRuntimeKernelFactory,
  createRuntimeKernel,
  getActivationState,
  getRuntimeKernelFactory,
} from "./compat/internal.js";
export { createBaseRuntimeInstance } from "./runtime/base-runtime.js";
