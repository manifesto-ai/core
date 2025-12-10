/**
 * Schema Builder
 *
 * Generates GraphQL schema from Manifesto domain definitions.
 */

import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
  GraphQLBoolean,
  GraphQLInt,
  GraphQLFloat,
  GraphQLEnumType,
  printSchema,
  type GraphQLFieldConfigMap,
  type GraphQLInputFieldConfigMap,
  type GraphQLOutputType,
} from 'graphql';
import type { ManifestoDomain, SemanticPath } from '@manifesto-ai/core';

import type {
  GraphQLProjectionConfig,
  GeneratedSchema,
  GraphQLResolvers,
  DomainTypeMap,
} from '../types.js';
import {
  mapZodToGraphQLOutput,
  mapZodToGraphQLInput,
  GraphQLJSON,
  GraphQLDateTime,
  sanitizeTypeName,
  sanitizeFieldName,
  clearTypeCache,
} from './type-mapper.js';
import {
  ManifestoDirectives,
  generateDirectiveDefinitionsSDL,
} from './directive-builder.js';

// =============================================================================
// Common Types
// =============================================================================

/**
 * ValidationIssue type for GraphQL.
 */
const ValidationIssueType = new GraphQLObjectType({
  name: 'ValidationIssue',
  fields: {
    code: { type: new GraphQLNonNull(GraphQLString) },
    message: { type: new GraphQLNonNull(GraphQLString) },
    path: { type: new GraphQLNonNull(GraphQLString) },
    severity: { type: new GraphQLNonNull(GraphQLString) },
  },
});

/**
 * ValidationResult type for GraphQL.
 */
const ValidationResultType = new GraphQLObjectType({
  name: 'ValidationResult',
  fields: {
    valid: { type: new GraphQLNonNull(GraphQLBoolean) },
    issues: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(ValidationIssueType))) },
  },
});

/**
 * SemanticMeta type for GraphQL.
 */
const SemanticMetaType = new GraphQLObjectType({
  name: 'SemanticMeta',
  fields: {
    type: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: new GraphQLNonNull(GraphQLString) },
    importance: { type: GraphQLString },
    examples: { type: new GraphQLList(new GraphQLNonNull(GraphQLString)) },
    hints: { type: new GraphQLList(new GraphQLNonNull(GraphQLString)) },
  },
});

/**
 * FieldPolicy type for GraphQL.
 */
const FieldPolicyType = new GraphQLObjectType({
  name: 'FieldPolicy',
  fields: {
    editable: { type: new GraphQLNonNull(GraphQLBoolean) },
    required: { type: new GraphQLNonNull(GraphQLBoolean) },
    visible: { type: new GraphQLNonNull(GraphQLBoolean) },
    relevant: { type: new GraphQLNonNull(GraphQLBoolean) },
  },
});

/**
 * FieldValue type for GraphQL.
 */
const FieldValueType = new GraphQLObjectType({
  name: 'FieldValue',
  fields: {
    path: { type: new GraphQLNonNull(GraphQLString) },
    value: { type: GraphQLJSON },
    displayValue: { type: new GraphQLNonNull(GraphQLString) },
    semantic: { type: new GraphQLNonNull(SemanticMetaType) },
    validity: { type: new GraphQLNonNull(ValidationResultType) },
    policy: { type: new GraphQLNonNull(FieldPolicyType) },
  },
});

/**
 * ActionInfo type for GraphQL.
 */
const ActionInfoType = new GraphQLObjectType({
  name: 'ActionInfo',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLString) },
    verb: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: new GraphQLNonNull(GraphQLString) },
    canExecute: { type: new GraphQLNonNull(GraphQLBoolean) },
    blockedReasons: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))) },
  },
});

/**
 * ActionError type for GraphQL.
 */
const ActionErrorType = new GraphQLObjectType({
  name: 'ActionError',
  fields: {
    code: { type: new GraphQLNonNull(GraphQLString) },
    message: { type: new GraphQLNonNull(GraphQLString) },
    path: { type: GraphQLString },
  },
});

/**
 * EffectResult type for GraphQL.
 */
const EffectResultType = new GraphQLObjectType({
  name: 'EffectResult',
  fields: {
    type: { type: new GraphQLNonNull(GraphQLString) },
    path: { type: GraphQLString },
    description: { type: new GraphQLNonNull(GraphQLString) },
  },
});

