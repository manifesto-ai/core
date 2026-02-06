/**
 * App Factory
 *
 * @see SPEC v2.3.0 §6
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
import { createManifestoWorld } from "@manifesto-ai/world";
import { ReservedEffectTypeError } from "./errors/index.js";
import { RESERVED_EFFECT_TYPE } from "./constants.js";

// =============================================================================
// Config Detection
// =============================================================================

/**
 * Check if argument is v2.3.0 AppConfig (effects-first, World owns persistence).
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
 * Create a new Manifesto App instance (v2.3.0).
 *
 * The `createApp()` function:
 * 1. Returns synchronously with an App instance
 * 2. Does NOT perform runtime initialization during this call
 * 3. Creates Host internally (users provide effects, not Host)
 * 4. Creates World internally if not provided (per ADR-003)
 *
 * ## v2.3.0 API (Recommended)
 *
 * Uses AppConfig with effects-first design. Host and World are created internally.
 *
 * ```typescript
 * const app = createApp({
 *   schema: domainSchema,
 *   effects: {
 *     'api.fetch': async (params, ctx) => [...],
 *     'api.save': async (params, ctx) => [...],
 *   },
 *   // world is optional (defaults to internal World with InMemoryWorldStore)
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
 * // @deprecated - Use v2.3.0 API with AppConfig
 * const app = createApp(domainMel, {
 *   initialData: { todos: [] },
 *   services: { 'http.fetch': httpFetchHandler }
 * });
 *
 * await app.ready();
 * ```
 *
 * @see SPEC v2.3.0 §6.1
 * @see ADR-APP-002
 * @see ADR-003
 */

export function createApp(config: AppConfig): App;
/**
 * @deprecated Use v2.3.0 API with AppConfig. This signature will be removed in v3.0.0.
 */
export function createApp(domain: MelText | DomainSchema, opts?: CreateAppOptions): App;
export function createApp(
  domainOrConfig: MelText | DomainSchema | AppConfig | LegacyAppConfig,
  opts?: CreateAppOptions
): App {
  // v2.2.0 path: AppConfig with effects
  if (isAppConfig(domainOrConfig)) {
    return createAppFromConfig(domainOrConfig);
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
 * Create App with v2.3.0 AppConfig (effects-first, World owns persistence).
 *
 * @internal
 */
function createAppFromConfig(config: AppConfig): App {
  // Extract domain from config
  const domain = config.schema;

  // Validate reserved effect types - users cannot override system.get
  if (RESERVED_EFFECT_TYPE in config.effects) {
    throw new ReservedEffectTypeError(RESERVED_EFFECT_TYPE);
  }

  // ADR-003: World owns persistence
  // If world is not provided, create a default World with InMemoryWorldStore
  let world = config.world;
  let worldStore;

  if (world) {
    // World provided by user - extract store for internal use
    // Note: world.store is @internal, used only by App implementation
    worldStore = world.store;
  } else {
    // Create default in-memory WorldStore and World
    worldStore = createInMemoryWorldStore();
    // Note: World will be fully initialized during app.ready() with schemaHash
    // For now, we just need the worldStore reference
  }

  // Build internal config with effects and worldStore
  // Note: Host will be created internally in ManifestoApp._initializeComponents
  const internalConfig = {
    ...config,
    worldStore,
    world,
  };

  // Build legacy options from config for internal use
  const legacyOpts: CreateAppOptions = {
    initialData: config.initialData,
    // services is deprecated, effects are in _internalConfig
    plugins: config.plugins as CreateAppOptions["plugins"],
    hooks: config.hooks,
    actorPolicy: config.actorPolicy,
    scheduler: config.scheduler,
    systemActions: config.systemActions,
    devtools: config.devtools,
    validation: config.validation as CreateAppOptions["validation"],
    memory: config.memory,
    // v2.3.0 config - will be used by ManifestoApp
    _internalConfig: internalConfig as unknown as CreateAppOptions["_internalConfig"],
  };

  return new ManifestoApp(domain, legacyOpts);
}

/**
 * Create App with legacy v2.0.0 AppConfig (host-first).
 *
 * @deprecated Use createAppFromConfig with effects instead.
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
    _internalConfig: config as unknown as CreateAppOptions["_internalConfig"],
  };

  return new ManifestoApp(domain, legacyOpts);
}

// =============================================================================
// Helper Factories
// =============================================================================

/**
 * Create a minimal App for testing.
 *
 * Uses in-memory implementations for WorldStore and empty effects.
 * For v2.3.0, this creates an effects-first app.
 *
 * @param domain - Domain schema or MEL text
 * @param opts - Additional options
 */
export function createTestApp(
  domain: MelText | DomainSchema,
  opts?: Partial<CreateAppOptions>
): App {
  // v2.3.0: Use effects-first API
  // Convert legacy services to effects for backward compatibility in tests
  const effects: AppConfig["effects"] = {};

  if (opts?.services) {
    for (const [key, handler] of Object.entries(opts.services)) {
      // Wrap legacy service handler to match EffectHandler signature
      effects[key] = async (params, ctx) => {
        const result = await handler(params as Record<string, unknown>, ctx as never);
        return (result ?? []) as readonly import("@manifesto-ai/core").Patch[];
      };
    }
  }

  return createApp({
    schema: domain,
    effects,
    initialData: opts?.initialData ?? {},
    hooks: opts?.hooks,
    actorPolicy: opts?.actorPolicy,
    scheduler: opts?.scheduler,
    systemActions: opts?.systemActions,
    devtools: opts?.devtools,
    plugins: opts?.plugins,
    validation: opts?.validation as { effects?: "strict" | "warn" | "off" },
    memory: opts?.memory,
  });
}
