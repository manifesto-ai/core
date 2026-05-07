import {
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
  deriveActionAnnotations,
  deriveActionParamMetadata,
  deriveSingleParamObjectValueMetadata,
} from "./compile-schema.js";
import type {
  ActionAnnotationMap,
  CompiledSchema,
  ResolvedSchema,
} from "./shared.js";
import {
  RESERVED_NAMESPACE_PREFIX,
} from "./shared.js";

export function resolveSchema(
  schema: DomainSchema | string,
  callerAnnotations?: ActionAnnotationMap,
): ResolvedSchema {
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
      actionAnnotations: deriveActionAnnotations(),
    };

  validateReservedNamespaces(resolved.schema);

  return {
    schema: resolved.schema,
    actionParamMetadata: resolved.actionParamMetadata,
    actionSingleParamObjectValueMetadata: resolved.actionSingleParamObjectValueMetadata,
    actionAnnotations: mergeActionAnnotations(
      resolved.actionAnnotations,
      callerAnnotations,
    ),
    projectionPlan: buildSnapshotProjectionPlan(resolved.schema),
  };
}

function mergeActionAnnotations(
  compiled: ActionAnnotationMap,
  caller: ActionAnnotationMap | undefined,
): ActionAnnotationMap {
  if (!caller) {
    return compiled;
  }

  const merged = new Map<string, Readonly<Record<string, unknown>>>();
  for (const [action, annotations] of Object.entries(compiled)) {
    merged.set(action, annotations);
  }
  for (const [action, annotations] of Object.entries(caller)) {
    merged.set(action, Object.freeze({
      ...(merged.get(action) ?? {}),
      ...annotations,
    }));
  }
  return Object.freeze(Object.fromEntries(merged));
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
    && "schema" in schema
    && "graph" in schema
    && "annotations" in schema;
}

function validateReservedNamespaces(schema: DomainSchema): void {
  visitStateFields(schema.state.fields, "state.fields");

  for (const actionType of Object.keys(schema.actions ?? {})) {
    if (actionType.startsWith(RESERVED_NAMESPACE_PREFIX)) {
      throw new ManifestoError(
        "RESERVED_NAMESPACE",
        `Action type "${actionType}" uses reserved namespace prefix "${RESERVED_NAMESPACE_PREFIX}"`,
      );
    }
  }
}

function visitStateFields(
  fields: DomainSchema["state"]["fields"],
  path: string,
): void {
  for (const [name, field] of Object.entries(fields)) {
    const fieldPath = `${path}.${name}`;
    if (name.startsWith("$")) {
      throw new ManifestoError(
        "SCHEMA_ERROR",
        `State field "${fieldPath}" uses reserved namespace prefix "$"`,
      );
    }

    if (field.type === "object" && field.fields) {
      visitStateFields(field.fields, fieldPath);
    }
  }
}