/**
 * ActionResult type for GraphQL.
 */
const ActionResultType = new GraphQLObjectType({
  name: 'ActionResult',
  fields: {
    success: { type: new GraphQLNonNull(GraphQLBoolean) },
    errors: { type: new GraphQLList(new GraphQLNonNull(ActionErrorType)) },
    effects: { type: new GraphQLList(new GraphQLNonNull(EffectResultType)) },
  },
});

/**
 * SetFieldResult type for GraphQL.
 */
const SetFieldResultType = new GraphQLObjectType({
  name: 'SetFieldResult',
  fields: {
    success: { type: new GraphQLNonNull(GraphQLBoolean) },
    path: { type: new GraphQLNonNull(GraphQLString) },
    previousValue: { type: GraphQLJSON },
    newValue: { type: GraphQLJSON },
    errors: { type: new GraphQLList(new GraphQLNonNull(ActionErrorType)) },
  },
});

/**
 * DomainChangeEvent type for subscriptions.
 */
const DomainChangeEventType = new GraphQLObjectType({
  name: 'DomainChangeEvent',
  fields: {
    type: { type: new GraphQLNonNull(GraphQLString) },
    timestamp: { type: new GraphQLNonNull(GraphQLFloat) },
    paths: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))) },
    snapshot: { type: GraphQLJSON },
  },
});

/**
 * FieldChangeEvent type for subscriptions.
 */
const FieldChangeEventType = new GraphQLObjectType({
  name: 'FieldChangeEvent',
  fields: {
    path: { type: new GraphQLNonNull(GraphQLString) },
    previousValue: { type: GraphQLJSON },
    newValue: { type: GraphQLJSON },
    timestamp: { type: new GraphQLNonNull(GraphQLFloat) },
  },
});

// =============================================================================
// Main Schema Builder
// =============================================================================

/**
 * Generate a complete GraphQL schema from a Manifesto domain.
 */
export function generateGraphQLSchema<TData, TState>(
  domain: ManifestoDomain<TData, TState>,
  config: GraphQLProjectionConfig = {}
): GeneratedSchema<TData, TState> {
  // Clear type cache for fresh generation
  clearTypeCache();

  const prefix = config.typePrefix ?? '';
  const suffix = config.typeSuffix ?? '';
  const domainName = sanitizeTypeName(`${prefix}${domain.id}${suffix}`);

  // Build domain-specific types
  const domainTypes = buildDomainTypes(domain, domainName, config);

  // Build Query type
  const queryType = buildQueryType(domain, domainName, domainTypes, config);

  // Build Mutation type
  const mutationType = buildMutationType(domain, domainName, domainTypes, config);

  // Build Subscription type (optional)
  const subscriptionType = config.enableSubscriptions !== false
    ? buildSubscriptionType(domain, domainName, config)
    : undefined;

  // Create the schema
  const schema = new GraphQLSchema({
    query: queryType,
    mutation: mutationType,
    subscription: subscriptionType,
    directives: [...ManifestoDirectives],
    types: [
      ValidationIssueType,
      ValidationResultType,
      SemanticMetaType,
      FieldPolicyType,
      FieldValueType,
      ActionInfoType,
      ActionErrorType,
      EffectResultType,
      ActionResultType,
      SetFieldResultType,
      DomainChangeEventType,
      FieldChangeEventType,
      GraphQLJSON,
      GraphQLDateTime,
      domainTypes.domainType,
      ...domainTypes.enumTypes.values(),
      ...domainTypes.inputTypes.values(),
    ],
  });

  // Generate SDL
  const schemaSDL = printSchema(schema);
  const directiveSDL = generateDirectiveDefinitionsSDL();
  const typeDefs = `${directiveSDL}\n\n${schemaSDL}`;

  // Create placeholder resolvers (actual resolvers created separately)
  const resolvers = createPlaceholderResolvers<TData, TState>(domain, domainName);

  return {
    schema,
    typeDefs,
    resolvers,
    domainTypes,
  };
}

// =============================================================================
// Domain Type Builder
// =============================================================================

/**
 * Build domain-specific GraphQL types from schema.
 */
