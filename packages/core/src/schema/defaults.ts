import type { StateSpec } from "./field.js";

/**
 * Extract top-level default values from a StateSpec.
 *
 * Iterates `stateSpec.fields` and collects fields with an explicit `default`.
 * Returns a flat record of field names to default values.
 *
 * @param stateSpec - The state specification from a DomainSchema
 * @returns Record of field names to their default values
 */
export function extractDefaults(
  stateSpec: StateSpec
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};

  for (const [name, spec] of Object.entries(stateSpec.fields)) {
    if (spec.default !== undefined) {
      defaults[name] = spec.default;
    }
  }

  return defaults;
}
