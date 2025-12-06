/**
 * Condition Generator - Public exports
 *
 * 자연어 비즈니스 규칙 → Expression AST 변환
 */

// Main generator
export {
  conditionGenerator,
  generateCondition,
  tryGenerateFromTemplate,
  type ConditionGeneratorInput,
  type ConditionGeneratorOutput,
} from './condition-generator'

// Templates
export {
  matchTemplate,
  canMatchTemplate,
  getTemplateCategories,
  type TemplatePattern,
  type TemplateMatch,
} from './templates'

// Validator
export {
  validateExpression,
  validateExpressionResult,
  isValidExpression,
  validateForTarget,
  type ValidationError,
  type ValidationResult,
} from './validator'

// Prompts (for advanced usage)
export {
  buildSystemPrompt,
  buildUserPrompt,
  FEW_SHOT_EXAMPLES,
  formatFewShotExamples,
} from './prompts'