function buildDomainTypes<TData, TState>(
  domain: ManifestoDomain<TData, TState>,
  domainName: string,
  config: GraphQLProjectionConfig
): DomainTypeMap {
  const inputTypes = new Map<string, GraphQLInputObjectType>();
  const enumTypes = new Map<string, GraphQLEnumType>();
  const scalarTypes = new Map<string, any>();

  // Build main domain type from data + state schemas
  const domainType = new GraphQLObjectType({
    name: domainName,
    description: domain.name,
    fields: () => {
      const fields: GraphQLFieldConfigMap<unknown, unknown> = {};

      // Add data fields
      if (domain.dataSchema) {
        const dataType = mapZodToGraphQLOutput(domain.dataSchema, `${domainName}Data`, {});
        const unwrappedDataType = dataType instanceof GraphQLNonNull ? dataType.ofType : dataType;
        if (unwrappedDataType instanceof GraphQLObjectType) {
          const dataFields = unwrappedDataType.getFields();
          for (const [key, fieldDef] of Object.entries(dataFields)) {
            fields[key] = {
              type: fieldDef.type as GraphQLOutputType,
              description: fieldDef.description,
            };
          }
        }
      }

      // Add state fields
      if (domain.stateSchema) {
        const stateType = mapZodToGraphQLOutput(domain.stateSchema, `${domainName}State`, {});
        const unwrappedStateType = stateType instanceof GraphQLNonNull ? stateType.ofType : stateType;
        if (unwrappedStateType instanceof GraphQLObjectType) {
          const stateFields = unwrappedStateType.getFields();
          for (const [key, fieldDef] of Object.entries(stateFields)) {
            fields[key] = {
              type: fieldDef.type as GraphQLOutputType,
              description: fieldDef.description,
            };
          }
        }
      }

      // Add derived fields
      if (domain.paths?.derived) {
        for (const [path, def] of Object.entries(domain.paths.derived)) {
          const fieldName = pathToFieldName(path);
          fields[fieldName] = {
            type: GraphQLJSON, // Derived fields can be any type
            description: def.semantic?.description ?? `Derived field: ${path}`,
          };
        }
      }

      // Ensure at least one field
      if (Object.keys(fields).length === 0) {
        fields._id = {
          type: new GraphQLNonNull(GraphQLString),
          description: 'Domain ID',
        };
      }

      return fields;
    },
  });

  return {
    domainType,
    inputTypes,
    enumTypes,
    scalarTypes,
  };
}

// =============================================================================
// Query Type Builder
// =============================================================================

/**
 * Build the Query type.
 */
function buildQueryType<TData, TState>(
  domain: ManifestoDomain<TData, TState>,
  domainName: string,
  domainTypes: DomainTypeMap,
  config: GraphQLProjectionConfig
): GraphQLObjectType {
  const lowerDomainName = domainName.charAt(0).toLowerCase() + domainName.slice(1);

  return new GraphQLObjectType({
    name: 'Query',
    fields: {
      // Get full domain state
      [lowerDomainName]: {
        type: new GraphQLNonNull(domainTypes.domainType),
        description: `Get current ${domain.name ?? domain.id} state`,
      },

      // Get specific field value
      [`${lowerDomainName}Field`]: {
        type: FieldValueType,
        description: `Get a specific field value from ${domain.name ?? domain.id}`,
        args: {
          path: { type: new GraphQLNonNull(GraphQLString) },
        },
      },

      // Get all field policies
      [`${lowerDomainName}Policies`]: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(FieldPolicyType))),
        description: `Get all field policies for ${domain.name ?? domain.id}`,
      },

      // Get available actions
      [`${lowerDomainName}Actions`]: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(ActionInfoType))),
        description: `Get available actions for ${domain.name ?? domain.id}`,
      },
    },
  });
}

// =============================================================================
// Mutation Type Builder
// =============================================================================

/**
 * Build the Mutation type.
 */
