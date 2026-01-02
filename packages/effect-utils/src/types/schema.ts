import type { z } from "zod";
import type { Patch, Snapshot } from "@manifesto-ai/core";
import type { EffectContext } from "@manifesto-ai/host";

/**
 * Configuration for defineEffectSchema
 */
export type EffectSchemaConfig<
  TType extends string,
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
> = {
  /** Effect type identifier (must match MEL effect declaration) */
  readonly type: TType;
  /** Input schema (Zod) */
  readonly input: TInput;
  /** Output schema (Zod) */
  readonly output: TOutput;
  /** Path where output will be written */
  readonly outputPath: string;
  /** Optional description */
  readonly description?: string;
};

/**
 * Effect schema with type inference
 */
export type EffectSchema<
  TType extends string = string,
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> = {
  readonly type: TType;
  readonly inputSchema: TInput;
  readonly outputSchema: TOutput;
  readonly outputPath: string;
  readonly description?: string;
  // Phantom types for inference (never actually used at runtime)
  readonly _input: z.infer<TInput>;
  readonly _output: z.infer<TOutput>;
};

/**
 * Handler implementation function type
 */
export type HandlerImplementation<TInput, TOutput> = (
  input: TInput,
  context: EffectContext
) => Promise<TOutput>;

/**
 * Effect handler function signature (Host Contract aligned)
 */
export type EffectHandler = (
  type: string,
  params: Record<string, unknown>,
  context: EffectContext
) => Promise<Patch[]>;
