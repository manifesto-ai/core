import { expect } from "vitest";
import type {
  ComplianceEvidence,
  ComplianceResult,
  ComplianceRule,
} from "./types.js";

export function noteEvidence(summary: string, details?: unknown): ComplianceEvidence {
  return { kind: "note", summary, details };
}

export function passRule<TSuite extends string, TEvidence extends ComplianceEvidence>(
  rule: ComplianceRule<TSuite>,
  message?: string,
  evidence?: TEvidence[]
): ComplianceResult<TEvidence> {
  return {
    ruleId: rule.ruleId,
    specSection: rule.specSection,
    mode: rule.mode,
    status: "PASS",
    message,
    evidence,
  };
}

export function failRule<TSuite extends string, TEvidence extends ComplianceEvidence>(
  rule: ComplianceRule<TSuite>,
  message?: string,
  evidence?: TEvidence[]
): ComplianceResult<TEvidence> {
  return {
    ruleId: rule.ruleId,
    specSection: rule.specSection,
    mode: rule.mode,
    status: "FAIL",
    message,
    evidence,
  };
}

export function warnRule<TSuite extends string, TEvidence extends ComplianceEvidence>(
  rule: ComplianceRule<TSuite>,
  message?: string,
  evidence?: TEvidence[]
): ComplianceResult<TEvidence> {
  return {
    ruleId: rule.ruleId,
    specSection: rule.specSection,
    mode: rule.mode,
    status: "WARN",
    message,
    evidence,
  };
}

export function evaluateRule<TSuite extends string, TEvidence extends ComplianceEvidence>(
  rule: ComplianceRule<TSuite>,
  satisfied: boolean,
  options: {
    passMessage?: string;
    failMessage: string;
    evidence?: TEvidence[];
  }
): ComplianceResult<TEvidence> {
  if (satisfied) {
    return passRule(rule, options.passMessage, options.evidence);
  }

  if (rule.mode === "blocking") {
    return failRule(rule, options.failMessage, options.evidence);
  }

  return warnRule(rule, options.failMessage, options.evidence);
}

function formatEvidence(evidence: ComplianceEvidence[] | undefined): string {
  if (!evidence || evidence.length === 0) {
    return "";
  }

  return evidence.map((item) => `- [${item.kind}] ${item.summary}`).join("\n");
}

export function expectCompliance<TEvidence extends ComplianceEvidence>(
  result: ComplianceResult<TEvidence>
): void {
  if (result.status === "FAIL") {
    const message = result.message ?? `Rule ${result.ruleId} violated`;
    const evidence = formatEvidence(result.evidence);
    expect.fail(`${message}${evidence ? `\n\nEvidence:\n${evidence}` : ""}`);
  }
}

export function expectAllCompliance<TEvidence extends ComplianceEvidence>(
  results: readonly ComplianceResult<TEvidence>[]
): void {
  for (const result of results) {
    expectCompliance(result);
  }
}
