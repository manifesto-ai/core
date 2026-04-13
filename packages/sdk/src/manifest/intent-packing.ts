import {
  createIntent as createCoreIntent,
} from "@manifesto-ai/core";

import {
  ManifestoError,
} from "../errors.js";
import {
  generateUUID,
} from "../runtime/uuid.js";
import type {
  CreateIntentArgs,
  ManifestoDomainShape,
  TypedActionRef,
  TypedCreateIntent,
  TypedIntent,
} from "../types.js";
import {
  ACTION_PARAM_NAMES,
  ACTION_SINGLE_PARAM_OBJECT_VALUE,
} from "../compat/runtime-symbols.js";
import type {
  RuntimeActionRef,
} from "./shared.js";

export function buildCreateIntent<T extends ManifestoDomainShape>(): TypedCreateIntent<T> {
  return <K extends keyof T["actions"]>(
    action: TypedActionRef<T, K>,
    ...args: CreateIntentArgs<T, K>
  ): TypedIntent<T, K> => {
    const actionRef = action as unknown as RuntimeActionRef;
    const intentId = generateUUID();
    const input = packIntentInput(actionRef, args);
    return createCoreIntent(
      String(action.name),
      input,
      intentId,
    ) as TypedIntent<T, K>;
  };
}

function packIntentInput(action: RuntimeActionRef, args: readonly unknown[]): unknown {
  const paramNames = Object.hasOwn(action, ACTION_PARAM_NAMES)
    ? action[ACTION_PARAM_NAMES]
    : [];
  if (args.length === 0) {
    return undefined;
  }

  if (paramNames === null) {
    if (args.length === 1 && isPlainObject(args[0])) {
      return args[0];
    }

    throw new ManifestoError(
      "INVALID_INTENT_ARGS",
      `Action "${String(action.name)}" requires a single object argument because positional parameter metadata is unavailable`,
    );
  }

  if (paramNames.length === 0) {
    if (args.length === 1) {
      return args[0];
    }

    throw new ManifestoError(
      "INVALID_INTENT_ARGS",
      `Action "${String(action.name)}" does not accept multiple positional arguments`,
    );
  }

  if (
    paramNames.length === 1 &&
    args.length === 1 &&
    isPlainObject(args[0]) &&
    action[ACTION_SINGLE_PARAM_OBJECT_VALUE]
  ) {
    return { [paramNames[0] ?? "arg0"]: args[0] };
  }

  if (
    paramNames.length === 1 &&
    args.length === 1 &&
    isNamedSingleParamBinding(args[0], paramNames[0])
  ) {
    return args[0];
  }

  if (args.length === 1 && isPlainObject(args[0]) && paramNames.length > 1) {
    return args[0];
  }

  return Object.fromEntries(args.map((value, index) => [
    paramNames[index] ?? `arg${index}`,
    value,
  ]));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNamedSingleParamBinding(
  value: unknown,
  paramName: string | undefined,
): value is Record<string, unknown> {
  if (!paramName || !isPlainObject(value)) {
    return false;
  }

  const keys = Object.keys(value);
  return keys.length === 1 && keys[0] === paramName;
}
