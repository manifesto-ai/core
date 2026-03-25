import {
  analyzeScope,
  compile,
  compileMelDomain,
  generate,
  lowerSystemValues,
  parse,
  tokenize,
  validateSemantics,
} from "../../index.js";
import type { DomainSchema } from "../../generator/ir.js";
import type { Token } from "../../lexer/index.js";
import type { ProgramNode } from "../../parser/index.js";
import type { Diagnostic } from "../../diagnostics/types.js";
import type {
  CompilerAnalyzeSnapshot,
  CompilerComplianceAdapter,
  CompilerPhaseSnapshot,
} from "./ccts-types.js";

function phaseSnapshot<T>(
  phase: CompilerPhaseSnapshot<T>["phase"],
  value: T | null,
  diagnostics: Diagnostic[],
  trace?: CompilerPhaseSnapshot<T>["trace"]
): CompilerPhaseSnapshot<T> {
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === "warning");
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error");

  return {
    phase,
    success: errors.length === 0,
    value,
    diagnostics,
    warnings,
    errors,
    trace,
  };
}

export class DefaultCompilerComplianceAdapter implements CompilerComplianceAdapter {
  lex(source: string): CompilerPhaseSnapshot<Token[]> {
    const result = tokenize(source);
    return phaseSnapshot("lex", result.tokens, result.diagnostics);
  }

  parse(source: string): CompilerPhaseSnapshot<ProgramNode> {
    const lexed = this.lex(source);
    if (!lexed.success || !lexed.value) {
      return phaseSnapshot("parse", null, lexed.diagnostics);
    }

    const parsed = parse(lexed.value);
    return phaseSnapshot("parse", parsed.program, parsed.diagnostics);
  }

  analyze(source: string): CompilerAnalyzeSnapshot {
    const parsed = this.parse(source);
    if (!parsed.success || !parsed.value) {
      return {
        ...phaseSnapshot("analyze", null, parsed.diagnostics),
        scopeDiagnostics: [],
        semanticDiagnostics: [],
      };
    }

    const scopeResult = analyzeScope(parsed.value);
    const semanticResult = validateSemantics(parsed.value);
    const diagnostics = [...scopeResult.diagnostics, ...semanticResult.diagnostics];

    return {
      ...phaseSnapshot("analyze", parsed.value, diagnostics),
      scopeDiagnostics: scopeResult.diagnostics,
      semanticDiagnostics: semanticResult.diagnostics,
    };
  }

  generate(source: string): CompilerPhaseSnapshot<DomainSchema> {
    const analyzed = this.analyze(source);
    if (!analyzed.success || !analyzed.value) {
      return phaseSnapshot("generate", null, analyzed.diagnostics);
    }

    const generated = generate(analyzed.value);
    return phaseSnapshot("generate", generated.schema, generated.diagnostics);
  }

  compile(source: string): CompilerPhaseSnapshot<DomainSchema> {
    const result = compile(source);
    const diagnostics = [...result.warnings, ...result.errors];
    return phaseSnapshot("compile", result.schema, diagnostics, result.trace);
  }

  lower(source: string): CompilerPhaseSnapshot<DomainSchema> {
    const compiled = compileMelDomain(source, { mode: "domain" });
    const diagnostics = [...compiled.warnings, ...compiled.errors];
    if (compiled.errors.length > 0 || !compiled.schema) {
      return phaseSnapshot("lower", null, diagnostics, compiled.trace);
    }

    const lowered = lowerSystemValues(compiled.schema);
    return phaseSnapshot("lower", lowered, diagnostics, compiled.trace);
  }
}

export function createCompilerComplianceAdapter(): CompilerComplianceAdapter {
  return new DefaultCompilerComplianceAdapter();
}
