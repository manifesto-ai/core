import type { Patch } from "@manifesto-ai/core";
import type { ErrorValue } from "../types/index.js";

/**
 * Convert an error to ErrorValue structure
 */
function toErrorValue(
  error: Error | { code: string; message: string }
): ErrorValue {
  if (error instanceof Error) {
    return {
      $error: true,
      code: error.name,
      message: error.message,
      stack: error.stack,
      timestamp: Date.now(),
    };
  }

  return {
    $error: true,
    code: error.code,
    message: error.message,
    timestamp: Date.now(),
  };
}

/**
 * Create an error patch
 *
 * @example
 * ```ts
 * toErrorPatch('data.error', new Error('Network failed'));
 * // → {
 * //   op: 'set',
 * //   path: 'data.error',
 * //   value: {
 * //     $error: true,
 * //     code: 'Error',
 * //     message: 'Network failed',
 * //     stack: '...',
 * //     timestamp: 1234567890
 * //   }
 * // }
 * ```
 */
export function toErrorPatch(
  path: string,
  error: Error | { code: string; message: string }
): Patch {
  return {
    op: "set",
    path,
    value: toErrorValue(error),
  };
}

/**
 * Create standard error patches for system.lastError and optional custom path
 *
 * @example
 * ```ts
 * toErrorPatches(new Error('Failed'), 'data.loadError');
 * // → [
 * //   { op: 'set', path: 'system.lastError', value: { $error: true, ... } },
 * //   { op: 'set', path: 'data.loadError', value: { $error: true, ... } },
 * // ]
 * ```
 */
export function toErrorPatches(error: Error, customPath?: string): Patch[] {
  const errorValue = toErrorValue(error);
  const patches: Patch[] = [{ op: "set", path: "system.lastError", value: errorValue }];

  if (customPath) {
    patches.push({ op: "set", path: customPath, value: errorValue });
  }

  return patches;
}
