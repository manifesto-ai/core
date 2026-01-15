/**
 * @fileoverview Translator Services Module
 *
 * Factory for creating Translator ServiceMap.
 * Used with App's services configuration.
 *
 * @see SPEC-0.2.0v.md
 */

export {
  type HandlerContext,
  type HandlerFactory,
  createTranslatorHandlers,
} from "./handlers.js";

import type { ServiceMap } from "@manifesto-ai/app";
import type { LLMClient } from "../pipeline/llm-client.js";
import { createTranslatorHandlers } from "./handlers.js";

/**
 * Options for creating translator services
 */
export type TranslatorServicesOptions = {
  /** LLM client for S2 Propose stage */
  llmClient?: LLMClient;
  /** Schema for project lexicon derivation */
  schema?: unknown;
  /** Schema hash for intentKey derivation */
  schemaHash?: string;
};

/**
 * Create translator services for App integration
 *
 * @example
 * ```typescript
 * import TranslatorMel from './domain/translator.mel';
 * import { createTranslatorServices } from './services';
 *
 * const app = createApp(TranslatorMel, {
 *   services: createTranslatorServices({ llmClient }),
 * });
 * ```
 */
export function createTranslatorServices(
  options: TranslatorServicesOptions = {}
): ServiceMap {
  return createTranslatorHandlers({
    llmClient: options.llmClient,
    schema: options.schema,
    schemaHash: options.schemaHash,
  });
}
