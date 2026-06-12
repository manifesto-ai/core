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
  WaitForProposalRuntimeKernel,
} from "./compat/internal.js";

// The kernel-level simulation result (canonical snapshot + patches +
// systemDelta). Distinct from the projected SimulateResult exported by the
// main entry; the stage-explicit name avoids alias-import collisions for
// decorator authors who touch both entrypoints (#493).
export type { SimulateResult as KernelSimulateResult } from "./compat/internal.js";

import type {
  SimulateResult as InternalKernelSimulateResult,
} from "./compat/internal.js";
import type { ManifestoDomainShape } from "./types.js";

/**
 * @deprecated Renamed to {@link KernelSimulateResult}: this provider-seam
 * type shares its name with the projected `SimulateResult` on the main
 * entry while having a different (canonical) shape. The alias will be
 * removed in the next major release.
 */
export type SimulateResult<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = InternalKernelSimulateResult<T>;
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
// Shared admission-failure mapping for decorator runtimes (single source
// for the blocked-admission -> AdmissionFailure narrowing).
export { mapBlockedAdmission, toBlocker } from "./runtime/admission-failure.js";
