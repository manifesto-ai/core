import type { EffectHandlerResult } from "../llm/handlers.js";
import type { CompilerDiagnostics } from "../../domain/types.js";

/**
 * Builder validate effect handler type
 */
export type BuilderValidateHandler = (
  params: Record<string, unknown>
) => Promise<EffectHandlerResult>;

/**
 * Create builder:validate effect handler
 *
 * Per FDR-C010: Builder.validateDomain() MUST be the sole judge of DomainDraft validity.
 * Compiler MUST NOT implement validation logic.
 *
 * This handler wraps the Builder validation and returns the result as an action.
 *
 * @param validateFn - Optional custom validation function (for testing)
 */
export function createBuilderValidateHandler(
  validateFn?: (draft: unknown) => ValidateResult
): BuilderValidateHandler {
  const validate = validateFn ?? defaultValidate;

  return async (params: Record<string, unknown>): Promise<EffectHandlerResult> => {
    const draft = params.draft;
    const timestamp = Date.now();

    try {
      const result = validate(draft);

      return {
        action: "receiveValidation",
        input: {
          valid: result.valid,
          schema: result.valid ? result.schema : null,
          diagnostics: result.diagnostics,
          schemaHash: result.valid ? result.schemaHash : null,
          timestamp,
        },
      };
    } catch (error) {
      // Validation threw an error - treat as invalid
      const message = error instanceof Error ? error.message : String(error);

      const diagnostics: CompilerDiagnostics = {
        valid: false,
        errors: [
          {
            code: "VALIDATION_ERROR",
            message: `Builder validation threw: ${message}`,
          },
        ],
        warnings: [],
      };

      return {
        action: "receiveValidation",
        input: {
          valid: false,
          schema: null,
          diagnostics,
          schemaHash: null,
          timestamp,
        },
      };
    }
  };
}

/**
 * Validation result from Builder
 */
export interface ValidateResult {
  valid: boolean;
  schema?: unknown;
  schemaHash?: string;
  diagnostics: CompilerDiagnostics;
}

/**
 * Default validation function
 *
 * This is a placeholder that performs basic structural validation.
 * In production, this would call the actual Builder.validateDomain().
 *
 * TODO: Integrate with actual @manifesto-ai/builder validateDomain
 */
function defaultValidate(draft: unknown): ValidateResult {
  // Basic structural validation
  if (!draft || typeof draft !== "object") {
    return {
      valid: false,
      diagnostics: {
        valid: false,
        errors: [{ code: "INVALID_DRAFT", message: "Draft must be an object" }],
        warnings: [],
      },
    };
  }

  const d = draft as Record<string, unknown>;

  // Check required fields
  const requiredFields = ["id", "version", "state", "computed", "actions"];
  const missingFields = requiredFields.filter((f) => !(f in d));

  if (missingFields.length > 0) {
    return {
      valid: false,
      diagnostics: {
        valid: false,
        errors: [
          {
            code: "MISSING_FIELDS",
            message: `Draft missing required fields: ${missingFields.join(", ")}`,
          },
        ],
        warnings: [],
      },
    };
  }

  // Check state structure
  if (!d.state || typeof d.state !== "object") {
    return {
      valid: false,
      diagnostics: {
        valid: false,
        errors: [{ code: "INVALID_STATE", message: "state must be an object" }],
        warnings: [],
      },
    };
  }

  // Check computed structure
  if (!d.computed || typeof d.computed !== "object") {
    return {
      valid: false,
      diagnostics: {
        valid: false,
        errors: [{ code: "INVALID_COMPUTED", message: "computed must be an object" }],
        warnings: [],
      },
    };
  }

  // Check actions structure
  if (!d.actions || typeof d.actions !== "object") {
    return {
      valid: false,
      diagnostics: {
        valid: false,
        errors: [{ code: "INVALID_ACTIONS", message: "actions must be an object" }],
        warnings: [],
      },
    };
  }

  // Generate a simple hash
  const schemaHash = generateSimpleHash(JSON.stringify(draft));

  // Valid draft
  return {
    valid: true,
    schema: draft,
    schemaHash,
    diagnostics: {
      valid: true,
      errors: [],
      warnings: [],
    },
  };
}

/**
 * Generate a simple hash for identification
 */
function generateSimpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}
