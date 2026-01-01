import type { z } from "zod";
import type { EffectSchemaConfig, EffectSchema } from "../types/index.js";

/**
 * Defines a type-safe effect schema.
 *
 * @example
 * ```ts
 * import { z } from 'zod';
 * import { defineEffectSchema } from '@manifesto-ai/effect-utils';
 *
 * const fetchUserSchema = defineEffectSchema({
 *   type: 'api.user.fetch',
 *   input: z.object({
 *     userId: z.string(),
 *     includeProfile: z.boolean().default(false),
 *   }),
 *   output: z.object({
 *     id: z.string(),
 *     name: z.string(),
 *     email: z.string(),
 *     profile: z.object({
 *       avatar: z.string(),
 *       bio: z.string(),
 *     }).optional(),
 *   }),
 *   outputPath: 'data.user',
 *   description: 'Fetches user data by ID',
 * });
 * ```
 */
export function defineEffectSchema<
  TType extends string,
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
>(
  config: EffectSchemaConfig<TType, TInput, TOutput>
): EffectSchema<TType, TInput, TOutput> {
  return {
    type: config.type,
    inputSchema: config.input,
    outputSchema: config.output,
    outputPath: config.outputPath,
    description: config.description,
    // Phantom types for inference (never actually used at runtime)
    _input: undefined as unknown as z.infer<TInput>,
    _output: undefined as unknown as z.infer<TOutput>,
  };
}
