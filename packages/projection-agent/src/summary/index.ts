/**
 * Summary module exports
 */

export {
  summarizeState,
  generateSummaryText,
  generateHighlights,
  generateIssues,
  summarizeActions,
  summarizeBlockers,
  summarizeNextSteps,
  categorizePathsByType,
  getInvalidPaths,
  getEmptyRequiredPaths,
  getFilledPaths,
  calculateCompletion,
  type SummaryConfig,
  type StateSummary,
} from './state-summarizer.js';
