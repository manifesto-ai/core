import { describe, expect, it } from "vitest";
import {
  expectCoverageCompleteness,
  expectCoverageIntegrity,
  expectInventoryRegistryParity,
  expectSuiteRulePresence,
  expectUniqueRuleIds,
} from "@manifesto-ai/cts-kit";
import { ACTS_SUITES } from "./acts-types.js";
import {
  ACTIVATION_COMPLIANCE_RULES,
  getRulesBySuite,
} from "./acts-rules.js";
import { ACTIVATION_SPEC_INVENTORY } from "./acts-spec-inventory.js";
import {
  ACTIVATION_COMPLIANCE_CASES,
  ACTIVATION_RULE_COVERAGE,
} from "./acts-coverage.js";

describe("ACTS Rule Matrix", () => {
  it("ACTS-MATRIX-001: rule ids are unique", () => {
    expectUniqueRuleIds(ACTIVATION_COMPLIANCE_RULES);
  });

  it("ACTS-MATRIX-002: every inventory rule is registered with matching metadata", () => {
    expectInventoryRegistryParity(
      ACTIVATION_SPEC_INVENTORY,
      ACTIVATION_COMPLIANCE_RULES,
    );
  });

  it("ACTS-MATRIX-003: coverage references only registered rules and declared case ids", () => {
    expectCoverageIntegrity(
      ACTIVATION_COMPLIANCE_RULES,
      ACTIVATION_COMPLIANCE_CASES,
      ACTIVATION_RULE_COVERAGE,
    );
  });

  it("ACTS-MATRIX-004: every non-superseded rule is covered by at least one ACTS case", () => {
    expectCoverageCompleteness(
      ACTIVATION_COMPLIANCE_RULES,
      ACTIVATION_RULE_COVERAGE,
    );
  });

  it("ACTS-MATRIX-005: every suite has at least one mapped rule", () => {
    expectSuiteRulePresence(ACTS_SUITES, getRulesBySuite, {
      exclude: ["matrix"],
    });
  });

  it("ACTS-MATRIX-006: Phase 6 rules are fully blocking", () => {
    const modes = new Set(ACTIVATION_COMPLIANCE_RULES.map((rule) => rule.mode));
    expect(modes.has("blocking")).toBe(true);
    expect(modes.size).toBe(1);
  });
});
