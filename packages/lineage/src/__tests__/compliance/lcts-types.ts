import type { Snapshot } from "../../index.js";

export const LCTS_SUITES = [
  "identity",
  "seams",
  "matrix",
] as const;

export type LineageComplianceSuite = (typeof LCTS_SUITES)[number];

export type ComplianceStatus = "PASS" | "FAIL" | "SKIP" | "WARN";

export type RuleMode = "blocking" | "pending" | "informational";

export type RuleLevel = "MUST" | "SHOULD" | "MUST_NOT" | "MAY" | "CRITICAL";

export type RuleLifecycle = "active" | "superseded";

export interface LineageEvidence {
  kind: "note";
  summary: string;
  details?: unknown;
}

export interface LineageComplianceInventoryItem {
  ruleId: string;
  specSection: string;
  level: RuleLevel;
  suite: LineageComplianceSuite;
  lifecycle: RuleLifecycle;
  notes?: string;
}

export interface LineageComplianceRule extends LineageComplianceInventoryItem {
  mode: RuleMode;
}

export interface LineageComplianceCase {
  caseId: string;
  suite: LineageComplianceSuite;
  description: string;
}

export interface LineageComplianceCoverageEntry {
  ruleId: string;
  caseIds: string[];
}

export interface LineageComplianceResult {
  ruleId: string;
  specSection: string;
  mode: RuleMode;
  status: ComplianceStatus;
  message?: string;
  evidence?: LineageEvidence[];
}

export interface LineageComplianceAdapter {
  computeSnapshotHash(snapshot: Snapshot): Promise<string>;
  computeWorldId(schemaHash: string, snapshotHash: string): Promise<string>;
  createMemoryStore(): unknown;
  exports(): Record<string, unknown>;
}
