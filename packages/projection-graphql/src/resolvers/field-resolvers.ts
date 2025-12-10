/**
 * Field Resolvers
 *
 * Custom field resolvers for domain types.
 */

import type { ManifestoDomain, SemanticPath } from '@manifesto-ai/core';

import type {
  GraphQLDomainContext,
  GraphQLFieldResolver,
} from '../types.js';

// =============================================================================
// Field Resolver Factory
// =============================================================================

/**
 * Create field resolvers for a domain type.
 */
export function createFieldResolvers<TData, TState>(
  domain: ManifestoDomain<TData, TState>,
  domainName: string
): Record<string, Record<string, GraphQLFieldResolver<TData, TState>>> {
  const resolvers: Record<string, Record<string, GraphQLFieldResolver<TData, TState>>> = {};

  // Create resolvers for the main domain type
  resolvers[domainName] = createDomainFieldResolvers(domain);

  return resolvers;
}

// =============================================================================
// Domain Field Resolvers
// =============================================================================

/**
 * Create field resolvers for the main domain type.
 */
function createDomainFieldResolvers<TData, TState>(
  domain: ManifestoDomain<TData, TState>
): Record<string, GraphQLFieldResolver<TData, TState>> {
  const resolvers: Record<string, GraphQLFieldResolver<TData, TState>> = {};

  // Add resolvers for derived fields
  if (domain.paths?.derived) {
    for (const [path, def] of Object.entries(domain.paths.derived)) {
      const fieldName = pathToFieldName(path);
      resolvers[fieldName] = createDerivedFieldResolver(path);
    }
  }

  // Add resolvers for async fields
  if (domain.paths?.async) {
    for (const [path, def] of Object.entries(domain.paths.async)) {
      const fieldName = pathToFieldName(path);
      resolvers[fieldName] = createAsyncFieldResolver(path, def);
    }
  }

  return resolvers;
}

// =============================================================================
// Derived Field Resolver
// =============================================================================

/**
 * Create a resolver for a derived field.
 */
function createDerivedFieldResolver<TData, TState>(
  path: string
): GraphQLFieldResolver<TData, TState> {
  return (_parent, _args, context) => {
    const { runtime } = context;

    try {
      return runtime.get(path as SemanticPath);
    } catch (error) {
      console.error(`Error resolving derived field ${path}:`, error);
      return null;
    }
  };
}

// =============================================================================
// Async Field Resolver
// =============================================================================

/**
 * Create a resolver for an async field.
 */
function createAsyncFieldResolver<TData, TState>(
  path: string,
  def: any
): GraphQLFieldResolver<TData, TState> {
  return async (_parent, _args, context) => {
    const { runtime } = context;

    try {
      // Check if value is already cached
      const cachedValue = runtime.get(path as SemanticPath);
      if (cachedValue !== undefined) {
        return cachedValue;
      }

      // Trigger async load if loader is defined
      const runtimeAny = runtime as any;
      if (def.loader && typeof runtimeAny.loadAsync === 'function') {
        await runtimeAny.loadAsync(path);
        return runtime.get(path as SemanticPath);
      }

      return null;
    } catch (error) {
      console.error(`Error resolving async field ${path}:`, error);
      return null;
    }
  };
}

// =============================================================================
// Custom Field Resolver Helpers
// =============================================================================

/**
 * Create a computed field resolver.
 */
export function createComputedResolver<TData, TState>(
  compute: (parent: unknown, context: GraphQLDomainContext<TData, TState>) => unknown
): GraphQLFieldResolver<TData, TState> {
  return (parent, _args, context) => {
    return compute(parent, context);
  };
}

/**
 * Create a lazy field resolver that loads data on demand.
 */
export function createLazyResolver<TData, TState>(
  load: (parent: unknown, context: GraphQLDomainContext<TData, TState>) => Promise<unknown>
): GraphQLFieldResolver<TData, TState> {
  return async (parent, _args, context) => {
    return load(parent, context);
  };
}

/**
 * Create a resolver that maps a field from parent.
 */
export function createMappedResolver<TData, TState>(
  fieldPath: string
): GraphQLFieldResolver<TData, TState> {
  return (parent, _args, _context) => {
    if (parent === null || parent === undefined) {
      return null;
    }

    const parts = fieldPath.split('.');
    let value: unknown = parent;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return null;
      }
      value = (value as Record<string, unknown>)[part];
    }

    return value;
  };
}

/**
 * Create a resolver that formats a value.
 */
export function createFormattedResolver<TData, TState>(
  fieldName: string,
  format: (value: unknown) => unknown
): GraphQLFieldResolver<TData, TState> {
  return (parent, _args, _context) => {
    if (parent === null || parent === undefined) {
      return null;
    }

    const value = (parent as Record<string, unknown>)[fieldName];
    return format(value);
  };
}

/**
 * Create a resolver that validates and transforms a value.
 */
export function createValidatedResolver<TData, TState>(
  fieldName: string,
  validate: (value: unknown) => boolean,
  transform?: (value: unknown) => unknown,
  defaultValue: unknown = null
): GraphQLFieldResolver<TData, TState> {
  return (parent, _args, _context) => {
    if (parent === null || parent === undefined) {
      return defaultValue;
    }

    const value = (parent as Record<string, unknown>)[fieldName];

    if (!validate(value)) {
      return defaultValue;
    }

    return transform ? transform(value) : value;
  };
}

// =============================================================================
// Resolver Composition
// =============================================================================

/**
 * Compose multiple resolvers (first non-null wins).
 */
export function composeResolvers<TData, TState>(
  ...resolvers: Array<GraphQLFieldResolver<TData, TState>>
): GraphQLFieldResolver<TData, TState> {
  return async (parent, args, context, info) => {
    for (const resolver of resolvers) {
      const result = await resolver(parent, args, context, info);
      if (result !== null && result !== undefined) {
        return result;
      }
    }
    return null;
  };
}

/**
 * Chain resolvers (each receives previous result).
 */
export function chainResolvers<TData, TState>(
  ...resolvers: Array<GraphQLFieldResolver<TData, TState>>
): GraphQLFieldResolver<TData, TState> {
  return async (parent, args, context, info) => {
    let result = parent;
    for (const resolver of resolvers) {
      result = await resolver(result, args, context, info);
    }
    return result;
  };
}

/**
 * Wrap a resolver with error handling.
 */
export function withErrorHandling<TData, TState>(
  resolver: GraphQLFieldResolver<TData, TState>,
  defaultValue: unknown = null
): GraphQLFieldResolver<TData, TState> {
  return async (parent, args, context, info) => {
    try {
      return await resolver(parent, args, context, info);
    } catch (error) {
      console.error('Field resolver error:', error);
      return defaultValue;
    }
  };
}

/**
 * Cache a resolver result.
 */
export function withCache<TData, TState>(
  resolver: GraphQLFieldResolver<TData, TState>,
  getCacheKey: (parent: unknown, args: Record<string, unknown>) => string
): GraphQLFieldResolver<TData, TState> {
  const cache = new Map<string, unknown>();

  return async (parent, args, context, info) => {
    const key = getCacheKey(parent, args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = await resolver(parent, args, context, info);
    cache.set(key, result);
    return result;
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert a path to a field name.
 */
function pathToFieldName(path: string): string {
  const parts = path.split('.');
  if (parts.length > 1 && ['data', 'state', 'derived', 'async'].includes(parts[0]!)) {
    parts.shift();
  }
  return parts
    .map((part, index) =>
      index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join('');
}
