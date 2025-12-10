/**
 * GraphQL Projection Types
 *
 * Type definitions for projecting Manifesto domains to GraphQL schemas.
 */

import type {
  DomainRuntime,
  ManifestoDomain,
  SemanticPath,
  ValidationResult,
  SemanticMeta,
} from '@manifesto-ai/core';
import type {
  GraphQLSchema,
  GraphQLResolveInfo,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLEnumType,
  GraphQLScalarType,
  GraphQLType,
  GraphQLFieldConfig,
  GraphQLOutputType,
  GraphQLInputType,
} from 'graphql';

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * GraphQL projection configuration options.
 */
export type GraphQLProjectionConfig = {
  /** Include GraphQL introspection (default: true) */
  includeIntrospection?: boolean;

  /** Include field descriptions from semantic metadata (default: true) */
  includeDescriptions?: boolean;

  /** Include deprecated fields (default: false) */
  includeDeprecated?: boolean;

  /** Enable subscriptions (default: true) */
  enableSubscriptions?: boolean;

  /** PubSub engine for subscriptions */
  subscriptionPubSub?: PubSubEngine;

  /** Maximum query depth (default: 10) */
  maxDepth?: number;

  /** Maximum query complexity (default: 1000) */
  maxComplexity?: number;

  /** Date formatting style (default: 'ISO') */
  dateFormat?: 'ISO' | 'UNIX' | 'CUSTOM';

  /** Whether fields are nullable by default (default: false) */
  nullableByDefault?: boolean;

  /** Custom type name prefix for domain types */
  typePrefix?: string;

  /** Custom type name suffix for domain types */
  typeSuffix?: string;
};

/**
 * PubSub engine interface for subscriptions.
 */
export interface PubSubEngine {
  publish(triggerName: string, payload: unknown): Promise<void>;
  subscribe(
    triggerName: string,
    onMessage: (message: unknown) => void
  ): Promise<number>;
  unsubscribe(subId: number): void;
  asyncIterator<T>(triggers: string | string[]): AsyncIterator<T>;
}

// =============================================================================
// Context Types
// =============================================================================

/**
 * GraphQL context passed to all resolvers.
 */
export type GraphQLDomainContext<TData = unknown, TState = unknown> = {
  /** The domain runtime instance */
  runtime: DomainRuntime<TData, TState>;

  /** The domain definition */
  domain: ManifestoDomain<TData, TState>;

  /** Unique request identifier */
  requestId: string;

  /** Optional user/auth context */
  user?: unknown;

  /** Optional pubsub for subscriptions */
  pubsub?: PubSubEngine;

  /** Additional custom context */
  [key: string]: unknown;
};

/**
 * Context factory options.
 */
export type ContextOptions = {
  /** PubSub engine for subscriptions */
  pubsub?: PubSubEngine;

  /** User/auth context */
  user?: unknown;

  /** Additional custom context */
  extras?: Record<string, unknown>;
};

// =============================================================================
// Schema Generation Types
// =============================================================================

/**
 * Result of schema generation.
 */
export type GeneratedSchema<TData = unknown, TState = unknown> = {
  /** The executable GraphQL schema */
  schema: GraphQLSchema;

  /** SDL (Schema Definition Language) string */
  typeDefs: string;

  /** Generated resolvers */
  resolvers: GraphQLResolvers<TData, TState>;

  /** Domain-specific type definitions */
  domainTypes: DomainTypeMap;
};

/**
 * Map of generated domain types.
 */
export type DomainTypeMap = {
  /** Main domain object type */
  domainType: GraphQLObjectType;

  /** Input types for mutations */
  inputTypes: Map<string, GraphQLInputObjectType>;

  /** Enum types */
  enumTypes: Map<string, GraphQLEnumType>;

  /** Scalar types */
  scalarTypes: Map<string, GraphQLScalarType>;
};

/**
 * Type mapping configuration.
 */
