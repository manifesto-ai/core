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
export function defineEffectSchema(config) {
    return {
        type: config.type,
        inputSchema: config.input,
        outputSchema: config.output,
        outputPath: config.outputPath,
        description: config.description,
        // Phantom types for inference (never actually used at runtime)
        _input: undefined,
        _output: undefined,
    };
}
//# sourceMappingURL=define.js.map