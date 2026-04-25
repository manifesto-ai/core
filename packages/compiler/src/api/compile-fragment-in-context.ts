import type { Diagnostic } from "../diagnostics/types.js";
import type { DomainModule, LocalTargetKey } from "../annotations.js";
import type { ProgramNode } from "../parser/index.js";
import { stableHashString } from "../source-map.js";
import { compileMelModule } from "./compile-mel.js";
import {
  applyTextEdits,
  describeUnknown,
  diffSchemas,
  findAction,
  findActionBodyBraces,
  findActionToken,
  findComputed,
  findStateField,
  findTypeField,
  indentLines,
  insertBeforeClosingLine,
  isEditObject,
  lineIndentAt,
  parseTypeFieldTarget,
  renderAction,
  renderBodyReplacement,
  renderJsonLiteral,
  requiredOffset,
  sortTargets,
  targetLocation,
  textEdit,
} from "./compile-fragment-source-utils.js";
import type {
  CompileFragmentInContextOptions,
  MelEditOp,
  MelEditReplaceActionBodyOp,
  MelEditReplaceComputedExprOp,
  MelEditReplaceStateDefaultOp,
  MelEditReplaceTypeFieldOp,
  MelEditResult,
  MelTextEdit,
  SchemaDiff,
} from "./compile-fragment-types.js";
import {
  diagnosticsOf,
  editError,
  parseProgram,
  targetNotFound,
  validateActionBodyFragment,
  validateExpressionFragment,
  validateIdentifierFragment,
  validateJsonLiteralFragment,
  validateParamsFragment,
  validateStateFieldFragment,
  validateTarget,
  validateTypeFragment,
} from "./compile-fragment-validation.js";

export type {
  CompileFragmentInContextOptions,
  MelEditAddActionOp,
  MelEditAddAvailableOp,
  MelEditAddComputedOp,
  MelEditAddDispatchableOp,
  MelEditAddStateFieldOp,
  MelEditAddTypeOp,
  MelEditOp,
  MelEditRemoveDeclarationOp,
  MelEditRenameDeclarationOp,
  MelEditReplaceActionBodyOp,
  MelEditReplaceAvailableOp,
  MelEditReplaceComputedExprOp,
  MelEditReplaceDispatchableOp,
  MelEditReplaceStateDefaultOp,
  MelEditReplaceTypeFieldOp,
  MelEditResult,
  MelParamSource,
  MelTextEdit,
  SchemaDiff,
  SchemaModifiedTarget,
} from "./compile-fragment-types.js";

type MaterializedEdit = {
  readonly edits: readonly MelTextEdit[];
  readonly changedTargets: readonly LocalTargetKey[];
  readonly diagnostics: readonly Diagnostic[];
};

export function compileFragmentInContext(
  baseSource: string,
  op: MelEditOp,
  options: CompileFragmentInContextOptions = {},
): MelEditResult {
  if (Array.isArray(op)) {
    return preMaterializationFailure(baseSource, [
      editError("E_FRAGMENT_SCOPE_VIOLATION", "compileFragmentInContext() accepts exactly one edit operation."),
    ]);
  }

  if (!isEditObject(op)) {
    return preMaterializationFailure(baseSource, [
      editError("E_FRAGMENT_SCOPE_VIOLATION", "compileFragmentInContext() requires one object edit operation."),
    ]);
  }

  if (options.baseModule && options.baseModule.sourceMap.sourceHash !== stableHashString(baseSource)) {
    return preMaterializationFailure(baseSource, [
      editError("E_STALE_MODULE", "baseModule.sourceMap.sourceHash does not match baseSource."),
    ]);
  }

  const baseCompile = compileMelModule(baseSource, { mode: "module" });
  const baseDiagnostics = diagnosticsOf(baseCompile);
  if (baseCompile.errors.length > 0 || !baseCompile.module) {
    return preMaterializationFailure(baseSource, baseDiagnostics);
  }

  const parsed = parseProgram(baseSource);
  if (!parsed.program) {
    return preMaterializationFailure(baseSource, parsed.diagnostics);
  }

  const materialized = materializeEdit(baseSource, parsed.program, baseCompile.module, op);
  if (materialized.diagnostics.length > 0 || materialized.edits.length === 0) {
    return preMaterializationFailure(baseSource, materialized.diagnostics);
  }

  const newSource = applyTextEdits(baseSource, materialized.edits);
  const editedCompile = compileMelModule(newSource, { mode: "module" });
  const diagnostics = diagnosticsOf(editedCompile);
  const ok = editedCompile.errors.length === 0;
  const result: {
    ok: boolean;
    newSource: string;
    diagnostics: readonly Diagnostic[];
    module?: DomainModule;
    changedTargets: readonly LocalTargetKey[];
    edits: readonly MelTextEdit[];
    schemaDiff?: SchemaDiff;
  } = {
    ok,
    newSource,
    diagnostics,
    changedTargets: sortTargets(materialized.changedTargets),
    edits: materialized.edits,
  };

  if (ok && options.includeModule && editedCompile.module) {
    result.module = editedCompile.module;
  }

  if (ok && options.includeSchemaDiff && editedCompile.module) {
    result.schemaDiff = diffSchemas(baseCompile.module.schema, editedCompile.module.schema);
  }

  return result;
}