export type TypeMappingConfig = {
  /** Custom scalar mappings */
  customScalars?: Record<string, GraphQLScalarType>;

  /** Whether to generate input types for nested objects */
  generateInputTypes?: boolean;

  /** Maximum nesting depth for type generation */
  maxDepth?: number;
};

/**
 * Result of mapping a Zod type to GraphQL.
 */
export type TypeMappingResult = {
  /** The GraphQL type */
  type: GraphQLOutputType | GraphQLInputType;

  /** Whether the type is nullable */
  nullable: boolean;

  /** Whether the type is a list */
  isList: boolean;

  /** Nested types that were generated */
  nestedTypes?: Map<string, GraphQLType>;
};

// =============================================================================
// Resolver Types
// =============================================================================

/**
 * All resolvers for the generated schema.
 */
export type GraphQLResolvers<TData = unknown, TState = unknown> = {
  Query: Record<string, GraphQLFieldResolver<TData, TState>>;
  Mutation: Record<string, GraphQLFieldResolver<TData, TState>>;
  Subscription?: Record<string, GraphQLSubscriptionResolver<TData, TState>>;
  [typeName: string]: Record<string, GraphQLFieldResolver<TData, TState> | GraphQLSubscriptionResolver<TData, TState>> | undefined;
};

/**
 * Standard field resolver function.
 */
export type GraphQLFieldResolver<TData = unknown, TState = unknown> = (
  parent: unknown,
  args: Record<string, unknown>,
  context: GraphQLDomainContext<TData, TState>,
  info: GraphQLResolveInfo
) => unknown | Promise<unknown>;

/**
 * Subscription resolver with subscribe and optional resolve.
 */
export type GraphQLSubscriptionResolver<TData = unknown, TState = unknown> = {
  subscribe: (
    parent: unknown,
    args: Record<string, unknown>,
    context: GraphQLDomainContext<TData, TState>,
    info: GraphQLResolveInfo
  ) => AsyncIterator<unknown>;
  resolve?: (payload: unknown) => unknown;
};

/**
 * Query resolver definitions.
 */
export type QueryResolvers<TData = unknown, TState = unknown> = {
  /** Get full domain state */
  domain: GraphQLFieldResolver<TData, TState>;

  /** Get specific field value */
  field: GraphQLFieldResolver<TData, TState>;

  /** Get all field policies */
  policies: GraphQLFieldResolver<TData, TState>;

  /** Get available actions */
  actions: GraphQLFieldResolver<TData, TState>;
};

/**
 * Mutation resolver definitions.
 */
export type MutationResolvers<TData = unknown, TState = unknown> = {
  /** Set a field value */
  setField: GraphQLFieldResolver<TData, TState>;

  /** Execute an action */
  executeAction: GraphQLFieldResolver<TData, TState>;
};

/**
 * Subscription resolver definitions.
 */
export type SubscriptionResolvers<TData = unknown, TState = unknown> = {
  /** Subscribe to domain changes */
  domainChanged: GraphQLSubscriptionResolver<TData, TState>;

  /** Subscribe to specific field changes */
  fieldChanged: GraphQLSubscriptionResolver<TData, TState>;
};

// =============================================================================
// GraphQL Response Types
// =============================================================================

/**
 * Field value response type.
 */
export type FieldValueResponse = {
  path: string;
  value: unknown;
  displayValue: string;
  semantic: SemanticMetaResponse;
  validity: ValidationResultResponse;
  policy: FieldPolicyResponse;
};

/**
 * Semantic meta response type.
 */
export type SemanticMetaResponse = {
  type: string;
  description: string;
  importance?: string;
  examples?: string[];
  hints?: string[];
};

/**
 * Validation result response type.
 */
export type ValidationResultResponse = {
  valid: boolean;
  issues: ValidationIssueResponse[];
};

/**
 * Validation issue response type.
 */
