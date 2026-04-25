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
  lineIndentAt,
  parseTypeFieldTarget,
  renderAction,
  renderBodyReplacement,
  renderJsonLiteral,
  sortTargets,
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
  readEditOperationKind,
  snapshotParamsFragment,
  targetNotFound,
  validateActionBodyFragment,
  validateExpressionFragment,
  validateIdentifierFragment,
  validateStateFieldFragment,
  validateTarget,
  validateTypeFragment,
} from "./compile-fragment-validation.js";
import { snapshotJsonLiteralFragment } from "./compile-fragment-json-validation.js";
import {
  planRemoveDeclaration,
  planRenameDeclaration,
} from "./compile-fragment-reference-utils.js";
import { snapshotCompileFragmentOptions } from "./compile-fragment-options-validation.js";
import {
  type MaterializedEdit,
  materializationFailure,
  materializationSuccess,
  preMaterializationFailure,
  validateThenEdit,
} from "./compile-fragment-edit-result.js";

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

export function compileFragmentInContext(
  baseSource: string,
  op: MelEditOp,
  options: CompileFragmentInContextOptions = {},
): MelEditResult {
  const optionsSnapshot = snapshotCompileFragmentOptions(options);
  if (!optionsSnapshot.ok) {
    return preMaterializationFailure(baseSource, [
      optionsSnapshot.diagnostic,
    ]);
  }

  const opKind = readEditOperationKind(op);
  if (!opKind.ok) {
    return preMaterializationFailure(baseSource, [
      opKind.diagnostic,
    ]);
  }

  if (optionsSnapshot.value.baseModuleSourceHash !== null && optionsSnapshot.value.baseModuleSourceHash !== stableHashString(baseSource)) {
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

  let materialized: MaterializedEdit;
  try {
    materialized = materializeEdit(baseSource, parsed.program, baseCompile.module, op, opKind.value);
  } catch {
    return preMaterializationFailure(baseSource, [
      editError("E_FRAGMENT_SCOPE_VIOLATION", "Source edit operation must be inspectable."),
    ]);
  }
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

  if (ok && optionsSnapshot.value.includeModule && editedCompile.module) {
    result.module = editedCompile.module;
  }

  if (ok && optionsSnapshot.value.includeSchemaDiff && editedCompile.module) {
    result.schemaDiff = diffSchemas(baseCompile.module.schema, editedCompile.module.schema);
  }

  return result;
}

function materializeEdit(
  source: string,
  program: ProgramNode,
  baseModule: DomainModule,
  op: MelEditOp,
  kind: string,
): MaterializedEdit {
  switch (kind) {
    case "addType": {
      const typed = op as Extract<MelEditOp, { readonly kind: "addType" }>;
      const { name, expr } = typed;
      return validateThenEdit([...validateIdentifierFragment(name, "type name"), ...validateTypeFragment(expr)], () =>
        insertTopLevel(source, program, `type ${name} = ${expr}`, [`type:${name}`]));
    }

    case "addStateField": {
      const typed = op as Extract<MelEditOp, { readonly kind: "addStateField" }>;
      const { name, type, defaultValue } = typed;
      const defaultSnapshot = snapshotJsonLiteralFragment(defaultValue, "state default");
      const diagnostics = [
        ...validateIdentifierFragment(name, "state field name"),
        ...defaultSnapshot.diagnostics,
      ];
      if (diagnostics.length > 0 || !defaultSnapshot.ok) {
        return materializationFailure(...diagnostics);
      }

      const defaultSource = renderJsonLiteral(defaultSnapshot.value);
      return validateThenEdit(validateStateFieldFragment(type, defaultSource), () =>
        addStateField(source, program, `${name}: ${type} = ${defaultSource}`, `state_field:${name}`));
    }

    case "addComputed": {
      const typed = op as Extract<MelEditOp, { readonly kind: "addComputed" }>;
      const { name, expr } = typed;
      return validateThenEdit([...validateIdentifierFragment(name, "computed name"), ...validateExpressionFragment(expr)], () =>
        insertTopLevel(source, program, `computed ${name} = ${expr}`, [`computed:${name}`]));
    }

    case "addAction": {
      const typed = op as Extract<MelEditOp, { readonly kind: "addAction" }>;
      const { name, params, body } = typed;
      const paramsSnapshot = snapshotParamsFragment(params);
      return validateThenEdit(
        [
          ...validateIdentifierFragment(name, "action name"),
          ...paramsSnapshot.diagnostics,
          ...validateActionBodyFragment(body),
        ],
        () => {
          if (typeof name !== "string" || typeof body !== "string" || !paramsSnapshot.ok) {
            return materializationFailure(editError("E_FRAGMENT_SCOPE_VIOLATION", "Source edit operation must be inspectable."));
          }
          return insertTopLevel(
            source,
            program,
            renderAction({ kind: "addAction", name, params: paramsSnapshot.value, body }),
            [`action:${name}`],
          );
        },
      );
    }

    case "addAvailable": {
      const typed = op as Extract<MelEditOp, { readonly kind: "addAvailable" }>;
      return addGuard(source, program, baseModule, typed.target, "available", typed.expr);
    }

    case "addDispatchable": {
      const typed = op as Extract<MelEditOp, { readonly kind: "addDispatchable" }>;
      return addGuard(source, program, baseModule, typed.target, "dispatchable", typed.expr);
    }

    case "replaceActionBody":
      return replaceActionBody(source, program, baseModule, op as Extract<MelEditOp, { readonly kind: "replaceActionBody" }>);

    case "replaceComputedExpr":
      return replaceComputedExpr(source, program, baseModule, op as Extract<MelEditOp, { readonly kind: "replaceComputedExpr" }>);

    case "replaceAvailable": {
      const typed = op as Extract<MelEditOp, { readonly kind: "replaceAvailable" }>;
      return replaceGuard(source, program, baseModule, typed.target, "available", typed.expr);
    }

    case "replaceDispatchable": {
      const typed = op as Extract<MelEditOp, { readonly kind: "replaceDispatchable" }>;
      return replaceGuard(source, program, baseModule, typed.target, "dispatchable", typed.expr);
    }

    case "replaceStateDefault":
      return replaceStateDefault(source, program, baseModule, op as Extract<MelEditOp, { readonly kind: "replaceStateDefault" }>);

    case "replaceTypeField":
      return replaceTypeField(source, program, baseModule, op as Extract<MelEditOp, { readonly kind: "replaceTypeField" }>);

    case "removeDeclaration":
      return removeDeclaration(source, program, baseModule, (op as Extract<MelEditOp, { readonly kind: "removeDeclaration" }>).target);

    case "renameDeclaration": {
      const typed = op as Extract<MelEditOp, { readonly kind: "renameDeclaration" }>;
      const { target, newName } = typed;
      return validateThenEdit(validateIdentifierFragment(newName, "rename target name"), () =>
        renameDeclaration(source, program, baseModule, target, newName));
    }

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
  const { target, body } = op;
  const targetDiagnostic = validateTarget(baseModule, target, ["action"]);
  if (targetDiagnostic) return materializationFailure(targetDiagnostic);
  const action = findAction(program, target.slice("action:".length));
  if (!action) return materializationFailure(targetNotFound(target));

  return validateThenEdit(validateActionBodyFragment(body), () => {
    const braces = findActionBodyBraces(source, action);
    if (!braces) return materializationFailure(targetNotFound(target));
    const actionIndent = lineIndentAt(source, action.location.start.offset);
    const replacement = renderBodyReplacement(body, `${actionIndent}  `, actionIndent);
    return materializationSuccess(
      [textEdit(source, braces.open.location.end.offset, braces.close.location.start.offset, replacement)],
      [target],
    );
  });
}

function replaceComputedExpr(
  source: string,
  program: ProgramNode,
  baseModule: DomainModule,
  op: MelEditReplaceComputedExprOp,
): MaterializedEdit {
  const { target, expr } = op;
  const targetDiagnostic = validateTarget(baseModule, target, ["computed"]);
  if (targetDiagnostic) return materializationFailure(targetDiagnostic);
  const computed = findComputed(program, target.slice("computed:".length));
  if (!computed) return materializationFailure(targetNotFound(target));

  return validateThenEdit(validateExpressionFragment(expr), () =>
    materializationSuccess(
      [textEdit(source, computed.expression.location.start.offset, computed.expression.location.end.offset, expr)],
      [target],
    ));
}

function replaceStateDefault(
  source: string,
  program: ProgramNode,
  baseModule: DomainModule,
  op: MelEditReplaceStateDefaultOp,
): MaterializedEdit {
  const { target, value } = op;
  const targetDiagnostic = validateTarget(baseModule, target, ["state_field"]);
  if (targetDiagnostic) return materializationFailure(targetDiagnostic);
  const field = findStateField(program, target.slice("state_field:".length));
  if (!field) return materializationFailure(targetNotFound(target));

  const valueSnapshot = snapshotJsonLiteralFragment(value, "state default");
  if (valueSnapshot.diagnostics.length > 0 || !valueSnapshot.ok) {
    return materializationFailure(...valueSnapshot.diagnostics);
  }

  const replacement = renderJsonLiteral(valueSnapshot.value);
  return validateThenEdit(validateExpressionFragment(replacement), () => {
    const start = field.initializer?.location.start.offset ?? field.typeExpr.location.end.offset;
    const end = field.initializer?.location.end.offset ?? field.typeExpr.location.end.offset;
    const text = field.initializer ? replacement : ` = ${replacement}`;
    return materializationSuccess([textEdit(source, start, end, text)], [target]);
  });
}

function replaceTypeField(
  source: string,
  program: ProgramNode,
  baseModule: DomainModule,
  op: MelEditReplaceTypeFieldOp,
): MaterializedEdit {
  const { target, type } = op;
  const targetDiagnostic = validateTarget(baseModule, target, ["type_field"]);
  if (targetDiagnostic) return materializationFailure(targetDiagnostic);
  const parsed = parseTypeFieldTarget(target);
  const field = parsed ? findTypeField(program, parsed.typeName, parsed.fieldName) : null;
  if (!parsed || !field) return materializationFailure(targetNotFound(target));

  return validateThenEdit(validateTypeFragment(type), () =>
    materializationSuccess(
      [textEdit(source, field.typeExpr.location.start.offset, field.typeExpr.location.end.offset, type)],
      [`type:${parsed.typeName}`, target],
    ));
}

function removeDeclaration(
  source: string,
  program: ProgramNode,
  baseModule: DomainModule,
  target: LocalTargetKey,
): MaterializedEdit {
  const targetDiagnostic = validateTarget(baseModule, target, ["type", "type_field", "state_field", "computed", "action"]);
  if (targetDiagnostic) return materializationFailure(targetDiagnostic);
  const plan = planRemoveDeclaration(source, program, target);
  if (!plan.ok) {
    return materializationFailure(editError(plan.code, plan.message, plan.location));
  }
  return materializationSuccess(plan.edits, plan.changedTargets);
}

function renameDeclaration(
  source: string,
  program: ProgramNode,
  baseModule: DomainModule,
  target: LocalTargetKey,
  newName: string,
): MaterializedEdit {
  const targetDiagnostic = validateTarget(baseModule, target, ["type", "type_field", "state_field", "computed", "action"]);
  if (targetDiagnostic) return materializationFailure(targetDiagnostic);
  const plan = planRenameDeclaration(source, program, target, newName);
  if (!plan.ok) {
    return materializationFailure(editError(plan.code, plan.message, plan.location));
  }
  return materializationSuccess(plan.edits, plan.changedTargets);
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
