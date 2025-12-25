/**
 * Agent Module
 *
 * Type definitions for AI Agent integration with Manifesto.
 * Actual implementation deferred to Phase 3.
 */

export type {
  // Decision types
  AgentDecision,
  DecisionResult,
  DecisionSuccess,
  DecisionFailure,
  DecisionFailureType,
  ValidationFailureDetails,
  UnavailableActionDetails,

  // Feedback types
  DecisionFeedback,
  ActionSuccessFeedback,
  ActionFailureFeedback,
  UnavailableActionFeedback,
  ValidationFailureFeedback,

  // Loop types
  AgentDecisionLoop,
  AgentLoopConfig,

  // Session types
  AgentCapabilities,
  AgentSession,
} from './types.js';
