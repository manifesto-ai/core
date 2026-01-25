/**
 * App Factory
 *
 * @see SPEC v2.0.0 §6
 * @module
 */

import type { DomainSchema } from "@manifesto-ai/core";
import type {
  App,
  AppConfig,
  CreateAppOptions,
  MelText,
} from "./core/types/index.js";
import { ManifestoApp } from "./app.js";

/**
 * Check if argument is v2 AppConfig.
 */
function isAppConfig(arg: unknown): arg is AppConfig {
  if (!arg || typeof arg !== "object") {
    return false;
  }
  const obj = arg as Record<string, unknown>;
  return "host" in obj && "worldStore" in obj;
}

// =============================================================================
// v2.0.0 API
// =============================================================================

/**
 * Create a new Manifesto App instance (v2.0.0).
 *
 * The `createApp()` function:
 * 1. Returns synchronously with an App instance
 * 2. Does NOT perform runtime initialization during this call
 * 3. Accepts AppConfig (v2) or legacy (domain, opts) signature
 *
 * ## v2.0.0 API (Recommended)
 *
 * Uses AppConfig with injectable Host and WorldStore.
 *
 * ```typescript
 * const app = createApp({
 *   schema: domainSchema,
 *   host: myHost,
 *   worldStore: new InMemoryWorldStore(),
 *   services: { 'api.fetch': fetchHandler },
 * });
 *
 * await app.ready();
 * ```
 *
 * ## Legacy API (Deprecated)
 *
 * Uses internal DomainExecutor.
 *
 * ```typescript
 * // @deprecated - Use v2 API with AppConfig
 * const app = createApp(domainMel, {
 *   initialData: { todos: [] },
 *   services: { 'http.fetch': httpFetchHandler }
 * });
 *
 * await app.ready();
 * ```
 *
 * @see SPEC v2.0.0 §6.1
 */
export function createApp(config: AppConfig): App;
/**
 * @deprecated Use v2 API with AppConfig. This signature will be removed in v3.0.0.
 */
export function createApp(domain: MelText | DomainSchema, opts?: CreateAppOptions): App;
export function createApp(
  domainOrConfig: MelText | DomainSchema | AppConfig,
  opts?: CreateAppOptions
): App {
  // v2 path: AppConfig
  if (isAppConfig(domainOrConfig)) {
    return createAppV2(domainOrConfig);
  }

  // Legacy path (deprecated)
  const isTest = typeof globalThis !== "undefined" &&
    (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV === "test";

  if (!isTest) {
    console.warn(
      "[Manifesto] Using legacy createApp() signature. " +
      "Migrate to v2 API with AppConfig for Host/WorldStore injection. " +
      "This signature will be removed in v3.0.0."
    );
  }

  return new ManifestoApp(domainOrConfig, opts);
}

/**
 * Create App with v2 AppConfig.
 *
 * @internal
 */
function createAppV2(config: AppConfig): App {
  // Extract domain from config
  const domain = config.schema;

  // Build legacy options from config for backward compatibility
  const legacyOpts: CreateAppOptions = {
    initialData: config.initialData,
    services: config.services,
    plugins: config.plugins as CreateAppOptions["plugins"],
    hooks: config.hooks,
    actorPolicy: config.actorPolicy,
    scheduler: config.scheduler,
    systemActions: config.systemActions,
    devtools: config.devtools,
    validation: config.validation as CreateAppOptions["validation"],
    // v2 specific - will be used by ManifestoApp when available
    _v2Config: config,
  };

  return new ManifestoApp(domain, legacyOpts);
}

// =============================================================================
// Helper Factories
// =============================================================================

/**
 * Create a minimal App for testing.
 *
 * Uses in-memory implementations for Host and WorldStore.
 *
 * @param domain - Domain schema or MEL text
 * @param opts - Additional options
 */
export function createTestApp(
  domain: MelText | DomainSchema,
  opts?: Partial<CreateAppOptions>
): App {
  // For testing, use legacy path until Host/WorldStore are fully integrated
  return new ManifestoApp(domain, opts);
}
