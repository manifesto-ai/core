/**
 * PatchFragment types for translation output
 */

import type { SemanticPath } from "./common.js";
import type { ExprNode, TypeExpr } from "./type-system.js";

/** Patch operation fragment */
export interface FragmentPatch {
  readonly kind: "patch";
  readonly path: SemanticPath;
  readonly op: "set" | "merge" | "remove";
  readonly value: ExprNode;
}

/** Constraint fragment */
export interface FragmentConstraint {
  readonly kind: "constraint";
  readonly path: SemanticPath;
  readonly expr: ExprNode;
  readonly message?: string;
}

/** Add field fragment */
export interface FragmentAddField {
  readonly kind: "addField";
  readonly path: SemanticPath;
  readonly type: TypeExpr;
  readonly default?: unknown;
}

/** Remove field fragment */
export interface FragmentRemoveField {
  readonly kind: "removeField";
  readonly path: SemanticPath;
}

/** Add computed fragment */
export interface FragmentAddComputed {
  readonly kind: "addComputed";
  readonly name: string;
  readonly expr: ExprNode;
  readonly deps: readonly SemanticPath[];
}

/** Add type fragment */
export interface FragmentAddType {
  readonly kind: "addType";
  readonly name: string;
  readonly typeExpr: TypeExpr;
  readonly description?: string;
}

/** Set field type fragment */
export interface FragmentSetFieldType {
  readonly kind: "setFieldType";
  readonly path: SemanticPath;
  readonly typeExpr: TypeExpr;
  readonly migrateValue?: ExprNode;
}

/** All fragment change types */
export type FragmentChange =
  | FragmentPatch
  | FragmentConstraint
  | FragmentAddField
  | FragmentRemoveField
  | FragmentAddComputed
  | FragmentAddType
  | FragmentSetFieldType;

/** Fragment metadata */
export interface FragmentMetadata {
  /** Source of the fragment (e.g., "fast-path", "slm-proposal") */
  readonly source?: string;
  /** Confidence score (0.0 - 1.0) */
  readonly confidence?: number;
  /** Creation timestamp */
  readonly createdAt?: number;
}

/** Complete patch fragment with metadata */
export interface PatchFragment {
  /** Unique fragment identifier */
  readonly id: string;
  /** Human-readable description */
  readonly description: string;
  /** The list of changes */
  readonly changes: readonly FragmentChange[];
  /** Optional metadata */
  readonly metadata?: FragmentMetadata;
}
