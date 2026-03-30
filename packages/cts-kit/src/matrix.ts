import { expect } from "vitest";
import type {
  ComplianceCase,
  ComplianceCoverageEntry,
  ComplianceInventoryItem,
  ComplianceRule,
} from "./types.js";

export function expectUniqueRuleIds<TSuite extends string>(
  rules: readonly ComplianceRule<TSuite>[]
): void {
  const ids = rules.map((rule) => rule.ruleId);
  expect(new Set(ids).size).toBe(ids.length);
}

export function expectInventoryRegistryParity<TSuite extends string>(
  inventory: readonly ComplianceInventoryItem<TSuite>[],
  rules: readonly ComplianceRule<TSuite>[]
): void {
  for (const inventoryRule of inventory) {
    const rule = rules.find((candidate) => candidate.ruleId === inventoryRule.ruleId);
    expect(rule, `Missing registry rule ${inventoryRule.ruleId}`).toBeDefined();
    expect(rule?.suite).toBe(inventoryRule.suite);
    expect(rule?.specSection).toBe(inventoryRule.specSection);
    expect(rule?.level).toBe(inventoryRule.level);
    expect(rule?.lifecycle).toBe(inventoryRule.lifecycle);
  }
}

export function expectCoverageIntegrity<TSuite extends string>(
  rules: readonly ComplianceRule<TSuite>[],
  cases: readonly ComplianceCase<TSuite>[],
  coverageEntries: readonly ComplianceCoverageEntry[]
): void {
  const ruleIds = new Set(rules.map((rule) => rule.ruleId));
  const caseIds = new Set(cases.map((entry) => entry.caseId));

  for (const coverage of coverageEntries) {
    expect(ruleIds.has(coverage.ruleId), `Coverage references unknown rule ${coverage.ruleId}`).toBe(true);
    expect(coverage.caseIds.length, `Coverage entry for ${coverage.ruleId} has no cases`).toBeGreaterThan(0);
    for (const caseId of coverage.caseIds) {
      expect(caseIds.has(caseId), `Coverage references unknown case ${caseId}`).toBe(true);
    }
  }
}

export function expectCoverageCompleteness<TSuite extends string>(
  rules: readonly ComplianceRule<TSuite>[],
  coverageEntries: readonly ComplianceCoverageEntry[]
): void {
  const coveredRuleIds = new Set(coverageEntries.map((coverage) => coverage.ruleId));
  for (const rule of rules) {
    if (rule.lifecycle === "superseded") {
      continue;
    }
    expect(coveredRuleIds.has(rule.ruleId), `Rule ${rule.ruleId} is registered but uncovered`).toBe(true);
  }
}

export function expectSuiteRulePresence<TSuite extends string>(
  suites: readonly TSuite[],
  getRulesBySuite: (suite: TSuite) => readonly ComplianceRule<TSuite>[],
  options?: { exclude?: readonly TSuite[] }
): void {
  const excluded = new Set(options?.exclude ?? []);
  for (const suite of suites) {
    if (excluded.has(suite)) {
      continue;
    }
    expect(getRulesBySuite(suite).length, `Suite ${suite} has no mapped rules`).toBeGreaterThan(0);
  }
}
