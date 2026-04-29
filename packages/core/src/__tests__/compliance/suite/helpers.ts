import { expect } from "vitest";
import {
  apply,
  applyNamespaceDeltas,
  applySystemDelta,
  computeSync,
  createContext,
  createIntent,
  createSnapshot,
  evaluateExpr,
  hashSchemaSync,
  isOk,
  semanticPathToPatchPath,
  type DomainSchema,
  type ExprNode,
  type HostContext,
  type Intent,
  type Snapshot,
} from "../../../index.js";

export const HOST_CONTEXT: HostContext = { now: 100, randomSeed: "seed" };
export const NEXT_CONTEXT: HostContext = { now: 101, randomSeed: "next-seed" };
export const pp = (path: string) => semanticPathToPatchPath(path);

export function caseTitle(caseId: string, title: string): string {
  return `${caseId}: ${title}`;
}

export function createComplianceSchema(
  overrides: Partial<Omit<DomainSchema, "hash">> = {},
): DomainSchema {
  const schemaWithoutHash: Omit<DomainSchema, "hash"> = {
    id: "manifesto:core-cts",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        count: { type: "number", required: true, default: 0 },
        enabled: { type: "boolean", required: true, default: true },
        name: { type: "string", required: true, default: "" },
        balance: { type: "number", required: true, default: 0 },
        done: { type: "boolean", required: true, default: false },
        response: { type: "string", required: true, default: "" },
        items: {
          type: "array",
          required: true,
          default: [],
          items: {
            type: "object",
            required: true,
            fields: {
              completed: { type: "boolean", required: true, default: false },
              title: { type: "string", required: true, default: "" },
            },
          },
        },
      },
      ...(overrides.state?.fieldTypes ? { fieldTypes: overrides.state.fieldTypes } : {}),
    },
    computed: {
      fields: {
        double: {
          expr: {
            kind: "add",
            left: { kind: "get", path: "count" },
            right: { kind: "get", path: "count" },
          },
          deps: ["count"],
        },
      },
    },
    actions: {
      noop: { flow: { kind: "halt", reason: "noop" } },
    },
    ...overrides,
  };

  if (overrides.state?.fields) {
    schemaWithoutHash.state = {
      ...schemaWithoutHash.state,
      fields: {
        count: { type: "number", required: true, default: 0 },
        enabled: { type: "boolean", required: true, default: true },
        name: { type: "string", required: true, default: "" },
        balance: { type: "number", required: true, default: 0 },
        done: { type: "boolean", required: true, default: false },
        response: { type: "string", required: true, default: "" },
        items: {
          type: "array",
          required: true,
          default: [],
          items: {
            type: "object",
            required: true,
            fields: {
              completed: { type: "boolean", required: true, default: false },
              title: { type: "string", required: true, default: "" },
            },
          },
        },
        ...overrides.state.fields,
      },
    };
  }

  if (overrides.computed?.fields) {
    schemaWithoutHash.computed = {
      fields: {
        double: {
          expr: {
            kind: "add",
            left: { kind: "get", path: "count" },
            right: { kind: "get", path: "count" },
          },
          deps: ["count"],
        },
        ...overrides.computed.fields,
      },
    };
  }

  if (overrides.actions) {
    schemaWithoutHash.actions = {
      noop: { flow: { kind: "halt", reason: "noop" } },
      ...overrides.actions,
    };
  }

  return {
    ...schemaWithoutHash,
    hash: hashSchemaSync(schemaWithoutHash),
  };
}

export function createComplianceSnapshot(
  state: Record<string, unknown>,
  schemaHash = "test-hash",
): Snapshot {
  return createSnapshot(state, schemaHash, HOST_CONTEXT);
}

export function createComplianceIntent(type: string, input?: unknown, intentId = "intent-1"): Intent {
  return input === undefined ? createIntent(type, intentId) : createIntent(type, input, intentId);
}

export function computeAndMaterialize(
  schema: DomainSchema,
  snapshot: Snapshot,
  intent: Intent,
  context: HostContext = NEXT_CONTEXT,
): { result: ReturnType<typeof computeSync>; snapshot: Snapshot } {
  const result = computeSync(schema, snapshot, intent, context);
  const patched = apply(schema, snapshot, result.patches, context);
  const namespaced = applyNamespaceDeltas(patched, result.namespaceDelta ?? [], context);
  const finalSnapshot = applySystemDelta(namespaced, result.systemDelta);
  return { result, snapshot: finalSnapshot };
}

export function expectValidationCode(
  errors: readonly { code: string; path?: string }[],
  code: string,
  path?: string,
): void {
  expect(errors).toEqual(expect.arrayContaining([
    expect.objectContaining(path ? { code, path } : { code }),
  ]));
}

export function evaluate(expr: ExprNode, snapshot: Snapshot, schema: DomainSchema): unknown {
  const ctx = createContext(snapshot, schema, "cts", "core-cts", "intent-1", snapshot.meta.timestamp);
  const result = evaluateExpr(expr, ctx);
  if (!isOk(result)) {
    throw new Error(result.error.message);
  }
  return result.value;
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
