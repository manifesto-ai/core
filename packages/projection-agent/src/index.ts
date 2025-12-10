/**
 * @manifesto-ai/projection-agent
 *
 * Agent Projection Layer for Manifesto AI
 *
 * Converts domain runtime state into AI-consumable AgentContext.
 * Provides 100% explainable action analysis, risk assessment, and suggestions.
 *
 * @example
 * ```typescript
 * import {
 *   createAgentProjector,
 *   projectAgentContext,
 * } from '@manifesto-ai/projection-agent';
 *
 * // Create a projector for ongoing use
 * const projector = createAgentProjector(runtime, domain);
 * const context = projector.project();
 *
 * // Or project directly
 * const context = projectAgentContext(runtime, domain, {
 *   includeSuggestion: true,
 * });
 *
 * console.log(context.summary);
 * // "Order Form is 75% complete with 2 issue(s) to resolve"
 *
 * console.log(context.suggestion);
 * // { action: 'submitOrder', reason: 'Ready to submit', confidence: 0.9 }
 * ```
 */

// =============================================================================
// Types
// =============================================================================

export type {
  // Agent Context Types
  AgentContext,
  AgentPathInfo,
  AgentActionInfo,
  AgentDomainInfo,
  AgentSuggestion,

  // Configuration
  AgentProjectorConfig,

  // Assessment Types
  RiskAssessment,
  EffectPrediction,

  // Formatting Types
  ValueFormatter,
  FormatterRegistry,
  JsonSchema,
} from './types.js';

// =============================================================================
// Main Projector
// =============================================================================

export {
  createAgentProjector,
  projectAgentContext,
  createMinimalContext,
  mergeContexts,
  type AgentProjector,
} from './projector.js';

// =============================================================================
// Formatters
// =============================================================================

export {
  // Core formatting
  formatValue,
  formatUnknown,
  createFormatterRegistry,
  getFormatterForSemantic,
  registerFormatter,
  mergeRegistries,

  // Default formatters
  defaultFormatters,
  stringFormatter,
  numberFormatter,
  booleanFormatter,
  dateFormatter,
  arrayFormatter,
  objectFormatter,
  nullFormatter,
  undefinedFormatter,
} from './formatters/index.js';

export {
  // Preset formatters
  PresetFormatters,
  currencyFormatter,
  percentFormatter,
  customDateFormatter,
  relativeTimeFormatter,
  fileSizeFormatter,
  phoneNumberFormatter,
  yesNoFormatter,
  listFormatter,
  jsonFormatter,
  maskedFormatter,
} from './formatters/index.js';

// =============================================================================
// Analyzers
// =============================================================================

export {
  // Action analysis
  analyzeAction,
  analyzeAllActions,
  preconditionsToBlockedReasons,
  zodToJsonSchema,

  // Action filtering
  getAvailableActions,
  getBlockedActions,
  groupActionsByRisk,
} from './analyzers/index.js';

export {
  // Effect prediction
  describeEffect,
  describeCompositeEffect,
  predictEffect,
  extractAffectedPaths,
  countSideEffects,
  hasApiCall,
  hasNavigation,
} from './analyzers/index.js';

export {
  // Risk assessment
  getRiskFromSemantic,
  assessEffectRisk,
  analyzeRiskFactors,
  generateRiskMitigations,
  assessActionRisk,
  compareRiskLevels,
  maxRiskLevel,
} from './analyzers/index.js';

// =============================================================================
// Summary
// =============================================================================

export {
  // State summarization
  summarizeState,
  generateSummaryText,
  generateHighlights,
  generateIssues,
  summarizeActions,
  summarizeBlockers,
  summarizeNextSteps,

  // Path analysis
  categorizePathsByType,
  getInvalidPaths,
  getEmptyRequiredPaths,
  getFilledPaths,
  calculateCompletion,

  // Types
  type SummaryConfig,
  type StateSummary,
} from './summary/index.js';

// =============================================================================
// Suggestion
// =============================================================================

export {
  // Action suggestion
  suggestAction,
  suggestAlternatives,
  suggestForGoal,
  canAchieveGoal,
  rankActions,

  // Types
  type SuggestionConfig,
} from './suggestion/index.js';
