import type {
  HostContextProvider,
  ManifestoHost,
} from "@manifesto-ai/host";
import type {
  DomainSchema,
} from "@manifesto-ai/core";

import {
  ACTION_PARAM_NAMES,
  ACTION_SINGLE_PARAM_OBJECT_VALUE,
} from "../compat/runtime-symbols.js";
import type {
  ActionAnnotation,
  BaseComposableLaws,
  ManifestoDomainShape,
  TypedActionRef,
} from "../types.js";
import type {
  SnapshotProjectionPlan,
} from "../projection/snapshot-projection.js";

export const RESERVED_EFFECT_TYPE = "system.get";
export const RESERVED_NAMESPACE_PREFIX = "system.";
export const BASE_LAWS: BaseComposableLaws = Object.freeze({ __baseLaws: true });

export type RuntimeActionRef = TypedActionRef<ManifestoDomainShape> & {
  readonly [ACTION_PARAM_NAMES]: readonly string[] | null;
  readonly [ACTION_SINGLE_PARAM_OBJECT_VALUE]?: boolean;
};

export type ActionParamMetadata = readonly string[] | null;
export type ActionSingleParamObjectValueMetadata = boolean;
export type ActionAnnotationMap = Readonly<Record<string, ActionAnnotation>>;

export type ResolvedSchema = {
  readonly schema: DomainSchema;
  readonly actionParamMetadata: Readonly<Record<string, ActionParamMetadata>>;
  readonly actionSingleParamObjectValueMetadata: Readonly<Record<string, ActionSingleParamObjectValueMetadata>>;
  readonly actionAnnotations: ActionAnnotationMap;
  readonly projectionPlan: SnapshotProjectionPlan;
};

export type CompiledSchema = Omit<ResolvedSchema, "projectionPlan">;

export type InternalHostBundle = {
  readonly host: ManifestoHost;
  readonly contextProvider: HostContextProvider;
};
