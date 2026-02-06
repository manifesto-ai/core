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
  "system.memory.maintain",
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
