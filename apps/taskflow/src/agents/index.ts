/**
 * TaskFlow Agents Module
 *
 * Exports all agent-related components for the TaskFlow application.
 * Follows Manifesto 1.0v patterns with a 2-LLM architecture:
 * - LLM1 (Intent Parser): User message → Intent
 * - LLM2 (Response Generator): Snapshot → User response
 */

// Agent
export { TaskFlowAgent, createTaskFlowAgent } from "./agent.js";

// Intent Parser
export { parseIntent, parseIntentFallback } from "./intent-parser.js";

// Response Generator
export { generateResponse, generateResponseFallback } from "./response-generator.js";

// Prompts
export {
  INTENT_PARSER_SYSTEM_PROMPT,
  INTENT_PARSER_USER_PROMPT,
  RESPONSE_GENERATOR_SYSTEM_PROMPT,
  RESPONSE_GENERATOR_USER_PROMPT,
  formatTaskList,
  formatTaskSummary,
} from "./prompts.js";

// Types
export type {
  ParsedIntent,
  IntentParseResult,
  QueryType,
  ResponseContext,
  ActionResult,
  ConversationMessage,
  AgentConfig,
  AgentSession,
  AgentResponse,
} from "./types.js";
