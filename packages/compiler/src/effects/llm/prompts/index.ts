/**
 * @manifesto-ai/compiler v1.1 LLM Prompts
 *
 * Re-exports for all LLM prompts.
 */

// v1.1 Prompts
export { createPlanPrompt, createPlanPromptFromText, type PlanPromptParams, type PromptPair } from "./plan.js";
export { createGeneratePrompt, type GeneratePromptParams } from "./generate.js";
