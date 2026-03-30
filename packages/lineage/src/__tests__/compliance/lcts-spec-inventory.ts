import type {
  LineageComplianceInventoryItem,
  LineageComplianceSuite,
  RuleLevel,
  RuleLifecycle,
} from "./lcts-types.js";

function inventory(
  ruleId: string,
  specSection: string,
  level: RuleLevel,
  suite: LineageComplianceSuite,
  options?: {
    lifecycle?: RuleLifecycle;
    notes?: string;
  }
): LineageComplianceInventoryItem {
  return {
    ruleId,
    specSection,
    level,
    suite,
    lifecycle: options?.lifecycle ?? "active",
    notes: options?.notes,
  };
}

function inventoryMany(
  ruleIds: readonly string[],
  specSection: string,
  level: RuleLevel,
  suite: LineageComplianceSuite,
  options?: {
    lifecycle?: RuleLifecycle;
    notes?: string;
  }
): LineageComplianceInventoryItem[] {
  return ruleIds.map((ruleId) => inventory(ruleId, specSection, level, suite, options));
}

export const LINEAGE_SPEC_INVENTORY: readonly LineageComplianceInventoryItem[] = [
  ...inventoryMany(["LIN-ID-1", "LIN-ID-2", "LIN-ID-3", "LIN-ID-4"], "§6.1", "MUST", "identity"),
  ...inventoryMany(
    ["LIN-HASH-1", "LIN-HASH-3a", "LIN-HASH-3c", "LIN-HASH-3d", "LIN-HASH-4a", "LIN-HASH-4b", "LIN-HASH-5", "LIN-HASH-6", "LIN-HASH-7", "LIN-HASH-10", "LIN-HASH-11"],
    "§6.3.3",
    "MUST",
    "identity"
  ),
  ...inventoryMany(["LIN-SEAL-PURE-1", "LIN-STORE-4", "LIN-HEAD-ADV-1", "MRKL-TIP-1", "MRKL-TIP-2", "MRKL-HEAD-5"], "§7.1/§10.2/§11.2", "MUST", "branch"),
  ...inventoryMany(["MRKL-ATTEMPT-2", "MRKL-REUSE-1", "MRKL-REUSE-2", "MRKL-STORE-4"], "§5.4/§8.2/§11.2", "MUST", "attempts"),
  ...inventoryMany(["MRKL-RESTORE-1", "MRKL-RESTORE-2", "MRKL-RESTORE-3", "MRKL-RESTORE-3a", "MRKL-RESTORE-4"], "§14.1", "MUST", "restore"),
  inventory("LIN-BOUNDARY-1", "§4.1", "MUST_NOT", "seams", {
    notes: "Source-level import scan verifies lineage stays isolated from governance.",
  }),
  inventory("LIN-BOUNDARY-4", "§4.1", "MUST_NOT", "seams", {
    notes: "Source-level event scan verifies lineage does not emit events.",
  }),
  inventory("LIN-STORE-3", "§11.2", "MUST", "seams", {
    notes: "Lineage must provide a native in-memory store with branch and attempt queries.",
  }),
] as const;

export function getInventoryRuleOrThrow(ruleId: string): LineageComplianceInventoryItem {
  const rule = LINEAGE_SPEC_INVENTORY.find((candidate) => candidate.ruleId === ruleId);
  if (!rule) {
    throw new Error(`Unknown lineage SPEC inventory rule: ${ruleId}`);
  }
  return rule;
}
