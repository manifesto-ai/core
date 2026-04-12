import {
  mergePatch,
  propSegment,
  setPatch,
  unsetPatch,
  type Patch,
  type PatchPath,
} from "@manifesto-ai/core";

import type {
  ComputedRef,
  EffectHandler,
  FieldRef,
  ManifestoDomainShape,
  TypedActionRef,
  TypedMEL,
} from "./types.js";
import { ManifestoError } from "./errors.js";

type RefLike = {
  readonly __kind: string;
  readonly name: string;
};

type MergeableObject<TValue> = TValue extends readonly unknown[]
  ? never
  : TValue extends object
    ? TValue
    : never;

type RefValue<TRef extends FieldRef<unknown>> = TRef extends FieldRef<infer TValue>
  ? TValue
  : never;

type MergeValue<TRef extends FieldRef<unknown>> = Partial<MergeableObject<RefValue<TRef>>>;

export type PatchBuilder = {
  set<TRef extends FieldRef<unknown>>(ref: TRef, value: RefValue<TRef>): Patch;
  unset<TRef extends FieldRef<unknown>>(ref: TRef): Patch;
  merge<TRef extends FieldRef<unknown>>(
    ref: TRef,
    value: MergeValue<TRef>,
  ): Patch;
};

type DefineEffectsFactory<T extends ManifestoDomainShape> = (
  ops: PatchBuilder,
  MEL: TypedMEL<T>,
) => Record<string, EffectHandler>;

function isPlainObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertFieldRef(op: keyof PatchBuilder, ref: unknown): asserts ref is FieldRef<unknown> {
  if (!ref || typeof ref !== "object") {
    throw new ManifestoError(
      "SCHEMA_ERROR",
      `PatchBuilder.${op}() expects a FieldRef from defineEffects(..., MEL.state.*)`,
    );
  }

  const candidate = ref as Partial<FieldRef<unknown>>;
  if (candidate.__kind !== "FieldRef" || typeof candidate.name !== "string" || candidate.name.length === 0) {
    throw new ManifestoError(
      "SCHEMA_ERROR",
      `PatchBuilder.${op}() expects a FieldRef from defineEffects(..., MEL.state.*)`,
    );
  }

  if (candidate.name.startsWith("$")) {
    throw new ManifestoError(
      "SCHEMA_ERROR",
      `PatchBuilder.${op}() does not allow reserved platform namespaces such as "${candidate.name}"`,
    );
  }
}

function assertMergeValue(value: unknown): asserts value is Record<string, unknown> {
  if (!isPlainObjectRecord(value)) {
    throw new ManifestoError(
      "SCHEMA_ERROR",
      "PatchBuilder.merge() expects a plain object value",
    );
  }
}

function createRefNamespace<TRef extends RefLike>(
  kind: TRef["__kind"],
): Record<string, TRef> {
  const cache = new Map<string, TRef>();
  const target = Object.freeze(Object.create(null)) as Record<string, TRef>;

  return new Proxy(target, {
    get(currentTarget, property, receiver) {
      if (typeof property !== "string") {
        return Reflect.get(currentTarget, property, receiver);
      }

      const existing = cache.get(property);
      if (existing) {
        return existing;
      }

      const ref = Object.freeze({
        __kind: kind,
        name: property,
      }) as TRef;

      cache.set(property, ref);
      return ref;
    },
  });
}

function toPatchPath(ref: FieldRef<unknown>): PatchPath {
  return [propSegment(ref.name)];
}

const PATCH_BUILDER: PatchBuilder = Object.freeze({
  set<TRef extends FieldRef<unknown>>(ref: TRef, value: RefValue<TRef>): Patch {
    assertFieldRef("set", ref);
    return setPatch(toPatchPath(ref), value);
  },
  unset<TRef extends FieldRef<unknown>>(ref: TRef): Patch {
    assertFieldRef("unset", ref);
    return unsetPatch(toPatchPath(ref));
  },
  merge<TRef extends FieldRef<unknown>>(
    ref: TRef,
    value: MergeValue<TRef>,
  ): Patch {
    assertFieldRef("merge", ref);
    assertMergeValue(value);
    return mergePatch(
      toPatchPath(ref),
      value,
    );
  },
});

const AUTHORING_MEL = Object.freeze({
  actions: createRefNamespace<TypedActionRef<ManifestoDomainShape>>("ActionRef"),
  state: createRefNamespace<FieldRef<unknown>>("FieldRef"),
  computed: createRefNamespace<ComputedRef<unknown>>("ComputedRef"),
}) as TypedMEL<ManifestoDomainShape>;

export function defineEffects<T extends ManifestoDomainShape>(
  factory: DefineEffectsFactory<T>,
): Record<string, EffectHandler> {
  return factory(PATCH_BUILDER, AUTHORING_MEL as TypedMEL<T>);
}
