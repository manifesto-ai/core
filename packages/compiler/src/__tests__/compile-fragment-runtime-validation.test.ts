import { describe, expect, it } from "vitest";

import {
  compileFragmentInContext,
  type MelEditResult,
} from "../api/index.js";

const SOURCE = `
domain Demo {
  state {
    count: number = 0
  }
}
`;

function expectScopeViolation(result: MelEditResult): void {
  expect(result.ok).toBe(false);
  expect(result.newSource).toBe(SOURCE);
  expect(result.edits).toEqual([]);
  expect(result.changedTargets).toEqual([]);
  expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("E_FRAGMENT_SCOPE_VIOLATION");
}

function changingNestedJsonValue(): { readonly value: object; readonly readCount: () => number } {
  let reads = 0;
  const nested = new Proxy({ value: 1 }, {
    get(target, property, receiver) {
      if (property === "value") {
        reads += 1;
        return reads === 1 ? 1 : 2;
      }
      return Reflect.get(target, property, receiver);
    },
  });
  return { value: { nested }, readCount: () => reads };
}

function jsonObjectWithProtoKey(value: unknown): object {
  const payload = {};
  Object.defineProperty(payload, "__proto__", {
    enumerable: true,
    value,
  });
  return payload;
}

describe("compileFragmentInContext runtime validation hardening", () => {
  it("returns diagnostics for revoked proxy edit operations instead of throwing", () => {
    const revoked = Proxy.revocable({
      kind: "addComputed",
      name: "next",
      expr: "count",
    }, {});
    revoked.revoke();

    const result = compileFragmentInContext(SOURCE, revoked.proxy as never);

    expectScopeViolation(result);
  });

  it("rejects symbol-keyed JSON literal properties before rendering", () => {
    const payload = { visible: 1 };
    Object.defineProperty(payload, Symbol("hidden"), {
      enumerable: true,
      value: 2,
    });

    const result = compileFragmentInContext(SOURCE, {
      kind: "replaceStateDefault",
      target: "state_field:count",
      value: payload as never,
    });

    expectScopeViolation(result);
  });

  it("rejects non-enumerable JSON literal properties before rendering", () => {
    const payload = { visible: 1 };
    Object.defineProperty(payload, "hidden", {
      enumerable: false,
      value: 2,
    });

    const result = compileFragmentInContext(SOURCE, {
      kind: "replaceStateDefault",
      target: "state_field:count",
      value: payload as never,
    });

    expectScopeViolation(result);
  });

  it("rejects non-index JSON array properties before rendering", () => {
    const payload = [1];
    Object.defineProperty(payload, "extra", {
      enumerable: true,
      value: 2,
    });

    const result = compileFragmentInContext(SOURCE, {
      kind: "replaceStateDefault",
      target: "state_field:count",
      value: payload as never,
    });

    expectScopeViolation(result);
  });

  it("rejects symbol-keyed JSON array properties before rendering", () => {
    const payload = [1];
    Object.defineProperty(payload, Symbol("hidden"), {
      enumerable: true,
      value: 2,
    });

    const result = compileFragmentInContext(SOURCE, {
      kind: "replaceStateDefault",
      target: "state_field:count",
      value: payload as never,
    });

    expectScopeViolation(result);
  });

  it("rejects oversized sparse JSON arrays before per-index traversal", () => {
    const payload: unknown[] = [];
    payload.length = 1_000_000_000;

    const result = compileFragmentInContext(SOURCE, {
      kind: "replaceStateDefault",
      target: "state_field:count",
      value: payload as never,
    });

    expectScopeViolation(result);
  });

  it("rejects oversized sparse action params before per-index traversal", () => {
    const params: unknown[] = [];
    params.length = 1_000_000_000;

    const result = compileFragmentInContext(SOURCE, {
      kind: "addAction",
      name: "submit",
      params: params as never,
      body: "when true { patch count = count }",
    });

    expectScopeViolation(result);
  });

  it("returns diagnostics for malformed baseModule options instead of throwing", () => {
    const malformedBaseModule = {};
    const baseModuleAccessor = {};
    Object.defineProperty(baseModuleAccessor, "sourceMap", {
      enumerable: true,
      get() {
        throw new Error("baseModule getter must not run");
      },
    });

    const missingSourceMap = compileFragmentInContext(SOURCE, {
      kind: "addComputed",
      name: "next",
      expr: "count",
    }, { baseModule: malformedBaseModule } as never);
    const throwingSourceMap = compileFragmentInContext(SOURCE, {
      kind: "addComputed",
      name: "next",
      expr: "count",
    }, { baseModule: baseModuleAccessor } as never);

    expectScopeViolation(missingSourceMap);
    expectScopeViolation(throwingSourceMap);
  });

  it("renders addAction from values captured during validation", () => {
    let nameReads = 0;
    let paramsReads = 0;
    let bodyReads = 0;
    const op = { kind: "addAction" };
    Object.defineProperty(op, "name", {
      enumerable: true,
      get() {
        nameReads += 1;
        return nameReads === 1 ? "submit" : "submit) { computed escaped = count } action x(";
      },
    });
    Object.defineProperty(op, "params", {
      enumerable: true,
      get() {
        paramsReads += 1;
        return paramsReads === 1
          ? [{ name: "value", type: "number" }]
          : [{ name: "value) { computed escaped = count } action x(", type: "number" }];
      },
    });
    Object.defineProperty(op, "body", {
      enumerable: true,
      get() {
        bodyReads += 1;
        return bodyReads === 1
          ? "when true { patch count = value }"
          : "computed escaped = count";
      },
    });

    const result = compileFragmentInContext(SOURCE, op as never);

    expect(result.ok).toBe(true);
    expect(result.newSource).toContain("action submit(value: number)");
    expect(result.newSource).toContain("patch count = value");
    expect(result.newSource).not.toContain("computed escaped");
    expect(nameReads).toBe(1);
    expect(paramsReads).toBe(1);
    expect(bodyReads).toBe(1);
  });

  it("replaces computed expressions from values captured during validation", () => {
    let exprReads = 0;
    const op = {
      kind: "replaceComputedExpr",
      target: "computed:doubled",
    };
    Object.defineProperty(op, "expr", {
      enumerable: true,
      get() {
        exprReads += 1;
        return exprReads === 1
          ? "count"
          : {
              toString() {
                throw new Error("computed expr must not be re-read");
              },
            };
      },
    });

    const result = compileFragmentInContext(`
domain Demo {
  state {
    count: number = 0
  }

  computed doubled = mul(count, 2)
}
`, op as never);

    expect(result.ok).toBe(true);
    expect(result.newSource).toContain("computed doubled = count");
    expect(exprReads).toBe(1);
  });

  it("replaces action bodies from values captured during validation", () => {
    let bodyReads = 0;
    const op = {
      kind: "replaceActionBody",
      target: "action:submit",
    };
    Object.defineProperty(op, "body", {
      enumerable: true,
      get() {
        bodyReads += 1;
        return bodyReads === 1
          ? "when true { patch count = count }"
          : "computed escaped = count";
      },
    });

    const result = compileFragmentInContext(`
domain Demo {
  state {
    count: number = 0
  }

  action submit() {
    when true {
      patch count = add(count, 1)
    }
  }
}
`, op as never);

    expect(result.ok).toBe(true);
    expect(result.newSource).toContain("patch count = count");
    expect(result.newSource).not.toContain("computed escaped");
    expect(bodyReads).toBe(1);
  });

  it("replaces state defaults from values captured during validation", () => {
    let valueReads = 0;
    const op = {
      kind: "replaceStateDefault",
      target: "state_field:count",
    };
    Object.defineProperty(op, "value", {
      enumerable: true,
      get() {
        valueReads += 1;
        return valueReads === 1 ? 1 : { escaped: 2 };
      },
    });

    const result = compileFragmentInContext(SOURCE, op as never);

    expect(result.ok).toBe(true);
    expect(result.newSource).toContain("count: number = 1");
    expect(result.newSource).not.toContain("escaped");
    expect(valueReads).toBe(1);
  });

  it("adds state defaults from a validated deep JSON snapshot", () => {
    const payload = changingNestedJsonValue();

    const result = compileFragmentInContext(SOURCE, {
      kind: "addStateField",
      name: "payload",
      type: "{ nested: { value: number } }",
      defaultValue: payload.value as never,
    });

    expect(result.ok).toBe(true);
    expect(result.newSource).toContain("payload: { nested: { value: number } } = { nested: { value: 1 } }");
    expect(result.newSource).not.toContain("value: 2");
    expect(payload.readCount()).toBe(1);
  });

  it("replaces state defaults from a validated deep JSON snapshot", () => {
    const payload = changingNestedJsonValue();

    const result = compileFragmentInContext(`
domain Demo {
  state {
    payload: { nested: { value: number } } = { nested: { value: 0 } }
  }
}
`, {
      kind: "replaceStateDefault",
      target: "state_field:payload",
      value: payload.value as never,
    });

    expect(result.ok).toBe(true);
    expect(result.newSource).toContain("payload: { nested: { value: number } } = { nested: { value: 1 } }");
    expect(result.newSource).not.toContain("value: 2");
    expect(payload.readCount()).toBe(1);
  });

  it("preserves __proto__ keys in validated JSON snapshots", () => {
    const result = compileFragmentInContext(`
domain Demo {
  state {
    payload: { __proto__: number } = { __proto__: 0 }
  }
}
`, {
      kind: "replaceStateDefault",
      target: "state_field:payload",
      value: jsonObjectWithProtoKey(1) as never,
    });

    expect(result.ok).toBe(true);
    expect(result.newSource).toContain("payload: { __proto__: number } = { __proto__: 1 }");
  });
});
