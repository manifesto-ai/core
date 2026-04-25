import type { Diagnostic } from "../diagnostics/types.js";
import { editError } from "./compile-fragment-validation.js";

export type CompileFragmentOptionsSnapshot = {
  readonly baseModuleSourceHash: string | null;
  readonly includeModule: boolean;
  readonly includeSchemaDiff: boolean;
};

type OptionsSnapshotRead =
  | { readonly ok: true; readonly value: CompileFragmentOptionsSnapshot }
  | { readonly ok: false; readonly diagnostic: Diagnostic };

type ValueReadResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly diagnostic: Diagnostic };

export function snapshotCompileFragmentOptions(options: unknown): OptionsSnapshotRead {
  if (options === undefined) {
    return { ok: true, value: defaultOptionsSnapshot() };
  }
  if (options === null || typeof options !== "object") {
    return {
      ok: false,
      diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", "compileFragmentInContext() options must be an object."),
    };
  }

  const includeModule = readBooleanOption(options, "includeModule");
  if (!includeModule.ok) return { ok: false, diagnostic: includeModule.diagnostic };
  const includeSchemaDiff = readBooleanOption(options, "includeSchemaDiff");
  if (!includeSchemaDiff.ok) return { ok: false, diagnostic: includeSchemaDiff.diagnostic };
  const baseModule = readOptionalDataProperty(options, "baseModule", "options.baseModule");
  if (!baseModule.ok) return { ok: false, diagnostic: baseModule.diagnostic };

  if (baseModule.value === undefined) {
    return {
      ok: true,
      value: {
        baseModuleSourceHash: null,
        includeModule: includeModule.value,
        includeSchemaDiff: includeSchemaDiff.value,
      },
    };
  }
  const sourceHash = readBaseModuleSourceHash(baseModule.value);
  if (!sourceHash.ok) return { ok: false, diagnostic: sourceHash.diagnostic };
  return {
    ok: true,
    value: {
      baseModuleSourceHash: sourceHash.value,
      includeModule: includeModule.value,
      includeSchemaDiff: includeSchemaDiff.value,
    },
  };
}

function defaultOptionsSnapshot(): CompileFragmentOptionsSnapshot {
  return { baseModuleSourceHash: null, includeModule: false, includeSchemaDiff: false };
}

function readBooleanOption(value: object, key: string): { ok: true; value: boolean } | { ok: false; diagnostic: Diagnostic } {
  const read = readOptionalDataProperty(value, key, `options.${key}`);
  if (!read.ok) return { ok: false, diagnostic: read.diagnostic };
  if (read.value === undefined) return { ok: true, value: false };
  if (typeof read.value !== "boolean") {
    return { ok: false, diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", `options.${key} must be a boolean.`) };
  }
  return { ok: true, value: read.value };
}

function readBaseModuleSourceHash(value: unknown): { ok: true; value: string } | { ok: false; diagnostic: Diagnostic } {
  if (value === null || typeof value !== "object") {
    return { ok: false, diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", "options.baseModule must be an object.") };
  }
  const sourceMap = readRequiredDataProperty(value, "sourceMap", "options.baseModule.sourceMap");
  if (!sourceMap.ok) return { ok: false, diagnostic: sourceMap.diagnostic };
  if (sourceMap.value === null || typeof sourceMap.value !== "object") {
    return { ok: false, diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", "options.baseModule.sourceMap must be an object.") };
  }
  const sourceHash = readRequiredDataProperty(sourceMap.value, "sourceHash", "options.baseModule.sourceMap.sourceHash");
  if (!sourceHash.ok) return { ok: false, diagnostic: sourceHash.diagnostic };
  if (typeof sourceHash.value !== "string") {
    return {
      ok: false,
      diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", "options.baseModule.sourceMap.sourceHash must be source text."),
    };
  }
  return { ok: true, value: sourceHash.value };
}

function readOptionalDataProperty(value: object, key: string, label: string): ValueReadResult {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    return { ok: false, diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} must be inspectable JSON data.`) };
  }
  if (!descriptor) return { ok: true, value: undefined };
  if (!("value" in descriptor)) {
    return { ok: false, diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} must be a JSON data property.`) };
  }
  try {
    return { ok: true, value: (value as Record<string, unknown>)[key] };
  } catch {
    return { ok: false, diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} must be inspectable JSON data.`) };
  }
}

function readRequiredDataProperty(value: object, key: string, label: string): ValueReadResult {
  const read = readOptionalDataProperty(value, key, label);
  if (!read.ok) return read;
  if (read.value === undefined) {
    return { ok: false, diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} must be present JSON data.`) };
  }
  return read;
}
