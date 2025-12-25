/**
 * Projection Types
 *
 * Types for transforming DomainSnapshot → AgentContext
 */

import type { SemanticPath, SemanticMeta, ActionSemanticMeta } from '../domain/types.js';
import type { ResolvedFieldPolicy, PreconditionStatus, ExplanationTree } from '../runtime/runtime.js';

/**
 * ProjectedSnapshot - Simplified snapshot for agents
 */
export type ProjectedSnapshot = {
  /** Data namespace values */
  data: Record<string, unknown>;
  /** State namespace values */
  state: Record<string, unknown>;
  /** Derived namespace values */
  derived: Record<string, unknown>;
  /** Async namespace values (results, loading states, errors) */
  async: Record<string, unknown>;
};

/**
 * AgentActionInfo - Information about an available action
 */
export type AgentActionInfo = {
  /** Action identifier */
  actionId: string;
  /** Action semantic metadata */
  semantic: ActionSemanticMeta;
  /** Dependencies that affect this action */
  deps: SemanticPath[];
  /** Precondition statuses */
  preconditions: PreconditionStatus[];
  /** Estimated impact paths */
  estimatedImpact: SemanticPath[];
};

/**
 * BlockedReason - Why an action is unavailable
 */
export type BlockedReason = {
  /** Type of block */
  type: 'precondition_failed';
  /** Path of the failed precondition */
  path: SemanticPath;
  /** Expected value */
  expected: 'true' | 'false';
  /** Actual value */
  actual: boolean;
  /** Human-readable reason */
  reason?: string;
};

/**
 * UnavailableAction - Action that cannot be executed
 */
export type UnavailableAction = {
  /** Action identifier */
  actionId: string;
  /** Action semantic metadata */
  semantic: ActionSemanticMeta;
  /** Reasons why the action is blocked */
  blockedReasons: BlockedReason[];
};

/**
 * FieldInfo - Information about a field for agents
 */
export type FieldInfo = {
  /** Semantic path */
  path: SemanticPath;
  /** Current value */
  value: unknown;
  /** Semantic metadata */
  semantic?: SemanticMeta;
  /** Resolved policy */
  policy: ResolvedFieldPolicy;
};

/**
 * AgentContextMetadata - Metadata about the projection
 */
export type AgentContextMetadata = {
  /** When the projection was created */
  projectedAt: number;
  /** Total number of paths */
  pathCount: number;
  /** Snapshot version */
  snapshotVersion: number;
  /** Estimated token count (for LLM context sizing) */
  estimatedTokens?: number;
};

/**
 * AgentContext - Complete context for AI agents
 *
 * This is the primary interface between Manifesto and AI agents.
 * It provides a structured view of the current state, available actions,
 * and field policies.
 */
export type AgentContext = {
  /** Projected snapshot (simplified view) */
  snapshot: ProjectedSnapshot;

  /** Actions that can be executed */
  availableActions: AgentActionInfo[];

  /** Actions that cannot be executed (with reasons) */
  unavailableActions: UnavailableAction[];

  /** Field policies by path */
  fieldPolicies: Record<SemanticPath, ResolvedFieldPolicy>;

  /** All fields with their info */
  fields: FieldInfo[];

  /** Projection metadata */
  metadata: AgentContextMetadata;
};

/**
 * ExplainValueResult - Result of explaining a value
 */
export type ExplainValueResult = ExplanationTree & {
  /** Natural language summary */
  summary: string;
};

/**
 * ExplainActionResult - Result of explaining an action
 */
export type ExplainActionResult = {
  /** Action identifier */
  actionId: string;
  /** Action semantic metadata */
  semantic: ActionSemanticMeta;
  /** Dependencies with explanations */
  dependencies: ExplainValueResult[];
  /** Preconditions with explanations */
  preconditions: Array<PreconditionStatus & { explanation: string }>;
  /** Estimated impact explanations */
  estimatedImpact: Array<{ path: SemanticPath; semantic?: SemanticMeta }>;
  /** Natural language summary */
  summary: string;
};

/**
 * ExplainFieldResult - Result of explaining a field
 */
export type ExplainFieldResult = {
  /** Field path */
  path: SemanticPath;
  /** Current value */
  value: unknown;
  /** Semantic metadata */
  semantic?: SemanticMeta;
  /** Resolved policy */
  policy: ResolvedFieldPolicy;
  /** Policy explanations */
  policyExplanation: {
    relevant: string;
    editable: string;
    required: string;
  };
  /** Natural language summary */
  summary: string;
};

/**
 * ImpactAnalysis - Analysis of impact from changing a value
 */
export type ImpactAnalysis = {
  /** The changed path */
  changedPath: SemanticPath;
  /** Directly affected paths */
  directImpact: SemanticPath[];
  /** Transitively affected paths */
  transitiveImpact: SemanticPath[];
  /** Async operations that may be triggered */
  asyncTriggers: SemanticPath[];
  /** Actions whose availability may change */
  affectedActions: string[];
};

/**
 * ActionImpactAnalysis - Analysis of impact from executing an action
 */
export type ActionImpactAnalysis = {
  /** Action identifier */
  actionId: string;
  /** Paths that will be directly modified */
  directModifications: SemanticPath[];
  /** Paths that will be affected through propagation */
  propagatedChanges: SemanticPath[];
  /** Other actions whose availability may change */
  affectedActions: string[];
  /** Risk assessment */
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
};
