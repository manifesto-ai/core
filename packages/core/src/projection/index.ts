/**
 * Projection Module
 *
 * Transform DomainRuntime state into AgentContext for AI agents.
 * This module provides pure functions for creating AI-readable views
 * of the domain state.
 */

// Types
export type {
  // Core types
  ProjectedSnapshot,
  AgentContext,
  AgentContextMetadata,

  // Action types
  AgentActionInfo,
  UnavailableAction,
  BlockedReason,

  // Field types
  FieldInfo,

  // Explanation types
  ExplainValueResult,
  ExplainActionResult,
  ExplainFieldResult,

  // Impact types
  ImpactAnalysis,
  ActionImpactAnalysis,
} from './types.js';

// Agent Context
export {
  projectSnapshot,
  projectAgentContext,
  type ProjectAgentContextOptions,
} from './agent-context.js';

// Explain
export { explainValue, explainAction, explainField } from './explain.js';

// Impact
export { analyzeValueImpact, analyzeActionImpact, getImpactMap } from './impact.js';
