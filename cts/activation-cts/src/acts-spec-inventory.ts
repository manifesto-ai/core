import type {
  ActivationComplianceInventoryItem,
  ActivationComplianceSuite,
  RuleLevel,
  RuleLifecycle,
} from "./acts-types.js";

function inventory(
  ruleId: string,
  specSection: string,
  level: RuleLevel,
  suite: ActivationComplianceSuite,
  options?: {
    lifecycle?: RuleLifecycle;
    notes?: string;
  },
): ActivationComplianceInventoryItem {
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
  suite: ActivationComplianceSuite,
  options?: {
    lifecycle?: RuleLifecycle;
    notes?: string;
  },
): ActivationComplianceInventoryItem[] {
  return ruleIds.map((ruleId) =>
    inventory(ruleId, specSection, level, suite, options)
  );
}

export const ACTIVATION_SPEC_INVENTORY: readonly ActivationComplianceInventoryItem[] = [
  ...inventoryMany(
    [
      "ACTS-BASE-1",
      "ACTS-BASE-2",
      "ACTS-BASE-3",
      "ACTS-BASE-4",
      "ACTS-BASE-5",
    ],
    "SDK SPEC v3 §4/§6/§7",
    "MUST",
    "base",
  ),
  ...inventoryMany(
    [
      "ACTS-LIN-1",
      "ACTS-LIN-2",
      "ACTS-LIN-3",
    ],
    "Lineage SPEC v3 §2/§3/§4",
    "MUST",
    "lineage",
  ),
  ...inventoryMany(
    [
      "ACTS-GOV-1",
      "ACTS-GOV-2",
      "ACTS-GOV-3",
      "ACTS-GOV-4",
      "ACTS-GOV-5",
    ],
    "Governance SPEC v3 §2/§4/§5/§6/§7/§8",
    "MUST",
    "governance",
  ),
  ...inventoryMany(
    [
      "ACTS-TYPE-1",
      "ACTS-TYPE-2",
      "ACTS-TYPE-3",
    ],
    "SDK SPEC v3 §4/§5; Lineage SPEC v3 §2/§3; Governance SPEC v3 §2/§4/§5/§6",
    "MUST",
    "types",
    {
      notes: "Compile-time fixtures are enforced through tsc --noEmit with @ts-expect-error against the current package-level runtime types.",
    },
  ),
] as const;

export function getInventoryRuleOrThrow(
  ruleId: string,
): ActivationComplianceInventoryItem {
  const rule = ACTIVATION_SPEC_INVENTORY.find(
    (candidate) => candidate.ruleId === ruleId,
  );
  if (!rule) {
    throw new Error(`Unknown activation CTS inventory rule: ${ruleId}`);
  }
  return rule;
}
