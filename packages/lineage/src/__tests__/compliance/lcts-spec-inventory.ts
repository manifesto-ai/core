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
  inventory("LIN-ID-1", "§6.1", "MUST", "identity"),
  ...inventoryMany(
    ["LIN-HASH-1", "LIN-HASH-4a", "LIN-HASH-4b", "LIN-HASH-5", "LIN-HASH-6", "LIN-HASH-7", "LIN-HASH-10"],
    "§6.3.3",
    "MUST",
    "identity"
  ),
  inventory("LIN-HASH-9", "§6.3.3", "SHOULD", "identity"),
  inventory("LIN-SEAL-PURE-1", "§8.1", "MUST", "identity", {
    notes: "Wave 1 requires pure prepare helpers on the extracted LineageService.",
  }),
  inventory("LIN-COLLISION-1", "§8.5", "MUST", "identity", {
    notes: "WorldId collision handling is enforced by prepareSealNext() before commit.",
  }),
  inventory("LIN-HEAD-ADV-1", "§15.3", "MUST", "identity", {
    notes: "Completed-only head advance is part of the extracted LineageService contract.",
  }),
  inventory("LIN-BOUNDARY-1", "§4.1", "MUST_NOT", "seams", {
    notes: "Source-level import scan verifies lineage stays isolated from governance.",
  }),
  inventory("LIN-BOUNDARY-4", "§4.1", "MUST_NOT", "seams", {
    notes: "Source-level event scan verifies lineage does not emit events.",
  }),
  inventory("LIN-STORE-3", "§16.2", "MUST", "seams", {
    notes: "Wave 1 includes a native in-memory LineageStore implementation.",
  }),
] as const;

export function getInventoryRuleOrThrow(ruleId: string): LineageComplianceInventoryItem {
  const rule = LINEAGE_SPEC_INVENTORY.find((candidate) => candidate.ruleId === ruleId);
  if (!rule) {
    throw new Error(`Unknown lineage SPEC inventory rule: ${ruleId}`);
  }
  return rule;
}
