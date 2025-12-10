/**
 * Agent Projector
 *
 * Main module for projecting domain runtime to AgentContext.
 * Creates AI-consumable representations of domain state.
 */

import type {
  DomainRuntime,
  ManifestoDomain,
  SemanticPath,
  SourceDefinition,
  DerivedDefinition,
  AsyncDefinition,
  PreconditionStatus,
} from '@manifesto-ai/core';
import type {
  AgentContext,
  AgentPathInfo,
  AgentActionInfo,
  AgentDomainInfo,
  AgentProjectorConfig,
  FormatterRegistry,
  ProjectionValidationResult,
  ProjectionFieldPolicy,
} from './types.js';
import { analyzeAction, analyzeAllActions } from './analyzers/action-analyzer.js';
import { createFormatterRegistry, formatValue } from './formatters/value-formatter.js';
import { summarizeState, type SummaryConfig } from './summary/state-summarizer.js';
import { suggestAction, type SuggestionConfig } from './suggestion/action-suggester.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Agent Projector instance.
 */
export interface AgentProjector<TData, TState> {
  /** Project current state to AgentContext */
  project(): AgentContext<TData, TState>;

  /** Project with custom configuration */
  projectWith(config: Partial<AgentProjectorConfig>): AgentContext<TData, TState>;

  /** Get path information for a specific path */
  getPathInfo(path: SemanticPath): AgentPathInfo | undefined;

  /** Get action information for a specific action */
  getActionInfo(actionId: string): AgentActionInfo | undefined;

  /** Get all path information */
  getAllPaths(): AgentPathInfo[];

  /** Get all action information */
  getAllActions(): AgentActionInfo[];

  /** Update formatter registry */
  setFormatters(registry: FormatterRegistry): void;
}

// =============================================================================
// Type for path schema
// =============================================================================

type PathSchema = SourceDefinition | DerivedDefinition | AsyncDefinition;

// =============================================================================
// Domain Info Extraction
// =============================================================================

/**
 * Extract domain info from domain definition.
 */
function extractDomainInfo<TData, TState>(
  domain: ManifestoDomain<TData, TState>
): AgentDomainInfo {
  return {
    id: domain.id,
    name: domain.name,
    description: domain.description ?? `Domain: ${domain.name}`,
  };
}

// =============================================================================
// Path Projection
// =============================================================================

/**
 * Get all path schemas from domain.
 */
function getAllPathSchemas<TData, TState>(
  domain: ManifestoDomain<TData, TState>
): Map<SemanticPath, PathSchema> {
  const schemas = new Map<SemanticPath, PathSchema>();

  // Add sources
  for (const [path, schema] of Object.entries(domain.paths.sources)) {
    schemas.set(path as SemanticPath, schema);
  }

  // Add derived
  for (const [path, schema] of Object.entries(domain.paths.derived)) {
    schemas.set(path as SemanticPath, schema);
  }

  // Add async
  for (const [path, schema] of Object.entries(domain.paths.async)) {
    schemas.set(path as SemanticPath, schema);
  }

  return schemas;
}

/**
 * Create a default validation result.
 */
function createDefaultValidation(): ProjectionValidationResult {
  return { valid: true, issues: [] };
}

/**
 * Convert ResolvedFieldPolicy to ProjectionFieldPolicy.
 */
function toProjectionPolicy(policy: { relevant: boolean; editable: boolean; required: boolean }): ProjectionFieldPolicy {
  return {
    relevant: policy.relevant,
    editable: policy.editable,
    required: policy.required,
    visible: policy.relevant,
  };
}

/**
 * Project all paths from domain runtime.
 */
