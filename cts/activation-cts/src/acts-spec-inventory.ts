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
      notes: "ADR-026 v5 action-candidate CTS rules covered by executable runtime cases. Granular SDK-* inventory rows below mirror the ADR rule IDs for audit traceability.",
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
      notes: "ADR-026 v5 type rules covered by executable tsc fixtures and positive runtime-surface type assertions.",
    },
  ),
  ...inventoryMany(
    [
      "SDK-ROOT-1",
      "SDK-ROOT-2",
      "SDK-ROOT-3",
      "SDK-SNAPSHOT-1",
      "SDK-SNAPSHOT-2",
      "SDK-SNAPSHOT-3",
    ],
    "ADR-026 §4/§10",
    "MUST",
    "base",
    {
      notes: "Granular ADR-026 root and snapshot rules covered by the v5 action-candidate surface case.",
    },
  ),
  ...inventoryMany(
    [
      "SDK-ROOT-7",
      "SDK-SNAPSHOT-4",
    ],
    "ADR-026 §4/§10",
    "MUST_NOT",
    "base",
    {
      notes: "Granular ADR-026 root/snapshot forbidden-surface rules covered by v5 root-shape assertions.",
    },
  ),
  ...inventoryMany(
    [
      "SDK-ROOT-4",
      "SDK-ROOT-6",
      "SDK-SUBMIT-11",
    ],
    "ADR-026 §4/§8",
    "MUST",
    "types",
    {
      notes: "Granular governance/generic-mode type reachability rules covered by tsc fixtures.",
    },
  ),
  inventory(
    "SDK-ROOT-5",
    "ADR-026 §4/§8",
    "MUST",
    "governance",
    {
      notes: "Granular governance settlement re-attachment rule covered by the governance settlement CTS case.",
    },
  ),
  ...inventoryMany(
    [
      "SDK-ADMISSION-1",
      "SDK-ADMISSION-4",
      "SDK-ADMISSION-5",
      "SDK-PREVIEW-1",
      "SDK-PREVIEW-4",
      "SDK-PREVIEW-5",
      "SDK-PREVIEW-6",
      "SDK-PREVIEW-7",
    ],
    "ADR-026 §6/§7",
    "MUST",
    "base",
    {
      notes: "Granular admission and preview rules covered by the v5 admission/preview case.",
    },
  ),
  ...inventoryMany(
    [
      "SDK-ADMISSION-2",
      "SDK-ADMISSION-3",
      "SDK-PREVIEW-2",
      "SDK-PREVIEW-3",
    ],
    "ADR-026 §6/§7",
    "MUST_NOT",
    "base",
    {
      notes: "Granular admission/preview non-mutation and no-bypass rules covered by the v5 admission/preview case.",
    },
  ),
  ...inventoryMany(
    [
      "SDK-RESULT-1",
      "SDK-RESULT-2",
      "SDK-SUBMIT-1",
      "SDK-SUBMIT-2",
      "SDK-SUBMIT-4",
      "SDK-SUBMIT-6",
      "SDK-SUBMIT-7",
      "SDK-SUBMIT-9",
      "SDK-SUBMIT-12",
      "SDK-SUBMIT-13",
      "SDK-SUBMIT-14",
      "SDK-OUTCOME-1",
      "SDK-OUTCOME-2",
      "SDK-OUTCOME-3",
    ],
    "ADR-026 §8/§9",
    "MUST",
    "base",
    {
      notes: "Granular submit/result/outcome rules covered by base, lineage, and governance submit CTS cases.",
    },
  ),
  ...inventoryMany(
    [
      "SDK-SUBMIT-3",
      "SDK-SUBMIT-8",
      "SDK-SUBMIT-10",
    ],
    "ADR-026 §8",
    "MUST_NOT",
    "base",
    {
      notes: "Granular submit forbidden-backdoor rules covered by root-shape and decorated-runtime CTS cases.",
    },
  ),
  ...inventoryMany(
    [
      "SDK-SUBMIT-15",
      "SDK-SUBMIT-16",
    ],
    "ADR-026 §8",
    "MUST",
    "governance",
    {
      notes: "Granular ProposalRef durability rules covered by governance settlement re-attachment CTS.",
    },
  ),
  ...inventoryMany(
    [
      "SDK-OBSERVE-1",
      "SDK-OBSERVE-2",
      "SDK-OBSERVE-3",
      "SDK-OBSERVE-5",
    ],
    "ADR-026 §11",
    "MUST",
    "base",
    {
      notes: "Granular observe rules covered by observe.event and observe.state CTS cases.",
    },
  ),
  inventory(
    "SDK-OBSERVE-4",
    "ADR-026 §11",
    "MUST_NOT",
    "base",
    {
      notes: "Granular observe no-snapshot-payload rule covered by observe.event CTS.",
    },
  ),
  ...inventoryMany(
    [
      "SDK-INSPECT-1",
      "SDK-INSPECT-2",
      "SDK-INSPECT-3",
      "SDK-INSPECT-4",
      "SDK-INSPECT-6",
    ],
    "ADR-026 §12",
    "MUST",
    "base",
    {
      notes: "Granular inspect rules covered by inspect CTS.",
    },
  ),
  inventory(
    "SDK-INSPECT-5",
    "ADR-026 §12",
    "MUST_NOT",
    "base",
    {
      notes: "Granular inspect no-v3-root rule covered by inspect CTS.",
    },
  ),
  ...inventoryMany(
    [
      "SDK-EXT-1",
      "SDK-EXT-4",
    ],
    "ADR-026 §13",
    "MUST",
    "base",
    {
      notes: "Granular extension-kernel placement and read-only session rules covered by extension CTS.",
    },
  ),
  ...inventoryMany(
    [
      "SDK-EXT-2",
      "SDK-EXT-3",
    ],
    "ADR-026 §13",
    "MUST_NOT",
    "base",
    {
      notes: "Granular extension no-root-kernel/no-mutation-backdoor rules covered by extension CTS.",
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
