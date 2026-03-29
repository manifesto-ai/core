import { expect } from "vitest";
import type {
  WorldFacadeComplianceResult,
  WorldFacadeComplianceRule,
  WorldFacadeEvidence,
} from "./wfcts-types.js";

export function noteEvidence(summary: string, details?: unknown): WorldFacadeEvidence {
  return { kind: "note", summary, details };
}

export function passRule(
  rule: WorldFacadeComplianceRule,
  message?: string,
  evidence?: WorldFacadeEvidence[]
): WorldFacadeComplianceResult {
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
  rule: WorldFacadeComplianceRule,
  message?: string,
  evidence?: WorldFacadeEvidence[]
): WorldFacadeComplianceResult {
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
  rule: WorldFacadeComplianceRule,
  message?: string,
  evidence?: WorldFacadeEvidence[]
): WorldFacadeComplianceResult {
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
  rule: WorldFacadeComplianceRule,
  satisfied: boolean,
  options: {
    passMessage?: string;
    failMessage: string;
    evidence?: WorldFacadeEvidence[];
  }
): WorldFacadeComplianceResult {
  if (satisfied) {
    return passRule(rule, options.passMessage, options.evidence);
  }

  if (rule.mode === "blocking") {
    return failRule(rule, options.failMessage, options.evidence);
  }

  return warnRule(rule, options.failMessage, options.evidence);
}

function formatEvidence(evidence: WorldFacadeEvidence[] | undefined): string {
  if (!evidence || evidence.length === 0) {
    return "";
  }

  return evidence.map((item) => `- [${item.kind}] ${item.summary}`).join("\n");
}

export function expectCompliance(result: WorldFacadeComplianceResult): void {
  if (result.status === "FAIL") {
    const message = result.message ?? `Rule ${result.ruleId} violated`;
    const evidence = formatEvidence(result.evidence);
    expect.fail(`${message}${evidence ? `\n\nEvidence:\n${evidence}` : ""}`);
  }
}

export function expectAllCompliance(results: readonly WorldFacadeComplianceResult[]): void {
  for (const result of results) {
    expectCompliance(result);
  }
}
