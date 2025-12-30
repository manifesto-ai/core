import type { EffectHandlerResult } from "./llm/handlers.js";

/**
 * Generic effect handler type
 */
export type EffectHandler = (params: Record<string, unknown>) => Promise<EffectHandlerResult>;

/**
 * Effect handler registry
 */
export type EffectHandlerRegistry = Record<string, EffectHandler>;
