/**
 * Directive Builder
 *
 * Creates custom GraphQL directives for Manifesto domains.
 */

import {
  GraphQLDirective,
  DirectiveLocation,
  GraphQLString,
  GraphQLBoolean,
  GraphQLNonNull,
  GraphQLEnumType,
} from 'graphql';

import type { SemanticDirectiveArgs, PolicyDirectiveArgs } from '../types.js';

// =============================================================================
// Semantic Directive
// =============================================================================

/**
 * Importance level enum for semantic directive.
 */
export const ImportanceLevelEnum = new GraphQLEnumType({
  name: 'ImportanceLevel',
  values: {
    CRITICAL: { value: 'critical' },
    HIGH: { value: 'high' },
    MEDIUM: { value: 'medium' },
    LOW: { value: 'low' },
  },
});

/**
 * Semantic type enum for semantic directive.
 */
export const SemanticTypeEnum = new GraphQLEnumType({
  name: 'SemanticType',
  values: {
    INPUT: { value: 'input' },
    COMPUTED: { value: 'computed' },
    STATE: { value: 'state' },
    DERIVED: { value: 'derived' },
    ASYNC: { value: 'async' },
  },
});

/**
 * @semantic directive for field metadata.
 *
 * Usage:
 * ```graphql
 * type User {
 *   email: String! @semantic(type: INPUT, description: "User email address")
 * }
 * ```
 */
export const SemanticDirective = new GraphQLDirective({
  name: 'semantic',
  description: 'Provides semantic metadata about a field',
  locations: [DirectiveLocation.FIELD_DEFINITION],
  args: {
    type: {
      type: new GraphQLNonNull(SemanticTypeEnum),
      description: 'The semantic type of the field',
    },
    description: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Human-readable description of the field',
    },
    importance: {
      type: ImportanceLevelEnum,
      description: 'The importance level of the field',
    },
  },
});

// =============================================================================
// Policy Directive
// =============================================================================

/**
 * @policy directive for field access policies.
 *
 * Usage:
 * ```graphql
 * type User {
 *   email: String! @policy(editable: true, required: true)
 * }
 * ```
 */
export const PolicyDirective = new GraphQLDirective({
  name: 'policy',
  description: 'Defines access and validation policies for a field',
  locations: [DirectiveLocation.FIELD_DEFINITION],
  args: {
    editable: {
      type: new GraphQLNonNull(GraphQLBoolean),
      description: 'Whether the field can be edited',
    },
    required: {
      type: new GraphQLNonNull(GraphQLBoolean),
      description: 'Whether the field is required',
    },
    visible: {
      type: GraphQLBoolean,
      defaultValue: true,
      description: 'Whether the field is visible',
    },
  },
});

// =============================================================================
// Deprecated Directive (Custom extension)
// =============================================================================

/**
 * @deprecatedReason directive for detailed deprecation info.
 */
export const DeprecatedReasonDirective = new GraphQLDirective({
  name: 'deprecatedReason',
  description: 'Provides detailed deprecation information',
  locations: [DirectiveLocation.FIELD_DEFINITION, DirectiveLocation.ENUM_VALUE],
  args: {
    reason: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'The reason for deprecation',
    },
    replacement: {
      type: GraphQLString,
      description: 'The field or value to use instead',
    },
    since: {
      type: GraphQLString,
      description: 'Version when the field was deprecated',
    },
  },
});

// =============================================================================
// Computed Directive
// =============================================================================

/**
 * @computed directive for derived fields.
 */
export const ComputedDirective = new GraphQLDirective({
  name: 'computed',
  description: 'Marks a field as computed/derived',
  locations: [DirectiveLocation.FIELD_DEFINITION],
  args: {
    expression: {
      type: GraphQLString,
      description: 'The expression used to compute this field',
    },
    dependencies: {
      type: GraphQLString,
      description: 'Comma-separated list of dependency paths',
    },
  },
});

// =============================================================================
// Async Directive
// =============================================================================

/**
 * @async directive for async data fields.
 */
export const AsyncDirective = new GraphQLDirective({
  name: 'asyncField',
  description: 'Marks a field as asynchronously loaded',
  locations: [DirectiveLocation.FIELD_DEFINITION],
  args: {
    loader: {
      type: GraphQLString,
      description: 'The loader function name',
    },
    cacheTTL: {
      type: GraphQLString,
      description: 'Cache TTL in seconds',
    },
  },
});

// =============================================================================
// Collection of all directives
// =============================================================================

/**
 * All custom Manifesto directives.
 */
export const ManifestoDirectives = [
  SemanticDirective,
  PolicyDirective,
  DeprecatedReasonDirective,
  ComputedDirective,
  AsyncDirective,
];

// =============================================================================
// Directive SDL Generation
// =============================================================================

/**
 * Generate SDL for a semantic directive usage.
 */
export function generateSemanticDirectiveSDL(args: SemanticDirectiveArgs): string {
  const parts = [
    `type: ${args.type.toUpperCase()}`,
    `description: "${escapeString(args.description)}"`,
  ];

  if (args.importance) {
    parts.push(`importance: ${args.importance.toUpperCase()}`);
  }

  return `@semantic(${parts.join(', ')})`;
}

/**
 * Generate SDL for a policy directive usage.
 */
export function generatePolicyDirectiveSDL(args: PolicyDirectiveArgs): string {
  const parts = [
    `editable: ${args.editable}`,
    `required: ${args.required}`,
  ];

  if (args.visible !== undefined) {
    parts.push(`visible: ${args.visible}`);
  }

  return `@policy(${parts.join(', ')})`;
}

/**
 * Generate all directive definitions as SDL.
 */
export function generateDirectiveDefinitionsSDL(): string {
  return `
enum ImportanceLevel {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}

enum SemanticType {
  INPUT
  COMPUTED
  STATE
  DERIVED
  ASYNC
}

directive @semantic(
  type: SemanticType!
  description: String!
  importance: ImportanceLevel
) on FIELD_DEFINITION

directive @policy(
  editable: Boolean!
  required: Boolean!
  visible: Boolean = true
) on FIELD_DEFINITION

directive @deprecatedReason(
  reason: String!
  replacement: String
  since: String
) on FIELD_DEFINITION | ENUM_VALUE

directive @computed(
  expression: String
  dependencies: String
) on FIELD_DEFINITION

directive @asyncField(
  loader: String
  cacheTTL: String
) on FIELD_DEFINITION
`.trim();
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Escape a string for use in GraphQL SDL.
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Parse directive arguments from a field definition.
 */
export function parseDirectiveArgs(
  directiveName: string,
  argsString: string
): Record<string, unknown> {
  const args: Record<string, unknown> = {};

  // Simple parsing of key: value pairs
  const regex = /(\w+):\s*(?:"([^"]*)"|(\w+)|(\d+(?:\.\d+)?)|(\[[^\]]*\]))/g;
  let match;

  while ((match = regex.exec(argsString)) !== null) {
    const key = match[1];
    const stringValue = match[2];
    const identValue = match[3];
    const numValue = match[4];
    const arrayValue = match[5];

    if (key) {
      if (stringValue !== undefined) {
        args[key] = stringValue;
      } else if (identValue !== undefined) {
        // Could be boolean or enum
        if (identValue === 'true') args[key] = true;
        else if (identValue === 'false') args[key] = false;
        else args[key] = identValue;
      } else if (numValue !== undefined) {
        args[key] = parseFloat(numValue);
      } else if (arrayValue !== undefined) {
        args[key] = arrayValue;
      }
    }
  }

  return args;
}
