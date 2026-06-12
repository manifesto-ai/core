import type { DomainSchema } from "../schema/domain.js";
import type { ValidationError, ValidationResult } from "../schema/result.js";
import type { JsonValue } from "../schema/context.js";
import { invalidResult, validResult } from "../schema/result.js";
import { validateValueAgainstFieldSpec } from "./validation-utils.js";
import { validateValueAgainstTypeDefinition } from "./type-definition-utils.js";

/**
 * Validate a materialized ADR-027 external context value against a schema.
 *
 * This helper validates only the user-owned `Context.external` partition.
 * Manifesto-owned `Context.runtime` is validated by the canonical `Context`
 * schema at the compute boundary.
 */
export function validateExternalContext(
  schema: DomainSchema,
  external: Record<string, JsonValue>,
): ValidationResult {
  const errors: ValidationError[] = [];
  const contextSpec = schema.context;

  if (!contextSpec) {
    return Object.keys(external).length === 0
      ? validResult()
      : invalidResult(
          Object.keys(external).map((name) => ({
            code: "INVALID_CONTEXT",
            message: `Schema does not declare user context field "${name}"`,
            path: `context.${name}`,
          })),
        );
  }

  const declared = contextSpec.fields;
  const declaredNames = new Set(Object.keys(declared));

  for (const name of Object.keys(external)) {
    if (!declaredNames.has(name)) {
      errors.push({
        code: "INVALID_CONTEXT",
        message: `Unknown context field: ${name}`,
        path: `context.${name}`,
      });
    }
  }

  for (const [name, fieldSpec] of Object.entries(declared)) {
    if (!(name in external)) {
      if (fieldSpec.required) {
        errors.push({
          code: "INVALID_CONTEXT",
          message: `Missing required context field: ${name}`,
          path: `context.${name}`,
        });
      }
      continue;
    }

    const fieldType = contextSpec.fieldTypes?.[name];
    const result = fieldType
      ? validateValueAgainstTypeDefinition(external[name], fieldType, schema.types)
      : validateValueAgainstFieldSpec(external[name], fieldSpec);

    if (!result.ok) {
      errors.push({
        code: "INVALID_CONTEXT",
        message: result.message ?? `Invalid context field: ${name}`,
        path: `context.${name}`,
      });
    }
  }

  return errors.length === 0 ? validResult() : invalidResult(errors);
}
