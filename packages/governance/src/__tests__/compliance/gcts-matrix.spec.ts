import { describe, expect, it } from "vitest";
import {
  expectCoverageCompleteness,
  expectCoverageIntegrity,
  expectInventoryRegistryParity,
  expectSuiteRulePresence,
  expectUniqueRuleIds,
} from "@manifesto-ai/cts-kit";
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
    expectUniqueRuleIds(GOVERNANCE_COMPLIANCE_RULES);
  });

  it("GCTS-MATRIX-002: every inventory rule is registered with matching metadata", () => {
    expectInventoryRegistryParity(GOVERNANCE_SPEC_INVENTORY, GOVERNANCE_COMPLIANCE_RULES);
  });

  it("GCTS-MATRIX-003: coverage references only registered rules and declared case ids", () => {
    expectCoverageIntegrity(GOVERNANCE_COMPLIANCE_RULES, GOVERNANCE_COMPLIANCE_CASES, GOVERNANCE_RULE_COVERAGE);
  });

  it("GCTS-MATRIX-004: every non-superseded registry rule is covered by at least one GCTS case", () => {
    expectCoverageCompleteness(GOVERNANCE_COMPLIANCE_RULES, GOVERNANCE_RULE_COVERAGE);
  });

  it("GCTS-MATRIX-005: every suite has at least one mapped rule", () => {
    expectSuiteRulePresence(GCTS_SUITES, getRulesBySuite, { exclude: ["matrix"] });
  });

  it("GCTS-MATRIX-006: staged rule modes remain visible", () => {
    const modes = new Set(GOVERNANCE_COMPLIANCE_RULES.map((rule) => rule.mode));
    expect(modes.has("blocking")).toBe(true);
    expect(modes.has("pending") || modes.has("informational")).toBe(true);
  });
});
