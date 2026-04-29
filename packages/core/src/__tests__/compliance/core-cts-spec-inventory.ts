import type { CoreComplianceInventoryItem, CoreComplianceSuite, RuleLevel } from "./core-cts-types.js";

function inventory(
  ruleId: string,
  specSection: string,
  level: RuleLevel,
  suite: CoreComplianceSuite,
  notes?: string,
): CoreComplianceInventoryItem {
  return {
    ruleId,
    specSection,
    level,
    suite,
    lifecycle: "active",
    ...(notes ? { notes } : {}),
  };
}

export const CORE_SPEC_INVENTORY: readonly CoreComplianceInventoryItem[] = [
  inventory("SCHEMA-RESERVED-1", "Core SPEC §5.5", "MUST_NOT", "schema"),
  inventory("SCHEMA-RESERVED-2", "Core SPEC §5.5", "MUST", "snapshot"),

  inventory("V-001", "Core SPEC §14.1", "MUST", "schema"),
  inventory("V-002", "Core SPEC §14.1", "MUST", "schema"),
  inventory("V-003", "Core SPEC §14.1", "MUST", "schema"),
  inventory("V-004", "Core SPEC §14.1", "MUST", "schema"),
  inventory("V-005", "Core SPEC §14.1", "MUST", "schema"),
  inventory("V-006", "Core SPEC §14.1", "MUST", "compute-and-flow"),
  inventory("V-007", "Core SPEC §14.1", "MUST", "schema"),
  inventory("V-008", "Core SPEC §14.1", "MUST", "trace-and-hash"),
  inventory("V-009", "Core SPEC §14.1", "MUST", "availability-dispatchability"),
  inventory("V-010", "Core SPEC §14.1", "MUST", "schema"),
  inventory("V-011", "Core SPEC §14.1", "MUST", "schema"),
  inventory("V-012", "Core SPEC §14.1", "MUST", "schema"),

  inventory("R-001", "Core SPEC §14.2", "MUST", "compute-and-flow"),
  inventory("R-002", "Core SPEC §14.2", "MUST", "compute-and-flow"),
  inventory("R-003", "Core SPEC §14.2", "MUST", "patch-and-system"),
  inventory("R-004", "Core SPEC §14.2", "MUST", "patch-and-system"),
  inventory("R-005", "Core SPEC §14.2", "MUST", "snapshot"),
  inventory("R-006", "Core SPEC §14.2", "MUST_NOT", "patch-and-system"),
  inventory("R-007", "Core SPEC §14.2", "MUST", "snapshot"),
  inventory("R-008", "Core SPEC §14.2", "MUST", "snapshot"),

  inventory("TRACE-NS-1", "Core SPEC §12.2", "MUST", "trace-and-hash"),
  inventory("TRACE-NS-2", "Core SPEC §12.2", "MUST", "trace-and-hash"),
  inventory("TRACE-NS-3", "Core SPEC §12.2", "MUST", "trace-and-hash"),
  inventory("TRACE-NS-4", "Core SPEC §12.2", "MUST_NOT", "trace-and-hash"),

  inventory("NSDELTA-1", "Core SPEC §13.4", "MUST", "snapshot"),
  inventory("NSDELTA-1a", "Core SPEC §13.4", "MAY", "snapshot"),
  inventory("NSDELTA-1b", "Core SPEC §13.4", "MAY", "snapshot"),
  inventory("NSDELTA-2", "Core SPEC §13.4", "MUST_NOT", "patch-and-system"),
  inventory("NSDELTA-2a", "Core SPEC §13.4", "MAY", "snapshot"),
  inventory("NSDELTA-3", "Core SPEC §13.4", "MUST", "snapshot"),
  inventory("NSDELTA-4", "Core SPEC §13.4", "MUST", "trace-and-hash"),
  inventory("NSREAD-1", "Core SPEC §13.4", "MUST_NOT", "expr"),
  inventory("NSREAD-2", "Core SPEC §13.4", "MAY", "trace-and-hash"),
  inventory("NSREAD-3", "Core SPEC §13.4", "MUST", "trace-and-hash"),
  inventory("NSREAD-4", "Core SPEC §13.4", "MUST", "trace-and-hash"),
  inventory("NSINIT-1", "Core SPEC §13.4", "MUST", "snapshot"),
  inventory("NSINIT-2", "Core SPEC §13.4", "MUST", "snapshot"),
  inventory("NSINIT-3", "Core SPEC §13.4", "MUST", "snapshot"),
  inventory("NSINIT-4", "Core SPEC §13.4", "MUST", "snapshot"),
  inventory("NSINIT-5", "Core SPEC §13.4", "SHOULD", "snapshot"),

  inventory("AVAIL-Q-1", "Core SPEC §16.6", "MUST", "availability-dispatchability"),
  inventory("AVAIL-Q-2", "Core SPEC §16.6", "MUST", "availability-dispatchability"),
  inventory("AVAIL-Q-3", "Core SPEC §16.6", "MUST", "availability-dispatchability"),
  inventory("AVAIL-Q-4", "Core SPEC §16.6", "MUST", "availability-dispatchability"),
  inventory("AVAIL-Q-5", "Core SPEC §16.6", "MUST", "availability-dispatchability"),
  inventory("AVAIL-Q-6", "Core SPEC §16.6", "MUST_NOT", "availability-dispatchability"),
  inventory("AVAIL-Q-7", "Core SPEC §16.6", "MUST_NOT", "availability-dispatchability"),

  inventory("DISP-Q-1", "Core SPEC §16.7", "MUST", "availability-dispatchability"),
  inventory("DISP-Q-2", "Core SPEC §16.7", "MUST", "availability-dispatchability"),
  inventory("DISP-Q-3", "Core SPEC §16.7", "MUST_NOT", "availability-dispatchability"),
  inventory("DISP-Q-4", "Core SPEC §16.7", "MUST", "availability-dispatchability"),
  inventory("DISP-Q-5", "Core SPEC §16.7", "MUST", "availability-dispatchability"),
  inventory("DISP-Q-6", "Core SPEC §16.7", "MUST_NOT", "availability-dispatchability"),
] as const;

export function getInventoryRuleOrThrow(ruleId: string): CoreComplianceInventoryItem {
  const rule = CORE_SPEC_INVENTORY.find((candidate) => candidate.ruleId === ruleId);
  if (!rule) {
    throw new Error(`Unknown Core SPEC inventory rule: ${ruleId}`);
  }
  return rule;
}
