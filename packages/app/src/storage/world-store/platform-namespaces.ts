/**
 * Platform Namespace Utilities
 *
 * Shared utilities for handling platform-reserved namespaces in snapshot.data.
 *
 * Per Core SPEC SCHEMA-RESERVED-1 and World SPEC v2.0.3 §7.9.1:
 * - All $-prefixed keys in snapshot.data are platform-reserved
 * - Domain schemas MUST NOT define $-prefixed keys
 *
 * @see Core SPEC v2.0.0 SCHEMA-RESERVED-1
 * @see World SPEC v2.0.3 §7.9.1
 * @module
 */

/**
 * Platform namespace prefix.
 *
 * Known platform namespaces:
 * - $host: Host-owned state (WORLD-HASH-4a)
 * - $mel: Compiler-owned guard state (WORLD-HASH-4b)
 * - Future: $app, $trace, etc. (automatically handled)
 */
export const PLATFORM_NAMESPACE_PREFIX = "$";

/**
 * Check if a key is a platform namespace.
 *
 * @param key - Key to check
 * @returns True if key is a platform namespace ($-prefixed)
 */
export function isPlatformNamespace(key: string): boolean {
  return key.startsWith(PLATFORM_NAMESPACE_PREFIX);
}

/**
 * Strip platform namespaces from data.
 *
 * Per Core SPEC SCHEMA-RESERVED-1 and World SPEC v2.0.3:
 * - All $-prefixed top-level keys are platform namespaces
 * - Platform namespaces MUST be excluded from snapshotHash and delta
 * - This is future-proof for new platform namespaces ($app, $trace, etc.)
 *
 * @param data - Data object
 * @returns Data without platform namespaces
 */
export function stripPlatformNamespaces(
  data: Record<string, unknown>
): Record<string, unknown> {
  if (data === undefined || data === null) {
    return {};
  }

  const keys = Object.keys(data);
  const hasPlatformNamespace = keys.some(isPlatformNamespace);

  if (!hasPlatformNamespace) {
    return data;
  }

  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (!isPlatformNamespace(key)) {
      result[key] = data[key];
    }
  }
  return result;
}
