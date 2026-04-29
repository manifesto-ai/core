import { describe, expect, it } from "vitest";
import {
  expectCoverageCompleteness,
  expectCoverageIntegrity,
  expectInventoryRegistryParity,
  expectSuiteRulePresence,
  expectUniqueRuleIds,
} from "@manifesto-ai/cts-kit";
import { CORE_CTS_SUITES } from "./core-cts-types.js";
import { CORE_COMPLIANCE_RULES, getRulesBySuite } from "./core-cts-rules.js";
import { CORE_SPEC_INVENTORY } from "./core-cts-spec-inventory.js";
import {
  CORE_COMPLIANCE_CASES,
  CORE_RULE_COVERAGE,
} from "./core-cts-coverage.js";

describe("Core CTS Rule Matrix", () => {
  it("CORE-CTS-MATRIX-001: rule ids are unique", () => {
    expectUniqueRuleIds(CORE_COMPLIANCE_RULES);
  });

  it("CORE-CTS-MATRIX-002: every inventory rule is registered with matching metadata", () => {
    expectInventoryRegistryParity(CORE_SPEC_INVENTORY, CORE_COMPLIANCE_RULES);
  });

  it("CORE-CTS-MATRIX-003: coverage references only registered rules and declared case ids", () => {
    expectCoverageIntegrity(CORE_COMPLIANCE_RULES, CORE_COMPLIANCE_CASES, CORE_RULE_COVERAGE);
  });

  it("CORE-CTS-MATRIX-004: every non-superseded registry rule is covered by at least one Core CTS case", () => {
    expectCoverageCompleteness(CORE_COMPLIANCE_RULES, CORE_RULE_COVERAGE);
  });

  it("CORE-CTS-MATRIX-005: every suite has at least one mapped rule", () => {
    expectSuiteRulePresence(CORE_CTS_SUITES, getRulesBySuite, { exclude: ["matrix"] });
  });

  it("CORE-CTS-MATRIX-006: staged rule modes remain visible", () => {
    const modes = new Set(CORE_COMPLIANCE_RULES.map((rule) => rule.mode));
    expect(modes.has("blocking")).toBe(true);
    expect(modes.has("informational")).toBe(true);
  });
});
