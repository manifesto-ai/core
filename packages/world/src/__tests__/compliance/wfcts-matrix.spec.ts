import { describe, expect, it } from "vitest";
import { WFCTS_SUITES } from "./wfcts-types.js";
import {
  WORLD_FACADE_COMPLIANCE_RULES,
  getRulesBySuite,
} from "./wfcts-rules.js";
import { WORLD_FACADE_SPEC_INVENTORY } from "./wfcts-spec-inventory.js";
import {
  WORLD_FACADE_COMPLIANCE_CASES,
  WORLD_FACADE_RULE_COVERAGE,
} from "./wfcts-coverage.js";

describe("WFCTS Rule Matrix", () => {
  it("WFCTS-MATRIX-001: rule ids are unique", () => {
    const ids = WORLD_FACADE_COMPLIANCE_RULES.map((rule) => rule.ruleId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("WFCTS-MATRIX-002: every inventory rule is registered with matching metadata", () => {
    for (const inventoryRule of WORLD_FACADE_SPEC_INVENTORY) {
      const rule = WORLD_FACADE_COMPLIANCE_RULES.find((candidate) => candidate.ruleId === inventoryRule.ruleId);
      expect(rule, `Missing registry rule ${inventoryRule.ruleId}`).toBeDefined();
      expect(rule?.suite).toBe(inventoryRule.suite);
      expect(rule?.specSection).toBe(inventoryRule.specSection);
      expect(rule?.level).toBe(inventoryRule.level);
      expect(rule?.lifecycle).toBe(inventoryRule.lifecycle);
    }
  });

  it("WFCTS-MATRIX-003: coverage references only registered rules and declared case ids", () => {
    const ruleIds = new Set(WORLD_FACADE_COMPLIANCE_RULES.map((rule) => rule.ruleId));
    const caseIds = new Set(WORLD_FACADE_COMPLIANCE_CASES.map((entry) => entry.caseId));

    for (const coverage of WORLD_FACADE_RULE_COVERAGE) {
      expect(ruleIds.has(coverage.ruleId), `Coverage references unknown rule ${coverage.ruleId}`).toBe(true);
      expect(coverage.caseIds.length, `Coverage entry for ${coverage.ruleId} has no cases`).toBeGreaterThan(0);
      for (const caseId of coverage.caseIds) {
        expect(caseIds.has(caseId), `Coverage references unknown case ${caseId}`).toBe(true);
      }
    }
  });

  it("WFCTS-MATRIX-004: every non-superseded registry rule is covered by at least one WFCTS case", () => {
    const coveredRuleIds = new Set(WORLD_FACADE_RULE_COVERAGE.map((coverage) => coverage.ruleId));
    for (const rule of WORLD_FACADE_COMPLIANCE_RULES) {
      if (rule.lifecycle === "superseded") {
        continue;
      }
      expect(coveredRuleIds.has(rule.ruleId), `Rule ${rule.ruleId} is registered but uncovered`).toBe(true);
    }
  });

  it("WFCTS-MATRIX-005: every suite has at least one mapped rule", () => {
    for (const suite of WFCTS_SUITES.filter((candidate) => candidate !== "matrix")) {
      expect(getRulesBySuite(suite).length, `Suite ${suite} has no mapped rules`).toBeGreaterThan(0);
    }
  });

  it("WFCTS-MATRIX-006: Phase 5 alignment leaves no pending facade rules", () => {
    const modes = new Set(WORLD_FACADE_COMPLIANCE_RULES.map((rule) => rule.mode));
    expect(modes.size).toBe(1);
    expect(modes.has("blocking")).toBe(true);
  });
});
