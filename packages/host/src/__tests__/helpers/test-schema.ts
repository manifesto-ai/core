/**
 * Common test schema helper
 */
import type { DomainSchema } from "@manifesto-ai/core";
import { hashSchemaSync } from "@manifesto-ai/core";

const BASE_STATE_FIELDS: DomainSchema["state"]["fields"] = {
  // Host-owned namespace (v2.0.2)
  $host: { type: "object", required: false, default: {} },

  // Common test fields
  dummy: { type: "string", required: true },
  count: { type: "number", required: true },
  counter: { type: "number", required: true },
  name: { type: "string", required: true },
  loading: { type: "boolean", required: true },
  response: { type: "object", required: true },
  itemsTotal: { type: "number", required: true },
  shipping: { type: "number", required: true },
  data: { type: "string", required: true },
  result: { type: "string", required: true },
  step: { type: "number", required: true },
  fetched: { type: "boolean", required: true },
  skipped: { type: "boolean", required: true },

  // Step tracking fields
  step1Done: { type: "boolean", required: true },
  step2Done: { type: "boolean", required: true },
  step1: { type: "boolean", required: true },
  step2: { type: "boolean", required: true },
  step3: { type: "boolean", required: true },
  done: { type: "boolean", required: true },
  complete: { type: "boolean", required: true },
  continued: { type: "boolean", required: true },
  effectDone: { type: "boolean", required: true },

  // Processing flags
  wasProcessed: { type: "boolean", required: true },
  processed: { type: "boolean", required: true },
  patchApplied: { type: "boolean", required: true },
  checked: { type: "boolean", required: true },
  errorRecorded: { type: "boolean", required: true },
  errorHandled: { type: "boolean", required: true },

  // Atomic test fields
  a: { type: "number", required: true },
  b: { type: "number", required: true },
  c: { type: "number", required: true },

  // Context/seed test fields
  firstTimestamp: { type: "number", required: true },
  secondTimestamp: { type: "number", required: true },
  firstSeed: { type: "string", required: true },
  secondSeed: { type: "string", required: true },
  capturedSeed: { type: "string", required: true },
  effectSawValue: { type: "number", required: true },
};

const BASE_COMPUTED_FIELDS: DomainSchema["computed"]["fields"] = {
  "computed.dummy": {
    expr: { kind: "get", path: "dummy" },
    deps: ["dummy"],
  },
};

const BASE_ACTIONS: DomainSchema["actions"] = {
  noop: { flow: { kind: "halt", reason: "noop" } },
};

/**
 * Create a test domain schema with optional overrides.
 * Automatically computes schema hash.
 */
export function createTestSchema(overrides: Partial<DomainSchema> = {}): DomainSchema {
  const { state, computed, actions: overrideActions, hash, types, ...restOverrides } = overrides;
  const stateFields = {
    ...BASE_STATE_FIELDS,
    ...(state?.fields ?? {}),
  };
  const computedFields = {
    ...BASE_COMPUTED_FIELDS,
    ...(computed?.fields ?? {}),
  };
  const actions = {
    ...BASE_ACTIONS,
    ...(overrideActions ?? {}),
  };

  const schemaWithoutHash: Omit<DomainSchema, "hash"> = {
    id: "manifesto:test",
    version: "1.0.0",
    ...restOverrides,
    types: types ?? {},
    state: { fields: stateFields },
    computed: { fields: computedFields },
    actions,
  };

  return {
    ...schemaWithoutHash,
    hash: hash ?? hashSchemaSync(schemaWithoutHash),
  };
}

export { BASE_STATE_FIELDS, BASE_COMPUTED_FIELDS, BASE_ACTIONS };
