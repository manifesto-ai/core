import type { TypeDefinition, TypeSpec } from "@manifesto-ai/core";
import type {
  CodegenContext,
  CodegenOutput,
  CodegenPlugin,
  Diagnostic,
} from "../types.js";
import type { TsPluginArtifacts } from "./ts-plugin.js";

const PLUGIN_NAME = "codegen-plugin-zod";
const TS_PLUGIN_NAME = "codegen-plugin-ts";

export interface ZodPluginOptions {
  readonly schemasFile?: string;
}

export function createZodPlugin(options?: ZodPluginOptions): CodegenPlugin {
  const schemasFile = options?.schemasFile ?? "base.ts";

  return {
    name: PLUGIN_NAME,
    generate(ctx: CodegenContext): CodegenOutput {
      const diagnostics: Diagnostic[] = [];

      // PLG-11: Optional TS artifacts dependency
      const tsArtifacts = ctx.artifacts[TS_PLUGIN_NAME] as TsPluginArtifacts | undefined;

      const sortedTypeNames = Object.keys(ctx.schema.types).sort();
      const schemaDecls: string[] = [];

      // Collect all type names for forward declarations with z.lazy
      const allTypeNames = new Set(sortedTypeNames);

      for (const name of sortedTypeNames) {
        const spec = ctx.schema.types[name];
        schemaDecls.push(renderNamedSchema(name, spec, allTypeNames, tsArtifacts, diagnostics));
      }

      // Build imports
      const imports: string[] = ['import { z } from "zod";'];

      // ZOD-4: Import TS types for annotations when available
      if (tsArtifacts && tsArtifacts.typeNames.length > 0) {
        const typeImports = sortedTypeNames
          .filter((n) => tsArtifacts.typeNames.includes(n))
          .join(", ");
        if (typeImports) {
          imports.push(`import type { ${typeImports} } from "${tsArtifacts.typeImportPath}";`);
        }
      }

      const content = imports.join("\n") + "\n\n" + schemaDecls.join("\n\n") + "\n";

      return {
        patches: [{ op: "set", path: schemasFile, content }],
        diagnostics,
      };
    },
  };
}

// --- Schema rendering ---

function renderNamedSchema(
  name: string,
  spec: TypeSpec,
  allTypeNames: Set<string>,
  tsArtifacts: TsPluginArtifacts | undefined,
  diagnostics: Diagnostic[]
): string {
  const schemaName = `${name}Schema`;
  const zodExpr = mapTypeDefinition(spec.definition, allTypeNames, diagnostics);

  // ZOD-4/ZOD-5: Type annotation when TS artifacts available
  const hasTypeAnnotation = tsArtifacts && tsArtifacts.typeNames.includes(name);
  const annotation = hasTypeAnnotation ? `: z.ZodType<${name}>` : "";

  return `export const ${schemaName}${annotation} = ${zodExpr};`;
}

function mapTypeDefinition(
  def: TypeDefinition,
  allTypeNames: Set<string>,
  diagnostics: Diagnostic[]
): string {
  switch (def.kind) {
    case "primitive":
      return mapPrimitiveZod(def.type);

    case "literal":
      return `z.literal(${renderLiteralValue(def.value)})`;

    case "array":
      return `z.array(${mapTypeDefinition(def.element, allTypeNames, diagnostics)})`;

    case "record":
      return handleRecord(def, allTypeNames, diagnostics);

    case "object":
      return renderZodObject(def.fields, allTypeNames, diagnostics);

    case "union":
      return handleUnion(def.types, allTypeNames, diagnostics);

    case "ref":
      // ZOD-2: Always z.lazy for circular reference support
      return `z.lazy(() => ${def.name}Schema)`;

    default: {
      // ZOD-1: Unknown kind fallback
      diagnostics.push({
        level: "warn",
        plugin: PLUGIN_NAME,
        message: `Unknown TypeDefinition kind: "${(def as Record<string, unknown>).kind}". Emitting "z.unknown()".`,
      });
      return "z.unknown()";
    }
  }
}

function mapPrimitiveZod(type: string): string {
  switch (type) {
    case "string":
      return "z.string()";
    case "number":
      return "z.number()";
    case "boolean":
      return "z.boolean()";
    case "null":
      return "z.null()";
    default:
      return "z.unknown()";
  }
}

function renderLiteralValue(value: string | number | boolean | null): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (value === null) {
    return "null";
  }
  return String(value);
}

function handleRecord(
  def: Extract<TypeDefinition, { kind: "record" }>,
  allTypeNames: Set<string>,
  diagnostics: Diagnostic[]
): string {
  const valueSchema = mapTypeDefinition(def.value, allTypeNames, diagnostics);

  // ZOD-7: Non-string record key -> degrade to z.record(z.string(), ...)
  if (def.key.kind !== "primitive" || def.key.type !== "string") {
    diagnostics.push({
      level: "warn",
      plugin: PLUGIN_NAME,
      message: `Record key type is not string (got ${JSON.stringify(def.key)}). Degrading to z.record(z.string(), ...).`,
    });
    return `z.record(z.string(), ${valueSchema})`;
  }

  return `z.record(z.string(), ${valueSchema})`;
}

function renderZodObject(
  fields: Record<string, { type: TypeDefinition; optional: boolean }>,
  allTypeNames: Set<string>,
  diagnostics: Diagnostic[]
): string {
  const sortedFields = Object.keys(fields).sort();
  const parts: string[] = [];

  for (const fieldName of sortedFields) {
    const field = fields[fieldName];
    let zodType = mapTypeDefinition(field.type, allTypeNames, diagnostics);

    // ZOD-6: optional -> .optional()
    if (field.optional) {
      zodType += ".optional()";
    }

    parts.push(`  ${fieldName}: ${zodType},`);
  }

  return `z.object({\n${parts.join("\n")}\n})`;
}

function handleUnion(
  types: TypeDefinition[],
  allTypeNames: Set<string>,
  diagnostics: Diagnostic[]
): string {
  // ZOD-3: 2-variant union with null -> z.nullable(T)
  if (types.length === 2) {
    const nullIdx = types.findIndex(
      (t) => t.kind === "primitive" && t.type === "null"
    );
    if (nullIdx !== -1) {
      const otherIdx = nullIdx === 0 ? 1 : 0;
      const otherSchema = mapTypeDefinition(types[otherIdx], allTypeNames, diagnostics);
      return `z.nullable(${otherSchema})`;
    }
  }

  const schemas = types.map((t) => mapTypeDefinition(t, allTypeNames, diagnostics));
  return `z.union([${schemas.join(", ")}])`;
}