function buildMutationType<TData, TState>(
  domain: ManifestoDomain<TData, TState>,
  domainName: string,
  domainTypes: DomainTypeMap,
  config: GraphQLProjectionConfig
): GraphQLObjectType {
  const lowerDomainName = domainName.charAt(0).toLowerCase() + domainName.slice(1);

  const mutationFields: GraphQLFieldConfigMap<unknown, unknown> = {
    // Set a field value
    [`set${domainName}Field`]: {
      type: new GraphQLNonNull(SetFieldResultType),
      description: `Set a field value in ${domain.name ?? domain.id}`,
      args: {
        path: { type: new GraphQLNonNull(GraphQLString) },
        value: { type: new GraphQLNonNull(GraphQLJSON) },
      },
    },
  };

  // Add action mutations
  if (domain.actions) {
    for (const [actionId, actionDef] of Object.entries(domain.actions)) {
      const mutationName = `${lowerDomainName}${capitalize(actionId)}`;

      const actionDefAny = actionDef as any;
      mutationFields[mutationName] = {
        type: new GraphQLNonNull(ActionResultType),
        description: actionDefAny.description ?? `Execute ${actionId} action`,
        args: {
          input: { type: GraphQLJSON },
        },
      };
    }
  }

  return new GraphQLObjectType({
    name: 'Mutation',
    fields: mutationFields,
  });
}

// =============================================================================
// Subscription Type Builder
// =============================================================================

/**
 * Build the Subscription type.
 */
function buildSubscriptionType<TData, TState>(
  domain: ManifestoDomain<TData, TState>,
  domainName: string,
  config: GraphQLProjectionConfig
): GraphQLObjectType {
  const lowerDomainName = domainName.charAt(0).toLowerCase() + domainName.slice(1);

  return new GraphQLObjectType({
    name: 'Subscription',
    fields: {
      // Subscribe to domain changes
      [`${lowerDomainName}Changed`]: {
        type: new GraphQLNonNull(DomainChangeEventType),
        description: `Subscribe to ${domain.name ?? domain.id} changes`,
      },

      // Subscribe to specific field changes
      [`${lowerDomainName}FieldChanged`]: {
        type: new GraphQLNonNull(FieldChangeEventType),
        description: `Subscribe to specific field changes in ${domain.name ?? domain.id}`,
        args: {
          path: { type: new GraphQLNonNull(GraphQLString) },
        },
      },
    },
  });
}

// =============================================================================
// Resolver Placeholders
// =============================================================================

/**
 * Create placeholder resolvers (actual implementation in resolver modules).
 */
function createPlaceholderResolvers<TData, TState>(
  domain: ManifestoDomain<TData, TState>,
  domainName: string
): GraphQLResolvers<TData, TState> {
  const lowerDomainName = domainName.charAt(0).toLowerCase() + domainName.slice(1);

  const resolvers: GraphQLResolvers<TData, TState> = {
    Query: {
      [lowerDomainName]: () => ({}),
      [`${lowerDomainName}Field`]: () => null,
      [`${lowerDomainName}Policies`]: () => [],
      [`${lowerDomainName}Actions`]: () => [],
    },
    Mutation: {
      [`set${domainName}Field`]: () => ({ success: false, path: '', errors: [] }),
    },
    Subscription: {},
  };

  // Add action mutation placeholders
  if (domain.actions) {
    for (const actionId of Object.keys(domain.actions)) {
      const mutationName = `${lowerDomainName}${capitalize(actionId)}`;
      resolvers.Mutation[mutationName] = () => ({ success: false, errors: [] });
    }
  }

  return resolvers;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert a semantic path to a GraphQL field name.
 */
function pathToFieldName(path: string): string {
  // Remove prefix like 'data.', 'state.', 'derived.'
  const parts = path.split('.');
  if (parts.length > 1 && ['data', 'state', 'derived', 'async'].includes(parts[0]!)) {
    parts.shift();
  }

  // Convert to camelCase
  return parts
    .map((part, index) =>
      index === 0 ? part : capitalize(part)
    )
    .join('');
}

/**
 * Capitalize the first letter of a string.
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// =============================================================================
// SDL Generation Helpers
// =============================================================================

/**
 * Generate only the type definitions as SDL string.
 */
export function generateTypeDefs<TData, TState>(
  domain: ManifestoDomain<TData, TState>,
  config: GraphQLProjectionConfig = {}
): string {
  const { typeDefs } = generateGraphQLSchema(domain, config);
  return typeDefs;
}

/**
 * Build schema from domain (convenience function).
 */
export function buildSchemaFromDomain<TData, TState>(
  domain: ManifestoDomain<TData, TState>,
  config: GraphQLProjectionConfig = {}
): GraphQLSchema {
  const { schema } = generateGraphQLSchema(domain, config);
  return schema;
}
