/**
 * App Factory
 *
 * @see SPEC v2.0.0 §6
 * @module
 */

import type { DomainSchema } from "@manifesto-ai/core";
import { createHost } from "@manifesto-ai/host";
import { compileMelDomain } from "@manifesto-ai/compiler";
import type { App, AppConfig, CreateAppOptions, MelText } from "./core/types/index.js";
import { ManifestoApp } from "./app.js";
import { createInMemoryWorldStore } from "./storage/world-store/index.js";
import { createSilentPolicyService } from "./runtime/policy/index.js";

// =============================================================================
// v2.0.0 API (Only supported API)
// =============================================================================

/**
 * Create a new Manifesto App instance.
 *
 * The `createApp()` function:
 * 1. Returns synchronously with an App instance
 * 2. Does NOT perform runtime initialization during this call
 * 3. Requires AppConfig with Host and WorldStore
 *
 * ```typescript
 * import { createHost } from "@manifesto-ai/host";
 * import { createApp, createInMemoryWorldStore } from "@manifesto-ai/app";
 *
 * const host = createHost(schema);
 * const app = createApp({
 *   schema: domainSchema,
 *   host,
 *   worldStore: createInMemoryWorldStore(),
 * });
 *
 * await app.ready();
 * ```
 *
 * @see SPEC v2.0.0 §6.1
 */
export function createApp(config: AppConfig): App {
  if (!config.host || !config.worldStore) {
    throw new Error(
      "createApp() requires AppConfig with host and worldStore. " +
      "Use createHost() from @manifesto-ai/host and createInMemoryWorldStore() from @manifesto-ai/app."
    );
  }

  const domain = config.schema;

  // Build internal options from config
  const opts: CreateAppOptions = {
    initialData: config.initialData,
    services: config.services,
    plugins: config.plugins as CreateAppOptions["plugins"],
    hooks: config.hooks,
    actorPolicy: config.actorPolicy,
    scheduler: config.scheduler,
    systemActions: config.systemActions,
    devtools: config.devtools,
    validation: config.validation as CreateAppOptions["validation"],
    memory: config.memory,
    _v2Config: config,
  };

  return new ManifestoApp(domain, opts);
}

// =============================================================================
// Test Helper
// =============================================================================

/**
 * Create an App for testing with auto-generated Host and WorldStore.
 *
 * @internal - For testing only
 * @param schema - Domain schema
 * @param opts - Additional options (includes CreateAppOptions fields for backward compat)
 */
export function createTestApp(
  schema: MelText | DomainSchema,
  opts?: Partial<CreateAppOptions>
): App {
  // If schema is a string (MEL text), compile it first for the Host
  // Note: The App will also compile during ready(), but the Host needs a valid schema now
  let compiledSchema: DomainSchema;
  if (typeof schema === "string") {
    const result = compileMelDomain(schema, { mode: "domain" });
    if (!result.schema) {
      const errorMsgs = result.errors?.map(e => e.message).join(", ") ?? "Unknown compilation error";
      throw new Error(`Failed to compile MEL text: ${errorMsgs}`);
    }
    // Cast to core's DomainSchema (structurally compatible)
    compiledSchema = result.schema as unknown as DomainSchema;
  } else {
    compiledSchema = schema;
  }

  // Pass initialData to Host so it can initialize the snapshot
  const host = createHost(compiledSchema, {
    initialData: opts?.initialData ?? {},
  });
  const worldStore = createInMemoryWorldStore();
  const policyService = createSilentPolicyService();

  const config = {
    schema,  // Pass original schema (MEL or DomainSchema) to App
    host: host as unknown as AppConfig["host"],
    worldStore,
    policyService,
    ...opts,
  } as unknown as AppConfig;

  return createApp(config);
}
