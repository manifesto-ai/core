import type { LocalTargetKey } from "../annotations.js";
import type { Diagnostic } from "../diagnostics/types.js";
import { requiredOffset } from "./compile-fragment-source-utils.js";
import type { MelEditResult, MelTextEdit } from "./compile-fragment-types.js";

export type MaterializedEdit = {
  readonly edits: readonly MelTextEdit[];
  readonly changedTargets: readonly LocalTargetKey[];
  readonly diagnostics: readonly Diagnostic[];
};

export function validateThenEdit(diagnostics: readonly Diagnostic[], makeEdit: () => MaterializedEdit): MaterializedEdit {
  if (diagnostics.length > 0) {
    return { edits: [], changedTargets: [], diagnostics };
  }
  return makeEdit();
}

export function preMaterializationFailure(baseSource: string, diagnostics: readonly Diagnostic[]): MelEditResult {
  return {
    ok: false,
    newSource: baseSource,
    diagnostics,
    changedTargets: [],
    edits: [],
  };
}

export function materializationSuccess(edits: readonly MelTextEdit[], changedTargets: readonly LocalTargetKey[]): MaterializedEdit {
  return { edits: [...edits].sort((a, b) => requiredOffset(a.range.start) - requiredOffset(b.range.start)), changedTargets, diagnostics: [] };
}

export function materializationFailure(...diagnostics: Diagnostic[]): MaterializedEdit {
  return { edits: [], changedTargets: [], diagnostics };
}
