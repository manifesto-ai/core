import type { TypeDefinition, TypeSpec } from "@manifesto-ai/core";
import type {
  CodegenContext,
  CodegenOutput,
  CodegenPlugin,
  Diagnostic,
} from "../types.js";
import type { TsPluginArtifacts } from "./ts-plugin.js";
import {
  createTypeNameAliasMap,
  renderPropertyKey,
  type IdentifierAliasMap,
} from "../identifier-safety.js";

const PLUGIN_NAME = "codegen-plugin-zod";
const TS_PLUGIN_NAME = "codegen-plugin-ts";

/**
 * @deprecated Prefer `createDomainPlugin()` for canonical domain facade output.
 */
export interface ZodPluginOptions {
  readonly schemasFile?: string;
}

/**
 * @deprecated Prefer `createDomainPlugin()` for canonical domain facade output.
 */
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

      // Sanitized aliases mirror the TS plugin so cross-file references and
      // z.ZodType annotations stay consistent.
      const typeAliases = createTypeNameAliasMap(sortedTypeNames);
      for (const [name, alias] of typeAliases) {
        if (alias !== name) {
          diagnostics.push({
            level: "warn",
            plugin: PLUGIN_NAME,
            message: `Schema type name "${name}" is not a valid TypeScript type name. Emitting sanitized alias "${alias}".`,
          });
        }
      }

      for (const name of sortedTypeNames) {
        const spec = ctx.schema.types[name];
        schemaDecls.push(renderNamedSchema(name, spec, typeAliases, tsArtifacts, diagnostics));
      }

      // Build imports
      const imports: string[] = ['import { z } from "zod";'];

      // ZOD-4: Import TS types for annotations when available
      if (tsArtifacts && tsArtifacts.typeNames.length > 0) {
        const typeImports = sortedTypeNames
          .map((n) => typeAliases.get(n) ?? n)
          .filter((alias) => tsArtifacts.typeNames.includes(alias))
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
  typeAliases: IdentifierAliasMap,
  tsArtifacts: TsPluginArtifacts | undefined,
  diagnostics: Diagnostic[]
): string {
  const alias = typeAliases.get(name) ?? name;
  const schemaName = `${alias}Schema`;
  const zodExpr = mapTypeDefinition(spec.definition, typeAliases, diagnostics);

  // ZOD-4/ZOD-5: Type annotation when TS artifacts available
  const hasTypeAnnotation = tsArtifacts && tsArtifacts.typeNames.includes(alias);
  const annotation = hasTypeAnnotation ? `: z.ZodType<${alias}>` : "";

  return `export const ${schemaName}${annotation} = ${zodExpr};`;
}

function mapTypeDefinition(
  def: TypeDefinition,
  typeAliases: IdentifierAliasMap,
  diagnostics: Diagnostic[]
): string {
  switch (def.kind) {
    case "primitive":
      return mapPrimitiveZod(def.type);

    case "literal":
      return `z.literal(${renderLiteralValue(def.value)})`;

    case "array":
      return `z.array(${mapTypeDefinition(def.element, typeAliases, diagnostics)})`;

    case "record":
      return handleRecord(def, typeAliases, diagnostics);

    case "object":
      return renderZodObject(def.fields, typeAliases, diagnostics);

    case "union":
      return handleUnion(def.types, typeAliases, diagnostics);

    case "ref":
      // ZOD-2: Always z.lazy for circular reference support
      return `z.lazy(() => ${typeAliases.get(def.name) ?? def.name}Schema)`;

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
  typeAliases: IdentifierAliasMap,
  diagnostics: Diagnostic[]
): string {
  const valueSchema = mapTypeDefinition(def.value, typeAliases, diagnostics);

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
  typeAliases: IdentifierAliasMap,
  diagnostics: Diagnostic[]
): string {
  const sortedFields = Object.keys(fields).sort();
  const parts: string[] = [];

  for (const fieldName of sortedFields) {
    const field = fields[fieldName];
    let zodType = mapTypeDefinition(field.type, typeAliases, diagnostics);

    // ZOD-6: optional -> .optional()
    if (field.optional) {
      zodType += ".optional()";
    }

    parts.push(`  ${renderPropertyKey(fieldName)}: ${zodType},`);
  }

  return `z.object({\n${parts.join("\n")}\n})`;
}

function handleUnion(
  types: TypeDefinition[],
  typeAliases: IdentifierAliasMap,
  diagnostics: Diagnostic[]
): string {
  // ZOD-3: 2-variant union with null -> z.nullable(T)
  if (types.length === 2) {
    const nullIdx = types.findIndex(
      (t) => t.kind === "primitive" && t.type === "null"
    );
    if (nullIdx !== -1) {
      const otherIdx = nullIdx === 0 ? 1 : 0;
      const otherSchema = mapTypeDefinition(types[otherIdx], typeAliases, diagnostics);
      return `z.nullable(${otherSchema})`;
    }
  }

  const schemas = types.map((t) => mapTypeDefinition(t, typeAliases, diagnostics));
  return `z.union([${schemas.join(", ")}])`;
}
