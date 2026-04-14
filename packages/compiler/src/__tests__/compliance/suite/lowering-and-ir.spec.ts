import { describe, it } from "vitest";
import type {
  CanonicalDomainSchema,
  CoreExprNode,
  CoreFlowNode,
  DomainSchema,
} from "../../../generator/ir.js";
import { createEvaluationContext, evaluateExpr } from "../../../index.js";
import type { MelExprNode } from "../../../lowering/lower-expr.js";
import { createCompilerComplianceAdapter } from "../ccts-adapter.js";
import {
  diagnosticEvidence,
  evaluateRule,
  expectAllCompliance,
  hasDiagnosticCode,
  noteEvidence,
} from "../ccts-assertions.js";
import { CCTS_CASES, caseTitle } from "../ccts-coverage.js";
import { getRuleOrThrow } from "../ccts-rules.js";

const adapter = createCompilerComplianceAdapter();
const CANONICAL_EXPR_KINDS = new Set(["lit", "var", "sys", "get", "field", "call", "obj", "arr"]);
const FORBIDDEN_EXPR_MARKERS = new Set(["seq", "effect", "patch", "halt", "fail"]);

function collectEffectTypes(flow: CoreFlowNode | undefined, types: string[] = []): string[] {
  if (!flow) {
    return types;
  }

  switch (flow.kind) {
    case "seq":
      for (const step of flow.steps) {
        collectEffectTypes(step, types);
      }
      break;
    case "if":
      collectEffectTypes(flow.then, types);
      if (flow.else) {
        collectEffectTypes(flow.else, types);
      }
      break;
    case "effect":
      types.push(flow.type);
      break;
  }

  return types;
}

function walkCanonicalExpr(expr: MelExprNode | undefined, visit: (expr: MelExprNode) => void): void {
  if (!expr) {
    return;
  }

  visit(expr);

  switch (expr.kind) {
    case "get":
      if (expr.base) {
        walkCanonicalExpr(expr.base, visit);
      }
      return;
    case "field":
      walkCanonicalExpr(expr.object, visit);
      return;
    case "call":
      expr.args.forEach((arg) => walkCanonicalExpr(arg, visit));
      return;
    case "obj":
      expr.fields.forEach((field) => walkCanonicalExpr(field.value, visit));
      return;
    case "arr":
      expr.elements.forEach((element) => walkCanonicalExpr(element, visit));
      return;
    case "lit":
    case "var":
    case "sys":
      return;
  }
}

function walkRuntimeExpr(expr: CoreExprNode | undefined, visit: (expr: CoreExprNode) => void): void {
  if (!expr) {
    return;
  }

  visit(expr);

  switch (expr.kind) {
    case "lit":
    case "get":
      return;
    case "eq":
    case "neq":
    case "gt":
    case "gte":
    case "lt":
    case "lte":
    case "add":
    case "sub":
    case "mul":
    case "div":
    case "mod":
      walkRuntimeExpr(expr.left, visit);
      walkRuntimeExpr(expr.right, visit);
      return;
    case "not":
    case "neg":
    case "abs":
    case "floor":
    case "ceil":
    case "round":
    case "sqrt":
    case "trim":
    case "toLowerCase":
    case "toUpperCase":
    case "strLen":
    case "len":
    case "first":
    case "last":
    case "typeof":
    case "isNull":
    case "toString":
      walkRuntimeExpr(expr.arg ?? expr.str ?? expr.array, visit);
      return;
    case "if":
      walkRuntimeExpr(expr.cond, visit);
      walkRuntimeExpr(expr.then, visit);
      walkRuntimeExpr(expr.else, visit);
      return;
    case "and":
    case "or":
    case "concat":
    case "min":
    case "max":
    case "coalesce":
      expr.args.forEach((arg) => walkRuntimeExpr(arg, visit));
      return;
    case "substring":
      walkRuntimeExpr(expr.str, visit);
      walkRuntimeExpr(expr.start, visit);
      if (expr.end) {
        walkRuntimeExpr(expr.end, visit);
      }
      return;
    case "at":
      walkRuntimeExpr(expr.array, visit);
      walkRuntimeExpr(expr.index, visit);
      return;
    case "slice":
      walkRuntimeExpr(expr.array, visit);
      walkRuntimeExpr(expr.start, visit);
      if (expr.end) {
        walkRuntimeExpr(expr.end, visit);
      }
      return;
    case "includes":
      walkRuntimeExpr(expr.array, visit);
      walkRuntimeExpr(expr.item, visit);
      return;
    case "filter":
    case "map":
    case "find":
    case "every":
    case "some":
      walkRuntimeExpr(expr.array, visit);
      walkRuntimeExpr(expr.predicate ?? expr.mapper, visit);
      return;
    case "append":
      walkRuntimeExpr(expr.array, visit);
      expr.items.forEach((item) => walkRuntimeExpr(item, visit));
      return;
    case "object":
      Object.values(expr.fields).forEach((field) => walkRuntimeExpr(field, visit));
      return;
    case "field":
      walkRuntimeExpr(expr.object, visit);
      return;
    case "keys":
    case "values":
    case "entries":
      walkRuntimeExpr(expr.obj, visit);
      return;
    case "merge":
      expr.objects.forEach((objectExpr) => walkRuntimeExpr(objectExpr, visit));
      return;
    case "pow":
      walkRuntimeExpr(expr.base, visit);
      walkRuntimeExpr(expr.exponent, visit);
      return;
    case "sumArray":
    case "minArray":
    case "maxArray":
      walkRuntimeExpr(expr.array, visit);
      return;
  }
}

