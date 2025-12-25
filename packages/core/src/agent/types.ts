/**
 * Agent Types
 *
 * Type definitions for AI Agent integration with Manifesto.
 * These types define the interface between AI agents and the Manifesto runtime.
 *
 * Note: Actual LLM integration is deferred to Phase 3. These are type definitions only.
 */

import type { SemanticPath } from '../domain/types.js';
import type { AgentContext } from '../projection/types.js';
import type { Result, EffectError } from '../effect/result.js';

/**
 * AgentDecision - A decision made by an AI agent
 */
export type AgentDecision = {
  /** Unique decision identifier */
  id: string;

  /** Action to execute */
  actionId: string;

  /** Input for the action (optional) */
  input?: unknown;

  /** Agent's reasoning for this decision (for logging/debugging) */
  reasoning?: string;

  /** Agent's confidence in this decision (0-1) */
  confidence?: number;

  /** Timestamp when decision was made */
  timestamp: number;
};

/**
 * DecisionResult - Result of executing a decision
 */
export type DecisionResult = Result<DecisionSuccess, DecisionFailure>;

/**
 * DecisionSuccess - Successful decision execution
 */
export type DecisionSuccess = {
  /** Decision that was executed */
  decisionId: string;

  /** Paths that were modified */
  modifiedPaths: SemanticPath[];

  /** New context after execution */
  newContext: AgentContext;

  /** Execution duration in ms */
  durationMs: number;
};

/**
 * DecisionFailure - Failed decision execution
 */
export type DecisionFailure = {
  /** Decision that failed */
  decisionId: string;

  /** Type of failure */
  failureType: DecisionFailureType;

  /** Error details */
  error: EffectError | ValidationFailureDetails | UnavailableActionDetails;

  /** Context at time of failure */
  contextAtFailure: AgentContext;
};

/**
 * DecisionFailureType - Types of decision failures
 */
export type DecisionFailureType =
  | 'action_not_found'
  | 'action_unavailable'
  | 'validation_failed'
  | 'execution_failed'
  | 'precondition_failed';

/**
 * ValidationFailureDetails - Details about validation failure
 */
export type ValidationFailureDetails = {
  _tag: 'ValidationFailure';
  actionId: string;
  inputErrors: Array<{
    path: string;
    message: string;
  }>;
};

/**
 * UnavailableActionDetails - Details about why action is unavailable
 */
export type UnavailableActionDetails = {
  _tag: 'UnavailableAction';
  actionId: string;
  blockedReasons: Array<{
    path: SemanticPath;
    expected: 'true' | 'false';
    actual: boolean;
    reason?: string;
  }>;
};

/**
 * DecisionFeedback - Feedback sent to agent after decision execution
 *
 * This is a discriminated union of all possible feedback types.
 */
export type DecisionFeedback =
  | ActionSuccessFeedback
  | ActionFailureFeedback
  | UnavailableActionFeedback
  | ValidationFailureFeedback;

/**
 * ActionSuccessFeedback - Feedback for successful action execution
 */
export type ActionSuccessFeedback = {
  _tag: 'ActionSuccess';
  decisionId: string;
  actionId: string;
  modifiedPaths: SemanticPath[];
  newContext: AgentContext;
  message: string;
};

/**
 * ActionFailureFeedback - Feedback for failed action execution
 */
export type ActionFailureFeedback = {
  _tag: 'ActionFailure';
  decisionId: string;
  actionId: string;
  error: EffectError;
  contextAtFailure: AgentContext;
  message: string;
  suggestion?: string;
};

/**
 * UnavailableActionFeedback - Feedback when action was not available
 */
export type UnavailableActionFeedback = {
  _tag: 'UnavailableAction';
  decisionId: string;
  actionId: string;
  blockedReasons: Array<{
    path: SemanticPath;
    expected: 'true' | 'false';
    actual: boolean;
    reason?: string;
  }>;
  contextAtFailure: AgentContext;
  message: string;
  suggestion?: string;
};

/**
 * ValidationFailureFeedback - Feedback when input validation failed
 */
export type ValidationFailureFeedback = {
  _tag: 'ValidationFailure';
  decisionId: string;
  actionId: string;
  inputErrors: Array<{
    path: string;
    message: string;
  }>;
  contextAtFailure: AgentContext;
  message: string;
  suggestion?: string;
};

/**
 * AgentDecisionLoop - Interface for AI agent decision loops
 *
 * This interface defines how AI agents interact with Manifesto.
 * Implementation is deferred to Phase 3.
 *
 * @example
 * ```typescript
 * // Example usage (implementation in Phase 3)
 * const loop: AgentDecisionLoop = createAgentLoop(runtime, domain, llmAdapter);
 *
 * // Get current context for the agent
 * const context = loop.getContext();
 *
 * // Agent makes a decision (via LLM)
 * const decision = await llm.decide(context);
 *
 * // Submit decision for execution
 * const result = await loop.submitDecision(decision);
 *
 * // Get feedback for the agent
 * const feedback = loop.getLastFeedback();
 * ```
 */
export interface AgentDecisionLoop {
  /**
   * Get current context for the agent
   */
  getContext(): AgentContext;

  /**
   * Submit a decision for execution
   */
  submitDecision(decision: AgentDecision): Promise<DecisionResult>;

  /**
   * Get the last feedback (after a decision was submitted)
   */
  getLastFeedback(): DecisionFeedback | undefined;

  /**
   * Get decision history
   */
  getDecisionHistory(): Array<{
    decision: AgentDecision;
    result: DecisionResult;
    feedback: DecisionFeedback;
  }>;

  /**
   * Reset the decision loop (clear history)
   */
  reset(): void;
}

/**
 * AgentLoopConfig - Configuration for agent decision loop
 */
export type AgentLoopConfig = {
  /** Maximum decisions per session (safety limit) */
  maxDecisions?: number;

  /** Enable decision logging */
  enableLogging?: boolean;

  /** Custom feedback generator */
  feedbackGenerator?: (
    decision: AgentDecision,
    result: DecisionResult
  ) => DecisionFeedback;
};

/**
 * AgentCapabilities - What an agent can do
 */
export type AgentCapabilities = {
  /** Can read snapshot */
  canRead: boolean;

  /** Can execute actions */
  canExecute: boolean;

  /** Specific actions the agent can execute (undefined = all) */
  allowedActions?: string[];

  /** Specific paths the agent can read (undefined = all) */
  allowedPaths?: SemanticPath[];
};

/**
 * AgentSession - An agent session with the domain
 */
export type AgentSession = {
  /** Session identifier */
  sessionId: string;

  /** Agent capabilities */
  capabilities: AgentCapabilities;

  /** Session start time */
  startedAt: number;

  /** Number of decisions made */
  decisionCount: number;

  /** Last activity time */
  lastActivityAt: number;
};
