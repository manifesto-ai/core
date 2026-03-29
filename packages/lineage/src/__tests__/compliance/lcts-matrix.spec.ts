import { describe, expect, it } from "vitest";
import { LCTS_SUITES } from "./lcts-types.js";
import { LINEAGE_COMPLIANCE_RULES, getRulesBySuite } from "./lcts-rules.js";
import { LINEAGE_SPEC_INVENTORY } from "./lcts-spec-inventory.js";
import {
  LINEAGE_COMPLIANCE_CASES,
  LINEAGE_RULE_COVERAGE,
} from "./lcts-coverage.js";

describe("LCTS Rule Matrix", () => {
  it("LCTS-MATRIX-001: rule ids are unique", () => {
    const ids = LINEAGE_COMPLIANCE_RULES.map((rule) => rule.ruleId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("LCTS-MATRIX-002: every inventory rule is registered with matching metadata", () => {
    for (const inventoryRule of LINEAGE_SPEC_INVENTORY) {
      const rule = LINEAGE_COMPLIANCE_RULES.find((candidate) => candidate.ruleId === inventoryRule.ruleId);
      expect(rule, `Missing registry rule ${inventoryRule.ruleId}`).toBeDefined();
      expect(rule?.suite).toBe(inventoryRule.suite);
      expect(rule?.specSection).toBe(inventoryRule.specSection);
      expect(rule?.level).toBe(inventoryRule.level);
      expect(rule?.lifecycle).toBe(inventoryRule.lifecycle);
    }
  });

  it("LCTS-MATRIX-003: coverage references only registered rules and declared case ids", () => {
    const ruleIds = new Set(LINEAGE_COMPLIANCE_RULES.map((rule) => rule.ruleId));
    const caseIds = new Set(LINEAGE_COMPLIANCE_CASES.map((entry) => entry.caseId));

    for (const coverage of LINEAGE_RULE_COVERAGE) {
      expect(ruleIds.has(coverage.ruleId), `Coverage references unknown rule ${coverage.ruleId}`).toBe(true);
      expect(coverage.caseIds.length, `Coverage entry for ${coverage.ruleId} has no cases`).toBeGreaterThan(0);
      for (const caseId of coverage.caseIds) {
        expect(caseIds.has(caseId), `Coverage references unknown case ${caseId}`).toBe(true);
      }
    }
  });

  it("LCTS-MATRIX-004: every non-superseded registry rule is covered by at least one LCTS case", () => {
    const coveredRuleIds = new Set(LINEAGE_RULE_COVERAGE.map((coverage) => coverage.ruleId));
    for (const rule of LINEAGE_COMPLIANCE_RULES) {
      if (rule.lifecycle === "superseded") {
        continue;
      }
      expect(coveredRuleIds.has(rule.ruleId), `Rule ${rule.ruleId} is registered but uncovered`).toBe(true);
    }
  });

  it("LCTS-MATRIX-005: every suite has at least one mapped rule", () => {
    for (const suite of LCTS_SUITES.filter((candidate) => candidate !== "matrix")) {
      expect(getRulesBySuite(suite).length, `Suite ${suite} has no mapped rules`).toBeGreaterThan(0);
    }
  });

  it("LCTS-MATRIX-006: staged rule modes remain visible", () => {
    const modes = new Set(LINEAGE_COMPLIANCE_RULES.map((rule) => rule.mode));
    expect(modes.has("blocking")).toBe(true);
    expect(modes.has("pending") || modes.has("informational")).toBe(true);
  });
});
