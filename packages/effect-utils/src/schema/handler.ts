import type { z } from "zod";
import type { Patch, Snapshot } from "@manifesto-ai/core";
import type { EffectContext } from "@manifesto-ai/host";
import type {
  EffectSchema,
  HandlerImplementation,
  EffectHandler,
} from "../types/index.js";
import { ValidationError } from "../errors/index.js";
import { toErrorPatches, toPatch } from "../transforms/index.js";

/**
 * Creates a type-safe Effect Handler from a schema.
 *
 * The handler:
 * - Validates input against schema
 * - Validates output against schema
 * - Catches all errors and returns as patches
 * - NEVER throws
 *
 * @example
 * ```ts
 * const fetchUserHandler = createHandler(fetchUserSchema, async (input, context) => {
 *   // input is typed: { userId: string, includeProfile: boolean }
 *   // context.snapshot — current snapshot (read-only)
 *   // context.requirement — { id, type, params }
 *
 *   const response = await fetch(`/api/users/${input.userId}`);
 *   const user = await response.json();
 *
 *   // Return value is validated against outputSchema
 *   return {
 *     id: user.id,
 *     name: user.name,
 *     email: user.email,
 *     profile: input.includeProfile ? user.profile : undefined,
 *   };
 * });
 *
 * // Register with Host
 * const host = createHost(schema, {
 *   effects: {
 *     'api.user.fetch': fetchUserHandler,
 *   }
 * });
 * ```
 */
export function createHandler<TInput, TOutput>(
  schema: EffectSchema<string, z.ZodType<TInput>, z.ZodType<TOutput>>,
  implementation: HandlerImplementation<TInput, TOutput>
): EffectHandler {
  return async (
    type: string,
    params: Record<string, unknown>,
    context: EffectContext
  ): Promise<Patch[]> => {
    try {
      // Validate input
      const inputResult = schema.inputSchema.safeParse(params);
      if (!inputResult.success) {
        return [
          ...toErrorPatches(
            new ValidationError(
              `Invalid input: ${inputResult.error.message}`,
              inputResult.error.issues
            )
          ),
          toPatch(schema.outputPath, null),
        ];
      }

      // Execute implementation
      const result = await implementation(inputResult.data, context);

      // Validate output
      const outputResult = schema.outputSchema.safeParse(result);
      if (!outputResult.success) {
        return [
          ...toErrorPatches(
            new ValidationError(
              `Invalid output: ${outputResult.error.message}`,
              outputResult.error.issues
            )
          ),
          toPatch(schema.outputPath, null),
        ];
      }

      // Return success patch
      return [toPatch(schema.outputPath, outputResult.data)];
    } catch (error) {
      // Handle implementation errors - never throw
      const err = error instanceof Error ? error : new Error(String(error));
      return [
        ...toErrorPatches(err, `${schema.outputPath}.error`),
        toPatch(schema.outputPath, null),
      ];
    }
  };
}
