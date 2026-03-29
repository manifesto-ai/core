import { describe, expect, it } from "vitest";
import { GCTS_SUITES } from "./gcts-types.js";
import {
  GOVERNANCE_COMPLIANCE_RULES,
  getRulesBySuite,
} from "./gcts-rules.js";
import { GOVERNANCE_SPEC_INVENTORY } from "./gcts-spec-inventory.js";
import {
  GOVERNANCE_COMPLIANCE_CASES,
  GOVERNANCE_RULE_COVERAGE,
} from "./gcts-coverage.js";

describe("GCTS Rule Matrix", () => {
  it("GCTS-MATRIX-001: rule ids are unique", () => {
    const ids = GOVERNANCE_COMPLIANCE_RULES.map((rule) => rule.ruleId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("GCTS-MATRIX-002: every inventory rule is registered with matching metadata", () => {
    for (const inventoryRule of GOVERNANCE_SPEC_INVENTORY) {
      const rule = GOVERNANCE_COMPLIANCE_RULES.find((candidate) => candidate.ruleId === inventoryRule.ruleId);
      expect(rule, `Missing registry rule ${inventoryRule.ruleId}`).toBeDefined();
      expect(rule?.suite).toBe(inventoryRule.suite);
      expect(rule?.specSection).toBe(inventoryRule.specSection);
      expect(rule?.level).toBe(inventoryRule.level);
      expect(rule?.lifecycle).toBe(inventoryRule.lifecycle);
    }
  });

  it("GCTS-MATRIX-003: coverage references only registered rules and declared case ids", () => {
    const ruleIds = new Set(GOVERNANCE_COMPLIANCE_RULES.map((rule) => rule.ruleId));
    const caseIds = new Set(GOVERNANCE_COMPLIANCE_CASES.map((entry) => entry.caseId));

    for (const coverage of GOVERNANCE_RULE_COVERAGE) {
      expect(ruleIds.has(coverage.ruleId), `Coverage references unknown rule ${coverage.ruleId}`).toBe(true);
      expect(coverage.caseIds.length, `Coverage entry for ${coverage.ruleId} has no cases`).toBeGreaterThan(0);
      for (const caseId of coverage.caseIds) {
        expect(caseIds.has(caseId), `Coverage references unknown case ${caseId}`).toBe(true);
      }
    }
  });

  it("GCTS-MATRIX-004: every non-superseded registry rule is covered by at least one GCTS case", () => {
    const coveredRuleIds = new Set(GOVERNANCE_RULE_COVERAGE.map((coverage) => coverage.ruleId));
    for (const rule of GOVERNANCE_COMPLIANCE_RULES) {
      if (rule.lifecycle === "superseded") {
        continue;
      }
      expect(coveredRuleIds.has(rule.ruleId), `Rule ${rule.ruleId} is registered but uncovered`).toBe(true);
    }
  });

  it("GCTS-MATRIX-005: every suite has at least one mapped rule", () => {
    for (const suite of GCTS_SUITES.filter((candidate) => candidate !== "matrix")) {
      expect(getRulesBySuite(suite).length, `Suite ${suite} has no mapped rules`).toBeGreaterThan(0);
    }
  });

  it("GCTS-MATRIX-006: staged rule modes remain visible", () => {
    const modes = new Set(GOVERNANCE_COMPLIANCE_RULES.map((rule) => rule.mode));
    expect(modes.has("blocking")).toBe(true);
    expect(modes.has("pending") || modes.has("informational")).toBe(true);
  });
});
