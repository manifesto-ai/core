import type { GovernanceEvent } from "@manifesto-ai/governance";
import type {
  CommitCapableWorldStore,
  WorldInstance,
} from "../../facade.js";

export const WFCTS_SUITES = [
  "reexports",
  "factory",
  "coordinator",
  "matrix",
] as const;

export type WorldFacadeComplianceSuite = (typeof WFCTS_SUITES)[number];

export type ComplianceStatus = "PASS" | "FAIL" | "SKIP" | "WARN";

export type RuleMode = "blocking" | "pending" | "informational";

export type RuleLevel = "MUST" | "SHOULD" | "MUST_NOT" | "MAY" | "CRITICAL";

export type RuleLifecycle = "active" | "superseded";

export interface WorldFacadeEvidence {
  kind: "note";
  summary: string;
  details?: unknown;
}

export interface WorldFacadeComplianceInventoryItem {
  ruleId: string;
  specSection: string;
  level: RuleLevel;
  suite: WorldFacadeComplianceSuite;
  lifecycle: RuleLifecycle;
  notes?: string;
}

export interface WorldFacadeComplianceRule extends WorldFacadeComplianceInventoryItem {
  mode: RuleMode;
}

export interface WorldFacadeComplianceCase {
  caseId: string;
  suite: WorldFacadeComplianceSuite;
  description: string;
}

export interface WorldFacadeComplianceCoverageEntry {
  ruleId: string;
  caseIds: string[];
}

export interface WorldFacadeComplianceResult {
  ruleId: string;
  specSection: string;
  mode: RuleMode;
  status: ComplianceStatus;
  message?: string;
  evidence?: WorldFacadeEvidence[];
}

export interface WorldFacadeComplianceAdapter {
  createWorld(): WorldInstance;
  createStore(): CommitCapableWorldStore;
  facadeExports(): Record<string, unknown>;
  topLevelExports(): Record<string, unknown>;
  eventLog(): GovernanceEvent[];
}
