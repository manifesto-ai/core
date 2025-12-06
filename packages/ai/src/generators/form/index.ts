/**
 * Form Generator - Public exports
 */

export { formGenerator, generateFormView, type FormGeneratorInput } from './form-generator'
export { buildFormSystemPrompt, buildFormUserPrompt, inferComponentType, inferColSpan } from './prompts'
export {
  generateFormVisibility,
  inferVisibilityRules,
  generateVisibilityFromHints,
  visibilityToReaction,
  buildVisibilityReactions,
  type VisibilityHint,
  type VisibilityConfig,
  type FieldVisibility,
} from './visibility'
