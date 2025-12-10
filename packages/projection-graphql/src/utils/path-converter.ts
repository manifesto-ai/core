/**
 * Path Converter
 *
 * Utilities for converting between SemanticPath and GraphQL field names.
 */

import type { SemanticPath } from '@manifesto-ai/core';
import type { PathConversionOptions } from '../types.js';

// =============================================================================
// Path Prefixes
// =============================================================================

/**
 * Known path prefixes in Manifesto.
 */
const PATH_PREFIXES = ['data', 'state', 'derived', 'async', 'actions'] as const;
type PathPrefix = (typeof PATH_PREFIXES)[number];

// =============================================================================
// Path to GraphQL Field Name
// =============================================================================

/**
 * Convert a SemanticPath to a GraphQL field name.
 *
 * @example
 * pathToFieldName('data.user.email') // 'userEmail'
 * pathToFieldName('derived.totalAmount') // 'totalAmount'
 */
export function pathToFieldName(
  path: string | SemanticPath,
  options: PathConversionOptions = {}
): string {
  const {
    separator = '',
    capitalize: shouldCapitalize = true,
    stripPrefix,
  } = options;

  let pathStr = String(path);

  // Strip specific prefix if provided
  if (stripPrefix && pathStr.startsWith(stripPrefix)) {
    pathStr = pathStr.slice(stripPrefix.length);
    if (pathStr.startsWith('.')) {
      pathStr = pathStr.slice(1);
    }
  }

  // Split into parts
  const parts = pathStr.split('.');

  // Remove known prefix if present
  if (parts.length > 0 && PATH_PREFIXES.includes(parts[0] as PathPrefix)) {
    parts.shift();
  }

  if (parts.length === 0) {
    return '_empty';
  }

  // Build field name
  if (separator) {
    return parts.join(separator);
  }

  // camelCase by default
  return parts
    .map((part, index) => {
      if (index === 0) {
        return part.charAt(0).toLowerCase() + part.slice(1);
      }
      return shouldCapitalize
        ? part.charAt(0).toUpperCase() + part.slice(1)
        : part;
    })
    .join('');
}

/**
 * Convert a SemanticPath to a GraphQL type name (PascalCase).
 *
 * @example
 * pathToTypeName('data.user') // 'User'
 * pathToTypeName('data.order.items') // 'OrderItems'
 */
export function pathToTypeName(
  path: string | SemanticPath,
  options: PathConversionOptions = {}
): string {
  const fieldName = pathToFieldName(path, { ...options, capitalize: true });
  return fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
}

// =============================================================================
// GraphQL Field Name to Path
// =============================================================================

/**
 * Convert a GraphQL field name back to a SemanticPath.
 *
 * @example
 * fieldNameToPath('userEmail', 'data') // 'data.user.email'
 * fieldNameToPath('totalAmount', 'derived') // 'derived.totalAmount'
 */
export function fieldNameToPath(
  fieldName: string,
  prefix: PathPrefix = 'data'
): SemanticPath {
  // Split camelCase into parts
  const parts = splitCamelCase(fieldName);

  // Join with dots and add prefix
  const pathStr = `${prefix}.${parts.join('.')}`;

  return pathStr as SemanticPath;
}

/**
 * Split a camelCase string into parts.
 *
 * @example
 * splitCamelCase('userEmail') // ['user', 'email']
 * splitCamelCase('totalOrderAmount') // ['total', 'order', 'amount']
 */
