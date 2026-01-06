/**
 * System Schema Definition
 *
 * Defines the schema for System Runtime actions.
 *
 * @see SPEC §16.2
 * @module
 */

import type { DomainSchema } from "@manifesto-ai/core";
import { SYSTEM_ACTION_TYPES } from "../constants.js";

/**
 * Create the System Runtime schema.
 *
 * The System Runtime has its own DomainSchema that defines
 * system.* actions for actor, branch, service, memory, and workflow management.
 *
 * @see SPEC §16.2 SYSRT-2
 */
export function createSystemSchema(): DomainSchema {
  // Build actions from SYSTEM_ACTION_TYPES
  const actions: DomainSchema["actions"] = {};

  for (const actionType of SYSTEM_ACTION_TYPES) {
    actions[actionType] = {
      type: actionType,
      inputSchema: getInputSchemaForAction(actionType),
      outputSchema: {},
      flow: { kind: "noop" },
    };
  }

  return {
    schemaHash: "system-runtime-v0.4.7",
    actions,
    computed: {},
    state: createSystemStateSchema(),
    effects: {},
    flows: {},
  };
}

/**
 * Get input schema for a system action type.
 */
function getInputSchemaForAction(
  actionType: string
): Record<string, unknown> {
  switch (actionType) {
    // Actor Management
    case "system.actor.register":
      return {
        type: "object",
        properties: {
          actorId: { type: "string" },
          kind: { type: "string", enum: ["human", "agent", "system"] },
          name: { type: "string" },
          meta: { type: "object" },
        },
        required: ["actorId", "kind"],
      };

    case "system.actor.disable":
      return {
        type: "object",
        properties: {
          actorId: { type: "string" },
        },
        required: ["actorId"],
      };

    case "system.actor.updateMeta":
      return {
        type: "object",
        properties: {
          actorId: { type: "string" },
          meta: { type: "object" },
        },
        required: ["actorId", "meta"],
      };

    case "system.actor.bindAuthority":
      return {
        type: "object",
        properties: {
          actorId: { type: "string" },
          authorityIds: { type: "array", items: { type: "string" } },
        },
        required: ["actorId", "authorityIds"],
      };

    // Branch Management
    case "system.branch.create":
      return {
        type: "object",
        properties: {
          branchId: { type: "string" },
          fromWorldId: { type: "string" },
          name: { type: "string" },
        },
        required: ["branchId"],
      };

    case "system.branch.checkout":
      return {
        type: "object",
        properties: {
          branchId: { type: "string" },
          worldId: { type: "string" },
        },
        required: ["branchId", "worldId"],
      };

    case "system.schema.migrate":
      return {
        type: "object",
        properties: {
          fromSchemaHash: { type: "string" },
          toSchemaHash: { type: "string" },
          strategy: { type: "string", enum: ["auto", "custom"] },
        },
        required: ["fromSchemaHash", "toSchemaHash"],
      };

    // Services Management
    case "system.service.register":
      return {
        type: "object",
        properties: {
          effectType: { type: "string" },
          handlerRef: { type: "string" },
        },
        required: ["effectType", "handlerRef"],
      };

    case "system.service.unregister":
      return {
        type: "object",
        properties: {
          effectType: { type: "string" },
        },
        required: ["effectType"],
      };

    case "system.service.replace":
      return {
        type: "object",
        properties: {
          effectType: { type: "string" },
          handlerRef: { type: "string" },
        },
        required: ["effectType", "handlerRef"],
      };

    // Memory Operations
    case "system.memory.configure":
      return {
        type: "object",
        properties: {
          providers: { type: "array", items: { type: "string" } },
          defaultProvider: { type: "string" },
          routing: { type: "object" },
          backfill: { type: "object" },
        },
      };

    case "system.memory.backfill":
      return {
        type: "object",
        properties: {
          worldId: { type: "string" },
          depth: { type: "number" },
        },
        required: ["worldId"],
      };

    // Workflow
    case "system.workflow.enable":
      return {
        type: "object",
        properties: {
          workflowId: { type: "string" },
        },
        required: ["workflowId"],
      };

    case "system.workflow.disable":
      return {
        type: "object",
        properties: {
          workflowId: { type: "string" },
        },
        required: ["workflowId"],
      };

    case "system.workflow.setPolicy":
      return {
        type: "object",
        properties: {
          workflowId: { type: "string" },
          policy: { type: "object" },
        },
        required: ["workflowId", "policy"],
      };

    default:
      return {};
  }
}

/**
 * Create the state schema for System Runtime.
 */
function createSystemStateSchema(): Record<string, unknown> {
  return {
    actors: { type: "object", default: {} },
    services: { type: "object", default: {} },
    memoryConfig: {
      type: "object",
      default: {
        providers: [],
        defaultProvider: "",
      },
    },
    workflows: { type: "object", default: {} },
    branchPointers: { type: "object", default: {} },
    auditLog: { type: "array", default: [] },
  };
}

/**
 * Create initial System Runtime state.
 *
 * @see SPEC §16.3
 */
export function createInitialSystemState(): import("../types/index.js").SystemRuntimeState {
  return {
    actors: {},
    services: {},
    memoryConfig: {
      providers: [],
      defaultProvider: "",
    },
    workflows: {},
    branchPointers: {},
    auditLog: [],
  };
}
