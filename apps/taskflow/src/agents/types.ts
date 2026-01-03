/**
 * Agent Types
 *
 * Type definitions for the TaskFlow agent system.
 * The agent uses a 2-LLM architecture:
 * - LLM1 (Intent Parser): User message → Intent
 * - LLM2 (Response Generator): Snapshot → User response
 */

import type { IntentBody } from "@manifesto-ai/world";
import type { Task, ViewMode, Filter } from "../manifesto/index.js";

// ============================================================================
// Intent Parsing Types
// ============================================================================

/**
 * Parsed intent from user message
 */
export interface ParsedIntent {
  /**
   * Intent body to dispatch
   */
  intent: IntentBody | null;

  /**
   * Confidence score (0-1)
   */
  confidence: number;

  /**
   * Whether this is a query (no state change needed)
   */
  isQuery: boolean;

  /**
   * Raw explanation from LLM
   */
  reasoning?: string;
}

/**
 * Intent parsing result
 */
export type IntentParseResult =
  | { kind: "intent"; intent: IntentBody; confidence: number }
  | { kind: "query"; queryType: QueryType; params: Record<string, unknown> }
  | { kind: "clarification"; message: string }
  | { kind: "error"; error: string };

/**
 * Query types that don't modify state
 */
export type QueryType =
  | "list_tasks"
  | "count_tasks"
  | "describe_task"
  | "summarize_status"
  | "help"
  | "unknown";

// ============================================================================
// Response Generation Types
// ============================================================================

/**
 * Context for response generation
 */
export interface ResponseContext {
  /**
   * User's original message
   */
  userMessage: string;

  /**
   * Parsed intent (if any)
   */
  parsedIntent: IntentParseResult;

  /**
   * Current tasks
   */
  tasks: Task[];

  /**
   * Computed values
   */
  computed: {
    todoCount: number;
    inProgressCount: number;
    reviewCount: number;
    doneCount: number;
    deletedCount: number;
  };

  /**
   * Current view mode
   */
  viewMode: ViewMode;

  /**
   * Action execution result (if action was taken)
   */
  actionResult?: ActionResult;

  /**
   * Conversation history (last N messages)
   */
  history?: ConversationMessage[];
}

/**
 * Result of action execution
 */
export interface ActionResult {
  success: boolean;
  actionType: string;
  affectedTaskIds?: string[];
  error?: string;
}

/**
 * Conversation message
 */
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

// ============================================================================
// Agent Configuration
// ============================================================================

/**
 * Agent configuration
 */
export interface AgentConfig {
  /**
   * OpenAI API key
   */
  apiKey: string;

  /**
   * Model for intent parsing
   */
  intentModel?: string;

  /**
   * Model for response generation
   */
  responseModel?: string;

  /**
   * Maximum conversation history length
   */
  maxHistoryLength?: number;

  /**
   * Language for responses
   */
  language?: "en" | "ko";
}

// ============================================================================
// Agent Session
// ============================================================================

/**
 * Agent session state
 */
export interface AgentSession {
  /**
   * Session ID
   */
  sessionId: string;

  /**
   * Conversation history
   */
  history: ConversationMessage[];

  /**
   * Created at timestamp
   */
  createdAt: number;

  /**
   * Last activity timestamp
   */
  lastActivityAt: number;
}

// ============================================================================
// Agent Response
// ============================================================================

/**
 * Agent response to user
 */
export interface AgentResponse {
  /**
   * Response message to display
   */
  message: string;

  /**
   * Intent that was executed (if any)
   */
  executedIntent?: IntentBody;

  /**
   * Whether an action was taken
   */
  actionTaken: boolean;

  /**
   * Affected task IDs (if action was taken)
   */
  affectedTaskIds?: string[];

  /**
   * Whether the response includes a query result
   */
  isQueryResult: boolean;
}
