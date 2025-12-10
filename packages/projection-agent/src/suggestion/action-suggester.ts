/**
 * Action Suggester
 *
 * Suggests the next best action based on current state.
 * Provides AI agents with intelligent action recommendations.
 */

import type { AgentPathInfo, AgentActionInfo, AgentSuggestion } from '../types.js';
import { getEmptyRequiredPaths, getInvalidPaths, calculateCompletion } from '../summary/state-summarizer.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Suggestion configuration options.
 */
export interface SuggestionConfig {
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;
  /** Prefer low-risk actions */
  preferLowRisk?: boolean;
  /** Consider user intent/goal */
  userGoal?: string;
}

/**
 * Scored action for ranking.
 */
interface ScoredAction {
  action: AgentActionInfo;
  score: number;
  reasons: string[];
}

// =============================================================================
// Action Scoring
// =============================================================================

/**
 * Score an action based on current context.
 */
function scoreAction(
  action: AgentActionInfo,
  paths: AgentPathInfo[],
  config: SuggestionConfig = {}
): ScoredAction {
  let score = 0;
  const reasons: string[] = [];

  // Can't suggest unavailable actions
  if (!action.canExecute) {
    return { action, score: -1, reasons: ['Action is not available'] };
  }

  // Base score for available actions
  score += 10;
  reasons.push('Action is available');

  // Risk preference
  if (config.preferLowRisk !== false) {
    if (action.risk === 'low') {
      score += 5;
      reasons.push('Low risk');
    } else if (action.risk === 'medium') {
      score += 2;
    } else if (action.risk === 'high') {
      score -= 3;
      reasons.push('High risk (lower priority)');
    }
  }

  // Verb-based scoring
  const verb = action.verb.toLowerCase();

  // Submit/confirm actions - high value when ready
  if (verb.includes('submit') || verb.includes('confirm') || verb.includes('save')) {
    const completion = calculateCompletion(paths);
    const invalid = getInvalidPaths(paths);

    if (completion === 100 && invalid.length === 0) {
      score += 20;
      reasons.push('Form is complete and valid');
    } else {
      score -= 10;
      reasons.push('Form not ready for submission');
    }
  }

  // Validation actions - good when there are errors
  if (verb.includes('validate') || verb.includes('check')) {
    const invalid = getInvalidPaths(paths);
    if (invalid.length > 0) {
      score += 15;
      reasons.push('Has validation errors to check');
    }
  }

  // Reset/clear actions - usually low priority
  if (verb.includes('reset') || verb.includes('clear') || verb.includes('cancel')) {
    score -= 5;
    reasons.push('Destructive action (lower priority)');
  }

  // Add/create actions - good when building up data
  if (verb.includes('add') || verb.includes('create') || verb.includes('new')) {
    const completion = calculateCompletion(paths);
    if (completion < 50) {
      score += 8;
      reasons.push('Building up data');
    }
  }

  // Edit/update actions - neutral
  if (verb.includes('edit') || verb.includes('update') || verb.includes('modify')) {
    score += 3;
  }

  // Delete/remove actions - lower priority
  if (verb.includes('delete') || verb.includes('remove')) {
    score -= 3;
    reasons.push('Destructive action');
  }

  // User goal matching
  if (config.userGoal) {
    const goal = config.userGoal.toLowerCase();
    if (
      action.description.toLowerCase().includes(goal) ||
      verb.includes(goal)
    ) {
      score += 15;
      reasons.push(`Matches user goal: ${config.userGoal}`);
    }
  }

  // Input requirement - slight preference for no-input actions
  if (!action.requiresInput) {
    score += 2;
    reasons.push('No input required');
  }

  return { action, score, reasons };
}

/**
 * Rank all available actions by score.
 */
export function rankActions(
  actions: AgentActionInfo[],
  paths: AgentPathInfo[],
  config: SuggestionConfig = {}
): ScoredAction[] {
  const scored = actions.map((action) => scoreAction(action, paths, config));

  // Filter out unavailable and sort by score
  return scored
    .filter((s) => s.score >= 0)
    .sort((a, b) => b.score - a.score);
}

// =============================================================================
// Suggestion Generation
// =============================================================================

/**
 * Generate reason text for suggestion.
 */
function generateReason(
  action: AgentActionInfo,
  paths: AgentPathInfo[],
  scoredReasons: string[]
): string {
  const completion = calculateCompletion(paths);
  const emptyRequired = getEmptyRequiredPaths(paths);
  const invalid = getInvalidPaths(paths);

  // Context-aware reason generation
  const verb = action.verb.toLowerCase();

  if (verb.includes('submit') || verb.includes('confirm')) {
    if (completion === 100 && invalid.length === 0) {
      return 'All required fields are complete and valid. Ready to submit.';
    }
  }

  if (verb.includes('validate') && invalid.length > 0) {
    return `There are ${invalid.length} validation error(s) to review.`;
  }

  if (verb.includes('add') || verb.includes('create')) {
    if (emptyRequired.length > 0) {
      return `${emptyRequired.length} required field(s) still need to be filled.`;
    }
    return 'This action can help build up the data.';
  }

  // Default to top scoring reason
  const topReason = scoredReasons[0];
  if (topReason) {
    return topReason;
  }

  return `${action.description} is available and can be executed.`;
}

