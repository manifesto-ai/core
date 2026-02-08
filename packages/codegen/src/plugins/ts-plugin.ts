import type {
  TypeDefinition,
  TypeSpec,
  ActionSpec,
  FieldSpec,
  FieldType,
} from "@manifesto-ai/core";
import type {
  CodegenContext,
  CodegenOutput,
  CodegenPlugin,
  Diagnostic,
} from "../types.js";

const PLUGIN_NAME = "codegen-plugin-ts";

export interface TsPluginOptions {
  readonly typesFile?: string;
  readonly actionsFile?: string;
}

export interface TsPluginArtifacts {
  readonly typeNames: string[];
  readonly typeImportPath: string;
}

export function createTsPlugin(options?: TsPluginOptions): CodegenPlugin {
  const typesFile = options?.typesFile ?? "types.ts";
  const actionsFile = options?.actionsFile ?? "actions.ts";

  return {
    name: PLUGIN_NAME,
    generate(ctx: CodegenContext): CodegenOutput {
      const diagnostics: Diagnostic[] = [];
      const typeNames: string[] = [];

      // Generate types from schema.types (GEN-10, TS-6: lexicographic order)
      const sortedTypeNames = Object.keys(ctx.schema.types).sort();
      const typeDecls: string[] = [];

      for (const name of sortedTypeNames) {
        const spec = ctx.schema.types[name];
        typeNames.push(name);
        typeDecls.push(renderNamedType(name, spec, diagnostics));
      }

      const typesContent = typeDecls.join("\n\n") + "\n";

      // Generate action input types
      const sortedActionNames = Object.keys(ctx.schema.actions).sort();
      const actionDecls: string[] = [];

      for (const actionName of sortedActionNames) {
        const spec = ctx.schema.actions[actionName];
        if (spec.input) {
          const typeName = pascalCase(actionName) + "Input";
          actionDecls.push(renderActionInputType(typeName, spec, diagnostics));
        }
      }

      const patches = [
        { op: "set" as const, path: typesFile, content: typesContent },
      ];

      if (actionDecls.length > 0) {
        const actionsContent = actionDecls.join("\n\n") + "\n";
        patches.push({ op: "set" as const, path: actionsFile, content: actionsContent });
      }

      const artifacts: TsPluginArtifacts = {
        typeNames,
        typeImportPath: `./${typesFile.replace(/\.ts$/, "")}`,
      };

      return { patches, artifacts: artifacts as unknown as Record<string, unknown>, diagnostics };
    },
  };
}

// --- Type rendering ---

function renderNamedType(
  name: string,
  spec: TypeSpec,
  diagnostics: Diagnostic[]
): string {
  const def = spec.definition;

  // TS-3: top-level named object -> export interface
  if (def.kind === "object") {
    return renderInterface(name, def.fields, diagnostics);
  }

  // TS-3: all other named types -> export type
  const tsType = mapTypeDefinition(def, diagnostics);
  return `export type ${name} = ${tsType};`;
}

function renderInterface(
  name: string,
  fields: Record<string, { type: TypeDefinition; optional: boolean }>,
  diagnostics: Diagnostic[]
): string {
  const sortedFields = Object.keys(fields).sort();
  const lines: string[] = [];

  for (const fieldName of sortedFields) {
    const field = fields[fieldName];
    const tsType = mapTypeDefinition(field.type, diagnostics);
    // TS-5: optional -> ?
    const opt = field.optional ? "?" : "";
    lines.push(`  ${fieldName}${opt}: ${tsType};`);
  }

  return `export interface ${name} {\n${lines.join("\n")}\n}`;
}

function mapTypeDefinition(
  def: TypeDefinition,
  diagnostics: Diagnostic[]
): string {
  switch (def.kind) {
    case "primitive":
      return mapPrimitive(def.type);

    case "literal":
      return renderLiteral(def.value);

    case "array":
      return `${wrapComplex(mapTypeDefinition(def.element, diagnostics), def.element)}[]`;

    case "record":
      return `Record<${mapTypeDefinition(def.key, diagnostics)}, ${mapTypeDefinition(def.value, diagnostics)}>`;

    case "object": {
      const sortedFields = Object.keys(def.fields).sort();
      const parts: string[] = [];
      for (const fieldName of sortedFields) {
        const field = def.fields[fieldName];
        const tsType = mapTypeDefinition(field.type, diagnostics);
        const opt = field.optional ? "?" : "";
        parts.push(`${fieldName}${opt}: ${tsType}`);
      }
      return `{ ${parts.join("; ")} }`;
    }

    case "union":
      // TS-2: nullable uses T | null
      return def.types.map((t) => mapTypeDefinition(t, diagnostics)).join(" | ");

    case "ref":
      return def.name;

    default: {
      // PLG-3, TS-1: unknown kind fallback
      diagnostics.push({
        level: "warn",
        plugin: PLUGIN_NAME,
        message: `Unknown TypeDefinition kind: "${(def as Record<string, unknown>).kind}". Emitting "unknown".`,
      });
      return "unknown";
    }
  }
}

function mapPrimitive(type: string): string {
  switch (type) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    default:
      return "unknown";
  }
}

function renderLiteral(value: string | number | boolean | null): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  return String(value);
}

/** Wrap union types in parens when used as array element */
function wrapComplex(tsType: string, def: TypeDefinition): string {
  if (def.kind === "union") {
    return `(${tsType})`;
  }
  return tsType;
}

// --- Action input rendering ---

function renderActionInputType(
  typeName: string,
  spec: ActionSpec,
  diagnostics: Diagnostic[]
): string {
  if (!spec.input) {
    return "";
  }
  const tsType = mapFieldSpec(spec.input, diagnostics);
  return `export type ${typeName} = ${tsType};`;
}

function mapFieldSpec(
  spec: FieldSpec,
  diagnostics: Diagnostic[]
): string {
  const baseType = mapFieldType(spec.type, spec, diagnostics);

  // GEN-12: degrade for unknown structures
  if (!spec.required && baseType !== "unknown") {
    return `${baseType} | null`;
  }
  return baseType;
}

function mapFieldType(
  type: FieldType,
  spec: FieldSpec,
  diagnostics: Diagnostic[]
): string {
  if (typeof type === "object" && "enum" in type) {
    // Enum -> union of literals
    return type.enum.map((v) => renderLiteral(v as string | number | boolean | null)).join(" | ");
  }

  switch (type) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    case "object": {
      if (spec.fields) {
        const sortedFields = Object.keys(spec.fields).sort();
        const parts: string[] = [];
        for (const name of sortedFields) {
          const field = spec.fields[name];
          const fieldType = mapFieldSpec(field, diagnostics);
          const opt = field.required ? "" : "?";
          parts.push(`${name}${opt}: ${fieldType}`);
        }
        return `{ ${parts.join("; ")} }`;
      }
      // GEN-12: unstructured object -> unknown
      diagnostics.push({
        level: "warn",
        plugin: PLUGIN_NAME,
        message: "Object field without fields spec, degrading to Record<string, unknown>",
      });
      return "Record<string, unknown>";
    }
    case "array": {
      if (spec.items) {
        return `${mapFieldSpec(spec.items, diagnostics)}[]`;
      }
      diagnostics.push({
        level: "warn",
        plugin: PLUGIN_NAME,
        message: "Array field without items spec, degrading to unknown[]",
      });
      return "unknown[]";
    }
    default:
      return "unknown";
  }
}

function pascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}
