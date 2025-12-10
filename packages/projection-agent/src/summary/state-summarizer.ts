/**
 * State Summarizer
 *
 * Generates natural language summaries of domain state.
 * Helps AI agents quickly understand the current situation.
 */

import type { SemanticPath } from '@manifesto-ai/core';
import type { AgentPathInfo, AgentActionInfo, AgentDomainInfo } from '../types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Summary configuration options.
 */
export interface SummaryConfig {
  /** Maximum length of the summary */
  maxLength?: number;
  /** Include validation errors */
  includeValidation?: boolean;
  /** Include action availability */
  includeActions?: boolean;
  /** Language for summary (default: 'en') */
  language?: 'en' | 'ko';
}

/**
 * State summary result.
 */
export interface StateSummary {
  /** Main summary text */
  text: string;
  /** Key highlights */
  highlights: string[];
  /** Issues found */
  issues: string[];
  /** Completion percentage (0-100) */
  completionPercent: number;
}

// =============================================================================
// Path Analysis
// =============================================================================

/**
 * Categorize paths by their semantic type.
 */
export function categorizePathsByType(
  paths: AgentPathInfo[]
): Record<string, AgentPathInfo[]> {
  const categories: Record<string, AgentPathInfo[]> = {};

  for (const path of paths) {
    const type = path.semantic.type ?? 'unknown';
    if (!categories[type]) {
      categories[type] = [];
    }
    categories[type].push(path);
  }

  return categories;
}

/**
 * Get paths with validation errors.
 */
export function getInvalidPaths(paths: AgentPathInfo[]): AgentPathInfo[] {
  return paths.filter((p) => !p.validity.valid);
}

/**
 * Get required paths that are empty.
 */
export function getEmptyRequiredPaths(paths: AgentPathInfo[]): AgentPathInfo[] {
  return paths.filter((p) => {
    const isRequired = p.policy.required;
    const isEmpty =
      p.value === null ||
      p.value === undefined ||
      p.value === '' ||
      (Array.isArray(p.value) && p.value.length === 0);
    return isRequired && isEmpty;
  });
}

/**
 * Get paths that have been filled (non-empty).
 */
export function getFilledPaths(paths: AgentPathInfo[]): AgentPathInfo[] {
  return paths.filter((p) => {
    const isEmpty =
      p.value === null ||
      p.value === undefined ||
      p.value === '' ||
      (Array.isArray(p.value) && p.value.length === 0);
    return !isEmpty;
  });
}

/**
 * Calculate completion percentage.
 */
export function calculateCompletion(paths: AgentPathInfo[]): number {
  const requiredPaths = paths.filter((p) => p.policy.required);
  if (requiredPaths.length === 0) return 100;

  const filledRequired = requiredPaths.filter((p) => {
    const isEmpty =
      p.value === null ||
      p.value === undefined ||
      p.value === '' ||
      (Array.isArray(p.value) && p.value.length === 0);
    return !isEmpty;
  });

  return Math.round((filledRequired.length / requiredPaths.length) * 100);
}

// =============================================================================
// Summary Generation
// =============================================================================

/**
 * Generate a label from a semantic path.
 */
