import { describe, expect, it } from "vitest";
import {
  expectCoverageCompleteness,
  expectCoverageIntegrity,
  expectInventoryRegistryParity,
  expectSuiteRulePresence,
  expectUniqueRuleIds,
} from "@manifesto-ai/cts-kit";
import { LCTS_SUITES } from "./lcts-types.js";
import { LINEAGE_COMPLIANCE_RULES, getRulesBySuite } from "./lcts-rules.js";
import { LINEAGE_SPEC_INVENTORY } from "./lcts-spec-inventory.js";
import {
  LINEAGE_COMPLIANCE_CASES,
  LINEAGE_RULE_COVERAGE,
} from "./lcts-coverage.js";

describe("LCTS Rule Matrix", () => {
  it("LCTS-MATRIX-001: rule ids are unique", () => {
    expectUniqueRuleIds(LINEAGE_COMPLIANCE_RULES);
  });

  it("LCTS-MATRIX-002: every inventory rule is registered with matching metadata", () => {
    expectInventoryRegistryParity(LINEAGE_SPEC_INVENTORY, LINEAGE_COMPLIANCE_RULES);
  });

  it("LCTS-MATRIX-003: coverage references only registered rules and declared case ids", () => {
    expectCoverageIntegrity(LINEAGE_COMPLIANCE_RULES, LINEAGE_COMPLIANCE_CASES, LINEAGE_RULE_COVERAGE);
  });

  it("LCTS-MATRIX-004: every non-superseded registry rule is covered by at least one LCTS case", () => {
    expectCoverageCompleteness(LINEAGE_COMPLIANCE_RULES, LINEAGE_RULE_COVERAGE);
  });

  it("LCTS-MATRIX-005: every suite has at least one mapped rule", () => {
    expectSuiteRulePresence(LCTS_SUITES, getRulesBySuite, { exclude: ["matrix"] });
  });

  it("LCTS-MATRIX-006: Phase 1 baseline is fully blocking", () => {
    const modes = new Set(LINEAGE_COMPLIANCE_RULES.map((rule) => rule.mode));
    expect(modes.has("blocking")).toBe(true);
    expect(modes.size).toBe(1);
  });
});
