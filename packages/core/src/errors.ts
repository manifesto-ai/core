import { z } from "zod";
import type { ErrorValue } from "./schema/snapshot.js";

/**
 * Core error codes
 */
export const CoreErrorCode = z.enum([
  "VALIDATION_ERROR",
  "PATH_NOT_FOUND",
  "TYPE_MISMATCH",
  "DIVISION_BY_ZERO",
  "INDEX_OUT_OF_BOUNDS",
  "UNKNOWN_ACTION",
  "ACTION_UNAVAILABLE",
  "INVALID_INPUT",
  "CYCLIC_DEPENDENCY",
  "UNKNOWN_FLOW",
  "CYCLIC_CALL",
  "UNKNOWN_EFFECT",
  "INTERNAL_ERROR",
]);
export type CoreErrorCode = z.infer<typeof CoreErrorCode>;

/**
 * Create an error value (errors are values, not exceptions)
 */
export function createError(
  code: CoreErrorCode,
  message: string,
  actionId: string,
  nodePath: string,
  timestamp: number,
  context?: Record<string, unknown>
): ErrorValue {
  return {
    code,
    message,
    source: {
      actionId,
      nodePath,
    },
    timestamp,
    context,
  };
}

/**
 * Check if a value is an ErrorValue
 */
export function isErrorValue(value: unknown): value is ErrorValue {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return (
    typeof obj.code === "string" &&
    typeof obj.message === "string" &&
    typeof obj.source === "object" &&
    obj.source !== null &&
    typeof (obj.source as Record<string, unknown>).actionId === "string" &&
    typeof (obj.source as Record<string, unknown>).nodePath === "string" &&
    typeof obj.timestamp === "number"
  );
}
