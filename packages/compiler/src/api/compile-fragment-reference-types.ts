import type { LocalTargetKey } from "../annotations.js";
import type { ProgramNode } from "../parser/index.js";
import type { MelTextEdit } from "./compile-fragment-types.js";

export type DeclarationEditPlan =
  | {
      readonly ok: true;
      readonly edits: readonly MelTextEdit[];
      readonly changedTargets: readonly LocalTargetKey[];
    }
  | {
      readonly ok: false;
      readonly code: DeclarationEditFailureCode;
      readonly message: string;
      readonly location: ProgramNode["location"];
    };

export type DeclarationEditFailureCode =
  | "E_REMOVE_BLOCKED_BY_REFERENCES"
  | "E_UNSAFE_RENAME_AMBIGUOUS"
  | "E_TARGET_NOT_FOUND"
  | "E_FRAGMENT_SCOPE_VIOLATION";

export type TargetInfo =
  | { readonly kind: "type"; readonly name: string }
  | { readonly kind: "state_field"; readonly name: string }
  | { readonly kind: "computed"; readonly name: string }
  | { readonly kind: "action"; readonly name: string }
  | { readonly kind: "type_field"; readonly typeName: string; readonly fieldName: string };

export type ReferenceSpan = {
  readonly range: OffsetRange;
  readonly location: ProgramNode["location"];
  readonly rewrite: boolean;
};

export type OffsetRange = {
  readonly start: number;
  readonly end: number;
};
