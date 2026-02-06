/**
 * App Factory
 *
 * @see SPEC v2.3.0 §6
 * @module
 */

import type { DomainSchema } from "@manifesto-ai/core";
import type { App, AppConfig, Effects, MelText } from "./core/types/index.js";
import { ManifestoApp } from "./app.js";
import { createInMemoryWorldStore } from "./storage/world-store/index.js";
import { ReservedEffectTypeError } from "./errors/index.js";
import { RESERVED_EFFECT_TYPE } from "./constants.js";

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
 * @see SPEC v2.3.0 §6.1
 * @see ADR-APP-002
 * @see ADR-003
 */

export function createApp(config: AppConfig): App {
  return createAppFromConfig(config);
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
  // If world is not provided, create a default WorldStore
  const worldStore = config.world?.store ?? createInMemoryWorldStore();

  return new ManifestoApp(config, worldStore);
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
  opts?: Partial<Omit<AppConfig, "schema" | "effects">> & { effects?: Effects }
): App {
  return createApp({
    schema: domain,
    effects: opts?.effects ?? {},
    initialData: opts?.initialData,
    hooks: opts?.hooks,
    actorPolicy: opts?.actorPolicy,
    scheduler: opts?.scheduler,
    systemActions: opts?.systemActions,
    devtools: opts?.devtools,
    plugins: opts?.plugins,
    validation: opts?.validation,
    memory: opts?.memory,
    memoryStore: opts?.memoryStore,
    memoryProvider: opts?.memoryProvider,
    policyService: opts?.policyService,
    executionKeyPolicy: opts?.executionKeyPolicy,
    world: opts?.world,
  });
}
