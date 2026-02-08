import type { DomainSchema } from "@manifesto-ai/core";

export type { DomainSchema };

export type Diagnostic = {
  readonly level: "warn" | "error";
  readonly plugin: string;
  readonly message: string;
};

export type FilePatch =
  | { readonly op: "set"; readonly path: string; readonly content: string }
  | { readonly op: "delete"; readonly path: string };

export interface CodegenHelpers {
  stableHash(input: unknown): string;
}

export interface CodegenContext {
  readonly schema: DomainSchema;
  readonly sourceId?: string;
  readonly outDir: string;
  readonly artifacts: Readonly<Record<string, unknown>>;
  readonly helpers: CodegenHelpers;
}

export interface CodegenOutput {
  readonly patches: readonly FilePatch[];
  readonly artifacts?: Readonly<Record<string, unknown>>;
  readonly diagnostics?: readonly Diagnostic[];
}

export interface CodegenPlugin {
  readonly name: string;
  generate(ctx: CodegenContext): CodegenOutput | Promise<CodegenOutput>;
}

export interface GenerateOptions {
  readonly schema: DomainSchema;
  readonly outDir: string;
  readonly plugins: readonly CodegenPlugin[];
  readonly sourceId?: string;
  readonly stamp?: boolean;
}

export interface GenerateResult {
  readonly files: ReadonlyArray<{ readonly path: string; readonly content: string }>;
  readonly artifacts: Readonly<Record<string, unknown>>;
  readonly diagnostics: readonly Diagnostic[];
}
