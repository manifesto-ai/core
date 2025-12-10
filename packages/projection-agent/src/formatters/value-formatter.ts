/**
 * Value Formatter
 *
 * Converts values to human-readable display strings.
 * Supports type-based formatting with customizable options.
 */

import type { SemanticMeta } from '@manifesto-ai/core';
import type {
  ValueFormatter,
  ValueFormatterOptions,
  FormatterRegistry,
} from '../types.js';

// =============================================================================
// Default Formatters
// =============================================================================

/**
 * Format string values.
 */
export const stringFormatter: ValueFormatter<string> = (value, options) => {
  if (value === '') return options?.nullDisplay ?? '(empty)';

  const maxLen = options?.truncateLength;
  if (maxLen && value.length > maxLen) {
    return value.slice(0, maxLen) + '...';
  }

  return value;
};

/**
 * Format number values.
 */
export const numberFormatter: ValueFormatter<number> = (value, options) => {
  if (Number.isNaN(value)) return 'NaN';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '-∞';

  const locale = options?.locale ?? 'en-US';
  const formatOptions = options?.numberFormat;

  return new Intl.NumberFormat(locale, formatOptions).format(value);
};

/**
 * Format boolean values.
 */
export const booleanFormatter: ValueFormatter<boolean> = (value, options) => {
  const locale = options?.locale ?? 'en-US';

  // Simple yes/no based on common locales
  if (locale.startsWith('ko')) {
    return value ? '예' : '아니오';
  }
  if (locale.startsWith('ja')) {
    return value ? 'はい' : 'いいえ';
  }

  return value ? 'Yes' : 'No';
};

/**
 * Format date values.
 */
export const dateFormatter: ValueFormatter<Date | string> = (value, options) => {
  const date = typeof value === 'string' ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  const locale = options?.locale ?? 'en-US';
  const timezone = options?.timezone;

  return date.toLocaleString(locale, {
    timeZone: timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

/**
 * Format array values.
 */
export const arrayFormatter: ValueFormatter<unknown[]> = (value, options) => {
  if (value.length === 0) return '(empty list)';

  const maxLen = options?.truncateLength ?? 100;
  const items = value.map((item) => formatUnknown(item, options));

  const joined = items.join(', ');
  if (joined.length > maxLen) {
    return joined.slice(0, maxLen) + `... (${value.length} items)`;
  }

  return joined;
};

/**
 * Format object values.
 */
export const objectFormatter: ValueFormatter<Record<string, unknown>> = (
  value,
  options
) => {
  const keys = Object.keys(value);
  if (keys.length === 0) return '(empty object)';

  const maxLen = options?.truncateLength ?? 100;
  const json = JSON.stringify(value);

  if (json.length > maxLen) {
    return json.slice(0, maxLen) + `... (${keys.length} keys)`;
  }

  return json;
};

/**
 * Format null values.
 */
export const nullFormatter: ValueFormatter<null> = (_value, options) => {
  return options?.nullDisplay ?? '(none)';
};

/**
 * Format undefined values.
 */
export const undefinedFormatter: ValueFormatter<undefined> = (_value, options) => {
  return options?.undefinedDisplay ?? '(not set)';
};

// =============================================================================
// Default Formatters Map
// =============================================================================

/**
 * Collection of default formatters by type.
 */
export const defaultFormatters = {
  string: stringFormatter,
  number: numberFormatter,
  boolean: booleanFormatter,
  date: dateFormatter,
  array: arrayFormatter,
  object: objectFormatter,
  null: nullFormatter,
  undefined: undefinedFormatter,
};

// =============================================================================
// Format Unknown Value
// =============================================================================

/**
 * Format an unknown value based on its type.
 */
export function formatUnknown(
  value: unknown,
  options?: ValueFormatterOptions
): string {
  if (value === null) {
    return nullFormatter(null, options);
  }

  if (value === undefined) {
    return undefinedFormatter(undefined, options);
  }

  if (typeof value === 'string') {
    return stringFormatter(value, options);
  }

  if (typeof value === 'number') {
    return numberFormatter(value, options);
  }

  if (typeof value === 'boolean') {
    return booleanFormatter(value, options);
  }

  if (value instanceof Date) {
    return dateFormatter(value, options);
  }

  if (Array.isArray(value)) {
    return arrayFormatter(value, options);
  }

  if (typeof value === 'object') {
    return objectFormatter(value as Record<string, unknown>, options);
  }

  // Fallback
  return String(value);
}

// =============================================================================
// Formatter Registry
// =============================================================================

/**
 * Create a formatter registry with default formatters.
 */
export function createFormatterRegistry(
  options?: ValueFormatterOptions
): FormatterRegistry {
  const formatters = new Map<string, ValueFormatter>();
  formatters.set('string', stringFormatter as ValueFormatter);
  formatters.set('number', numberFormatter as ValueFormatter);
  formatters.set('boolean', booleanFormatter as ValueFormatter);
  formatters.set('date', dateFormatter as ValueFormatter);
  formatters.set('array', arrayFormatter as ValueFormatter);
  formatters.set('object', objectFormatter as ValueFormatter);

  return {
    formatters,
    defaultFormatter: formatUnknown,
    options: options ?? {},
  };
}

/**
 * Get formatter for a semantic type.
 */
export function getFormatterForSemantic(
  semantic: SemanticMeta
): ValueFormatter | undefined {
  // Map semantic type to formatter
  switch (semantic.type) {
    case 'input':
    case 'computed':
      // Use default type inference
      return undefined;
    case 'async':
      // Async values might be loading states
      return undefined;
    case 'action-availability':
      // Boolean action availability
      return booleanFormatter as ValueFormatter;
    case 'validation':
      // Validation result - use object formatter
      return objectFormatter as ValueFormatter;
    default:
      return undefined;
  }
}

/**
 * Format a value using the registry.
 */
export function formatValue(
  value: unknown,
  semantic: SemanticMeta,
  registry: FormatterRegistry
): string {
  // Check for semantic-specific formatter
  const semanticFormatter = getFormatterForSemantic(semantic);
  if (semanticFormatter) {
    return semanticFormatter(value, registry.options);
  }

  // Check for type-specific formatter in registry
  const typeName = getTypeName(value);
  const typeFormatter = registry.formatters.get(typeName);
  if (typeFormatter) {
    return typeFormatter(value, registry.options);
  }

  // Use default formatter
  return registry.defaultFormatter(value, registry.options);
}

/**
 * Get type name for a value.
 */
function getTypeName(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  return typeof value;
}

// =============================================================================
// Registry Utilities
// =============================================================================

/**
 * Register a custom formatter.
 */
export function registerFormatter(
  registry: FormatterRegistry,
  typeName: string,
  formatter: ValueFormatter
): void {
  registry.formatters.set(typeName, formatter);
}

/**
 * Merge registries.
 */
export function mergeRegistries(
  base: FormatterRegistry,
  override: Partial<FormatterRegistry>
): FormatterRegistry {
  const mergedFormatters = new Map(base.formatters);

  if (override.formatters) {
    for (const [key, formatter] of override.formatters) {
      mergedFormatters.set(key, formatter);
    }
  }

  return {
    formatters: mergedFormatters,
    defaultFormatter: override.defaultFormatter ?? base.defaultFormatter,
    options: { ...base.options, ...override.options },
  };
}
