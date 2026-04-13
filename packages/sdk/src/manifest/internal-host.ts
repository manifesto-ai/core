import {
  type EffectContext as HostEffectContext,
  type EffectHandler as HostEffectHandler,
  type HostContextProvider,
  createHostContextProvider,
  createHost,
  defaultRuntime,
} from "@manifesto-ai/host";
import {
  extractDefaults,
  type DomainSchema,
  type Patch,
  type Snapshot as CoreSnapshot,
} from "@manifesto-ai/core";

import type {
  EffectHandler,
} from "../types.js";
import {
  cloneAndDeepFreeze,
  projectEffectContextSnapshot,
  type SnapshotProjectionPlan,
} from "../projection/snapshot-projection.js";
import {
  executeSystemGet,
} from "./system-get.js";
import type {
  InternalHostBundle,
} from "./shared.js";
import {
  RESERVED_EFFECT_TYPE,
} from "./shared.js";

export function createInternalHost(
  schema: DomainSchema,
  projectionPlan: SnapshotProjectionPlan,
  effects: Record<string, EffectHandler>,
): InternalHostBundle {
  const runtime = defaultRuntime;
  const host = createHost(schema, {
    initialData: extractDefaults(schema.state),
    runtime,
  });
  const contextProvider: HostContextProvider = createHostContextProvider(runtime);

  host.registerEffect(RESERVED_EFFECT_TYPE, async (
    _type: string,
    params: Record<string, unknown>,
    ctx: HostEffectContext,
  ): Promise<Patch[]> => {
    const { patches } = executeSystemGet(params, ctx.snapshot as CoreSnapshot);
    return patches;
  });

  for (const [effectType, appHandler] of Object.entries(effects)) {
    const hostHandler: HostEffectHandler = async (
      _type: string,
      params: Record<string, unknown>,
      ctx: HostEffectContext,
    ): Promise<Patch[]> => {
      const patches = await appHandler(params, {
        snapshot: cloneAndDeepFreeze(
          projectEffectContextSnapshot(ctx.snapshot, projectionPlan),
        ),
      });
      return patches as Patch[];
    };

    host.registerEffect(effectType, hostHandler);
  }

  return {
    host,
    contextProvider,
  };
}