function collectCanonicalExprs(schema: CanonicalDomainSchema | null): MelExprNode[] {
  if (!schema) {
    return [];
  }

  const exprs: MelExprNode[] = [];
  for (const field of Object.values(schema.computed.fields)) {
    walkCanonicalExpr(field.expr, (expr) => exprs.push(expr));
  }
  for (const action of Object.values(schema.actions)) {
    if (action.available) {
      walkCanonicalExpr(action.available, (expr) => exprs.push(expr));
    }
    collectCanonicalFlowExprs(action.flow, exprs);
  }
  return exprs;
}

function collectCanonicalFlowExprs(flow: CanonicalDomainSchema["actions"][string]["flow"], exprs: MelExprNode[]): void {
  switch (flow.kind) {
    case "seq":
      flow.steps.forEach((step) => collectCanonicalFlowExprs(step, exprs));
      return;
    case "if":
      walkCanonicalExpr(flow.cond, (expr) => exprs.push(expr));
      collectCanonicalFlowExprs(flow.then, exprs);
      if (flow.else) {
        collectCanonicalFlowExprs(flow.else, exprs);
      }
      return;
    case "patch":
      if (flow.value) {
        walkCanonicalExpr(flow.value, (expr) => exprs.push(expr));
      }
      return;
    case "effect":
      Object.values(flow.params).forEach((value) => walkCanonicalExpr(value, (expr) => exprs.push(expr)));
      return;
    case "fail":
      if (flow.message) {
        walkCanonicalExpr(flow.message, (expr) => exprs.push(expr));
      }
      return;
    case "call":
    case "halt":
      return;
  }
}

function collectRuntimeExprs(schema: DomainSchema | null): CoreExprNode[] {
  if (!schema) {
    return [];
  }

  const exprs: CoreExprNode[] = [];
  for (const field of Object.values(schema.computed.fields)) {
    walkRuntimeExpr(field.expr, (expr) => exprs.push(expr));
  }
  for (const action of Object.values(schema.actions)) {
    if (action.available) {
      walkRuntimeExpr(action.available, (expr) => exprs.push(expr));
    }
    collectRuntimeFlowExprs(action.flow, exprs);
  }
  return exprs;
}

function collectRuntimeFlowExprs(flow: CoreFlowNode, exprs: CoreExprNode[]): void {
  switch (flow.kind) {
    case "seq":
      flow.steps.forEach((step) => collectRuntimeFlowExprs(step, exprs));
      return;
    case "if":
      walkRuntimeExpr(flow.cond, (expr) => exprs.push(expr));
      collectRuntimeFlowExprs(flow.then, exprs);
      if (flow.else) {
        collectRuntimeFlowExprs(flow.else, exprs);
      }
      return;
    case "patch":
      if (flow.value) {
        walkRuntimeExpr(flow.value, (expr) => exprs.push(expr));
      }
      return;
    case "effect":
      Object.values(flow.params).forEach((value) => walkRuntimeExpr(value, (expr) => exprs.push(expr)));
      return;
    case "fail":
      if (flow.message) {
        walkRuntimeExpr(flow.message, (expr) => exprs.push(expr));
      }
      return;
    case "call":
    case "halt":
      return;
  }
}

function canonicalRoot(expr: MelExprNode): string | null {
  switch (expr.kind) {
    case "get":
      if (expr.base?.kind === "var" && expr.base.name === "item") {
        return "$item";
      }
      return expr.base ? null : "snapshot";
    case "sys":
      return expr.path[0] ?? null;
    case "var":
      return "$item";
    default:
      return null;
  }
}

function runtimeRoot(expr: CoreExprNode): string | null {
  if (expr.kind !== "get") {
    return null;
  }
  if (expr.path.startsWith("meta.")) {
    return "meta";
  }
  if (expr.path.startsWith("input.")) {
    return "input";
  }
  if (expr.path === "$item" || expr.path.startsWith("$item.")) {
    return "$item";
  }
  if (expr.path.startsWith("$system.")) {
    return "$system";
  }
  return "snapshot";
}

function createRecordingObject(
  entries: ReadonlyArray<readonly [string, unknown]>,
  accessLog: string[]
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    Object.defineProperty(obj, key, {
      enumerable: true,
      configurable: true,
      get() {
        accessLog.push(key);
        return value;
      },
    });
  }
  return obj;
}