function materializeEdit(
  source: string,
  program: ProgramNode,
  baseModule: DomainModule,
  op: MelEditOp,
): MaterializedEdit {
  switch (op.kind) {
    case "addType":
      return validateThenEdit([...validateIdentifierFragment(op.name, "type name"), ...validateTypeFragment(op.expr)], () =>
        insertTopLevel(source, program, `type ${op.name} = ${op.expr}`, [`type:${op.name}`]));

    case "addStateField": {
      const diagnostics = [
        ...validateIdentifierFragment(op.name, "state field name"),
        ...validateJsonLiteralFragment(op.defaultValue, "state default"),
      ];
      if (diagnostics.length > 0) {
        return materializationFailure(...diagnostics);
      }

      const defaultSource = renderJsonLiteral(op.defaultValue);
      return validateThenEdit(validateStateFieldFragment(op.type, defaultSource), () =>
        addStateField(source, program, `${op.name}: ${op.type} = ${defaultSource}`, `state_field:${op.name}`));
    }

    case "addComputed":
      return validateThenEdit([...validateIdentifierFragment(op.name, "computed name"), ...validateExpressionFragment(op.expr)], () =>
        insertTopLevel(source, program, `computed ${op.name} = ${op.expr}`, [`computed:${op.name}`]));

    case "addAction":
      return validateThenEdit(
        [
          ...validateIdentifierFragment(op.name, "action name"),
          ...validateParamsFragment(op.params),
          ...validateActionBodyFragment(op.body),
        ],
        () => insertTopLevel(source, program, renderAction(op), [`action:${op.name}`]),
      );

    case "addAvailable":
      return addGuard(source, program, baseModule, op.target, "available", op.expr);

    case "addDispatchable":
      return addGuard(source, program, baseModule, op.target, "dispatchable", op.expr);

    case "replaceActionBody":
      return replaceActionBody(source, program, baseModule, op);

    case "replaceComputedExpr":
      return replaceComputedExpr(source, program, baseModule, op);

    case "replaceAvailable":
      return replaceGuard(source, program, baseModule, op.target, "available", op.expr);

    case "replaceDispatchable":
      return replaceGuard(source, program, baseModule, op.target, "dispatchable", op.expr);

    case "replaceStateDefault":
      return replaceStateDefault(source, program, baseModule, op);

    case "replaceTypeField":
      return replaceTypeField(source, program, baseModule, op);

    case "removeDeclaration":
      return failUnsafeDeclarationEdit(source, program, baseModule, op.target, "remove");

    case "renameDeclaration":
      return validateThenEdit(validateIdentifierFragment(op.newName, "rename target name"), () =>
        failUnsafeDeclarationEdit(source, program, baseModule, op.target, "rename"));

    default:
      return materializationFailure(
        editError("E_FRAGMENT_SCOPE_VIOLATION", `Unknown source edit operation: ${describeUnknown(op)}`),
      );
  }
}

