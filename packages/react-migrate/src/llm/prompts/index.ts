/**
 * LLM Prompts
 *
 * 도메인별 LLM 프롬프트 템플릿
 */

// Analyzer Prompts
export {
  classifyFilePrompt,
  analyzeReducerPrompt,
  suggestDomainNamePrompt,
  analyzeComplexComponentPrompt,
  analyzeDomainBoundaryPrompt,
} from './analyzer.js';

// Summarizer Prompts
export {
  identifyDomainPrompt,
  extractEntitiesPrompt,
  extractActionsPrompt,
  generateSchemaPrompt,
  analyzeRelationshipsPrompt,
  resolveConflictPrompt,
} from './summarizer.js';

// Transformer Prompts
export {
  finalizeSchemaPrompt,
  generateDescriptionPrompt,
  fixValidationErrorsPrompt,
  improveSchemaPrompt,
  validateMappingsPrompt,
  generateMigrationSummaryPrompt,
} from './transformer.js';
