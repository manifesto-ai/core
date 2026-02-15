/**
 * Schema Compatibility Check
 *
 * Validates schema compatibility for fork operations.
 *
 * @see SPEC v2.2.0 §12.4
 * @module
 */

import type { DomainSchema } from "@manifesto-ai/core";
import type {
  SchemaCompatibilityResult,
  Effects,
} from "../../types/index.js";
import { RESERVED_EFFECT_TYPE } from "../../constants.js";

/**
 * Validate schema compatibility for fork.
 *
 * FORK-2: MUST verify effect handler compatibility before creating branch.
 * FORK-3: Missing effect handler MUST cause fork to fail without World creation.
 *
 * @see SPEC v2.0.0 §12.4
 */
export function validateSchemaCompatibility(
  newSchema: DomainSchema,
  registeredEffectTypes: readonly string[]
): SchemaCompatibilityResult {
  // Extract effect types from new schema's actions
  const requiredEffects = extractEffectTypes(newSchema);

  // Find missing effects
  const missingEffects: string[] = [];
  for (const effectType of requiredEffects) {
    if (!registeredEffectTypes.includes(effectType)) {
      missingEffects.push(effectType);
    }
  }

  if (missingEffects.length > 0) {
    return {
      compatible: false,
      missingEffects,
    };
  }

  return { compatible: true };
}

/**
 * Extract effect types from a schema.
 *
 * Traverses action flows to find all effect types.
 */
export function extractEffectTypes(schema: DomainSchema): readonly string[] {
  const effectTypes = new Set<string>();

  if (!schema.actions) {
    return [];
  }

  for (const [actionType, action] of Object.entries(schema.actions)) {
    if (action && typeof action === "object" && "flow" in action) {
      collectEffectTypes(
        (action as { flow: unknown }).flow,
        effectTypes,
        schema.actions,
        new Set([actionType])
      );
    }
  }

  return Array.from(effectTypes);
}

/**
 * Recursively collect effect types from a flow.
 */
function collectEffectTypes(
  flow: unknown,
  effectTypes: Set<string>,
  actions: DomainSchema["actions"],
  visited: Set<string>
): void {
  if (!flow || typeof flow !== "object") {
    return;
  }

  const flowObj = flow as Record<string, unknown>;

  // Check if this is an effect node
  if (flowObj.kind === "effect" && typeof flowObj.type === "string") {
    effectTypes.add(flowObj.type);
  }

  // Recursively check nested flows
  if (flowObj.kind === "seq" && Array.isArray(flowObj.steps)) {
    for (const step of flowObj.steps) {
      collectEffectTypes(step, effectTypes, actions, visited);
    }
  }

  if (flowObj.kind === "if") {
    if (flowObj.then) {
      collectEffectTypes(flowObj.then, effectTypes, actions, visited);
    }
    if (flowObj.else) {
      collectEffectTypes(flowObj.else, effectTypes, actions, visited);
    }
  }

  if (flowObj.kind === "call") {
    if (flowObj.body) {
      collectEffectTypes(flowObj.body, effectTypes, actions, visited);
    }
    if (typeof flowObj.flow === "string" && flowObj.flow in actions) {
      const target = actions[flowObj.flow];
      if (target && typeof target === "object" && "flow" in target && !visited.has(flowObj.flow)) {
        visited.add(flowObj.flow);
        collectEffectTypes((target as { flow: unknown }).flow, effectTypes, actions, visited);
      }
    }
  }
}

/**
 * Validate schema compatibility against an Effects map.
 *
 * v2.2.0: Preferred method for effects-first API.
 *
 * @see SPEC v2.2.0 §12.4
 */
export function validateSchemaCompatibilityWithEffects(
  newSchema: DomainSchema,
  effects: Effects
): SchemaCompatibilityResult {
  const registeredEffectTypes = new Set([
    ...Object.keys(effects),
    RESERVED_EFFECT_TYPE,
  ]);
  return validateSchemaCompatibility(newSchema, Array.from(registeredEffectTypes));
}

/**
 * Error thrown when schema is not compatible.
 */
export class SchemaIncompatibleError extends Error {
  readonly missingEffects: readonly string[];

  constructor(missingEffects: readonly string[]) {
    super(
      `Schema is not compatible. Missing effect handlers: ${missingEffects.join(", ")}`
    );
    this.name = "SchemaIncompatibleError";
    this.missingEffects = missingEffects;
  }
}
