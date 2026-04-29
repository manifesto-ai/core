import { describe, expect, it } from "vitest";
import { validate, type DomainSchema } from "../../../index.js";
import { CORE_CTS_CASES } from "../core-cts-coverage.js";
import {
  caseTitle,
  createComplianceSchema,
  expectValidationCode,
  pp,
} from "./helpers.js";

describe("Core CTS schema validation", () => {
  it(caseTitle(CORE_CTS_CASES.SCHEMA_VALIDATION, "validates schema rule ids V-001 through V-010"), () => {
    const missingDep = createComplianceSchema({
      computed: {
        fields: {
          bad: { expr: { kind: "get", path: "count" }, deps: ["missing"] },
        },
      },
    });
    expectValidationCode(validate(missingDep).errors, "V-001");

    const computedCycle = createComplianceSchema({
      computed: {
        fields: {
          a: { expr: { kind: "get", path: "b" }, deps: ["b"] },
          b: { expr: { kind: "get", path: "a" }, deps: ["a"] },
        },
      },
    });
    expectValidationCode(validate(computedCycle).errors, "V-002");

    const unknownActionPath = createComplianceSchema({
      actions: {
        bad: {
          flow: {
            kind: "patch",
            op: "set",
            path: pp("name"),
            value: { kind: "get", path: "missing" },
          },
        },
      },
    });
    expectValidationCode(validate(unknownActionPath).errors, "V-003");

    const missingCall = createComplianceSchema({
      actions: {
        bad: { flow: { kind: "call", flow: "missing" } },
      },
    });
    expectValidationCode(validate(missingCall).errors, "V-004");

    const recursiveCall = createComplianceSchema({
      actions: {
        a: { flow: { kind: "call", flow: "b" } },
        b: { flow: { kind: "call", flow: "a" } },
      },
    });
    expectValidationCode(validate(recursiveCall).errors, "V-005");

    const invalidInput = {
      ...createComplianceSchema(),
      actions: {
        bad: {
          input: { type: "object" },
          flow: { kind: "halt", reason: "bad" },
        },
      },
    };
    expect(validate(invalidInput).valid).toBe(false);

    const unresolvedType = createComplianceSchema({
      state: {
        fields: {
          count: { type: "number", required: true, default: 0 },
        },
        fieldTypes: {
          count: { kind: "ref", name: "Missing" },
        },
      },
    });
    expectValidationCode(validate(unresolvedType).errors, "V-010");
  });

  it(caseTitle(CORE_CTS_CASES.SCHEMA_RESERVED_AND_RUNTIME_PATHS, "rejects reserved state identifiers and computed runtime reads"), () => {
    const schema = createComplianceSchema({
      state: {
        fields: {
          "$host": { type: "string", required: true, default: "" },
          nested: {
            type: "object",
            required: true,
            default: {},
            fields: {
              "$runtime": { type: "string", required: true, default: "" },
            },
          },
        },
        fieldTypes: {
          "$lineage": { kind: "object", fields: {} },
        },
      },
      computed: {
        fields: {
          fromNamespace: { expr: { kind: "get", path: "$host.requestId" }, deps: [] },
          fromSystem: { expr: { kind: "get", path: "system.status" }, deps: [] },
          fromMeta: { expr: { kind: "get", path: "meta.timestamp" }, deps: [] },
          fromInput: { expr: { kind: "get", path: "input.value" }, deps: [] },
        },
      },
    });

    const result = validate(schema);

    expect(result.valid).toBe(false);
    expectValidationCode(result.errors, "SCHEMA_ERROR", "state.fields.$host");
    expectValidationCode(result.errors, "SCHEMA_ERROR", "state.fields.nested.$runtime");
    expectValidationCode(result.errors, "SCHEMA_ERROR", "state.fieldTypes.$lineage");
    expectValidationCode(result.errors, "V-012", "computed.fields.fromNamespace");
    expectValidationCode(result.errors, "V-012", "computed.fields.fromSystem");
    expectValidationCode(result.errors, "V-012", "computed.fields.fromMeta");
    expectValidationCode(result.errors, "V-012", "computed.fields.fromInput");
  });

  it(caseTitle(CORE_CTS_CASES.SCHEMA_VALIDATION, "detects schema hash mismatch for V-008"), () => {
    const schema: DomainSchema = {
      ...createComplianceSchema(),
      hash: "wrong-hash",
    };

    const result = validate(schema);

    expect(result.valid).toBe(false);
    expectValidationCode(result.errors, "V-008", "hash");
  });
});
