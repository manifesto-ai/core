export type ComplianceStatus = "PASS" | "FAIL" | "SKIP" | "WARN";

export type RuleMode = "blocking" | "pending" | "informational";

export type RuleLevel = "MUST" | "SHOULD" | "MUST_NOT" | "MAY" | "CRITICAL";

export type RuleLifecycle = "active" | "superseded";

export interface ComplianceEvidence {
  kind: "note";
  summary: string;
  details?: unknown;
}

export interface ComplianceInventoryItem<TSuite extends string> {
  ruleId: string;
  specSection: string;
  level: RuleLevel;
  suite: TSuite;
  lifecycle: RuleLifecycle;
  notes?: string;
}

export interface ComplianceRule<TSuite extends string> extends ComplianceInventoryItem<TSuite> {
  mode: RuleMode;
}

export interface ComplianceCase<TSuite extends string> {
  caseId: string;
  suite: TSuite;
  description: string;
}

export interface ComplianceCoverageEntry {
  ruleId: string;
  caseIds: string[];
}

export interface ComplianceResult<TEvidence extends ComplianceEvidence = ComplianceEvidence> {
  ruleId: string;
  specSection: string;
  mode: RuleMode;
  status: ComplianceStatus;
  message?: string;
  evidence?: TEvidence[];
}
