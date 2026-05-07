import type {
  ComposableManifesto,
  LineageLaws,
  ManifestoDomainShape,
} from "@manifesto-ai/sdk";
import {
  ManifestoError,
} from "@manifesto-ai/sdk";
import {
  activateComposable,
  assertComposableNotActivated,
  attachRuntimeKernelFactory,
  getActivationState,
  getRuntimeKernelFactory,
  type LineageRuntimeKernel,
  type LineageRuntimeKernelFactory,
} from "@manifesto-ai/sdk/provider";

import { createLineageService } from "./service/lineage-service.js";
import type {
  BaseComposableManifesto,
  LineageComposableManifesto,
  LineageComposableLaws,
  LineageConfig,
} from "./runtime-types.js";
import {
  attachLineageDecoration,
  type ResolvedLineageConfig,
} from "./internal.js";
import { createLineageRuntimeInstance } from "./lineage-runtime.js";

const LINEAGE_LAWS: LineageLaws = Object.freeze({ __lineageLaws: true });

export function withLineage<
  T extends ManifestoDomainShape,
>(
  manifesto: BaseComposableManifesto<T>,
  config: LineageConfig,
): LineageComposableManifesto<T> {
  assertComposableNotActivated(manifesto);

  const resolvedConfig = resolveLineageConfig(config);
  const { service } = resolvedConfig;
  const createKernel = getRuntimeKernelFactory(manifesto);
  const createLineageKernel: LineageRuntimeKernelFactory<T> = createKernel;
  const activationState = getActivationState(manifesto);

  const decorated: LineageComposableManifesto<T> = {
    _laws: Object.freeze({
      ...manifesto._laws,
      ...LINEAGE_LAWS,
    }) as LineageComposableLaws,
    schema: manifesto.schema,
    activate() {
      activateComposable(
        decorated as unknown as ComposableManifesto<T, LineageComposableLaws>,
      );
      return createLineageRuntimeInstance<T>(createLineageKernel(), service, resolvedConfig);
    },
  };

  attachRuntimeKernelFactory(
    decorated as unknown as ComposableManifesto<T, LineageComposableLaws>,
    createKernel,
    activationState,
  );

  return attachLineageDecoration(
    decorated as unknown as ComposableManifesto<T, LineageComposableLaws>,
    {
      service,
      config: resolvedConfig,
    },
  ) as unknown as LineageComposableManifesto<T>;
}

function resolveLineageConfig(config: LineageConfig): ResolvedLineageConfig {
  if (!config || typeof config !== "object") {
    throw new ManifestoError(
      "LINEAGE_CONFIG_REQUIRED",
      "withLineage() requires a config object with either service or store",
    );
  }

  if ("service" in config && config.service) {
    return Object.freeze({
      ...config,
      service: config.service,
    });
  }

  if ("store" in config && config.store) {
    return Object.freeze({
      ...config,
      service: createLineageService(config.store),
    });
  }

  throw new ManifestoError(
    "LINEAGE_CONFIG_REQUIRED",
    "withLineage() requires a config object with either service or store",
  );
}
