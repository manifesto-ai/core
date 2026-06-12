export {
  noteEvidence,
  passRule,
  failRule,
  warnRule,
  evaluateRule,
  expectCompliance,
  expectAllCompliance,
} from "@manifesto-ai/cts-kit";

import type { Diagnostic } from "../../diagnostics/types.js";
import type { CompilerEvidence } from "./ccts-types.js";

export function diagnosticEvidence(diagnostics: Diagnostic[]): CompilerEvidence[] {
  return diagnostics.map((diagnostic) => ({
    kind: "diagnostic",
    summary: `${diagnostic.code}: ${diagnostic.message}`,
    details: diagnostic,
  }));
}

export function hasDiagnosticCode(
  diagnostics: Diagnostic[],
  codes: readonly string[] | string,
): boolean {
  const expected = Array.isArray(codes) ? codes : [codes];
  return diagnostics.some((diagnostic) => expected.includes(diagnostic.code));
}
