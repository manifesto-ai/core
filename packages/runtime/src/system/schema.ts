/**
 * System Schema Definition
 *
 * Defines the schema for System Runtime actions.
 *
 * @see SPEC §16.2
 * @module
 */

import type { DomainSchema, FieldSpec } from "@manifesto-ai/core";
import type { SystemRuntimeState } from "../types/index.js";
import { SYSTEM_ACTION_TYPES } from "../constants.js";

/**
 * Create the System Runtime schema.
 *
 * The System Runtime has its own DomainSchema that defines
 * system.* actions for App-level maintenance operations.
 *
 * @see SPEC §16.2 SYSRT-2
 */
export function createSystemSchema(): DomainSchema {
  // Build actions from SYSTEM_ACTION_TYPES
  const actions: DomainSchema["actions"] = {};

  for (const actionType of SYSTEM_ACTION_TYPES) {
    actions[actionType] = {
      flow: { kind: "seq", steps: [] }, // Empty seq - system actions executed by System Runtime
      description: `System action: ${actionType}`,
    };
  }

  return {
    id: "manifesto:system-runtime",
    version: "0.4.9",
    hash: "system-runtime-v0.4.9",
    types: {},
    state: { fields: createSystemStateFields() },
    computed: { fields: {} },
    actions,
  };
}

/**
 * Create the state field definitions for System Runtime.
 */
function createSystemStateFields(): Record<string, FieldSpec> {
  return {
    auditLog: { type: "array", required: false, default: [] },
  };
}

/**
 * Create initial System Runtime state.
 *
 * @see SPEC §16.3
 */
export function createInitialSystemState(): SystemRuntimeState {
  return {
    auditLog: [],
  };
}