describe("CCTS Lowering and IR Suite", () => {
  it(caseTitle(CCTS_CASES.IR_CALL_ONLY, "(A13) canonical operations normalize to call nodes"), () => {
    const result = adapter.canonical(`
      domain Demo {
        state {
          a: number = 1
          b: number = 2
        }
        computed total = add(a, b)
      }
    `);

    const expr = result.value?.computed.fields["total"]?.expr as
      | { kind?: string; fn?: string; args?: unknown[] }
      | undefined;

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A13"), result.success && expr?.kind === "call" && expr?.fn === "add", {
        passMessage: "Canonical operations lower to call(fn, args) nodes.",
        failMessage: "Canonical generation still exposes specialized runtime node kinds.",
        evidence: [noteEvidence("Observed canonical expression", expr)],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.IR_INDEX_AND_NEQ, "(A11/A12/A19) canonical access shape and neq semantics stay normalized"), () => {
    const canonical = adapter.canonical(`
      domain Demo {
        state {
          records: Array<{ status: string }> = []
          count: number = 1
          items: Array<number> = [1]
          user: { name: string } = { name: "Ada" }
        }
        computed firstItem = items[0]
        computed status = at(records, 0).status
        computed userName = user.name
      }
    `);

    const indexExpr = canonical.value?.computed.fields["firstItem"]?.expr as
      | { kind?: string; fn?: string; args?: unknown[] }
      | undefined;
    const statusExpr = canonical.value?.computed.fields["status"]?.expr as
      | { kind?: string; fn?: string; object?: unknown; property?: string }
      | undefined;
    const userExpr = canonical.value?.computed.fields["userName"]?.expr as
      | { kind?: string; path?: Array<{ kind: string; name: string }> }
      | undefined;
    const ctx = createEvaluationContext({ meta: { intentId: "i1" } });
    const neqResult = evaluateExpr(
      { kind: "neq", left: { kind: "lit", value: 1 }, right: { kind: "lit", value: 2 } },
      ctx
    );
    const notEqResult = evaluateExpr(
      {
        kind: "not",
        arg: {
          kind: "eq",
          left: { kind: "lit", value: 1 },
          right: { kind: "lit", value: 2 },
        },
      },
      ctx
    );

    expectAllCompliance([
      evaluateRule(
        getRuleOrThrow("A12"),
        canonical.success &&
          indexExpr?.kind === "call" &&
          indexExpr.fn === "at" &&
          statusExpr?.kind === "field" &&
          statusExpr.property === "status" &&
          userExpr?.kind === "get" &&
          userExpr.path?.map((segment) => segment.name).join(".") === "user.name",
        {
          passMessage: "Canonical generation assigns one stable IR shape per surface construct.",
          failMessage: "Canonical generation still emits divergent IR shapes for equivalent surface constructs.",
          evidence: [
            noteEvidence("Observed index expression", indexExpr),
            noteEvidence("Observed status expression", statusExpr),
            noteEvidence("Observed user path expression", userExpr),
          ],
        }
      ),
      evaluateRule(getRuleOrThrow("A19"), canonical.success && indexExpr?.kind === "call" && indexExpr.fn === "at", {
        passMessage: "Index syntax lowers through call(\"at\", ...).",
        failMessage: "Index syntax did not canonicalize through at().",
        evidence: [noteEvidence("Observed canonical index expression", indexExpr)],
      }),
      evaluateRule(getRuleOrThrow("A11"), neqResult === notEqResult, {
        passMessage: "neq(a, b) remains semantically equivalent to not(eq(a, b)).",
        failMessage: "neq(a, b) is no longer semantically equivalent to not(eq(a, b)).",
        evidence: [
          noteEvidence("Observed neq result", neqResult),
          noteEvidence("Observed not(eq) result", notEqResult),
        ],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.IR_SYSTEM_LOWERING, "(A20..A24/A27/A34) compiler-owned system lowering inserts explicit effects"), () => {
    const source = `
      domain Demo {
        state {
          id: string = ""
          otherId: string = ""
        }
        action create() {
          when true {
            patch id = $system.uuid
            patch otherId = $system.uuid
          }
        }
      }
    `;
    const compiled = adapter.compile(source);
    const lowered = adapter.lower(source);

    const compiledRendered = JSON.stringify(compiled.value);
    const loweredRendered = JSON.stringify(lowered.value);
    const flow = lowered.value?.actions["create"]?.flow as CoreFlowNode | undefined;
    const effectTypes = collectEffectTypes(flow);
    const melField = lowered.value?.state.fields["$mel"];
    const slotFields = melField?.type === "object"
      ? Object.keys(
          melField.fields?.["sys"]?.fields?.["create"]?.fields?.["uuid"]?.fields ?? {}
        )
      : [];
    const guardedFlow = flow?.kind === "seq"
      ? flow.steps[flow.steps.length - 1]
      : undefined;
    const readinessSatisfied =
      guardedFlow?.kind === "if" &&
      guardedFlow.cond.kind === "eq" &&
      guardedFlow.cond.left.kind === "get" &&
      guardedFlow.cond.left.path === "$mel.sys.create.uuid.intent" &&
      guardedFlow.cond.right.kind === "get" &&
      guardedFlow.cond.right.path === "meta.intentId";

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A20"), lowered.success && effectTypes.includes("system.get"), {
        passMessage: "System values lower into Host-executed system.get effects.",
        failMessage: "System values did not lower into explicit system.get effects.",
        evidence: [noteEvidence("Observed effect types", effectTypes)],
      }),
      evaluateRule(getRuleOrThrow("A21"), lowered.success && effectTypes.length > 0 && effectTypes.every((type) => type === "system.get"), {
        passMessage: "Lowering uses only the system.get effect.",
        failMessage: "Lowering emitted non-system.get effects for system values.",
        evidence: [noteEvidence("Observed effect types", effectTypes)],
      }),
      evaluateRule(getRuleOrThrow("A22"), compiled.success && compiledRendered.includes("$system.uuid") && lowered.success && loweredRendered.includes("system.get"), {
        passMessage: "Compiler inserts system effects at lowering time.",
        failMessage: "Compiler did not insert system effects across the lowering boundary.",
        evidence: [
          noteEvidence("Compiled schema excerpt", compiledRendered.slice(0, 320)),
          noteEvidence("Lowered schema excerpt", loweredRendered.slice(0, 320)),
        ],
      }),
      evaluateRule(getRuleOrThrow("A23"), lowered.success && slotFields.length === 2, {
        passMessage: "Repeated $system.uuid use in one action deduplicates to one slot pair.",
        failMessage: "Repeated $system.uuid use in one action no longer deduplicates to one slot pair.",
        evidence: [noteEvidence("Observed slot fields", slotFields)],
      }),
      evaluateRule(getRuleOrThrow("A24"), readinessSatisfied, {
        passMessage: "Replay/readiness is expressed through intent slots in the lowered schema.",
        failMessage: "Replay/readiness is no longer expressed through intent slots in the lowered schema.",
        evidence: [noteEvidence("Observed lowered flow", flow)],
      }),
      evaluateRule(getRuleOrThrow("A27"), readinessSatisfied, {
        passMessage: "Readiness uses eq(intent_marker, $meta.intentId).",
        failMessage: "Readiness no longer uses eq(intent_marker, $meta.intentId).",
        evidence: [noteEvidence("Observed lowered flow", flow)],
      }),
      evaluateRule(getRuleOrThrow("A34"), lowered.success && !loweredRendered.includes("$system.uuid"), {
        passMessage: "Compiler remains the single MEL -> Core lowering boundary for system values.",
        failMessage: "System values survived past the compiler lowering boundary.",
        evidence: [noteEvidence("Lowered schema excerpt", loweredRendered.slice(0, 320))],
      }),
      evaluateRule(getRuleOrThrow("AD-COMP-LOW-001"), compiled.success && compiledRendered.includes("$system.uuid") && lowered.success && !loweredRendered.includes("$system.uuid"), {
        passMessage: "Compiler owns the lowering boundary from MEL Canonical IR to lowered runtime IR.",
        failMessage: "Lowering boundary ownership is no longer isolated to the compiler.",
        evidence: [
          noteEvidence("Compiled schema excerpt", compiledRendered.slice(0, 320)),
          noteEvidence("Lowered schema excerpt", loweredRendered.slice(0, 320)),
        ],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.IR_PLATFORM_NAMESPACE, "(A26, COMPILER-MEL-4, SCHEMA-RESERVED-1) platform namespace alignment stays tracked"), () => {
    const lowered = adapter.lower(`
      domain Demo {
        state { id: string = "" }
        action create() {
          when true {
            patch id = $system.uuid
          }
        }
      }
    `);

    const rendered = JSON.stringify(lowered.value);

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A26"), lowered.success && rendered.includes("$mel.sys"), {
        passMessage: "Lowered system slots live under $mel.sys.",
        failMessage: "Lowered system slots still use a legacy namespace.",
        evidence: [noteEvidence("Observed lowered schema excerpt", rendered.slice(0, 320))],
      }),
      evaluateRule(getRuleOrThrow("COMPILER-MEL-4"), lowered.success && rendered.includes("$mel.sys") && rendered.includes("\"op\":\"set\""), {
        passMessage: "System value patch bookkeeping uses leaf-level writes under $mel.sys.",
        failMessage: "System value patch bookkeeping is not yet aligned with $mel.sys leaf writes.",
        evidence: [noteEvidence("Observed lowered schema excerpt", rendered.slice(0, 320))],
      }),
      evaluateRule(getRuleOrThrow("SCHEMA-RESERVED-1"), lowered.success && rendered.includes("$mel"), {
        passMessage: "Compiler-owned schema state is isolated under the reserved $mel namespace.",
        failMessage: "Compiler-owned schema state is not yet isolated under the reserved $mel namespace.",
        evidence: [noteEvidence("Observed lowered schema excerpt", rendered.slice(0, 320))],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.IR_EXPR_CLOSURE, "(A1) expression trees remain finite and flow-free"), () => {
    const source = `
      domain Demo {
        state {
          count: number = 1
          user: { name: string } = { name: "Ada" }
          items: Array<number> = [1, 2, 3]
        }
        computed total = add(count, len(items))
        computed profile = { label: user.name, next: add(count, 1) }
        action save(title: string) {
          when eq(count, 1) {
            effect api.log({ title: $input.title, count: count })
          }
        }
      }
    `;
    const canonical = adapter.canonical(source);
    const compiled = adapter.compile(source);
    const canonicalExprs = collectCanonicalExprs(canonical.value);
    const runtimeExprs = collectRuntimeExprs(compiled.value);
    const canonicalKinds = [...new Set(canonicalExprs.map((expr) => expr.kind))].sort();
    const runtimeKinds = [...new Set(runtimeExprs.map((expr) => expr.kind))].sort();

    let deepExpr: CoreExprNode = { kind: "lit", value: 1 };
    for (let index = 0; index < 256; index += 1) {
      deepExpr = {
        kind: "add",
        left: { kind: "lit", value: 1 },
        right: deepExpr,
      };
    }
    const deepResult = evaluateExpr(deepExpr, createEvaluationContext({ meta: { intentId: "i1" } }));

    const closureSatisfied =
      canonical.success &&
      compiled.success &&
      canonicalExprs.length > 0 &&
      runtimeExprs.length > 0 &&
      canonicalExprs.every((expr) => CANONICAL_EXPR_KINDS.has(expr.kind)) &&
      runtimeExprs.every((expr) => !FORBIDDEN_EXPR_MARKERS.has(expr.kind)) &&
      deepResult === 257;

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A1"), closureSatisfied, {
        passMessage: "Expression trees stay within a finite closed set and evaluate without non-terminating constructs.",
        failMessage: "Expression trees no longer look structurally finite and flow-free.",
        evidence: [
          noteEvidence("Observed canonical expression kinds", canonicalKinds),
          noteEvidence("Observed runtime expression kinds", runtimeKinds),
          noteEvidence("Observed deep evaluation result", deepResult),
        ],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.IR_PURITY_SNAPSHOT_BOUNDARY, "(A4/A8) expression roots stay explicit and snapshot-bounded"), () => {
    const source = `
      domain Demo {
        state {
          count: number = 1
          user: { name: string } = { name: "Ada" }
        }
        computed label = concat("User:", user.name)
        action save(title: string) {
          when eq(count, 1) {
            effect api.log({ title: $input.title, count: count })
          }
        }
      }
    `;
    const canonical = adapter.canonical(source);
    const compiled = adapter.compile(source);
    const canonicalRoots = [...new Set(
      collectCanonicalExprs(canonical.value)
        .map((expr) => canonicalRoot(expr))
        .filter((root): root is string => root !== null)
    )].sort();
    const runtimeRoots = [...new Set(
      collectRuntimeExprs(compiled.value)
        .map((expr) => runtimeRoot(expr))
        .filter((root): root is string => root !== null)
    )].sort();
    const ctxKeys = Object.keys(
      createEvaluationContext({
        meta: { intentId: "i1" },
        snapshot: { data: {}, computed: {} },
        input: {},
      })
    ).sort();
    const puritySatisfied =
      canonical.success &&
      compiled.success &&
      canonicalRoots.every((root) => ["snapshot", "input", "meta", "$item"].includes(root)) &&
      runtimeRoots.every((root) => ["snapshot", "input", "meta", "$item"].includes(root)) &&
      ctxKeys.join(",") === "input,item,meta,snapshot";

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A4"), puritySatisfied, {
        passMessage: "Expression trees remain pure and contain no hidden execution channel.",
        failMessage: "Expression trees expose a non-expression or hidden execution channel.",
        evidence: [
          noteEvidence("Observed canonical roots", canonicalRoots),
          noteEvidence("Observed runtime roots", runtimeRoots),
          noteEvidence("Observed evaluation context keys", ctxKeys),
        ],
      }),
      evaluateRule(getRuleOrThrow("A8"), puritySatisfied, {
        passMessage: "All compiler-visible expression information flows through explicit snapshot/meta/input/item roots.",
        failMessage: "Compiler-visible expression information is escaping the explicit evaluation boundary.",
        evidence: [
          noteEvidence("Observed canonical roots", canonicalRoots),
          noteEvidence("Observed runtime roots", runtimeRoots),
          noteEvidence("Observed evaluation context keys", ctxKeys),
        ],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.IR_EVALUATION_ORDER, "(A18) evaluation remains left-to-right and key-sorted"), () => {
    const accesses: string[] = [];
    const ctx = createEvaluationContext({
      meta: { intentId: "i1" },
      snapshot: {
        data: {
          source: createRecordingObject(
            [
              ["b", 1],
              ["ä", 2],
              ["a", 3],
            ],
            accesses
          ),
          flags: createRecordingObject(
            [
              ["left", false],
              ["right", true],
            ],
            accesses
          ),
          branches: createRecordingObject(
            [
              ["then", "accepted"],
              ["else", "rejected"],
            ],
            accesses
          ),
          obj: { "ä": 2, b: 1, a: 3 },
        },
        computed: {},
      },
    });

    const objectResult = evaluateExpr(
      {
        kind: "object",
        fields: {
          b: { kind: "get", path: "source.b" },
          ä: { kind: "get", path: "source.ä" },
          a: { kind: "get", path: "source.a" },
        },
      },
      ctx
    );
    const objectOrder = accesses.splice(0, accesses.length);
    const andResult = evaluateExpr(
      {
        kind: "and",
        args: [
          { kind: "get", path: "flags.left" },
          { kind: "get", path: "flags.right" },
        ],
      },
      ctx
    );
    const andOrder = accesses.splice(0, accesses.length);
    const ifResult = evaluateExpr(
      {
        kind: "if",
        cond: { kind: "lit", value: true },
        then: { kind: "get", path: "branches.then" },
        else: { kind: "get", path: "branches.else" },
      },
      ctx
    );
    const ifOrder = accesses.splice(0, accesses.length);
    const keyResult = evaluateExpr({ kind: "keys", obj: { kind: "get", path: "obj" } }, ctx);
    const entryResult = evaluateExpr({ kind: "entries", obj: { kind: "get", path: "obj" } }, ctx);

    const orderSatisfied =
      JSON.stringify(objectResult) === JSON.stringify({ a: 3, b: 1, ä: 2 }) &&
      JSON.stringify(objectOrder) === JSON.stringify(["a", "b", "ä"]) &&
      andResult === false &&
      JSON.stringify(andOrder) === JSON.stringify(["left"]) &&
      ifResult === "accepted" &&
      JSON.stringify(ifOrder) === JSON.stringify(["then"]) &&
      JSON.stringify(keyResult) === JSON.stringify(["a", "b", "ä"]) &&
      JSON.stringify(entryResult) === JSON.stringify([
        ["a", 3],
        ["b", 1],
        ["ä", 2],
      ]);

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A18"), orderSatisfied, {
        passMessage: "Evaluation order stays left-to-right with key-sorted object traversal.",
        failMessage: "Evaluation order is no longer left-to-right with key-sorted object traversal.",
        evidence: [
          noteEvidence("Observed object result", objectResult),
          noteEvidence("Observed object access order", objectOrder),
          noteEvidence("Observed and access order", andOrder),
          noteEvidence("Observed if access order", ifOrder),
          noteEvidence("Observed key result", keyResult),
          noteEvidence("Observed entry result", entryResult),
        ],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.IR_TOTAL_EVALUATION, "(A3/A35, AD-COMP-LOW-003) expression evaluation stays total"), () => {
    const ctx = createEvaluationContext({
      meta: { intentId: "i1" },
      snapshot: { data: { count: 1 }, computed: {} },
    });

    const division = evaluateExpr(
      { kind: "div", left: { kind: "lit", value: 1 }, right: { kind: "lit", value: 0 } },
      ctx
    );
    const missing = evaluateExpr({ kind: "get", path: "missing.path" }, ctx);
    const invalidAdd = evaluateExpr(
      { kind: "add", left: { kind: "lit", value: "x" }, right: { kind: "lit", value: 1 } },
      ctx
    );
    const badField = evaluateExpr(
      { kind: "field", object: { kind: "lit", value: 42 }, property: "name" },
      ctx
    );
    const badFilter = evaluateExpr(
      {
        kind: "filter",
        array: { kind: "lit", value: [1, 2, 3] },
        predicate: { kind: "lit", value: "bad" },
      },
      ctx
    );
    const badEntries = evaluateExpr({ kind: "entries", obj: { kind: "lit", value: [] } }, ctx);

    const totalSatisfied =
      division === null &&
      missing === null &&
      invalidAdd === null &&
      badField === null &&
      badFilter === null &&
      badEntries === null;

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A3"), totalSatisfied, {
        passMessage: "Expression evaluation remains total and non-throwing.",
        failMessage: "Expression evaluation no longer behaves as a total function.",
        evidence: [
          noteEvidence("Division by zero result", division),
          noteEvidence("Missing path result", missing),
          noteEvidence("Invalid add result", invalidAdd),
          noteEvidence("Invalid field result", badField),
          noteEvidence("Invalid filter result", badFilter),
          noteEvidence("Invalid entries result", badEntries),
        ],
      }),
      evaluateRule(getRuleOrThrow("A35"), totalSatisfied, {
        passMessage: "Invalid runtime operations return null rather than throwing.",
        failMessage: "Invalid runtime operations no longer return null deterministically.",
        evidence: [
          noteEvidence("Division by zero result", division),
          noteEvidence("Missing path result", missing),
          noteEvidence("Invalid add result", invalidAdd),
          noteEvidence("Invalid field result", badField),
          noteEvidence("Invalid filter result", badFilter),
          noteEvidence("Invalid entries result", badEntries),
        ],
      }),
      evaluateRule(getRuleOrThrow("AD-COMP-LOW-003"), totalSatisfied, {
        passMessage: "Compiler-exposed evaluation stays total for invalid operations.",
        failMessage: "Compiler-exposed evaluation is no longer total for invalid operations.",
        evidence: [
          noteEvidence("Division by zero result", division),
          noteEvidence("Missing path result", missing),
          noteEvidence("Invalid add result", invalidAdd),
          noteEvidence("Invalid field result", badField),
          noteEvidence("Invalid filter result", badFilter),
          noteEvidence("Invalid entries result", badEntries),
        ],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.IR_PRIMITIVE_EQUALITY, "(A15) eq/neq stay limited to primitive operands"), () => {
    const objectLiteral = adapter.compile(`
      domain Demo {
        computed same = eq({ a: 1 }, { a: 1 })
      }
    `);
    const typedState = adapter.compile(`
      domain Demo {
        state {
          items: Array<number> = []
          user: { name: string } = { name: "Ada" }
        }
        computed sameItems = eq(items, [])
        computed sameUser = eq(user, { name: "Ada" })
      }
    `);
    const computedAlias = adapter.compile(`
      domain Demo {
        state { user: { name: string } = { name: "Ada" } }
        computed selected = user
        computed same = eq(selected, { name: "Ada" })
      }
    `);
    const entityReturn = adapter.compile(`
      domain Demo {
        type Task = { id: string, title: string }
        state {
          tasks: Array<Task> = []
          selectedId: string = ""
        }
        computed selectedTask = findById(tasks, selectedId)
        computed same = eq(selectedTask, null)
      }
    `);
    const primitiveComparisons = adapter.compile(`
      domain Demo {
        state {
          count: number = 0
          marker: string = ""
          title: string = ""
          items: Array<number> = []
        }
        computed sameCount = eq(count, 0)
        computed sameNull = eq(null, marker)
        computed trimmed = neq(trim(title), "")
        computed empty = eq(len(items), 0)
        action check() {
          when neq(marker, $meta.intentId) {
            stop "Already processed"
          }
        }
      }
    `);

    const invalidSatisfied =
      hasDiagnosticCode(objectLiteral.errors, "E_TYPE_MISMATCH") &&
      hasDiagnosticCode(typedState.errors, "E_TYPE_MISMATCH") &&
      hasDiagnosticCode(computedAlias.errors, "E_TYPE_MISMATCH") &&
      hasDiagnosticCode(entityReturn.errors, "E_TYPE_MISMATCH");
    const validSatisfied =
      primitiveComparisons.success &&
      !hasDiagnosticCode(primitiveComparisons.errors, "E_TYPE_MISMATCH");

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A15"), invalidSatisfied && validSatisfied, {
        passMessage: "eq/neq now reject definitely nonprimitive operands while preserving primitive comparisons.",
        failMessage: "eq/neq primitive-only enforcement is not yet exact at compile time.",
        evidence: [
          noteEvidence("Object literal diagnostics", objectLiteral.errors.map((diagnostic) => diagnostic.code)),
          noteEvidence("Typed state diagnostics", typedState.errors.map((diagnostic) => diagnostic.code)),
          noteEvidence("Computed alias diagnostics", computedAlias.errors.map((diagnostic) => diagnostic.code)),
          noteEvidence("Entity return diagnostics", entityReturn.errors.map((diagnostic) => diagnostic.code)),
          noteEvidence("Primitive comparison diagnostics", primitiveComparisons.errors.map((diagnostic) => diagnostic.code)),
        ],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.IR_BOUNDED_SUGAR_ARITH, "(MEL-SUGAR-1/2) bounded arithmetic sugar stays explicit until lowering"), () => {
    const source = `
      domain Demo {
        state {
          observed: number = 8
          predicted: number = 5
          score: number = 14
          totalAbs: number = 3
          divisor: number = 2
          prev: number = 2
          locked: boolean = true
        }
        computed error = absDiff(observed, predicted)
        computed bounded = clamp(score, 0, 10)
        computed buckets = idiv(neg(totalAbs), divisor)
        computed lockStreak = streak(prev, locked)
      }
    `;
    const canonical = adapter.canonical(source);
    const compiled = adapter.compile(source);

    const canonicalFns = canonical.success
      ? Object.values(canonical.value!.computed.fields).map((field) =>
          field.expr.kind === "call" ? field.expr.fn : field.expr.kind
        )
      : [];
    const runtimeKinds = compiled.success
      ? Object.values(compiled.value!.computed.fields).map((field) => field.expr.kind)
      : [];
    const ctx = createEvaluationContext({
      meta: { intentId: "i1" },
      snapshot: {
        data: {
          observed: 8,
          predicted: 5,
          score: 14,
          totalAbs: 3,
          divisor: 2,
          prev: 2,
          locked: true,
        },
        computed: {},
      },
    });
    const values = compiled.success
      ? {
          error: evaluateExpr(compiled.value!.computed.fields["error"].expr, ctx),
          bounded: evaluateExpr(compiled.value!.computed.fields["bounded"].expr, ctx),
          buckets: evaluateExpr(compiled.value!.computed.fields["buckets"].expr, ctx),
          lockStreak: evaluateExpr(compiled.value!.computed.fields["lockStreak"].expr, ctx),
        }
      : null;

    expectAllCompliance([
      evaluateRule(
        getRuleOrThrow("MEL-SUGAR-1"),
        canonical.success &&
          [...canonicalFns].sort().join(",") === "absDiff,clamp,idiv,streak",
        {
          passMessage: "Bounded arithmetic sugar remains explicit as canonical MEL call nodes.",
          failMessage: "Bounded arithmetic sugar did not remain explicit through canonical MEL IR.",
          evidence: [noteEvidence(`Observed canonical success=${canonical.success} diagnostics=${JSON.stringify(canonical.errors.map((diagnostic) => diagnostic.code))} functionNames=${JSON.stringify(canonicalFns)}`)],
        }
      ),
      evaluateRule(
        getRuleOrThrow("MEL-SUGAR-2"),
        compiled.success &&
          runtimeKinds.every((kind) => ["abs", "min", "floor", "if"].includes(kind)) &&
          values?.error === 3 &&
          values?.bounded === 10 &&
          values?.buckets === -2 &&
          values?.lockStreak === 3,
        {
          passMessage: "Bounded arithmetic sugar lowers only to existing runtime kinds and preserves semantics.",
          failMessage: "Bounded arithmetic sugar lowering or semantics regressed.",
          evidence: [
            noteEvidence(`Observed runtime root kinds: ${JSON.stringify(runtimeKinds)}`),
            noteEvidence(`Observed evaluated values: ${JSON.stringify(values)}`),
          ],
        }
      ),
    ]);
  });

  it(caseTitle(CCTS_CASES.IR_MATCH_SUGAR, "(MEL-SUGAR-3) match() stays finite literal-key branch sugar"), () => {
    const source = `
      domain Demo {
        state { status: string = "open" }
        computed code = match(status, ["open", 1], ["closed", 0], -1)
      }
    `;
    const canonical = adapter.canonical(source);
    const compiled = adapter.compile(source);
    const expr = compiled.value?.computed.fields["code"]?.expr as
      | { kind?: string; cond?: { kind?: string; left?: { kind?: string; path?: string }; right?: { kind?: string; value?: unknown } } }
      | undefined;
    const openCode = compiled.success
      ? evaluateExpr(
          compiled.value!.computed.fields["code"].expr,
          createEvaluationContext({
            meta: { intentId: "i1" },
            snapshot: { data: { status: "open" }, computed: {} },
          })
        )
      : null;
    const unknownCode = compiled.success
      ? evaluateExpr(
          compiled.value!.computed.fields["code"].expr,
          createEvaluationContext({
            meta: { intentId: "i1" },
            snapshot: { data: { status: "pending" }, computed: {} },
          })
        )
      : null;

    expectAllCompliance([
      evaluateRule(
        getRuleOrThrow("MEL-SUGAR-3"),
        canonical.success &&
          canonical.value!.computed.fields["code"]?.expr.kind === "call" &&
          (canonical.value!.computed.fields["code"]?.expr as { fn?: string }).fn === "match" &&
          compiled.success &&
          expr?.kind === "if" &&
          expr.cond?.kind === "eq" &&
          expr.cond.left?.kind === "get" &&
          expr.cond.left.path === "status" &&
          openCode === 1 &&
          unknownCode === -1,
        {
          passMessage: "match() remains explicit in canonical IR and lowers to finite source-order conditional structure.",
          failMessage: "match() no longer behaves as finite literal-key branch sugar.",
          evidence: [
            noteEvidence("Observed canonical expr", canonical.value?.computed.fields["code"]?.expr),
            noteEvidence("Observed lowered expr", expr),
            noteEvidence("Observed evaluated codes", { openCode, unknownCode }),
          ],
        }
      ),
    ]);
  });

  it(caseTitle(CCTS_CASES.IR_ARG_SELECTION_SUGAR, "(MEL-SUGAR-4) argmax()/argmin() stay fixed-candidate deterministic selection sugar"), () => {
    const source = `
      domain Demo {
        state {
          aOk: boolean = true
          bOk: boolean = true
          cOk: boolean = false
          aScore: number = 5
          bScore: number = 5
          cScore: number = 9
        }
        computed bestFirst = argmax(["a", aOk, aScore], ["b", bOk, bScore], ["c", cOk, cScore], "first")
        computed bestLast = argmax(["a", aOk, aScore], ["b", bOk, bScore], ["c", cOk, cScore], "last")
        computed worstFirst = argmin(["a", aOk, aScore], ["b", bOk, bScore], "first")
        computed none = argmax(["a", false, aScore], ["b", false, bScore], "first")
      }
    `;
    const canonical = adapter.canonical(source);
    const compiled = adapter.compile(source);
    const runtimeKinds = compiled.success
      ? Object.values(compiled.value!.computed.fields).map((field) => field.expr.kind)
      : [];
    const ctx = createEvaluationContext({
      meta: { intentId: "i1" },
      snapshot: {
        data: {
          aOk: true,
          bOk: true,
          cOk: false,
          aScore: 5,
          bScore: 5,
          cScore: 9,
        },
        computed: {},
      },
    });
    const values = compiled.success
      ? {
          bestFirst: evaluateExpr(compiled.value!.computed.fields["bestFirst"].expr, ctx),
          bestLast: evaluateExpr(compiled.value!.computed.fields["bestLast"].expr, ctx),
          worstFirst: evaluateExpr(compiled.value!.computed.fields["worstFirst"].expr, ctx),
          none: evaluateExpr(compiled.value!.computed.fields["none"].expr, ctx),
        }
      : null;

    expectAllCompliance([
      evaluateRule(
        getRuleOrThrow("MEL-SUGAR-4"),
        canonical.success &&
          runtimeKinds.every((kind) => kind === "if") &&
          values?.bestFirst === "a" &&
          values?.bestLast === "b" &&
          values?.worstFirst === "a" &&
          values?.none === null,
        {
          passMessage: "argmax()/argmin() stay source-enumerated, deterministic, and null-total when nothing is eligible.",
          failMessage: "argmax()/argmin() lowering or deterministic tie-break semantics regressed.",
          evidence: [
            noteEvidence("Observed canonical function names", canonical.success ? Object.values(canonical.value!.computed.fields).map((field) => (field.expr.kind === "call" ? field.expr.fn : field.expr.kind)) : []),
            noteEvidence("Observed runtime kinds", runtimeKinds),
            noteEvidence("Observed selection values", values),
          ],
        }
      ),
    ]);
  });

  it(caseTitle(CCTS_CASES.IR_SUGAR_DIAGNOSTICS, "(E049/E050/E051/E052) bounded sugar diagnostics remain visible"), () => {
    const clampResult = adapter.compile(`
      domain Demo {
        state { score: number = 0 }
        computed bounded = clamp(score, 10, 0)
      }
    `);
    const clampUnaryResult = adapter.compile(`
      domain Demo {
        state { score: number = 0 }
        computed bounded = clamp(score, 10, -1)
      }
    `);
    const matchShape = adapter.compile(`
      domain Demo {
        state { status: string = "open" }
        computed code = match(status, "open", 1, 0)
      }
    `);
    const matchDuplicate = adapter.compile(`
      domain Demo {
        state { status: string = "open" }
        computed code = match(status, ["open", 1], ["open", 2], 0)
      }
    `);
    const argShape = adapter.compile(`
      domain Demo {
        state { score: number = 1 }
        computed best = argmax(["a", true, score], "later")
      }
    `);

    expectAllCompliance([
      evaluateRule(
        getRuleOrThrow("E049"),
        hasDiagnosticCode(clampResult.errors, "E049") &&
          hasDiagnosticCode(clampUnaryResult.errors, "E049"),
        {
          passMessage: "Literal clamp bound inversion emits E049, including unary negative bounds.",
          failMessage: "Literal clamp bound inversion no longer emits E049 for direct or unary-negative bounds.",
          evidence: [
            ...diagnosticEvidence(clampResult.errors),
            ...diagnosticEvidence(clampUnaryResult.errors),
          ],
        }
      ),
      evaluateRule(getRuleOrThrow("E050"), hasDiagnosticCode(matchShape.errors, "E050"), {
        passMessage: "Malformed match() forms emit E050.",
        failMessage: "Malformed match() forms no longer emit E050.",
        evidence: diagnosticEvidence(matchShape.errors),
      }),
      evaluateRule(getRuleOrThrow("E051"), hasDiagnosticCode(matchDuplicate.errors, "E051"), {
        passMessage: "Duplicate match() keys emit E051.",
        failMessage: "Duplicate match() keys no longer emit E051.",
        evidence: diagnosticEvidence(matchDuplicate.errors),
      }),
      evaluateRule(getRuleOrThrow("E052"), hasDiagnosticCode(argShape.errors, "E052"), {
        passMessage: "Malformed argmax()/argmin() forms emit E052.",
        failMessage: "Malformed argmax()/argmin() forms no longer emit E052.",
        evidence: diagnosticEvidence(argShape.errors),
      }),
    ]);
  });
});
