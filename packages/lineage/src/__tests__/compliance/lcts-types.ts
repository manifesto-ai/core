import type {
  ComplianceCase,
  ComplianceCoverageEntry,
  ComplianceEvidence,
  ComplianceInventoryItem,
  ComplianceResult,
  ComplianceRule,
  ComplianceStatus,
  RuleLevel,
  RuleLifecycle,
  RuleMode,
} from "@manifesto-ai/cts-kit";
import type { Snapshot } from "@manifesto-ai/core";
import type { LineageService, LineageStore } from "../../types.js";

export const LCTS_SUITES = [
  "identity",
  "branch",
  "restore",
  "attempts",
  "seams",
  "matrix",
] as const;

export type LineageComplianceSuite = (typeof LCTS_SUITES)[number];

export type {
  ComplianceStatus,
  RuleLevel,
  RuleLifecycle,
  RuleMode,
};

export type LineageEvidence = ComplianceEvidence;

export type LineageComplianceInventoryItem = ComplianceInventoryItem<LineageComplianceSuite>;

export type LineageComplianceRule = ComplianceRule<LineageComplianceSuite>;

export type LineageComplianceCase = ComplianceCase<LineageComplianceSuite>;

export type LineageComplianceCoverageEntry = ComplianceCoverageEntry;

export type LineageComplianceResult = ComplianceResult<LineageEvidence>;

export interface LineageComplianceAdapter {
  computeSnapshotHash(snapshot: Snapshot): Promise<string>;
  computeWorldId(schemaHash: string, snapshotHash: string, parentWorldId: string | null): Promise<string>;
  createMemoryStore(): LineageStore;
  createService(store: LineageStore): LineageService;
  exports(): Record<string, unknown>;
}
