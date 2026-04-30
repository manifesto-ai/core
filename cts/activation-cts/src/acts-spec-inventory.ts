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
      "ACTS-BASE-6",
      "ACTS-BASE-7",
      "ACTS-BASE-8",
      "ACTS-BASE-9",
      "ACTS-BASE-10",
      "ACTS-BASE-11",
    ],
    "SDK SPEC v3 §5/§7/§7.2",
    "MUST",
    "base",
  ),
  ...inventoryMany(
    [
      "ACTS-LIN-1",
      "ACTS-LIN-2",
      "ACTS-LIN-3",
      "ACTS-LIN-4",
    ],
    "Lineage SPEC v5 §2/§3/§4",
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
      "ACTS-GOV-6",
      "ACTS-GOV-7",
      "ACTS-GOV-8",
      "ACTS-GOV-9",
    ],
    "Governance SPEC v5 §3/§4/§5/§6; SDK SPEC v5 §13",
    "MUST",
    "governance",
    {
      notes: "ADR-026 PR-5/PR-6 governance CTS rules cover v5 submit, raw ProposalRef identity, settlement re-attachment, canonical root backdoor absence, and governance proposal telemetry.",
    },
  ),
  ...inventoryMany(
    [
      "ACTS-TYPE-1",
      "ACTS-TYPE-2",
      "ACTS-TYPE-3",
      "ACTS-TYPE-4",
    ],
    "SDK SPEC v5 §5/§7/§8/§11; Lineage SPEC v5 §2/§3/§4; Governance SPEC v5 §3/§4/§5",
    "MUST",
    "types",
    {
      notes: "Compile-time fixtures are enforced through tsc --noEmit with @ts-expect-error against the current package-level runtime types.",
    },
  ),
  ...inventoryMany(
    [
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
    ],
    "SDK SPEC v5 §7/§8/§9/§10/§11/§13/§17",
    "MUST",
    "base",
    {
      notes: "ADR-026 v5 action-candidate CTS rules. During the pre-development slice these are registered with todo runtime cases and become executable as the SDK v5 source surface lands.",
    },
  ),
  ...inventoryMany(
    [
      "ACTS-V5-TYPE-1",
      "ACTS-V5-TYPE-2",
      "ACTS-V5-TYPE-3",
    ],
    "SDK SPEC v5 §5/§7/§8/§11/§13/§14",
    "MUST",
    "types",
    {
      notes: "ADR-026 v5 type rules. The initial fixture records expected missing public exports until the source slice replaces it with positive type assertions.",
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
