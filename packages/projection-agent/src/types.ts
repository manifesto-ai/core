/**
 * @manifesto-ai/projection-agent - Types
 *
 * Core types for Agent Projection layer.
 * Creates AI-readable context from domain runtime.
 *
 * Philosophy:
 * - "AI와 인간은 같은 언어로 사고한다"
 * - "Agent가 '왜 안되는지' 100% 설명 가능"
 * - "Zero Translation Loss"
 */

import type { SemanticPath, SemanticMeta, Unsubscribe } from '@manifesto-ai/core';

// =============================================================================
// Local Types for Projection
// =============================================================================

/**
 * Simplified validation result for projection.
 */
export type ProjectionValidationResult = {
  valid: boolean;
  issues: Array<{
    code: string;
    message: string;
    path: SemanticPath;
    severity: 'error' | 'warning' | 'info' | 'suggestion';
  }>;
};

/**
 * Simplified field policy for projection.
 */
export type ProjectionFieldPolicy = {
  relevant: boolean;
  editable: boolean;
  required: boolean;
  visible: boolean;
};

// =============================================================================
// AgentContext - Main Projection Type
// =============================================================================

/**
 * Complete AI Agent context for a domain.
 * Contains all information an AI needs to understand and interact with the domain.
 */
export type AgentContext<TData = unknown, TState = unknown> = {
  /** Domain metadata */
  domain: AgentDomainInfo;

  /** Current state summary (natural language) */
  summary: string;

  /** All paths with values and meanings */
  paths: AgentPathInfo[];

  /** Available actions with execution info */
  availableActions: AgentActionInfo[];

  /** AI-suggested next action (optional) */
  suggestion?: AgentSuggestion;

  /** Context generation timestamp */
  generatedAt: number;

  /** Snapshot version */
  snapshotVersion: number;
};

/**
 * Domain metadata for agent context.
 */
export type AgentDomainInfo = {
  /** Domain ID */
  id: string;

  /** Human-readable domain name */
  name: string;

  /** Domain description */
  description: string;

  /** Optional domain category */
  category?: string;

  /** Optional domain version */
  version?: string;
};

// =============================================================================
// AgentPathInfo
// =============================================================================

/**
 * Path information for AI consumption.
 * Includes value, display value, semantic info, and policy.
 */
export type AgentPathInfo = {
  /** Semantic path */
  path: SemanticPath;

  /** Actual value */
  value: unknown;

  /** Human-readable display value */
  displayValue: string;

  /** Semantic metadata */
  semantic: SemanticMeta;

  /** Validation result */
  validity: ProjectionValidationResult;

  /** Field policy (relevant, editable, required) */
  policy: ProjectionFieldPolicy;

  /** Paths that this value impacts */
  impacts?: SemanticPath[];

  /** Paths that this value depends on */
  dependencies?: SemanticPath[];
};

// =============================================================================
// AgentActionInfo
// =============================================================================

/**
 * Action information for AI consumption.
 * Explains what action does, why it's blocked, and what will happen.
 */
export type AgentActionInfo = {
  /** Action ID */
  id: string;

  /** Action verb (human-readable action word) */
  verb: string;

  /** Action description */
  description: string;

  /** Whether action can be executed */
  canExecute: boolean;

  /** Reasons why action is blocked (100% explainable) */
  blockedReasons: string[];

  /** What will happen when action executes (Effect descriptions) */
  willDo: string[];

  /** Risk level assessment */
  risk: 'low' | 'medium' | 'high';

  /** Whether action requires input */
  requiresInput: boolean;

  /** Input schema (JSON Schema format) */
  inputSchema?: JsonSchema;

  /** Expected outcome description */
  expectedOutcome?: string;

  /** Whether action is reversible */
  reversible?: boolean;
};

/**
 * AI suggestion for next action.
 */
export type AgentSuggestion = {
  /** Suggested action ID */
  action: string;

  /** Reason for suggestion */
  reason: string;

  /** Confidence score (0-1) */
  confidence: number;

  /** Suggested input (if action requires input) */
  suggestedInput?: unknown;
};

// =============================================================================
// JSON Schema (Simplified)
// =============================================================================

/**
 * JSON Schema type (simplified).
 */
export type JsonSchema = {
  type: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  description?: string;
  enum?: unknown[];
  items?: JsonSchema;
  [key: string]: unknown;
};

// =============================================================================
// Value Formatter Types
// =============================================================================

/**
 * Value formatter function.
 * Converts a value to a human-readable string.
 */
export type ValueFormatter<T = unknown> = (
  value: T,
  options?: ValueFormatterOptions
) => string;

/**
 * Formatter options.
 */
