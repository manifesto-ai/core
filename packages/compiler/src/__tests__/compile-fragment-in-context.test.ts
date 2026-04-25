import { describe, expect, it } from "vitest";

import {
  compileFragmentInContext,
  compileMelModule,
  type MelEditResult,
  type MelTextEdit,
} from "../api/index.js";

const SOURCE = `
domain Demo {
  @meta("doc:type")
  type Task = {
    id: string,
    title: string
  }

  state {
    count: number = 0
  }

  computed doubled = mul(count, 2)

  @meta("ui:button")
  action increment(by: number) available when gt(count, -1) {
    when true {
      patch count = add(count, by)
    }
  }
}
`;

function applyEdits(source: string, edits: readonly MelTextEdit[]): string {
  return [...edits]
    .sort((a, b) => (b.range.start.offset ?? 0) - (a.range.start.offset ?? 0))
    .reduce((current, edit) =>
      `${current.slice(0, edit.range.start.offset)}${edit.replacement}${current.slice(edit.range.end.offset)}`,
      source);
}

function expectNoMaterialization(result: MelEditResult, code: string, source = SOURCE): void {
  expect(result.ok).toBe(false);
  expect(result.newSource).toBe(source);
  expect(result.changedTargets).toEqual([]);
  expect(result.edits).toEqual([]);
  expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(code);
}

