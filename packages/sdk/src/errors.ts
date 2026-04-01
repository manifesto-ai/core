export class ManifestoError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ManifestoError";
    this.code = code;
  }
}

export class ReservedEffectError extends ManifestoError {
  readonly effectType: string;

  constructor(effectType: string) {
    super(
      "RESERVED_EFFECT",
      `Effect type "${effectType}" is reserved and cannot be overridden`,
    );
    this.name = "ReservedEffectError";
    this.effectType = effectType;
  }
}

export interface CompileDiagnostic {
  readonly severity: "error" | "warning" | "info";
  readonly code: string;
  readonly message: string;
  readonly location: {
    readonly start: { readonly line: number; readonly column: number; readonly offset: number };
    readonly end: { readonly line: number; readonly column: number; readonly offset: number };
  };
  readonly source?: string;
  readonly suggestion?: string;
}

export class CompileError extends ManifestoError {
  readonly diagnostics: readonly CompileDiagnostic[];

  constructor(diagnostics: readonly CompileDiagnostic[], formattedMessage: string) {
    super("COMPILE_ERROR", formattedMessage);
    this.name = "CompileError";
    this.diagnostics = diagnostics;
  }
}

export class DisposedError extends ManifestoError {
  constructor() {
    super("DISPOSED", "Cannot use a disposed Manifesto runtime");
    this.name = "DisposedError";
  }
}

export class AlreadyActivatedError extends ManifestoError {
  constructor() {
    super("ALREADY_ACTIVATED", "ComposableManifesto.activate() may only be called once");
    this.name = "AlreadyActivatedError";
  }
}
