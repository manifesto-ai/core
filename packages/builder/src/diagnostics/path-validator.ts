import { z } from "zod";
import type { Diagnostic } from "./diagnostic-types.js";

// Type check helpers for Zod v4 (duck typing)
function isZodObject(schema: z.ZodTypeAny): schema is z.ZodObject<z.ZodRawShape> {
  return "shape" in schema && typeof (schema as z.ZodObject<z.ZodRawShape>).shape === "object";
}

function isZodRecord(schema: z.ZodTypeAny): boolean {
  const def = (schema as unknown as { _zod?: { def?: { type?: string } } })._zod?.def;
  return def?.type === "record";
}

function isZodArray(schema: z.ZodTypeAny): boolean {
  return "element" in schema;
}

function isZodOptional(schema: z.ZodTypeAny): schema is z.ZodOptional<z.ZodTypeAny> {
  return "unwrap" in schema && !("removeDefault" in schema) && !isZodNullable(schema);
}

function isZodNullable(schema: z.ZodTypeAny): schema is z.ZodNullable<z.ZodTypeAny> {
  const def = (schema as unknown as { _zod?: { def?: { type?: string } } })._zod?.def;
  return def?.type === "nullable";
}

function isZodDefault(schema: z.ZodTypeAny): schema is z.ZodDefault<z.ZodTypeAny> {
  return "removeDefault" in schema;
}

/**
 * Build the set of valid paths from a Zod schema
 */
function buildValidPaths(
  schema: z.ZodTypeAny,
  prefix: string = "",
  paths: Set<string> = new Set()
): Set<string> {
  const unwrapped = unwrapSchema(schema);

  if (isZodObject(unwrapped)) {
    const shape = unwrapped.shape;

    for (const [key, fieldSchema] of Object.entries(shape)) {
      const path = prefix ? `${prefix}.${key}` : key;
      paths.add(path);
      buildValidPaths(fieldSchema as z.ZodTypeAny, path, paths);
    }
  }

  if (isZodRecord(unwrapped)) {
    // Records allow arbitrary keys - we'll add the base path
    // and allow any sub-path starting with it
    paths.add(prefix);
  }

  if (isZodArray(unwrapped)) {
    // Arrays are atomic - just add the base path
    paths.add(prefix);
  }

  return paths;
}

/**
 * Unwrap wrapper schemas
 */
function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (isZodOptional(schema)) return unwrapSchema(schema.unwrap());
  if (isZodNullable(schema)) return unwrapSchema(schema.unwrap());
  if (isZodDefault(schema)) return unwrapSchema(schema.removeDefault());
  return schema;
}

/**
 * Check if a path is valid given the schema
 */
function isValidPath(
  path: string,
  validPaths: Set<string>,
  recordPrefixes: Set<string>
): boolean {
  // Direct match
  if (validPaths.has(path)) return true;

  // Check if this is a record sub-path (e.g., "items.abc123")
  for (const prefix of recordPrefixes) {
    if (path.startsWith(prefix + ".")) return true;
  }

  return false;
}

/**
 * Find similar paths for suggestions
 */
function findSimilarPath(path: string, validPaths: Set<string>): string | undefined {
  const parts = path.split(".");
  const lastPart = parts[parts.length - 1];

  for (const validPath of validPaths) {
    const validParts = validPath.split(".");
    const validLastPart = validParts[validParts.length - 1];

    // Simple similarity: same last part
    if (validLastPart === lastPart) {
      return validPath;
    }

    // Levenshtein distance check could go here
  }

  return undefined;
}

/**
 * Validate that all referenced paths exist in the schema
 */
export function validatePaths(
  stateSchema: z.ZodObject<z.ZodRawShape>,
  computedNames: Set<string>,
  referencedPaths: Set<string>
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Build valid state paths
  const statePaths = buildValidPaths(stateSchema);

  // Add computed paths
  const computedPaths = new Set<string>();
  for (const name of computedNames) {
    computedPaths.add(`computed.${name}`);
  }

  // Find record paths for dynamic access
  const recordPaths = new Set<string>();
  function findRecordPaths(schema: z.ZodTypeAny, prefix: string) {
    const unwrapped = unwrapSchema(schema);

    if (isZodObject(unwrapped)) {
      for (const [key, fieldSchema] of Object.entries(unwrapped.shape)) {
        const path = prefix ? `${prefix}.${key}` : key;
        findRecordPaths(fieldSchema as z.ZodTypeAny, path);
      }
    }

    if (isZodRecord(unwrapped)) {
      recordPaths.add(prefix);
    }
  }
  findRecordPaths(stateSchema, "");

  // Validate each referenced path
  for (const path of referencedPaths) {
    // Skip special paths
    if (path.startsWith("input.") || path === "input") continue;
    if (path.startsWith("system.")) continue;
    if (path.startsWith("$")) continue; // Iteration variables

    // Check computed paths
    if (path.startsWith("computed.")) {
      const computedName = path.slice("computed.".length);
      if (!computedNames.has(computedName)) {
        diagnostics.push({
          code: "MISSING_DEPENDENCY",
          severity: "error",
          message: `Referenced computed "${computedName}" does not exist`,
          path,
          suggestion: findSimilarPath(path, computedPaths),
        });
      }
      continue;
    }

    // Check state paths
    if (!isValidPath(path, statePaths, recordPaths)) {
      diagnostics.push({
        code: "INVALID_PATH",
        severity: "error",
        message: `Referenced path "${path}" does not exist in state schema`,
        path,
        suggestion: findSimilarPath(path, statePaths),
      });
    }
  }

  return diagnostics;
}
