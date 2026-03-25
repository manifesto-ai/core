import { describe, expect, it } from "vitest";
import { CCTS_SUITES } from "./ccts-types.js";
import {
  COMPILER_COMPLIANCE_RULES,
  getRulesBySuite,
} from "./ccts-rules.js";
import { COMPILER_SPEC_INVENTORY } from "./ccts-spec-inventory.js";
import { COMPILER_COMPLIANCE_CASES, COMPILER_RULE_COVERAGE } from "./ccts-coverage.js";

describe("CCTS Rule Matrix", () => {
  it("CCTS-MATRIX-001: rule ids are unique", () => {
    const ids = COMPILER_COMPLIANCE_RULES.map((rule) => rule.ruleId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("CCTS-MATRIX-002: every inventory rule is registered with matching metadata", () => {
    for (const inventoryRule of COMPILER_SPEC_INVENTORY) {
      const rule = COMPILER_COMPLIANCE_RULES.find((candidate) => candidate.ruleId === inventoryRule.ruleId);
      expect(rule, `Missing registry rule ${inventoryRule.ruleId}`).toBeDefined();
      expect(rule?.suite).toBe(inventoryRule.suite);
      expect(rule?.specSection).toBe(inventoryRule.specSection);
      expect(rule?.level).toBe(inventoryRule.level);
      expect(rule?.lifecycle).toBe(inventoryRule.lifecycle);
    }
  });

  it("CCTS-MATRIX-003: coverage references only registered rules and declared case ids", () => {
    const ruleIds = new Set(COMPILER_COMPLIANCE_RULES.map((rule) => rule.ruleId));
    const caseIds = new Set(COMPILER_COMPLIANCE_CASES.map((entry) => entry.caseId));

    for (const coverage of COMPILER_RULE_COVERAGE) {
      expect(ruleIds.has(coverage.ruleId), `Coverage references unknown rule ${coverage.ruleId}`).toBe(true);
      expect(coverage.caseIds.length, `Coverage entry for ${coverage.ruleId} has no cases`).toBeGreaterThan(0);
      for (const caseId of coverage.caseIds) {
        expect(caseIds.has(caseId), `Coverage references unknown case ${caseId}`).toBe(true);
      }
    }
  });

  it("CCTS-MATRIX-004: every non-superseded registry rule is covered by at least one CCTS case", () => {
    const coveredRuleIds = new Set(COMPILER_RULE_COVERAGE.map((coverage) => coverage.ruleId));
    for (const rule of COMPILER_COMPLIANCE_RULES) {
      if (rule.lifecycle === "superseded") {
        continue;
      }
      expect(coveredRuleIds.has(rule.ruleId), `Rule ${rule.ruleId} is registered but uncovered`).toBe(true);
    }
  });

  it("CCTS-MATRIX-005: every suite has at least one mapped rule", () => {
    for (const suite of CCTS_SUITES.filter((candidate) => candidate !== "matrix")) {
      expect(getRulesBySuite(suite).length, `Suite ${suite} has no mapped rules`).toBeGreaterThan(0);
    }
  });

  it("CCTS-MATRIX-006: staged rule modes remain visible even when pending is empty", () => {
    const modes = new Set(COMPILER_COMPLIANCE_RULES.map((rule) => rule.mode));
    expect(modes.has("blocking")).toBe(true);
    expect(modes.has("pending") || modes.has("informational")).toBe(true);
  });
});
