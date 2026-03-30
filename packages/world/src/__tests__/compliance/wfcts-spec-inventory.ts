import type {
  RuleLevel,
  RuleLifecycle,
  WorldFacadeComplianceInventoryItem,
  WorldFacadeComplianceSuite,
} from "./wfcts-types.js";

// WFCTS tracks the executable active facade subset.
// MAY/SHOULD rules, lifecycle policy, and deeply delegated cross-package rules
// remain outside this matrix unless the facade itself owns an observable seam.

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
  inventory("FACADE-REEXPORT-1", "§5.2", "MUST", "reexports"),
  inventory("FACADE-REEXPORT-3", "§5.2", "MUST", "reexports"),
  inventory("FACADE-EVT-3", "§10", "MUST", "reexports"),
  inventory("FACADE-FACTORY-1", "§9", "MUST", "factory"),
  inventory("FACADE-FACTORY-2", "§9", "MUST", "factory"),
  inventory("FACADE-FACTORY-4", "§9", "MUST", "factory", {
    notes: "Facade returns the exact pre-built service instances without wrapping.",
  }),
  inventory("FACADE-STORE-1", "§6.2", "MUST", "factory"),
  inventory("FACADE-STORE-2", "§6.2", "MUST", "factory"),
  inventory("FACADE-STORE-3", "§6.2", "MUST", "factory"),
  inventory("FACADE-STORE-4", "§6.2", "MUST_NOT", "coordinator"),
  inventory("FACADE-STORE-6", "§6.2", "MUST_NOT", "coordinator"),
  inventory("FACADE-STORE-7", "§6.2", "MUST", "factory"),
  ...inventoryMany(["FACADE-WS-1", "FACADE-WS-2", "FACADE-WS-3", "FACADE-WS-4"], "§7", "MUST", "factory"),
  ...inventoryMany(["FACADE-COORD-1", "FACADE-COORD-2", "FACADE-COORD-3", "FACADE-COORD-4", "FACADE-COORD-5", "FACADE-COORD-6", "FACADE-COORD-7", "FACADE-COORD-8", "FACADE-COORD-9", "FACADE-COORD-11"], "§8", "MUST", "coordinator"),
  inventory("FACADE-EVT-1", "§10", "MUST", "coordinator"),
  inventory("FACADE-EVT-2", "§10", "MUST", "coordinator"),
  inventory("FACADE-EVT-5", "§10", "MUST_NOT", "coordinator"),
  inventory("FACADE-FACTORY-3", "§9", "MUST", "factory", {
    notes: "Same-store instance identity remains a caller precondition and is enforced through identity-preserving top-level assembly coverage.",
  }),
  ...inventoryMany(["FACADE-SDK-1", "FACADE-SDK-2"], "§12", "MUST", "matrix", {
    notes: "SDK alignment is enforced through thin top-level world re-exports and canonical top-level factory coverage.",
  }),
] as const;

export function getInventoryRuleOrThrow(ruleId: string): WorldFacadeComplianceInventoryItem {
  const rule = WORLD_FACADE_SPEC_INVENTORY.find((candidate) => candidate.ruleId === ruleId);
  if (!rule) {
    throw new Error(`Unknown world-facade SPEC inventory rule: ${ruleId}`);
  }
  return rule;
}
