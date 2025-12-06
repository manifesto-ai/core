/**
 * Planner Generator - Public exports
 *
 * 자연어 요구사항 → ViewPlan[] 변환
 */

// Main generator
export {
  plannerGenerator,
  generatePlan,
  generateViewPlansFromEntities,
  inferEntityRole,
  type PlannerGeneratorInput,
  type PlannerGeneratorOutput,
} from './planner-generator'

// Patterns
export {
  generateViewPlansForEntity,
  generateAllViewPlans,
  getAdditionalViews,
  suggestEntitiesFromDescription,
  INDUSTRY_PATTERNS,
  type IndustryViewPattern,
  type EntityPattern,
} from './patterns'

// Prompts (for advanced usage)
export {
  buildSystemPrompt as buildPlannerSystemPrompt,
  buildUserPrompt as buildPlannerUserPrompt,
  FEW_SHOT_EXAMPLES as PLANNER_FEW_SHOT_EXAMPLES,
  formatFewShotExample,
} from './prompts'
