/**
 * MEL Module Helpers
 *
 * Utilities for turning MEL source into JavaScript module code.
 */

import type { Diagnostic } from "./diagnostics/types.js";
import { compileMelDomain } from "./api/index.js";

function formatDiagnostic(diagnostic: Diagnostic): string {
  const location = diagnostic.location;

  if (!location) {
    return `[${diagnostic.code}] ${diagnostic.message}`;
  }

  const { line, column } = location.start;
  return `[${diagnostic.code}] ${diagnostic.message} (${line}:${column})`;
}

/**
 * Compile MEL source and emit ESM source that exports the compiled schema.
 *
 * @param melSource - MEL domain source text
 * @param sourceId - Human-readable source identifier for diagnostics
 */
export function compileMelToModuleCode(melSource: string, sourceId: string): string {
  const result = compileMelDomain(melSource, { mode: "domain" });

  if (result.errors.length > 0) {
    const details = result.errors.map(formatDiagnostic).join("\n");
    throw new Error(`MEL compilation failed for ${sourceId}\n${details}`);
  }

  if (!result.schema) {
    throw new Error(`MEL compilation produced no schema for ${sourceId}`);
  }

  const serializedSchema = JSON.stringify(result.schema, null, 2);
  return `export default ${serializedSchema};\n`;
}

