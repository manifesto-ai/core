import {
  validateExternalContext,
  type DomainSchema,
  type JsonValue,
} from "@manifesto-ai/core";

import { ManifestoError } from "../errors.js";
import type {
  DomainExternalContext,
  ExternalContext,
  ManifestoDomainShape,
} from "../types.js";

type JsonPath = readonly (string | number)[];

export function materializeExternalContext<T extends ManifestoDomainShape>(
  schema: DomainSchema,
  value: unknown,
  source: string,
): DomainExternalContext<T> {
  const external = materializeExternalRecord(
    value === undefined ? {} : value,
    source,
  );
  const result = validateExternalContext(schema, external);

  if (!result.valid) {
    const message = result.errors
      .map((error) =>
        error.path ? `${error.path}: ${error.message}` : error.message,
      )
      .join("; ");
    throw new ManifestoError(
      "INVALID_CONTEXT",
      `Invalid context for ${source}: ${message}`,
    );
  }

  return external as DomainExternalContext<T>;
}

export function captureExternalContext<T extends ManifestoDomainShape>(
  schema: DomainSchema,
  current: DomainExternalContext<T>,
  override: unknown,
  source: string,
): DomainExternalContext<T> {
  return override === undefined
    ? current
    : materializeExternalContext<T>(schema, override, source);
}

function materializeExternalRecord(
  value: unknown,
  source: string,
): ExternalContext {
  if (!isPlainRecord(value)) {
    throwInvalidContext(source, [], "Context must be a plain JSON object");
  }

  const seen = new WeakSet<object>();
  return Object.freeze(
    materializeRecord(value, source, [], seen),
  ) as ExternalContext;
}

function materializeJsonValue(
  value: unknown,
  source: string,
  path: JsonPath,
  seen: WeakSet<object>,
): JsonValue {
  if (value === null) {
    return null;
  }

  switch (typeof value) {
    case "string":
    case "boolean":
      return value;
    case "number":
      if (Number.isFinite(value)) {
        return value;
      }
      return throwInvalidContext(source, path, "Context numbers must be finite");
    case "undefined":
      return throwInvalidContext(source, path, "Context must not contain undefined");
    case "function":
      return throwInvalidContext(source, path, "Context must not contain functions");
    case "symbol":
      return throwInvalidContext(source, path, "Context must not contain symbols");
    case "bigint":
      return throwInvalidContext(
        source,
        path,
        "Context must not contain bigint values",
      );
    case "object":
      break;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throwInvalidContext(source, path, "Context must not contain cycles");
    }
    seen.add(value);
    rejectAccessors(value, source, path);
    rejectSymbolKeys(value, source, path);

    const clone: JsonValue[] = [];
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        throwInvalidContext(
          source,
          [...path, index],
          "Context arrays must not contain holes",
        );
      }
      clone.push(
        materializeJsonValue(value[index], source, [...path, index], seen),
      );
    }
    seen.delete(value);
    return Object.freeze(clone);
  }

  if (!isPlainRecord(value)) {
    throwInvalidContext(
      source,
      path,
      "Context objects must be plain JSON objects",
    );
  }

  if (seen.has(value)) {
    throwInvalidContext(source, path, "Context must not contain cycles");
  }
  seen.add(value);
  const clone = materializeRecord(value, source, path, seen);
  seen.delete(value);
  return Object.freeze(clone);
}

function materializeRecord(
  value: Record<string, unknown>,
  source: string,
  path: JsonPath,
  seen: WeakSet<object>,
): Record<string, JsonValue> {
  rejectAccessors(value, source, path);
  rejectSymbolKeys(value, source, path);

  const clone = Object.create(null) as Record<string, JsonValue>;
  for (const [key, child] of Object.entries(value)) {
    clone[key] = materializeJsonValue(child, source, [...path, key], seen);
  }
  return clone;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function rejectAccessors(value: object, source: string, path: JsonPath): void {
  for (const [key, descriptor] of Object.entries(
    Object.getOwnPropertyDescriptors(value),
  )) {
    if (descriptor.get || descriptor.set) {
      throwInvalidContext(
        source,
        [...path, key],
        "Context must not contain getters or setters",
      );
    }
  }
}

function rejectSymbolKeys(value: object, source: string, path: JsonPath): void {
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throwInvalidContext(source, path, "Context must not contain symbol keys");
  }
}

function throwInvalidContext(
  source: string,
  path: JsonPath,
  message: string,
): never {
  const renderedPath =
    path.length === 0 ? "$context" : `$context.${path.map(String).join(".")}`;
  throw new ManifestoError(
    "INVALID_CONTEXT",
    `Invalid context for ${source} at ${renderedPath}: ${message}`,
  );
}
