import type {
  RuleLevel,
  RuleLifecycle,
  WorldFacadeComplianceInventoryItem,
  WorldFacadeComplianceSuite,
} from "./wfcts-types.js";

function inventory(
  ruleId: string,
  specSection: string,
  level: RuleLevel,
  suite: WorldFacadeComplianceSuite,
  options?: {
    lifecycle?: RuleLifecycle;
    notes?: string;
  }
): WorldFacadeComplianceInventoryItem {
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
  suite: WorldFacadeComplianceSuite,
  options?: {
    lifecycle?: RuleLifecycle;
    notes?: string;
  }
): WorldFacadeComplianceInventoryItem[] {
  return ruleIds.map((ruleId) => inventory(ruleId, specSection, level, suite, options));
}

export const WORLD_FACADE_SPEC_INVENTORY: readonly WorldFacadeComplianceInventoryItem[] = [
  inventory("FACADE-REEXPORT-1", "§5.2", "MUST", "reexports", {
    notes: "Tracked via the current world compatibility surface until direct governance/lineage re-exports land.",
  }),
  inventory("FACADE-REEXPORT-3", "§5.2", "MUST", "reexports"),
  inventory("FACADE-FACTORY-1", "§9", "MUST", "factory", {
    notes: "Legacy createManifestoWorld() is the compatibility stand-in for createWorld().",
  }),
  inventory("FACADE-FACTORY-4", "§9", "MUST", "factory", {
    notes: "Service exposure is staged until world becomes a thin facade over split packages.",
  }),
  inventory("FACADE-STORE-7", "§6.2", "MUST", "factory", {
    notes: "Tracked through legacy createMemoryWorldStore() until createInMemoryWorldStore() exists.",
  }),
  ...inventoryMany(["FACADE-COORD-1", "FACADE-COORD-2", "FACADE-COORD-3", "FACADE-COORD-4", "FACADE-COORD-9"], "§8", "MUST", "coordinator", {
    notes: "Coordinator ordering and retry semantics are CTS-tracked ahead of the facade split.",
  }),
] as const;

export function getInventoryRuleOrThrow(ruleId: string): WorldFacadeComplianceInventoryItem {
  const rule = WORLD_FACADE_SPEC_INVENTORY.find((candidate) => candidate.ruleId === ruleId);
  if (!rule) {
    throw new Error(`Unknown world-facade SPEC inventory rule: ${ruleId}`);
  }
  return rule;
}
