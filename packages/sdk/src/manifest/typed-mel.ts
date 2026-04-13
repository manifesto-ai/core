import type {
  DomainSchema,
} from "@manifesto-ai/core";

import {
  ACTION_PARAM_NAMES,
  ACTION_SINGLE_PARAM_OBJECT_VALUE,
} from "../compat/runtime-symbols.js";
import type {
  ManifestoDomainShape,
  TypedMEL,
} from "../types.js";
import type {
  ActionParamMetadata,
  ActionSingleParamObjectValueMetadata,
} from "./shared.js";

export function buildTypedMel<T extends ManifestoDomainShape>(
  schema: DomainSchema,
  actionParamMetadata: Readonly<Record<string, ActionParamMetadata>>,
  actionSingleParamObjectValueMetadata: Readonly<Record<string, ActionSingleParamObjectValueMetadata>>,
): TypedMEL<T> {
  const actions = Object.fromEntries(
    Object.keys(schema.actions).map((name) => {
      const ref: Record<PropertyKey, unknown> = {
        __kind: "ActionRef",
        name,
      };
      Object.defineProperty(ref, ACTION_PARAM_NAMES, {
        enumerable: false,
        configurable: false,
        writable: false,
        value: Object.hasOwn(actionParamMetadata, name)
          ? actionParamMetadata[name]
          : [],
      });
      Object.defineProperty(ref, ACTION_SINGLE_PARAM_OBJECT_VALUE, {
        enumerable: false,
        configurable: false,
        writable: false,
        value: actionSingleParamObjectValueMetadata[name] ?? false,
      });
      return [name, Object.freeze(ref)];
    }),
  );

  const state = Object.fromEntries(
    Object.keys(schema.state.fields)
      .filter((name) => !name.startsWith("$"))
      .map((name) => [name, Object.freeze({
        __kind: "FieldRef",
        name,
      })]),
  );

  const computed = Object.fromEntries(
    Object.keys(schema.computed.fields)
      .map((name) => [name, Object.freeze({
        __kind: "ComputedRef",
        name,
      })]),
  );

  return Object.freeze({
    actions: Object.freeze(actions),
    state: Object.freeze(state),
    computed: Object.freeze(computed),
  }) as unknown as TypedMEL<T>;
}
