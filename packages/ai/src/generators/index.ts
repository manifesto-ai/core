/**
 * Generators - Public exports
 */

export {
  createGenerator,
  sequence,
  parallel,
  type Generator,
} from './base'

export {
  entityGenerator,
  generateEntity,
  buildSystemPrompt as buildEntitySystemPrompt,
  buildUserPrompt as buildEntityUserPrompt,
  FEW_SHOT_EXAMPLES,
  type EntityGeneratorInput,
} from './entity'

export {
  listGenerator,
  generateListView,
  buildListSystemPrompt,
  buildListUserPrompt,
  inferColumnType,
  type ListGeneratorInput,
} from './list'

export {
  formGenerator,
  generateFormView,
  buildFormSystemPrompt,
  buildFormUserPrompt,
  inferComponentType,
  inferColSpan,
  // Visibility
  generateFormVisibility,
  inferVisibilityRules,
  generateVisibilityFromHints,
  visibilityToReaction,
  buildVisibilityReactions,
  type FormGeneratorInput,
  type VisibilityHint,
  type VisibilityConfig,
  type FieldVisibility,
} from './form'

export {
  // Main generator
  conditionGenerator,
  generateCondition,
  tryGenerateFromTemplate,
  type ConditionGeneratorInput,
  type ConditionGeneratorOutput,
  // Templates
  matchTemplate,
  canMatchTemplate,
  getTemplateCategories,
  type TemplatePattern,
  type TemplateMatch,
  // Validator
  validateExpression,
  validateExpressionResult,
  isValidExpression,
  validateForTarget,
  type ValidationError,
  type ValidationResult,
  // Prompts
  buildSystemPrompt as buildConditionSystemPrompt,
  buildUserPrompt as buildConditionUserPrompt,
  FEW_SHOT_EXAMPLES as CONDITION_FEW_SHOT_EXAMPLES,
  formatFewShotExamples,
} from './condition'

export {
  // Main generator
  plannerGenerator,
  generatePlan,
  generateViewPlansFromEntities,
  inferEntityRole,
  type PlannerGeneratorInput,
  type PlannerGeneratorOutput,
  // Patterns
  generateViewPlansForEntity,
  generateAllViewPlans,
  getAdditionalViews,
  suggestEntitiesFromDescription,
  INDUSTRY_PATTERNS,
  type IndustryViewPattern,
  type EntityPattern,
  // Prompts
  buildPlannerSystemPrompt,
  buildPlannerUserPrompt,
  PLANNER_FEW_SHOT_EXAMPLES,
  formatFewShotExample,
} from './planner'