export type ValueFormatterOptions = {
  /** Locale for formatting */
  locale?: string;

  /** Timezone for date formatting */
  timezone?: string;

  /** Currency code */
  currency?: string;

  /** Date format */
  dateFormat?: string;

  /** Number format options */
  numberFormat?: Intl.NumberFormatOptions;

  /** Maximum length before truncation */
  truncateLength?: number;

  /** Display for null values */
  nullDisplay?: string;

  /** Display for undefined values */
  undefinedDisplay?: string;
};

/**
 * Formatter registry.
 */
export type FormatterRegistry = {
  /** Type-specific formatters */
  formatters: Map<string, ValueFormatter>;

  /** Default formatter for unknown types */
  defaultFormatter: ValueFormatter;

  /** Global options */
  options: ValueFormatterOptions;
};

// =============================================================================
// Effect Prediction Types
// =============================================================================

/**
 * Effect prediction result.
 */
export type EffectPrediction = {
  /** Natural language description */
  description: string;

  /** Paths affected by this effect */
  affectedPaths: SemanticPath[];

  /** Side effect type */
  sideEffectType: 'data' | 'state' | 'navigation' | 'api' | 'event';
};

/**
 * Risk assessment result.
 */
export type RiskAssessment = {
  /** Risk level */
  level: 'low' | 'medium' | 'high';

  /** Risk factors */
  factors: string[];

  /** Mitigation suggestions */
  mitigations?: string[];
};

// =============================================================================
// Projector Configuration
// =============================================================================

/**
 * Projector configuration.
 */
export type ProjectorConfig = {
  /** Value formatter registry */
  formatters?: FormatterRegistry;

  /** Enable summary generation */
  enableSummary?: boolean;

  /** Enable action suggestions */
  enableSuggestions?: boolean;

  /** Include dependency/impact relations */
  includeRelations?: boolean;

  /** Locale setting */
  locale?: string;

  /** Custom summary generator */
  customSummarizer?: (context: Omit<AgentContext, 'summary'>) => string;

  /** Custom suggestion generator */
  customSuggester?: (
    context: Omit<AgentContext, 'suggestion'>
  ) => AgentSuggestion | undefined;
};

/**
 * Agent Projector configuration (alias for compatibility).
 */
export type AgentProjectorConfig = {
  /** Value formatter registry */
  formatters?: FormatterRegistry;

  /** Include suggestion in context */
  includeSuggestion?: boolean;

  /** Include unavailable actions in context */
  includeUnavailableActions?: boolean;

  /** Maximum summary length */
  maxSummaryLength?: number;

  /** Minimum confidence for suggestion */
  minSuggestionConfidence?: number;
};

// =============================================================================
// Agent Projector Interface
// =============================================================================

/**
 * Agent Projector interface.
 */
export interface AgentProjectorInterface<TData = unknown, TState = unknown> {
  /**
   * Project current runtime state to AgentContext.
   */
  project(): AgentContext<TData, TState>;

  /**
   * Project a single path.
   */
  projectPath(path: SemanticPath): AgentPathInfo;

  /**
   * Project a single action.
   */
  projectAction(actionId: string): AgentActionInfo;

  /**
   * Subscribe to context changes.
   */
  subscribe(listener: (context: AgentContext<TData, TState>) => void): Unsubscribe;

  /**
   * Update projector configuration.
   */
  configure(config: Partial<ProjectorConfig>): void;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if value is a valid AgentDomainInfo.
 */
export function isAgentDomainInfo(value: unknown): value is AgentDomainInfo {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.description === 'string'
  );
}

/**
 * Check if value is a valid AgentPathInfo.
 */
export function isAgentPathInfo(value: unknown): value is AgentPathInfo {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.path === 'string' &&
    typeof obj.displayValue === 'string' &&
    typeof obj.semantic === 'object' &&
    obj.semantic !== null &&
    typeof obj.policy === 'object' &&
    obj.policy !== null
  );
}

/**
 * Check if value is a valid AgentActionInfo.
 */
export function isAgentActionInfo(value: unknown): value is AgentActionInfo {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.verb === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.canExecute === 'boolean' &&
    Array.isArray(obj.blockedReasons) &&
    Array.isArray(obj.willDo) &&
    (obj.risk === 'low' || obj.risk === 'medium' || obj.risk === 'high') &&
    typeof obj.requiresInput === 'boolean'
  );
}

/**
 * Check if value is a valid AgentSuggestion.
 */
export function isAgentSuggestion(value: unknown): value is AgentSuggestion {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.action === 'string' &&
    typeof obj.reason === 'string' &&
    typeof obj.confidence === 'number' &&
    obj.confidence >= 0 &&
    obj.confidence <= 1
  );
}

/**
 * Check if value is a valid AgentContext.
 */
export function isAgentContext(value: unknown): value is AgentContext {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    isAgentDomainInfo(obj.domain) &&
    typeof obj.summary === 'string' &&
    Array.isArray(obj.paths) &&
    Array.isArray(obj.availableActions) &&
    typeof obj.generatedAt === 'number' &&
    typeof obj.snapshotVersion === 'number'
  );
}
