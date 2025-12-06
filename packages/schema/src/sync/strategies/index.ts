/**
 * View Update Strategies
 */

// Form Strategy
export {
  analyzeFormViewImpact,
  applyFormStrategy,
  type FormStrategyResult,
} from './form-strategy'

// List Strategy
export {
  analyzeListViewImpact,
  applyListStrategy,
  type ListStrategyResult,
} from './list-strategy'

// Reaction Strategy
export {
  extractFieldReferences,
  updateFieldReference,
  updateFieldReferences,
  findBrokenReferencesInForm,
  findBrokenReferencesInList,
  cleanupBrokenReactions,
  updateFormReactionReferences,
  updateListReferences,
  suggestReactionUpdates,
} from './reaction-strategy'
