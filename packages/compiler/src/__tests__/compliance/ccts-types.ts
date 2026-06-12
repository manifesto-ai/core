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

export type {
  ComplianceStatus,
  RuleLevel,
  RuleLifecycle,
  RuleMode,
};

export type CompilerPhase = "lex" | "parse" | "analyze" | "canonical" | "generate" | "compile" | "lower";

export type CompilerEvidenceKind = "diagnostic" | "ast" | "schema" | "trace" | "note";

export type CompilerEvidence = ComplianceEvidence<CompilerEvidenceKind>;

export type CompilerComplianceInventoryItem = ComplianceInventoryItem<CompilerComplianceSuite>;

export type CompilerComplianceRule = ComplianceRule<CompilerComplianceSuite>;

export type CompilerComplianceCase = ComplianceCase<CompilerComplianceSuite>;

export type CompilerComplianceCoverageEntry = ComplianceCoverageEntry;

export type CompilerComplianceResult = ComplianceResult<CompilerEvidence>;

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