describe("compileFragmentInContext", () => {
  it("adds computed declarations and reports schema impact", () => {
    const result = compileFragmentInContext(SOURCE, {
      kind: "addComputed",
      name: "next",
      expr: "add(count, 1)",
    }, { includeModule: true, includeSchemaDiff: true });

    expect(result.ok).toBe(true);
    expect(result.module?.schema.computed.fields.next).toBeDefined();
    expect(result.changedTargets).toEqual(["computed:next"]);
    expect(result.schemaDiff?.addedTargets).toContain("computed:next");
    expect(result.newSource).toContain("computed next = add(count, 1)");
    expect(applyEdits(SOURCE, result.edits)).toBe(result.newSource);
  });

  it("replaces only an action body while preserving action identity, params, annotations, and guards", () => {
    const result = compileFragmentInContext(SOURCE, {
      kind: "replaceActionBody",
      target: "action:increment",
      body: `
        when true {
          patch count = add(count, 2)
        }
      `,
    }, { includeModule: true });

    expect(result.ok).toBe(true);
    expect(result.changedTargets).toEqual(["action:increment"]);
    expect(result.newSource).toContain("action increment(by: number) available when gt(count, -1)");
    expect(result.newSource).toContain("@meta(\"ui:button\")");
    expect(result.newSource).toContain("patch count = add(count, 2)");
    expect(result.module?.schema.actions.increment.params).toEqual(["by"]);
    expect(result.module?.annotations.entries["action:increment"]).toEqual([{ tag: "ui:button" }]);
  });

  it("replaces computed expressions, state defaults, and type fields with base-coordinate edits", () => {
    const computed = compileFragmentInContext(SOURCE, {
      kind: "replaceComputedExpr",
      target: "computed:doubled",
      expr: "add(count, 2)",
    });
    const stateDefault = compileFragmentInContext(SOURCE, {
      kind: "replaceStateDefault",
      target: "state_field:count",
      value: 10,
    });
    const typeField = compileFragmentInContext(SOURCE, {
      kind: "replaceTypeField",
      target: "type_field:Task.title",
      type: "string | null",
    });

    expect(computed.ok).toBe(true);
    expect(computed.newSource).toContain("computed doubled = add(count, 2)");
    expect(stateDefault.ok).toBe(true);
    expect(stateDefault.newSource).toContain("count: number = 10");
    expect(typeField.ok).toBe(true);
    expect(typeField.newSource).toContain("title: string | null");
    expect(computed.edits[0]?.range.start.offset).toBeTypeOf("number");
    expect(applyEdits(SOURCE, computed.edits)).toBe(computed.newSource);
  });

  it("adds and replaces action guards without changing runtime entrypoint contracts", () => {
    const withoutGuards = `
domain Demo {
  state { count: number = 0 }
  action submit() {
    when true { patch count = add(count, 1) }
  }
}
`;
    const added = compileFragmentInContext(withoutGuards, {
      kind: "addDispatchable",
      target: "action:submit",
      expr: "gt(count, -1)",
    }, { includeModule: true });
    const replaced = compileFragmentInContext(SOURCE, {
      kind: "replaceAvailable",
      target: "action:increment",
      expr: "gt(count, 0)",
    }, { includeModule: true });
    const beforeDispatchable = compileFragmentInContext(`
domain Demo {
  state { count: number = 0 }
  action submit() dispatchable when gt(count, -1) {
    when true { patch count = add(count, 1) }
  }
}
`, {
      kind: "addAvailable",
      target: "action:submit",
      expr: "true",
    }, { includeModule: true });

    expect(added.ok).toBe(true);
    expect(added.module?.schema.actions.submit.dispatchable).toBeDefined();
    expect(replaced.ok).toBe(true);
    expect(replaced.module?.schema.actions.increment.available).toBeDefined();
    expect(replaced.newSource).toContain("available when gt(count, 0)");
    expect(beforeDispatchable.ok).toBe(true);
    expect(beforeDispatchable.newSource).toContain("available when true dispatchable when gt(count, -1)");
  });

  it("returns diagnostics without materialization for stale modules, target errors, fragments, and unsafe removal", () => {
    const module = compileMelModule(SOURCE, { mode: "module" }).module!;
    const stale = compileFragmentInContext(`${SOURCE}\n`, {
      kind: "addComputed",
      name: "next",
      expr: "count",
    }, { baseModule: module });
    const missing = compileFragmentInContext(SOURCE, {
      kind: "replaceComputedExpr",
      target: "computed:missing",
      expr: "count",
    });
    const mismatch = compileFragmentInContext(SOURCE, {
      kind: "replaceComputedExpr",
      target: "action:increment" as never,
      expr: "count",
    });
    const smuggled = compileFragmentInContext(SOURCE, {
      kind: "replaceActionBody",
      target: "action:increment",
      body: "computed nope = count",
    });
    const remove = compileFragmentInContext(SOURCE, {
      kind: "removeDeclaration",
      target: "computed:doubled",
    });

    expect(stale.diagnostics.map((diagnostic) => diagnostic.code)).toContain("E_STALE_MODULE");
    expect(missing.diagnostics.map((diagnostic) => diagnostic.code)).toContain("E_TARGET_NOT_FOUND");
    expect(mismatch.diagnostics.map((diagnostic) => diagnostic.code)).toContain("E_TARGET_KIND_MISMATCH");
    expect(smuggled.diagnostics.map((diagnostic) => diagnostic.code)).toContain("E_FRAGMENT_SCOPE_VIOLATION");
    expect(remove.diagnostics.map((diagnostic) => diagnostic.code)).toContain("E_REMOVE_BLOCKED_BY_REFERENCES");
    for (const result of [stale, missing, mismatch, smuggled, remove]) {
      expect(result.edits).toEqual([]);
    }
  });

  it("rejects raw syntax smuggling through declaration identifiers before rendering edits", () => {
    const computedName = compileFragmentInContext(SOURCE, {
      kind: "addComputed",
      name: "next = count\n  action escaped" as never,
      expr: "count",
    });
    const actionParamName = compileFragmentInContext(SOURCE, {
      kind: "addAction",
      name: "submit",
      params: [{ name: "value) { computed escaped = count } action x(" as never, type: "number" }],
      body: "when true { patch count = value }",
    });
    const rename = compileFragmentInContext(SOURCE, {
      kind: "renameDeclaration",
      target: "computed:doubled",
      newName: "renamed\n  computed escaped" as never,
    });

    for (const result of [computedName, actionParamName, rename]) {
      expectNoMaterialization(result, "E_FRAGMENT_SCOPE_VIOLATION");
    }
  });

  it("rejects invalid runtime JSON literals before rendering state defaults", () => {
    const accessorPayload = {};
    Object.defineProperty(accessorPayload, "count", {
      enumerable: true,
      get() {
        throw new Error("getter must not run");
      },
    });
    const proxyPayload = new Proxy({}, {
      ownKeys() {
        throw new Error("proxy trap must not escape");
      },
    });

    const invalidKey = compileFragmentInContext(SOURCE, {
      kind: "addStateField",
      name: "settings",
      type: "{ bad-key: number }",
      defaultValue: { "bad-key": 1 } as never,
    });
    const invalidNumber = compileFragmentInContext(SOURCE, {
      kind: "replaceStateDefault",
      target: "state_field:count",
      value: Number.NaN as never,
    });
    const accessor = compileFragmentInContext(SOURCE, {
      kind: "replaceStateDefault",
      target: "state_field:count",
      value: accessorPayload as never,
    });
    const proxy = compileFragmentInContext(SOURCE, {
      kind: "replaceStateDefault",
      target: "state_field:count",
      value: proxyPayload as never,
    });

    for (const result of [invalidKey, invalidNumber, accessor, proxy]) {
      expectNoMaterialization(result, "E_FRAGMENT_SCOPE_VIOLATION");
    }
  });

  it("returns diagnostics for runtime-invalid edit operation shapes instead of throwing", () => {
    const nullOp = compileFragmentInContext(SOURCE, null as never);
    const arrayOp = compileFragmentInContext(SOURCE, [
      { kind: "addComputed", name: "bad", expr: "count" },
    ] as never);
    const unknownKind = compileFragmentInContext(SOURCE, { kind: "unknown" } as never);
    const invalidParams = compileFragmentInContext(SOURCE, {
      kind: "addAction",
      name: "submit",
      params: undefined,
      body: "when true { patch count = count }",
    } as never);
    const invalidTarget = compileFragmentInContext(SOURCE, {
      kind: "replaceComputedExpr",
      target: 42,
      expr: "count",
    } as never);

    expectNoMaterialization(nullOp, "E_FRAGMENT_SCOPE_VIOLATION");
    expectNoMaterialization(arrayOp, "E_FRAGMENT_SCOPE_VIOLATION");
    expectNoMaterialization(unknownKind, "E_FRAGMENT_SCOPE_VIOLATION");
    expectNoMaterialization(invalidParams, "E_FRAGMENT_SCOPE_VIOLATION");
    expectNoMaterialization(invalidTarget, "E_FRAGMENT_SCOPE_VIOLATION");
  });
});
