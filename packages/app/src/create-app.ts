/**
 * App Factory
 *
 * @see SPEC v2.2.0 §6
 * @module
 */

import type { DomainSchema } from "@manifesto-ai/core";
import type {
  App,
  AppConfig,
  CreateAppOptions,
  LegacyAppConfig,
  MelText,
} from "./core/types/index.js";
import { ManifestoApp } from "./app.js";
import { createInMemoryWorldStore } from "./storage/world-store/index.js";

// =============================================================================
// Config Detection
// =============================================================================

/**
 * Check if argument is v2.2.0 AppConfig (effects-first).
 */
function isAppConfig(arg: unknown): arg is AppConfig {
  if (!arg || typeof arg !== "object") {
    return false;
  }
  const obj = arg as Record<string, unknown>;
  // v2.2.0: Check for effects (required) and schema
  return "effects" in obj && "schema" in obj;
}

/**
 * Check if argument is legacy v2.0.0 AppConfig (host-first).
 * @deprecated
 */
function isLegacyAppConfig(arg: unknown): arg is LegacyAppConfig {
  if (!arg || typeof arg !== "object") {
    return false;
  }
  const obj = arg as Record<string, unknown>;
  // Legacy v2.0.0: Check for host and worldStore
  return "host" in obj && "worldStore" in obj;
}

// =============================================================================
// v2.2.0 API
// =============================================================================

/**
 * Create a new Manifesto App instance (v2.2.0).
 *
 * The `createApp()` function:
 * 1. Returns synchronously with an App instance
 * 2. Does NOT perform runtime initialization during this call
 * 3. Creates Host internally (users provide effects, not Host)
 *
 * ## v2.2.0 API (Recommended)
 *
 * Uses AppConfig with effects-first design. Host is created internally.
 *
 * ```typescript
 * const app = createApp({
 *   schema: domainSchema,
 *   effects: {
 *     'api.fetch': async (params, ctx) => [...],
 *     'api.save': async (params, ctx) => [...],
 *   },
 *   // worldStore is optional (defaults to in-memory)
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
 * // @deprecated - Use v2.2.0 API with AppConfig
 * const app = createApp(domainMel, {
 *   initialData: { todos: [] },
 *   services: { 'http.fetch': httpFetchHandler }
 * });
 *
 * await app.ready();
 * ```
 *
 * @see SPEC v2.2.0 §6.1
 * @see ADR-APP-002
 */
export function createApp(config: AppConfig): App;
/**
 * @deprecated Use v2.2.0 API with AppConfig. This signature will be removed in v3.0.0.
 */
export function createApp(domain: MelText | DomainSchema, opts?: CreateAppOptions): App;
export function createApp(
  domainOrConfig: MelText | DomainSchema | AppConfig | LegacyAppConfig,
  opts?: CreateAppOptions
): App {
  // v2.2.0 path: AppConfig with effects
  if (isAppConfig(domainOrConfig)) {
    return createAppV2(domainOrConfig);
  }

  // Legacy v2.0.0 path: AppConfig with host (deprecated)
  if (isLegacyAppConfig(domainOrConfig)) {
    const isTest = typeof globalThis !== "undefined" &&
      (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV === "test";

    if (!isTest) {
      console.warn(
        "[Manifesto] Using deprecated createApp() with host/worldStore. " +
        "Migrate to v2.2.0 API with effects instead. Host is now created internally. " +
        "This pattern will be removed in v3.0.0."
      );
    }

    return createAppLegacy(domainOrConfig);
  }

  // Legacy path: (domain, opts) signature (deprecated)
  const isTest = typeof globalThis !== "undefined" &&
    (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV === "test";

  if (!isTest) {
    console.warn(
      "[Manifesto] Using legacy createApp() signature. " +
      "Migrate to v2.2.0 API with AppConfig for effects-first design. " +
      "This signature will be removed in v3.0.0."
    );
  }

  return new ManifestoApp(domainOrConfig, opts);
}

/**
 * Create App with v2.2.0 AppConfig (effects-first).
 *
 * @internal
 */
function createAppV2(config: AppConfig): App {
  // Extract domain from config
  const domain = config.schema;

  // Default worldStore to in-memory if not provided
  const worldStore = config.worldStore ?? createInMemoryWorldStore();

  // Build internal config with effects
  // Note: Host will be created internally in ManifestoApp._initializeV2Components
  const internalConfig = {
    ...config,
    worldStore,
  };

  // Build legacy options from config for internal use
  const legacyOpts: CreateAppOptions = {
    initialData: config.initialData,
    // services is deprecated, effects are in _v2Config
    plugins: config.plugins as CreateAppOptions["plugins"],
    hooks: config.hooks,
    actorPolicy: config.actorPolicy,
    scheduler: config.scheduler,
    systemActions: config.systemActions,
    devtools: config.devtools,
    validation: config.validation as CreateAppOptions["validation"],
    // v2.2.0 config - will be used by ManifestoApp
    _v2Config: internalConfig as unknown as CreateAppOptions["_v2Config"],
  };

  return new ManifestoApp(domain, legacyOpts);
}

/**
 * Create App with legacy v2.0.0 AppConfig (host-first).
 *
 * @deprecated Use createAppV2 with effects instead.
 * @internal
 */
function createAppLegacy(config: LegacyAppConfig): App {
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
    // Legacy v2.0.0 config with host
    _v2Config: config as unknown as CreateAppOptions["_v2Config"],
  };

  return new ManifestoApp(domain, legacyOpts);
}

// =============================================================================
// Helper Factories
// =============================================================================

/**
 * Create a minimal App for testing.
 *
 * Uses in-memory implementations for WorldStore.
 * For v2.2.0, prefer createApp({ schema, effects: {} }) directly.
 *
 * @param domain - Domain schema or MEL text
 * @param opts - Additional options
 */
export function createTestApp(
  domain: MelText | DomainSchema,
  opts?: Partial<CreateAppOptions>
): App {
  // For testing, use legacy path
  return new ManifestoApp(domain, opts);
}