function projectPaths<TData, TState>(
  runtime: DomainRuntime<TData, TState>,
  domain: ManifestoDomain<TData, TState>,
  formatters: FormatterRegistry
): AgentPathInfo[] {
  const paths: AgentPathInfo[] = [];
  const schemas = getAllPathSchemas(domain);

  for (const [path, schema] of schemas) {
    const value = runtime.get(path);
    const policy = runtime.getFieldPolicy(path);

    // Generate display value using formatters
    const displayValue = formatValue(value, schema.semantic, formatters);

    // Get dependencies from derived schema
    let dependencies: SemanticPath[] | undefined;
    if ('deps' in schema && Array.isArray(schema.deps)) {
      dependencies = schema.deps.length > 0 ? schema.deps : undefined;
    }

    paths.push({
      path,
      value,
      displayValue,
      semantic: schema.semantic,
      validity: createDefaultValidation(), // Would need schema validation
      policy: toProjectionPolicy(policy),
      dependencies,
      impacts: undefined, // Would need graph analysis
    });
  }

  return paths;
}

/**
 * Project a single path.
 */
function projectPath<TData, TState>(
  path: SemanticPath,
  runtime: DomainRuntime<TData, TState>,
  domain: ManifestoDomain<TData, TState>,
  formatters: FormatterRegistry
): AgentPathInfo | undefined {
  const schemas = getAllPathSchemas(domain);
  const schema = schemas.get(path);

  if (!schema) {
    return undefined;
  }

  const value = runtime.get(path);
  const policy = runtime.getFieldPolicy(path);
  const displayValue = formatValue(value, schema.semantic, formatters);

  let dependencies: SemanticPath[] | undefined;
  if ('deps' in schema && Array.isArray(schema.deps)) {
    dependencies = schema.deps.length > 0 ? schema.deps : undefined;
  }

  return {
    path,
    value,
    displayValue,
    semantic: schema.semantic,
    validity: createDefaultValidation(),
    policy: toProjectionPolicy(policy),
    dependencies,
    impacts: undefined,
  };
}

// =============================================================================
// Agent Projector Factory
// =============================================================================

/**
 * Create an Agent Projector instance.
 *
 * @param runtime - Domain runtime to project
 * @param domain - Domain definition
 * @param config - Optional configuration
 * @returns AgentProjector instance
 */
export function createAgentProjector<TData, TState>(
  runtime: DomainRuntime<TData, TState>,
  domain: ManifestoDomain<TData, TState>,
  config: AgentProjectorConfig = {}
): AgentProjector<TData, TState> {
  let formatters = config.formatters ?? createFormatterRegistry();

  const getPreconditions = (actionId: string): PreconditionStatus[] => {
    return runtime.getPreconditions(actionId);
  };

  return {
    project(): AgentContext<TData, TState> {
      return projectAgentContext(runtime, domain, {
        ...config,
        formatters,
      });
    },

    projectWith(overrideConfig: Partial<AgentProjectorConfig>): AgentContext<TData, TState> {
      return projectAgentContext(runtime, domain, {
        ...config,
        ...overrideConfig,
        formatters: overrideConfig.formatters ?? formatters,
      });
    },

    getPathInfo(path: SemanticPath): AgentPathInfo | undefined {
      return projectPath(path, runtime, domain, formatters);
    },

    getActionInfo(actionId: string): AgentActionInfo | undefined {
      const action = domain.actions[actionId];
      if (!action) return undefined;
      return analyzeAction(actionId, action, getPreconditions(actionId));
    },

    getAllPaths(): AgentPathInfo[] {
      return projectPaths(runtime, domain, formatters);
    },

    getAllActions(): AgentActionInfo[] {
      return analyzeAllActions(domain.actions, getPreconditions);
    },

    setFormatters(registry: FormatterRegistry): void {
      formatters = registry;
    },
  };
}

// =============================================================================
// Main Projection Function
// =============================================================================

