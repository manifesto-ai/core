import type { CompileTrace } from "../../api/compile-mel.js";
import type { Diagnostic } from "../../diagnostics/types.js";
import type { Token } from "../../lexer/index.js";
import type { ProgramNode } from "../../parser/index.js";
import type { CanonicalDomainSchema, DomainSchema } from "../../generator/ir.js";

export const CCTS_SUITES = [
  "grammar",
  "annotations",
  "context",
  "state-and-computed",
  "actions-and-control",
  "lowering-and-ir",
  "flow-composition",
  "entity-primitives",
  "introspection",
  "source-editing",
  "determinism",
  "matrix",
] as const;

export type CompilerComplianceSuite = (typeof CCTS_SUITES)[number];

export type ComplianceStatus = "PASS" | "FAIL" | "SKIP" | "WARN";

export type RuleMode = "blocking" | "pending" | "informational";

export type RuleLevel = "MUST" | "SHOULD" | "MUST_NOT" | "MAY" | "CRITICAL";

export type RuleLifecycle = "active" | "superseded";

export type CompilerPhase = "lex" | "parse" | "analyze" | "canonical" | "generate" | "compile" | "lower";

export interface CompilerEvidence {
  kind: "diagnostic" | "ast" | "schema" | "trace" | "note";
  summary: string;
  details?: unknown;
}

export interface CompilerComplianceInventoryItem {
  ruleId: string;
  specSection: string;
  level: RuleLevel;
  suite: CompilerComplianceSuite;
  lifecycle: RuleLifecycle;
  notes?: string;
}

export interface CompilerComplianceRule extends CompilerComplianceInventoryItem {
  mode: RuleMode;
}

export interface CompilerComplianceCase {
  caseId: string;
  suite: CompilerComplianceSuite;
  description: string;
}

export interface CompilerComplianceCoverageEntry {
  ruleId: string;
  caseIds: string[];
}

export interface CompilerComplianceResult {
  ruleId: string;
  specSection: string;
  mode: RuleMode;
  status: ComplianceStatus;
  message?: string;
  evidence?: CompilerEvidence[];
}

export interface CompilerPhaseSnapshot<T = unknown> {
  phase: CompilerPhase;
  success: boolean;
  value: T | null;
  diagnostics: Diagnostic[];
  warnings: Diagnostic[];
  errors: Diagnostic[];
  trace?: CompileTrace[];
}

export interface CompilerAnalyzeSnapshot extends CompilerPhaseSnapshot<ProgramNode> {
  scopeDiagnostics: Diagnostic[];
  semanticDiagnostics: Diagnostic[];
}

export interface CompilerComplianceAdapter {
  lex(source: string): CompilerPhaseSnapshot<Token[]>;
  parse(source: string): CompilerPhaseSnapshot<ProgramNode>;
  analyze(source: string): CompilerAnalyzeSnapshot;
  canonical(source: string): CompilerPhaseSnapshot<CanonicalDomainSchema>;
  generate(source: string): CompilerPhaseSnapshot<DomainSchema>;
  compile(source: string): CompilerPhaseSnapshot<DomainSchema>;
  lower(source: string): CompilerPhaseSnapshot<DomainSchema>;
}
