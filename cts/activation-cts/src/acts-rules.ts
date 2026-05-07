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
      "SDK-ROOT-1",
      "SDK-ROOT-2",
      "SDK-ROOT-3",
      "SDK-ROOT-4",
      "SDK-ROOT-5",
      "SDK-ROOT-6",
      "SDK-ROOT-7",
      "SDK-ADMISSION-1",
      "SDK-ADMISSION-2",
      "SDK-ADMISSION-3",
      "SDK-ADMISSION-4",
      "SDK-ADMISSION-5",
      "SDK-PREVIEW-1",
      "SDK-PREVIEW-2",
      "SDK-PREVIEW-3",
      "SDK-PREVIEW-4",
      "SDK-PREVIEW-5",
      "SDK-PREVIEW-6",
      "SDK-PREVIEW-7",
      "SDK-RESULT-1",
      "SDK-RESULT-2",
      "SDK-SUBMIT-1",
      "SDK-SUBMIT-2",
      "SDK-SUBMIT-3",
      "SDK-SUBMIT-4",
      "SDK-SUBMIT-6",
      "SDK-SUBMIT-7",
      "SDK-SUBMIT-8",
      "SDK-SUBMIT-9",
      "SDK-SUBMIT-10",
      "SDK-SUBMIT-11",
      "SDK-SUBMIT-12",
      "SDK-SUBMIT-13",
      "SDK-SUBMIT-14",
      "SDK-SUBMIT-15",
      "SDK-SUBMIT-16",
      "SDK-OUTCOME-1",
      "SDK-OUTCOME-2",
      "SDK-OUTCOME-3",
      "SDK-SNAPSHOT-1",
      "SDK-SNAPSHOT-2",
      "SDK-SNAPSHOT-3",
      "SDK-SNAPSHOT-4",
      "SDK-OBSERVE-1",
      "SDK-OBSERVE-2",
      "SDK-OBSERVE-3",
      "SDK-OBSERVE-4",
      "SDK-OBSERVE-5",
      "SDK-INSPECT-1",
      "SDK-INSPECT-2",
      "SDK-INSPECT-3",
      "SDK-INSPECT-4",
      "SDK-INSPECT-5",
      "SDK-INSPECT-6",
      "SDK-EXT-1",
      "SDK-EXT-2",
      "SDK-EXT-3",
      "SDK-EXT-4",
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
