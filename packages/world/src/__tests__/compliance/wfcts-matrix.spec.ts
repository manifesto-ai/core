import { describe, expect, it } from "vitest";
import {
  expectCoverageCompleteness,
  expectCoverageIntegrity,
  expectInventoryRegistryParity,
  expectSuiteRulePresence,
  expectUniqueRuleIds,
} from "@manifesto-ai/cts-kit";
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
    expectUniqueRuleIds(WORLD_FACADE_COMPLIANCE_RULES);
  });

  it("WFCTS-MATRIX-002: every inventory rule is registered with matching metadata", () => {
    expectInventoryRegistryParity(WORLD_FACADE_SPEC_INVENTORY, WORLD_FACADE_COMPLIANCE_RULES);
  });

  it("WFCTS-MATRIX-003: coverage references only registered rules and declared case ids", () => {
    expectCoverageIntegrity(WORLD_FACADE_COMPLIANCE_RULES, WORLD_FACADE_COMPLIANCE_CASES, WORLD_FACADE_RULE_COVERAGE);
  });

  it("WFCTS-MATRIX-004: every non-superseded registry rule is covered by at least one WFCTS case", () => {
    expectCoverageCompleteness(WORLD_FACADE_COMPLIANCE_RULES, WORLD_FACADE_RULE_COVERAGE);
  });

  it("WFCTS-MATRIX-005: every suite has at least one mapped rule", () => {
    expectSuiteRulePresence(WFCTS_SUITES, getRulesBySuite, { exclude: ["matrix"] });
  });

  it("WFCTS-MATRIX-006: Phase 6 hard cut leaves no pending facade rules", () => {
    const modes = new Set(WORLD_FACADE_COMPLIANCE_RULES.map((rule) => rule.mode));
    expect(modes.size).toBe(1);
    expect(modes.has("blocking")).toBe(true);
  });
});
