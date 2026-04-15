import {
  hashSchemaSync,
  type DomainSchema,
} from "@manifesto-ai/core";

import {
  ManifestoError,
} from "../errors.js";
import {
  buildSnapshotProjectionPlan,
} from "../projection/snapshot-projection.js";
import {
  compileSchema,
  deriveActionParamMetadata,
  deriveSingleParamObjectValueMetadata,
} from "./compile-schema.js";
import type {
  CompiledSchema,
  ResolvedSchema,
} from "./shared.js";
import {
  RESERVED_NAMESPACE_PREFIX,
} from "./shared.js";

export function resolveSchema(schema: DomainSchema | string): ResolvedSchema {
  if (typeof schema !== "string" && isDomainModuleArtifact(schema)) {
    throw new ManifestoError(
      "SCHEMA_ERROR",
      "DomainModule is a compiler tooling artifact. Pass module.schema or MEL source to createManifesto().",
    );
  }

  const resolved: CompiledSchema = typeof schema === "string"
    ? compileSchema(schema)
    : {
      schema,
      actionParamMetadata: deriveActionParamMetadata(schema),
      actionSingleParamObjectValueMetadata: deriveSingleParamObjectValueMetadata(schema),
    };

  const normalizedSchema = withPlatformNamespaces(resolved.schema);
  validateReservedNamespaces(normalizedSchema);

  return {
    schema: normalizedSchema,
    actionParamMetadata: resolved.actionParamMetadata,
    actionSingleParamObjectValueMetadata: resolved.actionSingleParamObjectValueMetadata,
    projectionPlan: buildSnapshotProjectionPlan(normalizedSchema),
  };
}

function isDomainModuleArtifact(
  schema: DomainSchema,
): schema is DomainSchema & {
  schema: unknown;
  graph: unknown;
  annotations: unknown;
} {
  return typeof schema === "object"
    && schema !== null
    && Object.hasOwn(schema, "schema")
    && Object.hasOwn(schema, "graph")
    && Object.hasOwn(schema, "annotations");
}

function withPlatformNamespaces(schema: DomainSchema): DomainSchema {
  const fields = { ...schema.state.fields };
  let changed = false;

  if (!fields.$host) {
    fields.$host = {
      type: "object",
      required: false,
      default: {},
    };
    changed = true;
  } else if (fields.$host.type !== "object") {
    throw new ManifestoError("SCHEMA_ERROR", "Reserved namespace '$host' must be an object field");
  } else if (fields.$host.default === undefined) {
    fields.$host = { ...fields.$host, default: {} };
    changed = true;
  }

  if (!fields.$mel) {
    fields.$mel = {
      type: "object",
      required: false,
      default: { guards: { intent: {} } },
      fields: {
        guards: {
          type: "object",
          required: false,
          default: { intent: {} },
          fields: {
            intent: {
              type: "object",
              required: false,
              default: {},
            },
          },
        },
      },
    };
    changed = true;
  } else if (fields.$mel.type !== "object") {
    throw new ManifestoError("SCHEMA_ERROR", "Reserved namespace '$mel' must be an object field");
  } else {
    let nextMel = fields.$mel;
    if (nextMel.default === undefined) {
      nextMel = { ...nextMel, default: { guards: { intent: {} } } };
      changed = true;
    }

    const melFields = nextMel.fields ?? {};
    const guardsField = melFields.guards;

    if (!guardsField) {
      nextMel = {
        ...nextMel,
        fields: {
          ...melFields,
          guards: {
            type: "object",
            required: false,
            default: { intent: {} },
            fields: {
              intent: {
                type: "object",
                required: false,
                default: {},
              },
            },
          },
        },
      };
      changed = true;
    } else if (guardsField.type !== "object") {
      throw new ManifestoError("SCHEMA_ERROR", "Reserved namespace '$mel.guards' must be an object field");
    } else {
      let nextGuards = guardsField;
      if (nextGuards.default === undefined) {
        nextGuards = { ...nextGuards, default: { intent: {} } };
        changed = true;
      }

      const guardFields = nextGuards.fields ?? {};
      const intentField = guardFields.intent;

      if (!intentField) {
        nextGuards = {
          ...nextGuards,
          fields: {
            ...guardFields,
            intent: {
              type: "object",
              required: false,
              default: {},
            },
          },
        };
        changed = true;
      } else if (intentField.type !== "object") {
        throw new ManifestoError("SCHEMA_ERROR", "Reserved namespace '$mel.guards.intent' must be an object field");
      } else if (intentField.default === undefined) {
        nextGuards = {
          ...nextGuards,
          fields: {
            ...guardFields,
            intent: { ...intentField, default: {} },
          },
        };
        changed = true;
      }

      if (nextGuards !== guardsField) {
        nextMel = {
          ...nextMel,
          fields: {
            ...melFields,
            guards: nextGuards,
          },
        };
      }
    }

    if (nextMel !== fields.$mel) {
      fields.$mel = nextMel;
    }
  }

  if (!changed) {
    return schema;
  }

  const nextSchema = {
    ...schema,
    state: {
      ...schema.state,
      fields,
    },
  };

  const { hash: _hash, ...schemaWithoutHash } = nextSchema;
  return {
    ...nextSchema,
    hash: hashSchemaSync(schemaWithoutHash),
  };
}

function validateReservedNamespaces(schema: DomainSchema): void {
  for (const actionType of Object.keys(schema.actions ?? {})) {
    if (actionType.startsWith(RESERVED_NAMESPACE_PREFIX)) {
      throw new ManifestoError(
        "RESERVED_NAMESPACE",
        `Action type "${actionType}" uses reserved namespace prefix "${RESERVED_NAMESPACE_PREFIX}"`,
      );
    }
  }
}
