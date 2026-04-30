import type { ActivationComplianceRule } from "./acts-types.js";
import {
  ACTIVATION_SPEC_INVENTORY,
  getInventoryRuleOrThrow,
} from "./acts-spec-inventory.js";

function registry(
  ruleId: string,
  mode: ActivationComplianceRule["mode"],
  notes?: string,
): ActivationComplianceRule {
  const inventoryRule = getInventoryRuleOrThrow(ruleId);
  return {
    ...inventoryRule,
    mode,
    notes: notes ?? inventoryRule.notes,
  };
}

function registryMany(
  ruleIds: readonly string[],
  mode: ActivationComplianceRule["mode"],
  notes?: string,
): ActivationComplianceRule[] {
  return ruleIds.map((ruleId) => registry(ruleId, mode, notes));
}

export const ACTIVATION_COMPLIANCE_RULES: readonly ActivationComplianceRule[] = [
  ...registryMany(
    [
      "ACTS-BASE-1",
      "ACTS-BASE-2",
      "ACTS-BASE-3",
      "ACTS-BASE-4",
      "ACTS-BASE-5",
      "ACTS-BASE-6",
      "ACTS-BASE-7",
      "ACTS-BASE-8",
      "ACTS-BASE-9",
      "ACTS-BASE-10",
      "ACTS-BASE-11",
      "ACTS-LIN-1",
      "ACTS-LIN-2",
      "ACTS-LIN-3",
      "ACTS-LIN-4",
      "ACTS-GOV-1",
      "ACTS-GOV-2",
      "ACTS-GOV-3",
      "ACTS-GOV-4",
      "ACTS-GOV-5",
      "ACTS-GOV-6",
      "ACTS-GOV-7",
      "ACTS-GOV-8",
      "ACTS-GOV-9",
      "ACTS-TYPE-1",
      "ACTS-TYPE-2",
      "ACTS-TYPE-3",
      "ACTS-TYPE-4",
      "ACTS-V5-ROOT-1",
      "ACTS-V5-ACTION-1",
      "ACTS-V5-ADMISSION-1",
      "ACTS-V5-PREVIEW-1",
      "ACTS-V5-SUBMIT-1",
      "ACTS-V5-SUBMIT-2",
      "ACTS-V5-SUBMIT-3",
      "ACTS-V5-OBSERVE-1",
      "ACTS-V5-OBSERVE-2",
      "ACTS-V5-OBSERVE-3",
      "ACTS-V5-INSPECT-1",
      "ACTS-V5-TYPE-1",
      "ACTS-V5-TYPE-2",
      "ACTS-V5-TYPE-3",
    ],
    "blocking",
  ),
] as const;

export function getRuleOrThrow(ruleId: string): ActivationComplianceRule {
  const rule = ACTIVATION_COMPLIANCE_RULES.find(
    (candidate) => candidate.ruleId === ruleId,
  );
  if (!rule) {
    throw new Error(`Unknown activation CTS rule: ${ruleId}`);
  }
  return rule;
}

export function getRulesBySuite(
  suite: ActivationComplianceRule["suite"],
): ActivationComplianceRule[] {
  return ACTIVATION_COMPLIANCE_RULES.filter((rule) => rule.suite === suite);
}

export const ACTIVATION_SPEC_RULE_IDS = ACTIVATION_SPEC_INVENTORY.map(
  (rule) => rule.ruleId,
);