export function splitCamelCase(str: string): string[] {
  const parts: string[] = [];
  let current = '';

  for (const char of str) {
    if (char === char.toUpperCase() && current) {
      parts.push(current.toLowerCase());
      current = char.toLowerCase();
    } else {
      current += char.toLowerCase();
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

// =============================================================================
// Path Utilities
// =============================================================================

/**
 * Get the prefix from a path.
 *
 * @example
 * getPathPrefix('data.user.email') // 'data'
 * getPathPrefix('derived.total') // 'derived'
 */
export function getPathPrefix(path: string | SemanticPath): PathPrefix | null {
  const parts = String(path).split('.');
  const prefix = parts[0];

  if (prefix && PATH_PREFIXES.includes(prefix as PathPrefix)) {
    return prefix as PathPrefix;
  }

  return null;
}

/**
 * Check if a path has a specific prefix.
 *
 * @example
 * hasPathPrefix('data.user.email', 'data') // true
 * hasPathPrefix('derived.total', 'data') // false
 */
export function hasPathPrefix(
  path: string | SemanticPath,
  prefix: PathPrefix
): boolean {
  return getPathPrefix(path) === prefix;
}

/**
 * Remove the prefix from a path.
 *
 * @example
 * stripPathPrefix('data.user.email') // 'user.email'
 * stripPathPrefix('derived.total') // 'total'
 */
export function stripPathPrefix(path: string | SemanticPath): string {
  const parts = String(path).split('.');

  if (parts.length > 0 && PATH_PREFIXES.includes(parts[0] as PathPrefix)) {
    parts.shift();
  }

  return parts.join('.');
}

/**
 * Add a prefix to a path if not already present.
 *
 * @example
 * addPathPrefix('user.email', 'data') // 'data.user.email'
 * addPathPrefix('data.user.email', 'data') // 'data.user.email'
 */
export function addPathPrefix(
  path: string | SemanticPath,
  prefix: PathPrefix
): SemanticPath {
  const pathStr = String(path);

  if (hasPathPrefix(pathStr, prefix)) {
    return pathStr as SemanticPath;
  }

  if (getPathPrefix(pathStr)) {
    // Replace existing prefix
    return `${prefix}.${stripPathPrefix(pathStr)}` as SemanticPath;
  }

  return `${prefix}.${pathStr}` as SemanticPath;
}

/**
 * Get the parent path.
 *
 * @example
 * getParentPath('data.user.email') // 'data.user'
 * getParentPath('data.user') // 'data'
 */
export function getParentPath(path: string | SemanticPath): string | null {
  const parts = String(path).split('.');

  if (parts.length <= 1) {
    return null;
  }

  parts.pop();
  return parts.join('.');
}

/**
 * Get the last segment of a path.
 *
 * @example
 * getPathSegment('data.user.email') // 'email'
 * getPathSegment('data.user') // 'user'
 */
export function getPathSegment(path: string | SemanticPath): string {
  const parts = String(path).split('.');
  return parts[parts.length - 1] ?? '';
}

/**
 * Join path segments.
 *
 * @example
 * joinPath('data', 'user', 'email') // 'data.user.email'
 */
export function joinPath(...segments: string[]): SemanticPath {
  return segments.filter(Boolean).join('.') as SemanticPath;
}

/**
 * Check if a path is a child of another path.
 *
 * @example
 * isChildPath('data.user.email', 'data.user') // true
 * isChildPath('data.user', 'data.user.email') // false
 */
export function isChildPath(
  childPath: string | SemanticPath,
  parentPath: string | SemanticPath
): boolean {
  const child = String(childPath);
  const parent = String(parentPath);

  return child.startsWith(parent + '.');
}

/**
 * Get relative path from parent.
 *
 * @example
 * getRelativePath('data.user.email', 'data.user') // 'email'
 * getRelativePath('data.user.profile.name', 'data.user') // 'profile.name'
 */
export function getRelativePath(
  fullPath: string | SemanticPath,
  parentPath: string | SemanticPath
): string | null {
  const full = String(fullPath);
  const parent = String(parentPath);

  if (!full.startsWith(parent + '.')) {
    return null;
  }

  return full.slice(parent.length + 1);
}

// =============================================================================
// GraphQL-specific Utilities
// =============================================================================

/**
 * Sanitize a string to be a valid GraphQL name.
 */
export function sanitizeGraphQLName(name: string): string {
  // Replace invalid characters with underscores
  let sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_');

  // Ensure it starts with a letter or underscore
  if (/^[0-9]/.test(sanitized)) {
    sanitized = '_' + sanitized;
  }

  return sanitized;
}

/**
 * Check if a name is a valid GraphQL name.
 */
export function isValidGraphQLName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/**
 * Convert a path to a valid GraphQL argument name.
 *
 * @example
 * pathToArgName('data.user.email') // 'dataUserEmail'
 */
export function pathToArgName(path: string | SemanticPath): string {
  const parts = String(path).split('.');

  return parts
    .map((part, index) => {
      if (index === 0) {
        return part.toLowerCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
}
