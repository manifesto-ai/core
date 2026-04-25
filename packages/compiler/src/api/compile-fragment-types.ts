import type { DomainModule, JsonLiteral, LocalTargetKey } from "../annotations.js";
import type { SourceSpan } from "../source-map.js";
import type { Diagnostic } from "../diagnostics/types.js";

export interface CompileFragmentInContextOptions {
  readonly baseModule?: DomainModule;
  readonly includeModule?: boolean;
  readonly includeSchemaDiff?: boolean;
}

export interface MelEditResult {
  readonly ok: boolean;
  readonly newSource: string;
  readonly diagnostics: readonly Diagnostic[];
  readonly module?: DomainModule;
  readonly changedTargets: readonly LocalTargetKey[];
  readonly edits: readonly MelTextEdit[];
  readonly schemaDiff?: SchemaDiff;
}

export interface MelTextEdit {
  readonly range: SourceSpan;
  readonly replacement: string;
}

export interface SchemaDiff {
  readonly addedTargets: readonly LocalTargetKey[];
  readonly removedTargets: readonly LocalTargetKey[];
  readonly modifiedTargets: readonly SchemaModifiedTarget[];
}

export interface SchemaModifiedTarget {
  readonly target: LocalTargetKey;
  readonly beforeHash: string;
  readonly afterHash: string;
  readonly before?: unknown;
  readonly after?: unknown;
}

export type MelParamSource = {
  readonly name: string;
  readonly type: string;
};

export type MelEditOp =
  | MelEditAddTypeOp
  | MelEditAddStateFieldOp
  | MelEditAddComputedOp
  | MelEditAddActionOp
  | MelEditAddAvailableOp
  | MelEditAddDispatchableOp
  | MelEditReplaceActionBodyOp
  | MelEditReplaceComputedExprOp
  | MelEditReplaceAvailableOp
  | MelEditReplaceDispatchableOp
  | MelEditReplaceStateDefaultOp
  | MelEditReplaceTypeFieldOp
  | MelEditRemoveDeclarationOp
  | MelEditRenameDeclarationOp;

export type MelEditAddTypeOp = {
  readonly kind: "addType";
  readonly name: string;
  readonly expr: string;
};

export type MelEditAddStateFieldOp = {
  readonly kind: "addStateField";
  readonly name: string;
  readonly type: string;
  readonly defaultValue: JsonLiteral;
};

export type MelEditAddComputedOp = {
  readonly kind: "addComputed";
  readonly name: string;
  readonly expr: string;
};

export type MelEditAddActionOp = {
  readonly kind: "addAction";
  readonly name: string;
  readonly params: readonly MelParamSource[];
  readonly body: string;
};

export type MelEditAddAvailableOp = {
  readonly kind: "addAvailable";
  readonly target: `action:${string}`;
  readonly expr: string;
};

export type MelEditAddDispatchableOp = {
  readonly kind: "addDispatchable";
  readonly target: `action:${string}`;
  readonly expr: string;
};

export type MelEditReplaceActionBodyOp = {
  readonly kind: "replaceActionBody";
  readonly target: `action:${string}`;
  readonly body: string;
};

export type MelEditReplaceComputedExprOp = {
  readonly kind: "replaceComputedExpr";
  readonly target: `computed:${string}`;
  readonly expr: string;
};

export type MelEditReplaceAvailableOp = {
  readonly kind: "replaceAvailable";
  readonly target: `action:${string}`;
  readonly expr: string | null;
};

export type MelEditReplaceDispatchableOp = {
  readonly kind: "replaceDispatchable";
  readonly target: `action:${string}`;
  readonly expr: string | null;
};

export type MelEditReplaceStateDefaultOp = {
  readonly kind: "replaceStateDefault";
  readonly target: `state_field:${string}`;
  readonly value: JsonLiteral;
};

export type MelEditReplaceTypeFieldOp = {
  readonly kind: "replaceTypeField";
  readonly target: `type_field:${string}.${string}`;
  readonly type: string;
};

export type MelEditRemoveDeclarationOp = {
  readonly kind: "removeDeclaration";
  readonly target: LocalTargetKey;
};

export type MelEditRenameDeclarationOp = {
  readonly kind: "renameDeclaration";
  readonly target: LocalTargetKey;
  readonly newName: string;
};
