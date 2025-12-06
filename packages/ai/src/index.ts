/**
 * @manifesto-ai/ai
 *
 * AI-powered schema generation for Manifesto Engine
 * Atomic and monadic generators with Vercel AI SDK integration
 *
 * @example
 * ```typescript
 * import { openai } from '@ai-sdk/openai'
 * import {
 *   createAIClient,
 *   createProvider,
 *   registerOpenAIProvider,
 *   entityGenerator
 * } from '@manifesto-ai/ai'
 *
 * // 1. Register provider
 * registerOpenAIProvider(openai)
 *
 * // 2. Create provider and client
 * const provider = createProvider({
 *   type: 'openai',
 *   model: 'gpt-4o-mini',
 * })
 * const client = createAIClient({ provider })
 *
 * // 3. Generate entity
 * const result = await entityGenerator.generate(
 *   { domainDescription: 'A customer management system for e-commerce' },
 *   { industry: { type: 'commerce' } },
 *   client
 * )
 *
 * if (result._tag === 'Ok') {
 *   console.log(result.value.value) // EntitySchema
 * }
 * ```
 */

// ============================================================================
// Core - AI Client & Provider
// ============================================================================

export {
  // Provider
  createProvider,
  registerProvider,
  registerOpenAIProvider,
  registerAnthropicProvider,
  OPENAI_PRESETS,
  ANTHROPIC_PRESETS,
  type AIProvider,
  type AIProviderConfig,
  type AIProviderType,
  type ProviderFactory,
  // Client
  createAIClient,
  type AIClient,
  type AIClientOptions,
  type GenerateObjectOptions,
  type GenerateTextOptions,
  type GenerateWithToolsOptions,
  type ToolCallResult,
  type ToolCall,
} from './core'

// ============================================================================
// Generators
// ============================================================================

export {
  // Base
  createGenerator,
  sequence,
  parallel,
  type Generator,
  // Entity Generator
  entityGenerator,
  generateEntity,
  buildEntitySystemPrompt,
  buildEntityUserPrompt,
  FEW_SHOT_EXAMPLES,
  type EntityGeneratorInput,
  // List Generator
  listGenerator,
  generateListView,
  buildListSystemPrompt,
  buildListUserPrompt,
  inferColumnType,
  type ListGeneratorInput,
  // Form Generator
  formGenerator,
  generateFormView,
  buildFormSystemPrompt,
  buildFormUserPrompt,
  inferComponentType,
  inferColSpan,
  type FormGeneratorInput,
} from './generators'

// ============================================================================
// Types
// ============================================================================

export {
  // Error types
  type AIGeneratorError,
  type ProviderError,
  type SchemaValidationError,
  type GenerationFailedError,
  type RateLimitedError,
  type InvalidInputError,
  type TimeoutError,
  // Type guards
  isProviderError,
  isSchemaValidationError,
  isGenerationFailedError,
  isRateLimitedError,
  isInvalidInputError,
  isTimeoutError,
  // Utilities
  isRetryable,
  getRetryDelay,
  // Constructors
  providerError,
  schemaValidationError,
  generationFailedError,
  rateLimitedError,
  invalidInputError,
  timeoutError,
  // Common types
  type GeneratorContext,
  type IndustryContext,
  type IndustryType,
  type NamingConvention,
  type GenerationResult,
  type GenerationMetadata,
  type TokenUsage,
  type FinishReason,
  type GeneratorOptions,
  DEFAULT_GENERATOR_OPTIONS,
  // View Plan types (for future use)
  type ViewType,
  type ViewPurpose,
  type ViewPlan,
  type ViewPlanConfig,
  // Sync types (for future use)
  type SyncEvent,
  type FieldAddedEvent,
  type FieldRemovedEvent,
  type FieldRenamedEvent,
  type TypeChangedEvent,
  // Result monad re-exports
  type Result,
  type Ok,
  type Err,
  ok,
  err,
  isOk,
  isErr,
  map,
  flatMap,
  fold,
  tryCatchAsync,
} from './types'

// ============================================================================
// Schemas (Zod schemas for custom extensions)
// ============================================================================

