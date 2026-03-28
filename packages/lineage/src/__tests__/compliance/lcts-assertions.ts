import { expect } from "vitest";
import type {
  LineageComplianceResult,
  LineageComplianceRule,
  LineageEvidence,
} from "./lcts-types.js";

export function noteEvidence(summary: string, details?: unknown): LineageEvidence {
  return { kind: "note", summary, details };
}

export function passRule(
  rule: LineageComplianceRule,
  message?: string,
  evidence?: LineageEvidence[]
): LineageComplianceResult {
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
  rule: LineageComplianceRule,
  message?: string,
  evidence?: LineageEvidence[]
): LineageComplianceResult {
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
  rule: LineageComplianceRule,
  message?: string,
  evidence?: LineageEvidence[]
): LineageComplianceResult {
  return {
    ruleId: rule.ruleId,
    specSection: rule.specSection,
    mode: rule.mode,
    status: "WARN",
    message,
    evidence,
  };
}

export function evaluateRule(
  rule: LineageComplianceRule,
  satisfied: boolean,
  options: {
    passMessage?: string;
    failMessage: string;
    evidence?: LineageEvidence[];
  }
): LineageComplianceResult {
  if (satisfied) {
    return passRule(rule, options.passMessage, options.evidence);
  }

  if (rule.mode === "blocking") {
    return failRule(rule, options.failMessage, options.evidence);
  }

  return warnRule(rule, options.failMessage, options.evidence);
}

function formatEvidence(evidence: LineageEvidence[] | undefined): string {
  if (!evidence || evidence.length === 0) {
    return "";
  }

  return evidence.map((item) => `- [${item.kind}] ${item.summary}`).join("\n");
}

export function expectCompliance(result: LineageComplianceResult): void {
  if (result.status === "FAIL") {
    const message = result.message ?? `Rule ${result.ruleId} violated`;
    const evidence = formatEvidence(result.evidence);
    expect.fail(`${message}${evidence ? `\n\nEvidence:\n${evidence}` : ""}`);
  }
}

export function expectAllCompliance(results: readonly LineageComplianceResult[]): void {
  for (const result of results) {
    expectCompliance(result);
  }
}