/**
 * Project domain runtime to AgentContext.
 *
 * This is the main function for creating AI-consumable state representations.
 *
 * @param runtime - Domain runtime to project
 * @param domain - Domain definition
 * @param config - Optional configuration
 * @returns Complete AgentContext
 *
 * @example
 * ```typescript
 * const context = projectAgentContext(runtime, orderDomain, {
 *   includeSuggestion: true,
 * });
 *
 * console.log(context.summary);
 * // "Order Form is 75% complete with 2 issue(s) to resolve"
 *
 * console.log(context.suggestion);
 * // { action: 'fillEmail', reason: 'Email is required', confidence: 0.85 }
 * ```
 */
export function projectAgentContext<TData, TState>(
  runtime: DomainRuntime<TData, TState>,
  domain: ManifestoDomain<TData, TState>,
  config: AgentProjectorConfig = {}
): AgentContext<TData, TState> {
  const snapshot = runtime.getSnapshot();
  const formatters = config.formatters ?? createFormatterRegistry();

  // Extract domain info
  const domainInfo = extractDomainInfo(domain);

  // Project all paths
  const paths = projectPaths(runtime, domain, formatters);

  // Analyze all actions
  const getPreconditions = (actionId: string): PreconditionStatus[] => {
    return runtime.getPreconditions(actionId);
  };
  const allActions = analyzeAllActions(domain.actions, getPreconditions);

  // Filter to available actions (or all if configured)
  const availableActions = config.includeUnavailableActions
    ? allActions
    : allActions.filter((a) => a.canExecute);

  // Generate summary
  const summaryConfig: SummaryConfig = {
    maxLength: config.maxSummaryLength,
    includeValidation: true,
    includeActions: true,
  };
  const stateSummary = summarizeState(domainInfo, paths, allActions, summaryConfig);

  // Generate suggestion if requested
  let suggestion = undefined;
  if (config.includeSuggestion !== false) {
    const suggestionConfig: SuggestionConfig = {
      minConfidence: config.minSuggestionConfidence ?? 0.3,
      preferLowRisk: true,
    };
    suggestion = suggestAction(paths, allActions, suggestionConfig);
  }

  return {
    domain: domainInfo,
    summary: stateSummary.text,
    paths,
    availableActions,
    suggestion,
    generatedAt: Date.now(),
    snapshotVersion: snapshot.version,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create a minimal AgentContext (for debugging/testing).
 */
export function createMinimalContext<TData, TState>(
  domainId: string,
  domainName: string
): AgentContext<TData, TState> {
  return {
    domain: {
      id: domainId,
      name: domainName,
      description: `Domain: ${domainName}`,
    },
    summary: `${domainName} (empty)`,
    paths: [],
    availableActions: [],
    suggestion: undefined,
    generatedAt: Date.now(),
    snapshotVersion: 0,
  };
}

/**
 * Merge multiple AgentContexts (for multi-domain scenarios).
 */
export function mergeContexts<TData, TState>(
  contexts: AgentContext<TData, TState>[]
): AgentContext<TData, TState> {
  if (contexts.length === 0) {
    throw new Error('Cannot merge empty contexts array');
  }

  const first = contexts[0];
  if (!first) {
    throw new Error('Cannot merge empty contexts array');
  }

  if (contexts.length === 1) {
    return first;
  }

  const domainNames = contexts.map((c) => c.domain.name).join(' + ');
  const allPaths = contexts.flatMap((c) => c.paths);
  const allActions = contexts.flatMap((c) => c.availableActions);
  const summaries = contexts.map((c) => c.summary).join('. ');

  // Pick suggestion with highest confidence
  const suggestions = contexts
    .map((c) => c.suggestion)
    .filter((s): s is NonNullable<typeof s> => s !== undefined)
    .sort((a, b) => b.confidence - a.confidence);

  return {
    domain: {
      id: 'merged',
      name: domainNames,
      description: `Merged context from ${contexts.length} domains`,
    },
    summary: summaries,
    paths: allPaths,
    availableActions: allActions,
    suggestion: suggestions[0],
    generatedAt: Date.now(),
    snapshotVersion: Math.max(...contexts.map((c) => c.snapshotVersion)),
  };
}
