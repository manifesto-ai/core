/**
 * MEL Loader
 *
 * This module intentionally supports two environments:
 * 1) Node ESM loader hooks (`resolve`, `load`) for `node --loader` / `tsx --loader`
 * 2) Webpack loader default export (`use: "@manifesto-ai/compiler/loader"`)
 */

import { readFile } from "node:fs/promises";
import type { LoadHook, ResolveHook } from "node:module";
import { fileURLToPath } from "node:url";
import type { LoaderContext } from "webpack";
import { compileMelToModuleCode } from "./mel-module.js";

function stripSearchAndHash(value: string): string {
  const [withoutSearch] = value.split("?", 1);
  const [withoutHash] = withoutSearch.split("#", 1);
  return withoutHash;
}

function isMelReference(value: string): boolean {
  return stripSearchAndHash(value).endsWith(".mel");
}

function toSourceId(urlOrPath: string): string {
  try {
    return fileURLToPath(urlOrPath);
  } catch {
    return urlOrPath;
  }
}

/**
 * Node loader resolve hook.
 */
export const resolve: ResolveHook = async (specifier, context, nextResolve) => {
  if (!isMelReference(specifier)) {
    return nextResolve(specifier, context);
  }

  const resolved = await nextResolve(specifier, context);
  return { ...resolved, shortCircuit: true };
};

/**
 * Node loader load hook.
 */
export const load: LoadHook = async (url, context, nextLoad) => {
  if (!isMelReference(url)) {
    return nextLoad(url, context);
  }

  const melSource = await readFile(new URL(url), "utf8");
  const source = compileMelToModuleCode(melSource, toSourceId(url));

  return {
    format: "module",
    source,
    shortCircuit: true,
  };
};

/**
 * Webpack loader default export.
 */
export default function melWebpackLoader(
  this: LoaderContext<unknown>,
  source: string | Buffer
): string {
  this.cacheable?.(true);
  const melSource = typeof source === "string" ? source : source.toString("utf8");
  const sourceId = this.resourcePath ?? "<mel>";
  return compileMelToModuleCode(melSource, sourceId);
}

export const raw = false;
