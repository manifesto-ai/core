/**
 * Manifesto App Constants
 *
 * @module
 */

/**
 * System Action types catalog.
 *
 * @see SPEC §17 System Action Catalog
 * @see SPEC Appendix A.4
 */
export const SYSTEM_ACTION_TYPES = [
  // Actor Management
  "system.actor.register",
  "system.actor.disable",
  "system.actor.updateMeta",
  "system.actor.bindAuthority",

  // Branch Management
  "system.branch.create",
  "system.branch.checkout",
  "system.schema.migrate",

  // Services Management
  "system.service.register",
  "system.service.unregister",
  "system.service.replace",

  // Memory Operations
  "system.memory.configure",
  "system.memory.backfill",
  "system.memory.maintain",

  // Workflow
  "system.workflow.enable",
  "system.workflow.disable",
  "system.workflow.setPolicy",
] as const;

/**
 * System Action type union.
 */
export type SystemActionType = (typeof SYSTEM_ACTION_TYPES)[number];

/**
 * Reserved effect type for Compiler.
 */
export const RESERVED_EFFECT_TYPE = "system.get";

/**
 * Reserved namespace prefix.
 */
export const RESERVED_NAMESPACE_PREFIX = "system.";
