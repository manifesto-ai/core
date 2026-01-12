/**
 * @fileoverview Resolver Module Exports
 *
 * Resolver handles discourse reference resolution.
 * Resolution is deterministic (no LLM involved).
 */

export {
  createResolver,
  type Resolver,
  type ResolutionContext,
  type FocusEntry,
  type DiscourseEntry,
} from "./interface.js";
