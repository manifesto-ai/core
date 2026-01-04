import type { z } from "zod";
import type { EffectSchema, HandlerImplementation, EffectHandler } from "../types/index.js";
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
export declare function createHandler<TInput, TOutput>(schema: EffectSchema<string, z.ZodType<TInput>, z.ZodType<TOutput>>, implementation: HandlerImplementation<TInput, TOutput>): EffectHandler;
//# sourceMappingURL=handler.d.ts.map