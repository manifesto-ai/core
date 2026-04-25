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
});
