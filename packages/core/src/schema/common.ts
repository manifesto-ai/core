import { z } from "zod";

/**
 * Dot-separated path for accessing values (e.g., "user.profile.name")
 */
export const SemanticPath = z.string().min(1);
export type SemanticPath = z.infer<typeof SemanticPath>;

/**
 * Result type for functions that can fail without throwing
 */
export const Result = <T extends z.ZodTypeAny, E extends z.ZodTypeAny>(
  valueSchema: T,
  errorSchema: E
) =>
  z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), value: valueSchema }),
    z.object({ ok: z.literal(false), error: errorSchema }),
  ]);

export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Helper functions for Result type
 */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const isOk = <T, E>(result: Result<T, E>): result is { ok: true; value: T } =>
  result.ok;

export const isErr = <T, E>(result: Result<T, E>): result is { ok: false; error: E } =>
  !result.ok;
