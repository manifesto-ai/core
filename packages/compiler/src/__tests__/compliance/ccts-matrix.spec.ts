import { describe, expect, it } from "vitest";
import {
  expectCoverageCompleteness,
  expectCoverageIntegrity,
  expectInventoryRegistryParity,
  expectSuiteRulePresence,
  expectUniqueRuleIds,
} from "@manifesto-ai/cts-kit";
import { CCTS_SUITES } from "./ccts-types.js";
import { COMPILER_COMPLIANCE_RULES, getRulesBySuite } from "./ccts-rules.js";
import { COMPILER_SPEC_INVENTORY } from "./ccts-spec-inventory.js";
import { COMPILER_COMPLIANCE_CASES, COMPILER_RULE_COVERAGE } from "./ccts-coverage.js";

describe("CCTS Rule Matrix", () => {
  it("CCTS-MATRIX-001: rule ids are unique", () => {
    expectUniqueRuleIds(COMPILER_COMPLIANCE_RULES);
  });

  it("CCTS-MATRIX-002: every inventory rule is registered with matching metadata", () => {
    expectInventoryRegistryParity(COMPILER_SPEC_INVENTORY, COMPILER_COMPLIANCE_RULES);
  });

  it("CCTS-MATRIX-003: coverage references only registered rules and declared case ids", () => {
    expectCoverageIntegrity(
      COMPILER_COMPLIANCE_RULES,
      COMPILER_COMPLIANCE_CASES,
      COMPILER_RULE_COVERAGE,
    );
  });

  it("CCTS-MATRIX-004: every non-superseded registry rule is covered by at least one CCTS case", () => {
    expectCoverageCompleteness(COMPILER_COMPLIANCE_RULES, COMPILER_RULE_COVERAGE);
  });

  it("CCTS-MATRIX-005: every suite has at least one mapped rule", () => {
    expectSuiteRulePresence(CCTS_SUITES, getRulesBySuite, { exclude: ["matrix"] });
  });

  it("CCTS-MATRIX-006: staged rule modes remain visible even when pending is empty", () => {
    const modes = new Set(COMPILER_COMPLIANCE_RULES.map((rule) => rule.mode));
    expect(modes.has("blocking")).toBe(true);
    expect(modes.has("pending") || modes.has("informational")).toBe(true);
  });
});
