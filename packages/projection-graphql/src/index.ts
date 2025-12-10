/**
 * @manifesto-ai/projection-graphql
 *
 * GraphQL projection layer for Manifesto domains.
 * Generates GraphQL schemas and resolvers from domain definitions.
 */

// =============================================================================
// Types
// =============================================================================

export type {
  GraphQLProjectionConfig,
  PubSubEngine,
  GraphQLDomainContext,
  ContextOptions,
  GeneratedSchema,
  DomainTypeMap,
  TypeMappingConfig,
  TypeMappingResult,
  GraphQLResolvers,
  GraphQLFieldResolver,
  GraphQLSubscriptionResolver,
  QueryResolvers,
  MutationResolvers,
  SubscriptionResolvers,
  FieldValueResponse,
  SemanticMetaResponse,
  ValidationResultResponse,
  ValidationIssueResponse,
  FieldPolicyResponse,
  ActionInfoResponse,
  ActionResultResponse,
  ActionErrorResponse,
  EffectResultResponse,
  SetFieldResultResponse,
  DomainChangeEvent,
  FieldChangeEvent,
  SemanticDirectiveArgs,
  PolicyDirectiveArgs,
  PathConversionOptions,
  ErrorFormattingOptions,
} from './types.js';

export {
  isGraphQLProjectionConfig,
  isDomainChangeEvent,
  isFieldChangeEvent,
} from './types.js';

// =============================================================================
// Schema Generation
// =============================================================================

export {
  // Main functions
  generateGraphQLSchema,
  generateTypeDefs,
  buildSchemaFromDomain,
  // Type mapper
  mapZodToGraphQLOutput,
  mapZodToGraphQLInput,
  GraphQLJSON,
  GraphQLDateTime,
  sanitizeTypeName,
  sanitizeFieldName,
  sanitizeEnumValue,
  getZodTypeName,
  isZodOptional,
  unwrapZodType,
  clearTypeCache,
  createMappingResult,
  // Directives
  SemanticDirective,
  PolicyDirective,
  DeprecatedReasonDirective,
  ComputedDirective,
  AsyncDirective,
  ManifestoDirectives,
  ImportanceLevelEnum,
  SemanticTypeEnum,
  generateSemanticDirectiveSDL,
  generatePolicyDirectiveSDL,
  generateDirectiveDefinitionsSDL,
  parseDirectiveArgs,
} from './schema/index.js';

// =============================================================================
// Resolvers
// =============================================================================

export {
  // Factory functions
  createResolvers,
  createQueryResolvers,
  createMutationResolvers,
  createSubscriptionResolvers,
  createFieldResolvers,
  // Resolver helpers
  createComputedResolver,
  createLazyResolver,
  createMappedResolver,
  createFormattedResolver,
  createValidatedResolver,
  composeResolvers,
  chainResolvers,
  withErrorHandling,
  withCache,
  // Subscription helpers
  withFilter,
  withTransform,
  setupRuntimeSubscriptions,
} from './resolvers/index.js';

// =============================================================================
// Context
// =============================================================================

export {
  createGraphQLContext,
  createContextFactory,
  getRuntimeFromContext,
  getDomainFromContext,
  getPubSubFromContext,
  isAuthenticated,
  getUserFromContext,
  SimplePubSub,
  getDomainChangeTrigger,
  getFieldChangeTrigger,
  getActionTrigger,
  isValidRequestId,
} from './context/index.js';

// =============================================================================
// Utilities
// =============================================================================

export {
  // Path conversion
  pathToFieldName,
  pathToTypeName,
  fieldNameToPath,
  splitCamelCase,
  getPathPrefix,
  hasPathPrefix,
  stripPathPrefix,
  addPathPrefix,
  getParentPath,
  getPathSegment,
  joinPath,
  isChildPath,
  getRelativePath,
  sanitizeGraphQLName,
  isValidGraphQLName,
  pathToArgName,
  // Error formatting
  ErrorCodes,
  type ErrorCode,
  formatValidationResult,
  formatValidationIssue,
  formatError,
  formatErrors,
  createValidationError,
  createRequiredFieldError,
  createPreconditionError,
  createFieldNotFoundError,
  createFieldNotEditableError,
  createAuthenticationError,
  createAuthorizationError,
  createInternalError,
  createErrorResponse,
  createErrorResponses,
  aggregateErrors,
  isErrorCode,
  getErrorCode,
  logError,
  createErrorHandler,
} from './utils/index.js';