export {
  // Entity schemas
  GeneratedConstraintSchema,
  GeneratedEnumValueSchema,
  GeneratedReferenceConfigSchema,
  GeneratedFieldSchema,
  GeneratedRelationSchema,
  GeneratedEntitySchema,
  EntityGenerationRequestSchema,
  type GeneratedConstraint,
  type GeneratedEnumValue,
  type GeneratedReferenceConfig,
  type GeneratedField,
  type GeneratedRelation,
  type GeneratedEntity,
  type EntityGenerationRequest,
  // List view schemas
  GeneratedColumnTypeSchema,
  GeneratedColumnFormatSchema,
  GeneratedListColumnSchema,
  GeneratedFilterFieldSchema,
  GeneratedListViewSchema,
  ListViewGenerationRequestSchema,
  columnTypeSchema,
  type ColumnType,
  type GeneratedColumnType,
  type GeneratedColumnFormat,
  type GeneratedListColumn,
  type GeneratedFilterField,
  type GeneratedListView,
  type ListViewGenerationRequest,
  // Form view schemas
  GeneratedComponentTypeSchema,
  GeneratedFormFieldSchema,
  GeneratedFormSectionSchema,
  GeneratedFormViewSchema,
  FormViewGenerationRequestSchema,
  DEFAULT_COMPONENT_MAP,
  componentTypeSchema,
  type ComponentType,
  type GeneratedComponentType,
  type GeneratedFormField,
  type GeneratedFormSection,
  type GeneratedFormView,
  type FormViewGenerationRequest,
} from './core/schemas'

// ============================================================================
// Sync - Entity-View Synchronization (re-exported from @manifesto-ai/schema)
// ============================================================================

export {
  // Main API
  syncViews,
  syncFormView,
  syncListView,
  analyzeViewImpact,
  applySuggestedActions,
  summarizeSyncResults,
  getViewsRequiringReview,
  getAllSkippedActions,
  // Diff utilities
  diffEntities,
  filterChangesByType,
  filterChangesBySeverity,
  summarizeChanges,
  detectRenames,
  stringSimilarity,
  filterByConfidence,
  getTypeCompatibility,
  getDefaultComponent,
  getDefaultColumnType,
  isTypeCompatible,
  requiresComponentChange,
  // Strategies
  analyzeFormViewImpact,
  applyFormStrategy,
  analyzeListViewImpact,
  applyListStrategy,
  extractFieldReferences,
  updateFieldReference,
  updateFieldReferences,
  findBrokenReferencesInForm,
  findBrokenReferencesInList,
  cleanupBrokenReactions,
  updateFormReactionReferences,
  updateListReferences,
  suggestReactionUpdates,
  // Type guards
  isFieldRemoved,
  isFieldAdded,
  isFieldRenamed,
  isFieldTypeChanged,
  isFieldConstraintChanged,
  isFieldEnumChanged,
  isFieldLabelChanged,
  isFieldReferenceChanged,
  isCriticalChange,
  isBreakingChange,
  isFormView,
  isListView,
  // Default config
  DEFAULT_SYNC_CONFIG,
  // Types
  type ChangeSeverity,
  type EntityChange,
  type FieldRemovedChange,
  type FieldAddedChange,
  type FieldRenamedChange,
  type FieldTypeChange,
  type FieldConstraintChange,
  type FieldEnumChange,
  type FieldLabelChange,
  type FieldReferenceChange,
  type CompatibilityLevel,
  type TypeCompatibility,
  type EntityChangeSummary,
  type AffectedElement,
  type BrokenReference,
  type ViewImpactAnalysis,
  type SuggestedAction,
  type RemoveFieldAction,
  type UpdateFieldIdAction,
  type UpdateComponentAction,
  type UpdateEnumOptionsAction,
  type AddFieldAction,
  type UpdateReactionAction,
  type RemoveReactionAction,
  type RemoveFilterAction,
  type UpdateFilterFieldIdAction,
  type RemoveSortAction,
  type UpdateSortFieldIdAction,
  type FieldPlacement,
  type SyncMode,
  type FieldMappingHint,
  type SyncManagerConfig,
  type SyncResult,
  type SyncManagerInput,
  type SyncManagerOutput,
  type DiffOptions,
  type RenameCandidate,
  type FormStrategyResult,
  type ListStrategyResult,
} from '@manifesto-ai/schema'
