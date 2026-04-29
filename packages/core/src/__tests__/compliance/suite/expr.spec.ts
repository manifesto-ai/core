import { describe, expect, it } from "vitest";
import { validate } from "../../../index.js";
import { CORE_CTS_CASES } from "../core-cts-coverage.js";
import {
  caseTitle,
  createComplianceSchema,
  createComplianceSnapshot,
  evaluate,
  expectValidationCode,
} from "./helpers.js";

describe("Core CTS expression rules", () => {
  it(caseTitle(CORE_CTS_CASES.EXPR_TOTALITY, "keeps edge-case expression evaluation total"), () => {
    const schema = createComplianceSchema();
    const snapshot = createComplianceSnapshot(
      {
        nums: [1, 2, 2],
        empty: [],
        text: "a-a-a",
        value: "not-a-number",
      },
      schema.hash,
    );

    expect(evaluate({ kind: "div", left: { kind: "lit", value: 1 }, right: { kind: "lit", value: 0 } }, snapshot, schema)).toBeNull();
    expect(evaluate({ kind: "mod", left: { kind: "lit", value: 1 }, right: { kind: "lit", value: 0 } }, snapshot, schema)).toBeNull();
    expect(evaluate({ kind: "at", array: { kind: "get", path: "nums" }, index: { kind: "lit", value: 10 } }, snapshot, schema)).toBeNull();
    expect(evaluate({ kind: "replace", str: { kind: "get", path: "text" }, search: { kind: "lit", value: "-" }, replacement: { kind: "lit", value: "_" } }, snapshot, schema)).toBe("a_a-a");
    expect(evaluate({ kind: "unique", array: { kind: "get", path: "nums" } }, snapshot, schema)).toEqual([1, 2]);
    expect(evaluate({ kind: "indexOf", str: { kind: "get", path: "text" }, search: { kind: "lit", value: "z" } }, snapshot, schema)).toBe(-1);
    expect(evaluate({ kind: "split", str: { kind: "get", path: "text" }, delimiter: { kind: "lit", value: "|" } }, snapshot, schema)).toEqual(["a-a-a"]);
    expect(evaluate({ kind: "toNumber", arg: { kind: "get", path: "value" } }, snapshot, schema)).toBe(0);
    expect(evaluate({ kind: "toBoolean", arg: { kind: "lit", value: null } }, snapshot, schema)).toBe(false);
  });

  it(caseTitle(CORE_CTS_CASES.EXPR_NAMESPACE_BOUNDARY, "rejects user-authored namespace reads while allowing lexical variables"), () => {
    const schema = createComplianceSchema({
      computed: {
        fields: {
          completedCount: {
            expr: {
              kind: "len",
              arg: {
                kind: "filter",
                array: { kind: "get", path: "items" },
                predicate: { kind: "get", path: "$item.completed" },
              },
            },
            deps: ["items"],
          },
          badNamespace: {
            expr: { kind: "get", path: "$host.requestId" },
            deps: [],
          },
        },
      },
      actions: {
        badAction: {
          flow: {
            kind: "patch",
            op: "set",
            path: [{ kind: "prop", name: "name" }],
            value: { kind: "get", path: "$host.requestId" },
          },
        },
      },
    });

    const result = validate(schema);

    expect(result.valid).toBe(false);
    expectValidationCode(result.errors, "V-012", "computed.fields.badNamespace");
    expectValidationCode(result.errors, "V-003", "actions.badAction");
    expect(result.errors).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "computed.fields.completedCount" }),
    ]));
  });
});