export type ValidationIssueResponse = {
  code: string;
  message: string;
  path: string;
  severity: string;
};

/**
 * Field policy response type.
 */
export type FieldPolicyResponse = {
  editable: boolean;
  required: boolean;
  visible: boolean;
  relevant: boolean;
};

/**
 * Action info response type.
 */
export type ActionInfoResponse = {
  id: string;
  verb: string;
  description: string;
  canExecute: boolean;
  blockedReasons: string[];
};

/**
 * Action result response type.
 */
export type ActionResultResponse = {
  success: boolean;
  errors?: ActionErrorResponse[];
  effects?: EffectResultResponse[];
};

/**
 * Action error response type.
 */
export type ActionErrorResponse = {
  code: string;
  message: string;
  path?: string;
};

/**
 * Effect result response type.
 */
export type EffectResultResponse = {
  type: string;
  path?: string;
  description: string;
};

/**
 * Set field result response type.
 */
export type SetFieldResultResponse = {
  success: boolean;
  path: string;
  previousValue: unknown;
  newValue: unknown;
  errors?: ActionErrorResponse[];
};

// =============================================================================
// Subscription Event Types
// =============================================================================

/**
 * Domain change event for subscriptions.
 */
export type DomainChangeEvent = {
  type: 'DATA_CHANGED' | 'STATE_CHANGED' | 'ACTION_EXECUTED' | 'VALIDATION_CHANGED';
  timestamp: number;
  paths: string[];
  snapshot: unknown;
};

/**
 * Field change event for subscriptions.
 */
export type FieldChangeEvent = {
  path: string;
  previousValue: unknown;
  newValue: unknown;
  timestamp: number;
};

// =============================================================================
// Directive Types
// =============================================================================

/**
 * Semantic directive arguments.
 */
export type SemanticDirectiveArgs = {
  type: string;
  description: string;
  importance?: string;
};

/**
 * Policy directive arguments.
 */
export type PolicyDirectiveArgs = {
  editable: boolean;
  required: boolean;
  visible?: boolean;
};

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Path to GraphQL field name conversion options.
 */
export type PathConversionOptions = {
  /** Separator for nested paths (default: '_') */
  separator?: string;

  /** Whether to capitalize first letter of each segment */
  capitalize?: boolean;

  /** Prefix to strip from paths */
  stripPrefix?: string;
};

/**
 * Error formatting options.
 */
export type ErrorFormattingOptions = {
  /** Include stack traces (default: false) */
  includeStackTrace?: boolean;

  /** Include path in error message (default: true) */
  includePath?: boolean;

  /** Custom error code mapping */
  codeMapping?: Record<string, string>;
};

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a value is a valid GraphQL projection config.
 */
export function isGraphQLProjectionConfig(value: unknown): value is GraphQLProjectionConfig {
  if (typeof value !== 'object' || value === null) return false;
  const config = value as Record<string, unknown>;

  if (config.includeIntrospection !== undefined && typeof config.includeIntrospection !== 'boolean') {
    return false;
  }
  if (config.enableSubscriptions !== undefined && typeof config.enableSubscriptions !== 'boolean') {
    return false;
  }
  if (config.maxDepth !== undefined && typeof config.maxDepth !== 'number') {
    return false;
  }

  return true;
}

/**
 * Check if a value is a valid domain change event.
 */
export function isDomainChangeEvent(value: unknown): value is DomainChangeEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;

  return (
    typeof event.type === 'string' &&
    ['DATA_CHANGED', 'STATE_CHANGED', 'ACTION_EXECUTED', 'VALIDATION_CHANGED'].includes(event.type) &&
    typeof event.timestamp === 'number' &&
    Array.isArray(event.paths)
  );
}

/**
 * Check if a value is a valid field change event.
 */
export function isFieldChangeEvent(value: unknown): value is FieldChangeEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;

  return typeof event.path === 'string' && typeof event.timestamp === 'number';
}