/**
 * Calculate confidence based on score and context.
 */
function calculateConfidence(
  score: number,
  action: AgentActionInfo,
  paths: AgentPathInfo[],
  allScores: number[]
): number {
  // Base confidence from absolute score
  let confidence = Math.min(score / 40, 1);

  // Adjust based on score gap with next action
  if (allScores.length > 1) {
    const first = allScores[0] ?? 0;
    const second = allScores[1] ?? 0;
    const gap = first - second;
    if (gap > 10) {
      confidence = Math.min(confidence + 0.2, 1);
    } else if (gap < 3) {
      confidence = Math.max(confidence - 0.1, 0.3);
    }
  }

  // High confidence for submit when ready
  const verb = action.verb.toLowerCase();
  if (verb.includes('submit') || verb.includes('confirm')) {
    const completion = calculateCompletion(paths);
    const invalid = getInvalidPaths(paths);
    if (completion === 100 && invalid.length === 0) {
      confidence = Math.max(confidence, 0.9);
    }
  }

  // Lower confidence for high-risk actions
  if (action.risk === 'high') {
    confidence = Math.min(confidence, 0.6);
  }

  return Math.round(confidence * 100) / 100;
}

/**
 * Suggest the next best action.
 *
 * @param paths - Current path information
 * @param actions - Available actions
 * @param config - Suggestion configuration
 * @returns Suggestion or undefined if no good action
 */
export function suggestAction(
  paths: AgentPathInfo[],
  actions: AgentActionInfo[],
  config: SuggestionConfig = {}
): AgentSuggestion | undefined {
  const minConfidence = config.minConfidence ?? 0.3;

  // Rank all actions
  const ranked = rankActions(actions, paths, config);

  const best = ranked[0];
  if (!best) {
    return undefined;
  }

  const allScores = ranked.map((r) => r.score);

  // Calculate confidence
  const confidence = calculateConfidence(
    best.score,
    best.action,
    paths,
    allScores
  );

  // Check minimum confidence threshold
  if (confidence < minConfidence) {
    return undefined;
  }

  // Generate reason
  const reason = generateReason(best.action, paths, best.reasons);

  return {
    action: best.action.id,
    reason,
    confidence,
  };
}

// =============================================================================
// Alternative Suggestions
// =============================================================================

/**
 * Get alternative action suggestions.
 */
export function suggestAlternatives(
  paths: AgentPathInfo[],
  actions: AgentActionInfo[],
  config: SuggestionConfig = {},
  limit: number = 3
): AgentSuggestion[] {
  const ranked = rankActions(actions, paths, config);
  const suggestions: AgentSuggestion[] = [];

  for (const scored of ranked.slice(0, limit)) {
    const allScores = ranked.map((r) => r.score);
    const confidence = calculateConfidence(
      scored.score,
      scored.action,
      paths,
      allScores
    );

    suggestions.push({
      action: scored.action.id,
      reason: generateReason(scored.action, paths, scored.reasons),
      confidence,
    });
  }

  return suggestions;
}

// =============================================================================
// Goal-Based Suggestion
// =============================================================================

/**
 * Suggest action based on explicit goal.
 */
export function suggestForGoal(
  goal: string,
  paths: AgentPathInfo[],
  actions: AgentActionInfo[]
): AgentSuggestion | undefined {
  return suggestAction(paths, actions, { userGoal: goal });
}

/**
 * Check if a goal can be achieved with current state.
 */
export function canAchieveGoal(
  goal: string,
  actions: AgentActionInfo[]
): { possible: boolean; blockers: string[] } {
  const goalLower = goal.toLowerCase();

  // Find actions that might achieve the goal
  const relevant = actions.filter(
    (a) =>
      a.description.toLowerCase().includes(goalLower) ||
      a.verb.toLowerCase().includes(goalLower)
  );

  if (relevant.length === 0) {
    return {
      possible: false,
      blockers: [`No action found matching goal: ${goal}`],
    };
  }

  // Check if any relevant action is available
  const available = relevant.filter((a) => a.canExecute);
  if (available.length > 0) {
    return { possible: true, blockers: [] };
  }

  // Collect blockers from unavailable actions
  const blockers = relevant.flatMap((a) => a.blockedReasons);

  return {
    possible: false,
    blockers: [...new Set(blockers)],
  };
}
