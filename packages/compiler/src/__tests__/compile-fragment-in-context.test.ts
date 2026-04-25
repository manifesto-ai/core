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
      target: "state_field:count",
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

  it("removes unreferenced declarations and reports removed schema targets", () => {
    const source = `
domain Demo {
  state { count: number = 0 }
  computed unused = 1
}
`;
    const result = compileFragmentInContext(source, {
      kind: "removeDeclaration",
      target: "computed:unused",
    }, { includeModule: true, includeSchemaDiff: true });

    expect(result.ok).toBe(true);
    expect(result.newSource).not.toContain("computed unused");
    expect(result.module?.schema.computed.fields.unused).toBeUndefined();
    expect(result.changedTargets).toEqual(["computed:unused"]);
    expect(result.schemaDiff?.removedTargets).toContain("computed:unused");
    expect(applyEdits(source, result.edits)).toBe(result.newSource);
  });

  it("renames state fields and rewrites safe expression and path references", () => {
    const source = `
domain Demo {
  state {
    count: number = 0
  }

  computed doubled = mul(count, 2)

  action increment() dispatchable when gt(count, 0) {
    when true {
      patch count = add(count, 1)
    }
  }
}
`;
    const result = compileFragmentInContext(source, {
      kind: "renameDeclaration",
      target: "state_field:count",
      newName: "total",
    }, { includeModule: true, includeSchemaDiff: true });

    expect(result.ok).toBe(true);
    expect(result.newSource).toContain("total: number = 0");
    expect(result.newSource).toContain("computed doubled = mul(total, 2)");
    expect(result.newSource).toContain("dispatchable when gt(total, 0)");
    expect(result.newSource).toContain("patch total = add(total, 1)");
    expect(result.module?.schema.state.fields.total).toBeDefined();
    expect(result.module?.schema.state.fields.count).toBeUndefined();
    expect(result.changedTargets).toEqual(["state_field:count", "state_field:total"]);
    expect(result.schemaDiff?.removedTargets).toContain("state_field:count");
    expect(result.schemaDiff?.addedTargets).toContain("state_field:total");
  });

  it("preserves action parameter reads that shadow renamed state fields", () => {
    const source = `
domain Demo {
  state {
    count: number = 0
  }

  action increment(count: number) {
    when true {
      patch count = add(count, 1)
    }
  }
}
`;
    const result = compileFragmentInContext(source, {
      kind: "renameDeclaration",
      target: "state_field:count",
      newName: "total",
    });

    expect(result.ok).toBe(true);
    expect(result.newSource).toContain("total: number = 0");
    expect(result.newSource).toContain("action increment(count: number)");
    expect(result.newSource).toContain("patch total = add(count, 1)");
    expect(result.newSource).not.toContain("add(total, 1)");
  });

  it("renames computed declarations and type declarations with safe references", () => {
    const source = `
domain Demo {
  type Task = {
    id: string
  }

  state {
    task: Task = { id: "1" }
    count: number = 0
  }

  computed doubled = mul(count, 2)
  computed label = add(doubled, 1)
}
`;
    const renamedComputed = compileFragmentInContext(source, {
      kind: "renameDeclaration",
      target: "computed:doubled",
      newName: "doubleCount",
    }, { includeModule: true, includeSchemaDiff: true });
    const renamedType = compileFragmentInContext(source, {
      kind: "renameDeclaration",
      target: "type:Task",
      newName: "Todo",
    }, { includeModule: true, includeSchemaDiff: true });

    expect(renamedComputed.ok).toBe(true);
    expect(renamedComputed.newSource).toContain("computed doubleCount = mul(count, 2)");
    expect(renamedComputed.newSource).toContain("computed label = add(doubleCount, 1)");
    expect(renamedComputed.module?.schema.computed.fields.doubleCount).toBeDefined();
    expect(renamedComputed.schemaDiff?.removedTargets).toContain("computed:doubled");
    expect(renamedComputed.schemaDiff?.addedTargets).toContain("computed:doubleCount");

    expect(renamedType.ok).toBe(true);
    expect(renamedType.newSource).toContain("type Todo =");
    expect(renamedType.newSource).toContain("task: Todo");
    expect(renamedType.module?.schema.types.Todo).toBeDefined();
    expect(renamedType.schemaDiff?.removedTargets).toContain("type:Task");
    expect(renamedType.schemaDiff?.addedTargets).toContain("type:Todo");
  });

  it("renames and removes unreferenced type fields while blocking ambiguous field references", () => {
    const unreferenced = `
domain Demo {
  type Task = {
    id: string,
    title: string
  }

  state { count: number = 0 }
}
`;
    const referenced = `
domain Demo {
  type Task = {
    id: string,
    title: string
  }

  state {
    task: Task = { id: "1", title: "A" }
  }

  computed taskTitle = task.title
}
`;
    const rename = compileFragmentInContext(unreferenced, {
      kind: "renameDeclaration",
      target: "type_field:Task.title",
      newName: "label",
    }, { includeModule: true, includeSchemaDiff: true });
    const remove = compileFragmentInContext(unreferenced, {
      kind: "removeDeclaration",
      target: "type_field:Task.title",
    }, { includeModule: true, includeSchemaDiff: true });
    const blocked = compileFragmentInContext(referenced, {
      kind: "renameDeclaration",
      target: "type_field:Task.title",
      newName: "label",
    });

    expect(rename.ok).toBe(true);
    expect(rename.newSource).toContain("label: string");
    expect(rename.changedTargets).toEqual(["type:Task", "type_field:Task.label", "type_field:Task.title"]);
    expect(rename.schemaDiff?.removedTargets).toContain("type_field:Task.title");
    expect(rename.schemaDiff?.addedTargets).toContain("type_field:Task.label");

    expect(remove.ok).toBe(true);
    expect(remove.newSource).not.toContain("title: string");
    expect(remove.schemaDiff?.removedTargets).toContain("type_field:Task.title");

    expectNoMaterialization(blocked, "E_UNSAFE_RENAME_AMBIGUOUS", referenced);
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
    const sparseArray = new Array(1);

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
    const sparse = compileFragmentInContext(SOURCE, {
      kind: "replaceStateDefault",
      target: "state_field:count",
      value: sparseArray as never,
    });

    for (const result of [invalidKey, invalidNumber, accessor, proxy, sparse]) {
      expectNoMaterialization(result, "E_FRAGMENT_SCOPE_VIOLATION");
    }
  });

  it("returns diagnostics for runtime-invalid edit operation shapes instead of throwing", () => {
    const opWithThrowingKind = {};
    Object.defineProperty(opWithThrowingKind, "kind", {
      enumerable: true,
      get() {
        throw new Error("op kind getter must not run");
      },
    });
    const paramWithAccessor = { type: "number" };
    Object.defineProperty(paramWithAccessor, "name", {
      enumerable: true,
      get() {
        throw new Error("param getter must not run");
      },
    });
    const paramProxy = new Proxy({ name: "value", type: "number" }, {
      get(target, property, receiver) {
        if (property === "name" || property === "type") {
          throw new Error("param proxy trap must not escape");
        }
        return Reflect.get(target, property, receiver);
      },
    });

    const nullOp = compileFragmentInContext(SOURCE, null as never);
    const arrayOp = compileFragmentInContext(SOURCE, [
      { kind: "addComputed", name: "bad", expr: "count" },
    ] as never);
    const unknownKind = compileFragmentInContext(SOURCE, { kind: "unknown" } as never);
    const throwingKind = compileFragmentInContext(SOURCE, opWithThrowingKind as never);
    const invalidParams = compileFragmentInContext(SOURCE, {
      kind: "addAction",
      name: "submit",
      params: undefined,
      body: "when true { patch count = count }",
    } as never);
    const accessorParam = compileFragmentInContext(SOURCE, {
      kind: "addAction",
      name: "submit",
      params: [paramWithAccessor],
      body: "when true { patch count = count }",
    } as never);
    const proxyParam = compileFragmentInContext(SOURCE, {
      kind: "addAction",
      name: "submit",
      params: [paramProxy],
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
    expectNoMaterialization(throwingKind, "E_FRAGMENT_SCOPE_VIOLATION");
    expectNoMaterialization(invalidParams, "E_FRAGMENT_SCOPE_VIOLATION");
    expectNoMaterialization(accessorParam, "E_FRAGMENT_SCOPE_VIOLATION");
    expectNoMaterialization(proxyParam, "E_FRAGMENT_SCOPE_VIOLATION");
    expectNoMaterialization(invalidTarget, "E_FRAGMENT_SCOPE_VIOLATION");
  });
});
