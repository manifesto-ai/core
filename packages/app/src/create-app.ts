/**
 * App Factory
 *
 * @see SPEC §5.1
 * @module
 */

import type { DomainSchema } from "@manifesto-ai/core";
import type {
  App,
  CreateAppOptions,
  MelText,
} from "./types/index.js";
import { ManifestoApp } from "./app.js";

/**
 * Create a new Manifesto App instance.
 *
 * The `createApp()` function:
 * 1. Returns synchronously with an App instance
 * 2. Does NOT perform runtime initialization during this call
 * 3. Accepts either MEL text string or compiled DomainSchema
 *
 * @param domain - MEL text or compiled DomainSchema
 * @param opts - App creation options
 * @returns App instance (not yet initialized - call ready())
 *
 * @see SPEC §5.1
 *
 * @example
 * ```typescript
 * const app = createApp(domainMel, {
 *   initialData: { todos: [] },
 *   services: {
 *     'http.fetch': httpFetchHandler
 *   }
 * });
 *
 * await app.ready();
 * ```
 */
export function createApp(
  domain: MelText | DomainSchema,
  opts?: CreateAppOptions
): App {
  return new ManifestoApp(domain, opts);
}