function addGuard(
  source: string,
  program: ProgramNode,
  baseModule: DomainModule,
  target: `action:${string}`,
  guard: "available" | "dispatchable",
  expr: string,
): MaterializedEdit {
  const targetDiagnostic = validateTarget(baseModule, target, ["action"]);
  if (targetDiagnostic) return materializationFailure(targetDiagnostic);
  const action = findAction(program, target.slice("action:".length));
  if (!action) return materializationFailure(targetNotFound(target));
  if ((guard === "available" && action.available) || (guard === "dispatchable" && action.dispatchable)) {
    return materializationFailure(editError("E_FRAGMENT_SCOPE_VIOLATION", `Action already has ${guard} guard.`, action.location));
  }

  return validateThenEdit(validateExpressionFragment(expr), () => {
    const braces = findActionBodyBraces(source, action);
    if (!braces) return materializationFailure(editError("E_TARGET_NOT_FOUND", "Action body range was not found.", action.location));
    const insertOffset = guard === "available" && action.dispatchable
      ? findActionToken(source, action, "DISPATCHABLE")?.location.start.offset ?? braces.open.location.start.offset
      : braces.open.location.start.offset;
    const edit = textEdit(source, insertOffset, insertOffset, ` ${guard} when ${expr} `);
    return materializationSuccess([edit], [target]);
  });
}

function replaceGuard(
  source: string,
  program: ProgramNode,
  baseModule: DomainModule,
  target: `action:${string}`,
  guard: "available" | "dispatchable",
  expr: string | null,
): MaterializedEdit {
  const targetDiagnostic = validateTarget(baseModule, target, ["action"]);
  if (targetDiagnostic) return materializationFailure(targetDiagnostic);
  const action = findAction(program, target.slice("action:".length));
  if (!action) return materializationFailure(targetNotFound(target));
  const existing = guard === "available" ? action.available : action.dispatchable;

  if (!existing) {
    if (expr === null) {
      return materializationFailure(editError("E_TARGET_NOT_FOUND", `Action does not have ${guard} guard.`, action.location));
    }
    return addGuard(source, program, baseModule, target, guard, expr);
  }

  if (expr === null) {
    const token = findActionToken(source, action, guard === "available" ? "AVAILABLE" : "DISPATCHABLE");
    if (!token) return materializationFailure(targetNotFound(target));
    return materializationSuccess(
      [textEdit(source, token.location.start.offset, existing.location.end.offset, "")],
      [target],
    );
  }

  return validateThenEdit(validateExpressionFragment(expr), () =>
    materializationSuccess(
      [textEdit(source, existing.location.start.offset, existing.location.end.offset, expr)],
      [target],
    ));
}

function replaceActionBody(
  source: string,
  program: ProgramNode,
  baseModule: DomainModule,
  op: MelEditReplaceActionBodyOp,
): MaterializedEdit {
  const targetDiagnostic = validateTarget(baseModule, op.target, ["action"]);
  if (targetDiagnostic) return materializationFailure(targetDiagnostic);
  const action = findAction(program, op.target.slice("action:".length));
  if (!action) return materializationFailure(targetNotFound(op.target));

  return validateThenEdit(validateActionBodyFragment(op.body), () => {
    const braces = findActionBodyBraces(source, action);
    if (!braces) return materializationFailure(targetNotFound(op.target));
    const actionIndent = lineIndentAt(source, action.location.start.offset);
    const body = renderBodyReplacement(op.body, `${actionIndent}  `, actionIndent);
    return materializationSuccess(
      [textEdit(source, braces.open.location.end.offset, braces.close.location.start.offset, body)],
      [op.target],
    );
  });
}

function replaceComputedExpr(
  source: string,
  program: ProgramNode,
  baseModule: DomainModule,
  op: MelEditReplaceComputedExprOp,
): MaterializedEdit {
  const targetDiagnostic = validateTarget(baseModule, op.target, ["computed"]);
  if (targetDiagnostic) return materializationFailure(targetDiagnostic);
  const computed = findComputed(program, op.target.slice("computed:".length));
  if (!computed) return materializationFailure(targetNotFound(op.target));

  return validateThenEdit(validateExpressionFragment(op.expr), () =>
    materializationSuccess(
      [textEdit(source, computed.expression.location.start.offset, computed.expression.location.end.offset, op.expr)],
      [op.target],
    ));
}

