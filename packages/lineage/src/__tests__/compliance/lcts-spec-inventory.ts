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
    notes: "Tracked for split extraction; legacy world helpers do not expose prepare-only lineage services yet.",
  }),
  inventory("LIN-COLLISION-1", "§8.5", "MUST", "identity", {
    notes: "WorldId collision handling remains inside the monolithic world implementation.",
  }),
  inventory("LIN-HEAD-ADV-1", "§15.3", "MUST", "identity", {
    notes: "Head advance rules remain CTS-tracked until branch management is extracted.",
  }),
  inventory("LIN-BOUNDARY-1", "§4.1", "MUST_NOT", "seams", {
    notes: "Runtime seam check only; actual import isolation lands with the package split.",
  }),
  inventory("LIN-BOUNDARY-4", "§4.1", "MUST_NOT", "seams"),
  inventory("LIN-STORE-3", "§16.2", "MUST", "seams", {
    notes: "In-memory LineageStore is staged behind the legacy world-backed adapter.",
  }),
] as const;

export function getInventoryRuleOrThrow(ruleId: string): LineageComplianceInventoryItem {
  const rule = LINEAGE_SPEC_INVENTORY.find((candidate) => candidate.ruleId === ruleId);
  if (!rule) {
    throw new Error(`Unknown lineage SPEC inventory rule: ${ruleId}`);
  }
  return rule;
}
