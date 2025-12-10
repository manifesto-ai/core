/**
 * Convert AI-generated JSON schema to Manifesto domain
 */

import { z } from "zod";
import {
  defineDomain,
  defineSource,
  createRuntime,
  type ManifestoDomain,
  type DomainRuntime,
  type SemanticPath,
  type SourceDefinition,
} from "@manifesto-ai/core";
import type { GeneratedSchema, FieldDefinition } from "@/lib/types/schema";

/**
 * Convert a field definition to a Zod schema
 */
function fieldToZodSchema(field: FieldDefinition): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  switch (field.type) {
    case "string":
    case "textarea":
      schema = z.string();
      if (field.validation?.minLength) {
        schema = (schema as z.ZodString).min(field.validation.minLength);
      }
      if (field.validation?.maxLength) {
        schema = (schema as z.ZodString).max(field.validation.maxLength);
      }
      if (field.validation?.pattern) {
        schema = (schema as z.ZodString).regex(new RegExp(field.validation.pattern));
      }
      break;

    case "email":
      schema = z.string().email();
      break;

    case "phone":
      schema = z.string();
      break;

    case "number":
      schema = z.number();
      if (field.validation?.min !== undefined) {
        schema = (schema as z.ZodNumber).min(field.validation.min);
      }
      if (field.validation?.max !== undefined) {
        schema = (schema as z.ZodNumber).max(field.validation.max);
      }
      break;

    case "boolean":
      schema = z.boolean();
      break;

    case "date":
      schema = z.string(); // ISO date string
      break;

    case "select":
      if (field.options && field.options.length > 0) {
        const values = field.options.map((o) => o.value) as [string, ...string[]];
        schema = z.enum(values);
      } else {
        schema = z.string();
      }
      break;

    case "multiselect":
      if (field.options && field.options.length > 0) {
        const values = field.options.map((o) => o.value) as [string, ...string[]];
        schema = z.array(z.enum(values));
      } else {
        schema = z.array(z.string());
      }
      break;

    default:
      schema = z.unknown();
  }

  // Handle default value - apply before optional
  if (field.defaultValue !== undefined) {
    schema = schema.default(field.defaultValue as never);
  }

  return schema;
}

/**
 * Build Zod schema from field definitions
 */
export function buildDataSchema(fields: Record<string, FieldDefinition>): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};

  for (const [fieldName, field] of Object.entries(fields)) {
    shape[fieldName] = fieldToZodSchema(field);
  }

  return z.object(shape);
}

/**
 * Get default values from field definitions
 */
export function getDefaultValues(fields: Record<string, FieldDefinition>): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};

  for (const [fieldName, field] of Object.entries(fields)) {
    if (field.defaultValue !== undefined) {
      defaults[fieldName] = field.defaultValue;
    } else {
      // Set sensible defaults based on type
      switch (field.type) {
        case "string":
        case "email":
        case "phone":
        case "textarea":
        case "date":
          defaults[fieldName] = "";
          break;
        case "number":
          defaults[fieldName] = 0;
          break;
        case "boolean":
          defaults[fieldName] = false;
          break;
        case "select":
          defaults[fieldName] = field.options?.[0]?.value ?? "";
          break;
        case "multiselect":
          defaults[fieldName] = [];
          break;
      }
    }
  }

  return defaults;
}

/**
 * Map field type to semantic type
 */
function fieldTypeToSemanticType(type: FieldDefinition["type"]): string {
  const typeMap: Record<FieldDefinition["type"], string> = {
    string: "text",
    number: "number",
    boolean: "boolean",
    email: "email",
    phone: "phone",
    date: "date",
    select: "option",
    multiselect: "options",
    textarea: "longtext",
  };
  return typeMap[type] || "unknown";
}

/**
 * Convert field to source definition
 */
function fieldToSourceDefinition(fieldName: string, field: FieldDefinition): SourceDefinition {
  return defineSource({
    schema: fieldToZodSchema(field),
    defaultValue: getDefaultValues({ [fieldName]: field })[fieldName],
    semantic: {
      type: fieldTypeToSemanticType(field.type),
      description: field.description || field.label,
      importance: field.required ? "high" : "medium",
    },
  });
}

/**
 * Convert generated schema to ManifestoDomain
 */
export function schemaToManifestoDomain(schema: GeneratedSchema): ManifestoDomain<Record<string, unknown>, Record<string, unknown>> {
  // Build sources from fields
  const sources: Record<SemanticPath, SourceDefinition> = {};

  for (const [fieldName, field] of Object.entries(schema.fields)) {
    const path = `data.${fieldName}` as SemanticPath;
    sources[path] = fieldToSourceDefinition(fieldName, field);
  }

  // Build data schema
  const dataSchema = buildDataSchema(schema.fields);

  // State schema (empty for now - can be extended for form state)
  const stateSchema = z.object({});

  const domain = defineDomain({
    id: schema.name.toLowerCase().replace(/\s+/g, "-"),
    name: schema.name,
    description: schema.description,
    dataSchema,
    stateSchema,
    initialState: {},
    paths: {
      sources,
    },
  });

  return domain;
}

/**
 * Create runtime from generated schema
 */
export function createRuntimeFromSchema(schema: GeneratedSchema): DomainRuntime<Record<string, unknown>, Record<string, unknown>> {
  const domain = schemaToManifestoDomain(schema);
  const defaultValues = getDefaultValues(schema.fields);

  const runtime = createRuntime({
    domain,
    initialData: defaultValues,
  });

  return runtime;
}

/**
 * Helper to get data from runtime snapshot
 */
export function getFormDataFromRuntime(runtime: DomainRuntime<Record<string, unknown>, Record<string, unknown>>): Record<string, unknown> {
  const snapshot = runtime.getSnapshot();
  return snapshot.data;
}

/**
 * Helper to set field value in runtime
 */
export function setRuntimeValue(
  runtime: DomainRuntime<Record<string, unknown>, Record<string, unknown>>,
  fieldName: string,
  value: unknown
): boolean {
  const path = `data.${fieldName}` as SemanticPath;
  const result = runtime.set(path, value);
  return result.ok;
}

// Export types
export type { ManifestoDomain, DomainRuntime };