function replaceStateDefault(
  source: string,
  program: ProgramNode,
  baseModule: DomainModule,
  op: MelEditReplaceStateDefaultOp,
): MaterializedEdit {
  const targetDiagnostic = validateTarget(baseModule, op.target, ["state_field"]);
  if (targetDiagnostic) return materializationFailure(targetDiagnostic);
  const field = findStateField(program, op.target.slice("state_field:".length));
  if (!field) return materializationFailure(targetNotFound(op.target));

  const jsonDiagnostics = validateJsonLiteralFragment(op.value, "state default");
  if (jsonDiagnostics.length > 0) {
    return materializationFailure(...jsonDiagnostics);
  }

  const replacement = renderJsonLiteral(op.value);
  return validateThenEdit(validateExpressionFragment(replacement), () => {
    const start = field.initializer?.location.start.offset ?? field.typeExpr.location.end.offset;
    const end = field.initializer?.location.end.offset ?? field.typeExpr.location.end.offset;
    const text = field.initializer ? replacement : ` = ${replacement}`;
    return materializationSuccess([textEdit(source, start, end, text)], [op.target]);
  });
}

function replaceTypeField(
  source: string,
  program: ProgramNode,
  baseModule: DomainModule,
  op: MelEditReplaceTypeFieldOp,
): MaterializedEdit {
  const targetDiagnostic = validateTarget(baseModule, op.target, ["type_field"]);
  if (targetDiagnostic) return materializationFailure(targetDiagnostic);
  const parsed = parseTypeFieldTarget(op.target);
  const field = parsed ? findTypeField(program, parsed.typeName, parsed.fieldName) : null;
  if (!field) return materializationFailure(targetNotFound(op.target));

  return validateThenEdit(validateTypeFragment(op.type), () =>
    materializationSuccess(
      [textEdit(source, field.typeExpr.location.start.offset, field.typeExpr.location.end.offset, op.type)],
      [op.target],
    ));
}

function failUnsafeDeclarationEdit(
  source: string,
  program: ProgramNode,
  baseModule: DomainModule,
  target: LocalTargetKey,
  kind: "remove" | "rename",
): MaterializedEdit {
  const targetDiagnostic = validateTarget(baseModule, target, ["type", "type_field", "state_field", "computed", "action"]);
  if (targetDiagnostic) return materializationFailure(targetDiagnostic);
  const diagnosticCode = kind === "remove" ? "E_REMOVE_BLOCKED_BY_REFERENCES" : "E_UNSAFE_RENAME_AMBIGUOUS";
  const message = kind === "remove"
    ? "removeDeclaration is blocked until reference safety can be proven."
    : "renameDeclaration is blocked until reference rewriting can be proven unambiguous.";
  return materializationFailure(editError(diagnosticCode, message, targetLocation(program, target)));
}

function insertTopLevel(
  source: string,
  program: ProgramNode,
  fragment: string,
  changedTargets: readonly LocalTargetKey[],
): MaterializedEdit {
  const closeOffset = program.domain.location.end.offset - 1;
  const closeIndent = lineIndentAt(source, closeOffset);
  const memberIndent = `${closeIndent}  `;
  const replacement = indentLines(fragment, memberIndent);
  return materializationSuccess([insertBeforeClosingLine(source, closeOffset, replacement)], changedTargets);
}

function addStateField(
  source: string,
  program: ProgramNode,
  fieldSource: string,
  target: LocalTargetKey,
): MaterializedEdit {
  const state = program.domain.members.find((member) => member.kind === "state");
  if (!state || state.kind !== "state") {
    return insertTopLevel(source, program, `state {\n  ${fieldSource}\n}`, [target]);
  }

  const closeOffset = state.location.end.offset - 1;
  const closeIndent = lineIndentAt(source, closeOffset);
  const fieldIndent = `${closeIndent}  `;
  return materializationSuccess(
    [insertBeforeClosingLine(source, closeOffset, `${fieldIndent}${fieldSource}`)],
    [target],
  );
}

function validateThenEdit(diagnostics: readonly Diagnostic[], makeEdit: () => MaterializedEdit): MaterializedEdit {
  if (diagnostics.length > 0) {
    return { edits: [], changedTargets: [], diagnostics };
  }
  return makeEdit();
}

function preMaterializationFailure(baseSource: string, diagnostics: readonly Diagnostic[]): MelEditResult {
  return {
    ok: false,
    newSource: baseSource,
    diagnostics,
    changedTargets: [],
    edits: [],
  };
}

function materializationSuccess(edits: readonly MelTextEdit[], changedTargets: readonly LocalTargetKey[]): MaterializedEdit {
  return { edits: [...edits].sort((a, b) => requiredOffset(a.range.start) - requiredOffset(b.range.start)), changedTargets, diagnostics: [] };
}

function materializationFailure(...diagnostics: Diagnostic[]): MaterializedEdit {
  return { edits: [], changedTargets: [], diagnostics };
}
