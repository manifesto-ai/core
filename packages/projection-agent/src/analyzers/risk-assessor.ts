/**
 * Risk Assessor
 *
 * Assesses the risk level of actions and effects.
 * Helps AI agents understand the potential impact of actions.
 */

import type { ActionDefinition, Effect } from '@manifesto-ai/core';
import type { RiskAssessment } from '../types.js';
import { hasApiCall, hasNavigation, countSideEffects } from './effect-predictor.js';

// =============================================================================
// Risk Level Mapping
// =============================================================================

/**
 * Map semantic risk to AgentActionInfo risk level.
 */
export function getRiskFromSemantic(
  risk?: 'none' | 'low' | 'medium' | 'high' | 'critical'
): 'low' | 'medium' | 'high' {
  switch (risk) {
    case 'none':
    case 'low':
      return 'low';
    case 'medium':
      return 'medium';
    case 'high':
    case 'critical':
      return 'high';
    default:
      return 'low';
  }
}

// =============================================================================
// Effect Risk Assessment
// =============================================================================

/**
 * Assess the risk level of an effect.
 */
export function assessEffectRisk(effect: Effect): 'low' | 'medium' | 'high' {
  // High risk: API calls or navigation
  if (hasApiCall(effect)) return 'high';
  if (hasNavigation(effect)) return 'medium';

  // Medium risk: multiple side effects
  const sideEffectCount = countSideEffects(effect);
  if (sideEffectCount >= 5) return 'high';
  if (sideEffectCount >= 3) return 'medium';

  // Assess individual effects
  if (effect._tag === 'SetValue' || effect._tag === 'SetState') {
    return 'low';
  }

  if (effect._tag === 'EmitEvent') {
    return 'low';
  }

  if (effect._tag === 'Delay') {
    return 'low';
  }

  // Composite effects - take max risk
  if (effect._tag === 'Sequence' || effect._tag === 'Parallel') {
    const risks = effect.effects.map(assessEffectRisk);
    if (risks.includes('high')) return 'high';
    if (risks.includes('medium')) return 'medium';
    return 'low';
  }

  if (effect._tag === 'Conditional') {
    const thenRisk = assessEffectRisk(effect.then);
    const elseRisk = effect.else ? assessEffectRisk(effect.else) : 'low';
    if (thenRisk === 'high' || elseRisk === 'high') return 'high';
    if (thenRisk === 'medium' || elseRisk === 'medium') return 'medium';
    return 'low';
  }

  if (effect._tag === 'Catch') {
    const tryRisk = assessEffectRisk(effect.try);
    const catchRisk = effect.catch ? assessEffectRisk(effect.catch) : 'low';
    if (tryRisk === 'high' || catchRisk === 'high') return 'high';
    if (tryRisk === 'medium' || catchRisk === 'medium') return 'medium';
    return 'low';
  }

  return 'low';
}

// =============================================================================
// Action Risk Assessment
// =============================================================================

/**
 * Analyze risk factors for an action.
 */
export function analyzeRiskFactors(action: ActionDefinition): string[] {
  const factors: string[] = [];

  // Check effect-based risks
  if (action.effect) {
    if (hasApiCall(action.effect)) {
      factors.push('Makes external API call');
    }
    if (hasNavigation(action.effect)) {
      factors.push('Changes page/navigation');
    }

    const sideEffects = countSideEffects(action.effect);
    if (sideEffects >= 3) {
      factors.push(`Modifies ${sideEffects} values`);
    }
  }

  // Check semantic risk
  const semanticRisk = action.semantic.risk;
  if (semanticRisk === 'high' || semanticRisk === 'critical') {
    factors.push('Marked as high-risk action');
  }

  // Check for data persistence implications
  const verb = action.semantic.verb?.toLowerCase() ?? '';
  if (verb.includes('delete') || verb.includes('remove')) {
    factors.push('Deletes data');
  }
  if (verb.includes('submit') || verb.includes('confirm')) {
    factors.push('Finalizes/commits data');
  }
  if (verb.includes('publish') || verb.includes('send')) {
    factors.push('Sends data externally');
  }

  return factors;
}

/**
 * Generate risk mitigations for an action.
 */
export function generateRiskMitigations(
  action: ActionDefinition,
  factors: string[]
): string[] {
  const mitigations: string[] = [];

  for (const factor of factors) {
    if (factor.includes('API call')) {
      mitigations.push('Ensure network connectivity');
      mitigations.push('Check for rate limits');
    }
    if (factor.includes('Deletes data')) {
      mitigations.push('Confirm with user before deletion');
      mitigations.push('Consider soft-delete instead');
    }
    if (factor.includes('Sends data externally')) {
      mitigations.push('Verify data is correct before sending');
    }
  }

  return mitigations;
}

/**
 * Assess the full risk of an action.
 *
 * @param action - Action definition
 * @returns Full risk assessment
 */
export function assessActionRisk(action: ActionDefinition): RiskAssessment {
  // Check for explicit semantic risk
  const semanticRisk = getRiskFromSemantic(action.semantic.risk);

  // Assess effect risk
  let effectRisk: 'low' | 'medium' | 'high' = 'low';
  if (action.effect) {
    effectRisk = assessEffectRisk(action.effect);
  }

  // Take the higher of the two
  let level: 'low' | 'medium' | 'high' = 'low';
  if (semanticRisk === 'high' || effectRisk === 'high') {
    level = 'high';
  } else if (semanticRisk === 'medium' || effectRisk === 'medium') {
    level = 'medium';
  }

  // Analyze risk factors
  const factors = analyzeRiskFactors(action);

  // Upgrade risk level based on factors
  if (factors.length >= 3 && level === 'low') {
    level = 'medium';
  }
  if (factors.length >= 5 && level === 'medium') {
    level = 'high';
  }

  // Generate mitigations for high-risk actions
  const mitigations =
    level === 'high' ? generateRiskMitigations(action, factors) : undefined;

  return {
    level,
    factors,
    mitigations,
  };
}

// =============================================================================
// Risk Comparison
// =============================================================================

/**
 * Compare two risk levels.
 * Returns: -1 if a < b, 0 if a = b, 1 if a > b
 */
export function compareRiskLevels(
  a: 'low' | 'medium' | 'high',
  b: 'low' | 'medium' | 'high'
): number {
  const levels = { low: 0, medium: 1, high: 2 };
  return levels[a] - levels[b];
}

/**
 * Get the higher of two risk levels.
 */
export function maxRiskLevel(
  a: 'low' | 'medium' | 'high',
  b: 'low' | 'medium' | 'high'
): 'low' | 'medium' | 'high' {
  return compareRiskLevels(a, b) >= 0 ? a : b;
}