function getPathLabel(path: AgentPathInfo): string {
  // Use semantic description if available
  if (path.semantic.description) {
    // Extract short label from description
    const desc = path.semantic.description;
    if (desc.length <= 30) return desc;
    return desc.slice(0, 27) + '...';
  }

  // Extract last segment of path
  const segments = path.path.split('.');
  const lastSegment = segments[segments.length - 1] ?? path.path;

  // Convert camelCase/snake_case to words
  return lastSegment
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Generate highlights from filled paths.
 */
export function generateHighlights(
  paths: AgentPathInfo[],
  limit: number = 5
): string[] {
  const filled = getFilledPaths(paths);
  const highlights: string[] = [];

  // Prioritize paths with high importance or semantic significance
  const importanceRank = (imp: string | undefined): number => {
    switch (imp) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  };

  const sorted = [...filled].sort((a, b) => {
    // Prioritize by semantic importance
    const aImportance = importanceRank(a.semantic.importance);
    const bImportance = importanceRank(b.semantic.importance);
    return bImportance - aImportance;
  });

  for (const path of sorted.slice(0, limit)) {
    const label = getPathLabel(path);
    highlights.push(`${label}: ${path.displayValue}`);
  }

  return highlights;
}

/**
 * Generate issues list from validation errors and missing required fields.
 */
export function generateIssues(
  paths: AgentPathInfo[],
  config: SummaryConfig = {}
): string[] {
  const issues: string[] = [];

  // Add validation errors
  if (config.includeValidation !== false) {
    const invalid = getInvalidPaths(paths);
    for (const path of invalid) {
      const label = getPathLabel(path);
      const errors = path.validity.issues.map((issue) => issue.message).join(', ');
      issues.push(`${label}: ${errors}`);
    }
  }

  // Add missing required fields
  const emptyRequired = getEmptyRequiredPaths(paths);
  for (const path of emptyRequired) {
    const label = getPathLabel(path);
    issues.push(`${label} is required but empty`);
  }

  return issues;
}

/**
 * Generate action summary.
 */
export function summarizeActions(actions: AgentActionInfo[]): string {
  const available = actions.filter((a) => a.canExecute);
  const blocked = actions.filter((a) => !a.canExecute);

  if (available.length === 0) {
    return 'No actions currently available.';
  }

  const actionNames = available
    .slice(0, 3)
    .map((a) => a.verb)
    .join(', ');

  let summary = `${available.length} action(s) available: ${actionNames}`;
  if (available.length > 3) {
    summary += `, and ${available.length - 3} more`;
  }

  if (blocked.length > 0) {
    summary += `. ${blocked.length} action(s) blocked.`;
  }

  return summary;
}

/**
 * Generate the main summary text.
 */
export function generateSummaryText(
  domain: AgentDomainInfo,
  paths: AgentPathInfo[],
  actions: AgentActionInfo[],
  config: SummaryConfig = {}
): string {
  const completion = calculateCompletion(paths);
  const invalid = getInvalidPaths(paths);
  const emptyRequired = getEmptyRequiredPaths(paths);
  const available = actions.filter((a) => a.canExecute);

  const parts: string[] = [];

  // Domain context
  parts.push(`${domain.name}`);

  // Completion status
  if (completion === 100) {
    parts.push('is complete');
  } else {
    parts.push(`is ${completion}% complete`);
  }

  // Issues
  const issueCount = invalid.length + emptyRequired.length;
  if (issueCount > 0) {
    parts.push(`with ${issueCount} issue(s) to resolve`);
  }

  // Actions
  if (config.includeActions !== false && available.length > 0) {
    parts.push(`- ${available.length} action(s) available`);
  }

  let text = parts.join(' ');

  // Truncate if needed
  if (config.maxLength && text.length > config.maxLength) {
    text = text.slice(0, config.maxLength - 3) + '...';
  }

  return text;
}

/**
 * Summarize the current domain state.
 *
 * @param domain - Domain information
 * @param paths - All path information
 * @param actions - All action information
 * @param config - Summary configuration
 * @returns Complete state summary
 */
export function summarizeState(
  domain: AgentDomainInfo,
  paths: AgentPathInfo[],
  actions: AgentActionInfo[],
  config: SummaryConfig = {}
): StateSummary {
  const text = generateSummaryText(domain, paths, actions, config);
  const highlights = generateHighlights(paths);
  const issues = generateIssues(paths, config);
  const completionPercent = calculateCompletion(paths);

  return {
    text,
    highlights,
    issues,
    completionPercent,
  };
}

// =============================================================================
// Context-Aware Summary
// =============================================================================

/**
 * Generate a summary focused on what's blocking progress.
 */
export function summarizeBlockers(
  paths: AgentPathInfo[],
  actions: AgentActionInfo[]
): string[] {
  const blockers: string[] = [];

  // Missing required fields
  const emptyRequired = getEmptyRequiredPaths(paths);
  for (const path of emptyRequired) {
    const label = getPathLabel(path);
    blockers.push(`Fill in ${label}`);
  }

  // Validation errors
  const invalid = getInvalidPaths(paths);
  for (const path of invalid) {
    const label = getPathLabel(path);
    blockers.push(`Fix ${label}`);
  }

  // Blocked actions with reasons
  const blocked = actions.filter((a) => !a.canExecute);
  for (const action of blocked.slice(0, 3)) {
    if (action.blockedReasons.length > 0) {
      blockers.push(`${action.verb}: ${action.blockedReasons[0]}`);
    }
  }

  return blockers;
}

/**
 * Generate a summary of what can be done next.
 */
export function summarizeNextSteps(
  paths: AgentPathInfo[],
  actions: AgentActionInfo[]
): string[] {
  const steps: string[] = [];

  // Available actions
  const available = actions.filter((a) => a.canExecute);
  for (const action of available.slice(0, 3)) {
    steps.push(`Can ${action.verb}: ${action.description}`);
  }

  // Empty optional fields
  const emptyOptional = paths.filter((p) => {
    const isEmpty =
      p.value === null ||
      p.value === undefined ||
      p.value === '' ||
      (Array.isArray(p.value) && p.value.length === 0);
    return isEmpty && !p.policy.required && p.policy.relevant;
  });

  for (const path of emptyOptional.slice(0, 2)) {
    const label = getPathLabel(path);
    steps.push(`Optionally fill ${label}`);
  }

  return steps;
}
