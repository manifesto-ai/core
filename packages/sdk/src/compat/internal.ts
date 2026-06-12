import { AlreadyActivatedError, ManifestoError } from "../errors.js";
import type {
  BaseLaws,
  ComposableManifesto,
  ManifestoDomainShape,
} from "../types.js";
import type { ExtensionKernel } from "../extensions-types.js";
import {
  ACTIVATION_STATE,
  EXTENSION_KERNEL,
  RUNTIME_KERNEL_FACTORY,
  type ActivationState,
} from "./runtime-symbols.js";

export {
  ACTION_PARAM_NAMES,
  ACTION_SINGLE_PARAM_OBJECT_VALUE,
  ACTIVATION_STATE,
  EXTENSION_KERNEL,
  RUNTIME_KERNEL_FACTORY,
  type ActivationState,
} from "./runtime-symbols.js";

// The kernel contract lives with the runtime (#421); this module stays
// a thin compatibility layer: aliases, attachment helpers, factory
// re-exports, and the symbols decorators need.
export * from "../runtime/kernel-contract.js";
import type {
  RuntimeExtensionFacet,
  RuntimeKernelFactory,
} from "../runtime/kernel-contract.js";

export type InternalComposableManifesto<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
> = ComposableManifesto<T, Laws> & {
  readonly [RUNTIME_KERNEL_FACTORY]: RuntimeKernelFactory<T>;
  readonly [ACTIVATION_STATE]: ActivationState;
};

type ExtensionKernelCarrier<T extends ManifestoDomainShape> = {
  readonly [EXTENSION_KERNEL]: ExtensionKernel<T>;
};

export function attachRuntimeKernelFactory<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
>(
  manifesto: ComposableManifesto<T, Laws>,
  factory: RuntimeKernelFactory<T>,
  activationState?: ActivationState,
): InternalComposableManifesto<T, Laws> {
  Object.defineProperty(manifesto, RUNTIME_KERNEL_FACTORY, {
    enumerable: false,
    configurable: false,
    writable: false,
    value: factory,
  });

  const state = activationState ??
    getExistingActivationState(manifesto) ?? {
      activated: false,
    };

  if (!getExistingActivationState(manifesto)) {
    Object.defineProperty(manifesto, ACTIVATION_STATE, {
      enumerable: false,
      configurable: false,
      writable: false,
      value: state,
    });
  }

  return manifesto as InternalComposableManifesto<T, Laws>;
}

export function getRuntimeKernelFactory<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
>(manifesto: ComposableManifesto<T, Laws>): RuntimeKernelFactory<T> {
  const internal = manifesto as Partial<InternalComposableManifesto<T, Laws>>;
  const factory = internal[RUNTIME_KERNEL_FACTORY];

  if (typeof factory !== "function") {
    throw new ManifestoError(
      "SCHEMA_ERROR",
      "ComposableManifesto is missing its runtime kernel factory",
    );
  }

  return factory;
}

export function attachExtensionKernel<
  T extends ManifestoDomainShape,
  TInstance extends object,
>(runtime: TInstance, kernel: RuntimeExtensionFacet<T>): TInstance {
  Object.defineProperty(runtime, EXTENSION_KERNEL, {
    enumerable: false,
    configurable: false,
    writable: false,
    value: kernel[EXTENSION_KERNEL],
  });

  return runtime;
}

export function getAttachedExtensionKernel<T extends ManifestoDomainShape>(
  runtime: object,
): ExtensionKernel<T> {
  const internal = runtime as Partial<ExtensionKernelCarrier<T>>;
  const kernel = internal[EXTENSION_KERNEL];

  if (!kernel) {
    throw new ManifestoError(
      "SCHEMA_ERROR",
      "Activated runtime is missing its extension kernel",
    );
  }

  return kernel;
}

export function getActivationState<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
>(manifesto: ComposableManifesto<T, Laws>): ActivationState {
  const internal = manifesto as Partial<InternalComposableManifesto<T, Laws>>;
  const state = internal[ACTIVATION_STATE];

  if (!state) {
    throw new ManifestoError(
      "SCHEMA_ERROR",
      "ComposableManifesto is missing its activation state",
    );
  }

  return state;
}

export function assertComposableNotActivated<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
>(manifesto: ComposableManifesto<T, Laws>): void {
  if (getActivationState(manifesto).activated) {
    throw new AlreadyActivatedError();
  }
}

export function activateComposable<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
>(manifesto: ComposableManifesto<T, Laws>): void {
  const state = getActivationState(manifesto);
  if (state.activated) {
    throw new AlreadyActivatedError();
  }
  state.activated = true;
}

function getExistingActivationState<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
>(manifesto: ComposableManifesto<T, Laws>): ActivationState | null {
  const internal = manifesto as Partial<InternalComposableManifesto<T, Laws>>;
  return internal[ACTIVATION_STATE] ?? null;
}

export { createRuntimeKernel } from "../runtime/kernel.js";

export { mapBlockedAdmission, toBlocker } from "../runtime/admission-failure.js";
