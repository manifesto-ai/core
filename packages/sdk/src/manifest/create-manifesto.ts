import {
  activateComposable,
  attachRuntimeKernelFactory,
  createRuntimeKernel,
} from "../compat/internal.js";
import {
  createBaseRuntimeInstance,
} from "../runtime/base-runtime.js";
import type {
  BaseComposableLaws,
  ComposableManifesto,
  CreateManifestoOptions,
  EffectHandler,
  ManifestoDomainShape,
} from "../types.js";
import {
  ReservedEffectError,
} from "../errors.js";
import {
  createInternalHost,
} from "./internal-host.js";
import {
  buildCreateIntent,
} from "./intent-packing.js";
import {
  resolveSchema,
} from "./resolve-schema.js";
import {
  BASE_LAWS,
  RESERVED_EFFECT_TYPE,
} from "./shared.js";
import {
  buildTypedMel,
} from "./typed-mel.js";
import type {
  DomainSchema,
} from "@manifesto-ai/core";

export function createManifesto<T extends ManifestoDomainShape>(
  schemaInput: DomainSchema | string,
  effects: Record<string, EffectHandler>,
  options?: CreateManifestoOptions,
): ComposableManifesto<T, BaseComposableLaws> {
  if (RESERVED_EFFECT_TYPE in effects) {
    throw new ReservedEffectError(RESERVED_EFFECT_TYPE);
  }

  const resolved = resolveSchema(schemaInput, options?.annotations);

  const manifesto = {
    _laws: BASE_LAWS,
    schema: resolved.schema,
    activate() {
      activateComposable(manifesto);
      const internalHost = createInternalHost(
        resolved.schema,
        resolved.projectionPlan,
        effects,
      );
      return createBaseRuntimeInstance(
        createRuntimeKernel<T>({
          schema: resolved.schema,
          projectionPlan: resolved.projectionPlan,
          host: internalHost.host,
          hostContextProvider: internalHost.contextProvider,
          MEL: buildTypedMel<T>(
            resolved.schema,
            resolved.actionParamMetadata,
            resolved.actionSingleParamObjectValueMetadata,
          ),
          createIntent: buildCreateIntent<T>(),
          actionAnnotations: resolved.actionAnnotations,
        }),
      );
    },
  };

  return attachRuntimeKernelFactory(manifesto, () => {
    const internalHost = createInternalHost(
      resolved.schema,
      resolved.projectionPlan,
      effects,
    );
    return createRuntimeKernel<T>({
      schema: resolved.schema,
      projectionPlan: resolved.projectionPlan,
      host: internalHost.host,
      hostContextProvider: internalHost.contextProvider,
      MEL: buildTypedMel<T>(
        resolved.schema,
        resolved.actionParamMetadata,
        resolved.actionSingleParamObjectValueMetadata,
      ),
      createIntent: buildCreateIntent<T>(),
      actionAnnotations: resolved.actionAnnotations,
    });
  });
}
