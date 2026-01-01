import type { DomainSchema } from "@manifesto-ai/core";
import type { DomainModule } from "./define-domain.js";
import type { DomainDiagnostics } from "../diagnostics/diagnostic-types.js";

/**
 * SetupDomainResult - Result of setupDomain()
 */
export interface SetupDomainResult {
  /**
   * The compiled DomainSchema IR
   */
  readonly schema: DomainSchema;

  /**
   * Deterministic schema hash (per Schema Spec)
   */
  readonly schemaHash: string;

  /**
   * Validation diagnostics
   */
  readonly diagnostics: DomainDiagnostics;
}

/**
 * setupDomain - Validate, canonicalize, and hash a domain
 *
 * This is the production-ready setup that:
 * 1. Runs all validations
 * 2. Computes deterministic schema hash
 * 3. Throws in production mode if invalid
 *
 * @example
 * ```ts
 * const { schema, schemaHash, diagnostics } = setupDomain(MyDomain);
 *
 * if (!diagnostics.valid) {
 *   console.error(diagnostics.errors);
 *   process.exit(1);
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setupDomain<T extends DomainModule<any, any, any>>(
  domain: T
): SetupDomainResult {
  const { schema, diagnostics } = domain;

  // In production mode, throw on errors
  // Use globalThis to avoid Node.js type dependency
  const isProduction = typeof globalThis !== "undefined" &&
    (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV === "production";

  if (isProduction && !diagnostics.valid) {
    const errorMessages = diagnostics.errors
      .map((e) => `[${e.code}] ${e.message}${e.path ? ` at ${e.path}` : ""}`)
      .join("\n");
    throw new Error(`Domain validation failed:\n${errorMessages}`);
  }

  return {
    schema,
    schemaHash: schema.hash,
    diagnostics,
  };
}

/**
 * validateDomain - Run validation only without setup
 *
 * Useful for development-time validation without the full setup process.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateDomain<T extends DomainModule<any, any, any>>(
  domain: T
): DomainDiagnostics {
  return domain.diagnostics;
}
