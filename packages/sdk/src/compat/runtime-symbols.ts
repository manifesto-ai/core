export const ACTION_PARAM_NAMES = Symbol("manifesto-sdk.action-param-names");
export const ACTION_SINGLE_PARAM_OBJECT_VALUE = Symbol("manifesto-sdk.action-single-param-object-value");
export const RUNTIME_KERNEL_FACTORY = Symbol("manifesto-sdk.runtime-kernel-factory");
export const ACTIVATION_STATE = Symbol("manifesto-sdk.activation-state");
export const EXTENSION_KERNEL = Symbol("manifesto-sdk.extension-kernel");

export type ActivationState = {
  activated: boolean;
};
