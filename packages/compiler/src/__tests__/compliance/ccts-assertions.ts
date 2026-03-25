import { expect } from "vitest";
import type { Diagnostic } from "../../diagnostics/types.js";
import type {
  CompilerComplianceResult,
  CompilerComplianceRule,
  CompilerEvidence,
} from "./ccts-types.js";

export function noteEvidence(summary: string, details?: unknown): CompilerEvidence {
  return { kind: "note", summary, details };
}

export function diagnosticEvidence(diagnostics: Diagnostic[]): CompilerEvidence[] {
  return diagnostics.map((diagnostic) => ({
    kind: "diagnostic",
    summary: `${diagnostic.code}: ${diagnostic.message}`,
    details: diagnostic,
  }));
}

export function hasDiagnosticCode(
  diagnostics: Diagnostic[],
  codes: readonly string[] | string
): boolean {
  const expected = Array.isArray(codes) ? codes : [codes];
  return diagnostics.some((diagnostic) => expected.includes(diagnostic.code));
}

export function passRule(
  rule: CompilerComplianceRule,
  message?: string,
  evidence?: CompilerEvidence[]
): CompilerComplianceResult {
  return {
    ruleId: rule.ruleId,
    specSection: rule.specSection,
    mode: rule.mode,
    status: "PASS",
    message,
    evidence,
  };
}

export function failRule(
  rule: CompilerComplianceRule,
  message?: string,
  evidence?: CompilerEvidence[]
): CompilerComplianceResult {
  return {
    ruleId: rule.ruleId,
    specSection: rule.specSection,
    mode: rule.mode,
    status: "FAIL",
    message,
    evidence,
  };
}

export function warnRule(
  rule: CompilerComplianceRule,
  message?: string,
  evidence?: CompilerEvidence[]
): CompilerComplianceResult {
  return {
    ruleId: rule.ruleId,
    specSection: rule.specSection,
    mode: rule.mode,
    status: "WARN",
    message,
    evidence,
  };
}

export function skipRule(
  rule: CompilerComplianceRule,
  message?: string,
  evidence?: CompilerEvidence[]
): CompilerComplianceResult {
  return {
    ruleId: rule.ruleId,
    specSection: rule.specSection,
    mode: rule.mode,
    status: "SKIP",
    message,
    evidence,
  };
}

export function evaluateRule(
  rule: CompilerComplianceRule,
  satisfied: boolean,
  options: {
    passMessage?: string;
    failMessage: string;
    evidence?: CompilerEvidence[];
  }
): CompilerComplianceResult {
  if (satisfied) {
    return passRule(rule, options.passMessage, options.evidence);
  }

  if (rule.mode === "blocking") {
    return failRule(rule, options.failMessage, options.evidence);
  }

  return warnRule(rule, options.failMessage, options.evidence);
}

function formatEvidence(evidence: CompilerEvidence[] | undefined): string {
  if (!evidence || evidence.length === 0) {
    return "";
  }

  return evidence
    .map((item) => `- [${item.kind}] ${item.summary}`)
    .join("\n");
}

export function expectCompliance(result: CompilerComplianceResult): void {
  if (result.status === "FAIL") {
    const message = result.message ?? `Rule ${result.ruleId} violated`;
    const evidence = formatEvidence(result.evidence);
    expect.fail(`${message}${evidence ? `\n\nEvidence:\n${evidence}` : ""}`);
  }
}

export function expectAllCompliance(results: readonly CompilerComplianceResult[]): void {
  for (const result of results) {
    expectCompliance(result);
  }
}
