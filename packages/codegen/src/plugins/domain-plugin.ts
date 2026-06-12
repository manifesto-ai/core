import type { CodegenContext, CodegenOutput, CodegenPlugin, Diagnostic } from "../types.js";
import type { ActionSpec, ContextSpec, FieldSpec, TypeDefinition, TypeSpec } from "@manifesto-ai/core";
import { createInferenceContext, inferComputedType } from "./domain-type-inference.js";
import {
  fieldSpecToDomainField,
  fieldSpecToDomainType,
  primitiveType,
  refType,
  renderDomainType,
  unionOf,
  unknownType,
  type DomainTypeField,
} from "./domain-type-model.js";
import { typeDefinitionToDomainType } from "./domain-type-definition.js";
import { toContextSafeType } from "./domain-context-type.js";
import {
  createTypeNameAliasMap,
  isTypeDeclarationName,
  renderPropertyKey,
  sanitizeIdentifier,
  sanitizeParameterNames,
  type IdentifierAliasMap,
} from "../identifier-safety.js";

const PLUGIN_NAME = "codegen-plugin-domain";
const RESERVED_PUBLIC_ACTION_NAMES = new Set([
  "then",
  "constructor",
  "prototype",
  "__proto__",
]);

export interface DomainPluginOptions {
  readonly fileName?: string;
  readonly interfaceName?: string;
  readonly includeReservedState?: boolean;
}

export function createDomainPlugin(options?: DomainPluginOptions): CodegenPlugin {
  return {
    name: PLUGIN_NAME,
    generate(ctx: CodegenContext): CodegenOutput {
      const diagnostics: Diagnostic[] = [];
      const inference = createInferenceContext(ctx.schema, diagnostics, PLUGIN_NAME);

      const requestedInterfaceName = options?.interfaceName
        ?? deriveInterfaceName(ctx)
        ?? "Domain";
      const interfaceName = ensureTypeDeclarationName(requestedInterfaceName);
      if (interfaceName !== requestedInterfaceName) {
        diagnostics.push({
          level: "warn",
          plugin: PLUGIN_NAME,
          message: `Domain interface name "${requestedInterfaceName}" is not a valid TypeScript identifier. Emitting sanitized name "${interfaceName}".`,
        });
      }
      const facadePrefix = deriveFacadePrefix(interfaceName);
      const fileName = options?.fileName ?? deriveFileName(ctx.sourceId);
      const schemaTypes = ctx.schema.types;
      const typeAliases = createTypeNameAliasMap(
        Object.keys(schemaTypes),
        [interfaceName]
      );
      for (const [name, alias] of typeAliases) {
        if (alias !== name) {
          diagnostics.push({
            level: "warn",
            plugin: PLUGIN_NAME,
            message: `Schema type name "${name}" is not a valid TypeScript type name. Emitting sanitized alias "${alias}".`,
          });
        }
      }
      const namedTypeDeclarations = renderNamedTypeDeclarations(
        schemaTypes,
        typeAliases,
        diagnostics
      );

      const stateFields = renderFieldBlock(
        ctx.schema.state.fields,
        { includeReservedState: options?.includeReservedState ?? false },
        (name, spec) => stateFieldToDomainField(
          name,
          spec,
          ctx.schema.state.fieldTypes,
          schemaTypes,
          typeAliases,
          diagnostics
        )
      );

      const computedFields = renderFieldBlock(
        ctx.schema.computed.fields,
        { includeReservedState: true },
        (name) => ({
          type: inferComputedType(name, inference),
          optional: false,
        })
      );

      const actionNames = Object.keys(ctx.schema.actions).sort();
      const reservedActionNames = actionNames.filter((name) =>
        RESERVED_PUBLIC_ACTION_NAMES.has(name)
      );
      if (reservedActionNames.length > 0) {
        diagnostics.push({
          level: "error",
          plugin: PLUGIN_NAME,
          message: `Reserved public action name${
            reservedActionNames.length === 1 ? "" : "s"
          } ${reservedActionNames.map((name) => `"${name}"`).join(", ")} cannot be emitted in SDK v5 facade output`,
        });
        return {
          patches: [],
          diagnostics,
        };
      }
      const actionLines = actionNames.map((name) => {
        const action = ctx.schema.actions[name];
        return `    ${renderPropertyKey(name)}: ${renderActionSignature(name, action, schemaTypes, typeAliases, diagnostics)}`;
      });

      const contextBlock = ctx.schema.context
        ? renderContextFieldBlock(ctx.schema.context, schemaTypes, diagnostics)
        : null;

      const sdkImports = [
        "ActionArgs",
        "ActionHandle",
        "ActionInput",
        ...(contextBlock?.usesJsonValue ? ["JsonValue"] : []),
        "ManifestoApp",
        "RuntimeMode",
      ];

      const sections = [
        "import type {",
        ...sdkImports.map((name) => `  ${name},`),
        "} from \"@manifesto-ai/sdk\";",
        "",
        ...(namedTypeDeclarations.length > 0
          ? [namedTypeDeclarations.join("\n\n"), ""]
          : []),
        "export interface " + interfaceName + " {",
        "  readonly state: {",
        stateFields,
        "  }",
        "  readonly computed: {",
        computedFields,
        "  }",
        ...(contextBlock
          ? ["  readonly context: {", contextBlock.fields, "  }"]
          : []),
        "  readonly actions: {",
        actionLines.join("\n"),
        "  }",
        "}",
        "",
        ...(contextBlock
          ? [
              `export type ${facadePrefix}ExternalContext = ${interfaceName}["context"];`,
              "",
            ]
          : []),
        `export type ${facadePrefix}ActionInput<Name extends keyof ${interfaceName}["actions"] & string> =`,
        `  ActionInput<${interfaceName}, Name>;`,
        "",
        `export type ${facadePrefix}ActionArgs<Name extends keyof ${interfaceName}["actions"] & string> =`,
        `  ActionArgs<${interfaceName}, Name>;`,
        "",
        `export type ${facadePrefix}ActionSurface<TMode extends RuntimeMode> = {`,
        `  readonly [Name in keyof ${interfaceName}["actions"] & string]:`,
        `    ActionHandle<${interfaceName}, Name, TMode>;`,
        "};",
        "",
        `export type ${facadePrefix}ActionSurfaceFromApp<TMode extends RuntimeMode> =`,
        `  ManifestoApp<${interfaceName}, TMode>["action"];`,
        "",
        `export type ${facadePrefix}App<TMode extends RuntimeMode> =`,
        `  ManifestoApp<${interfaceName}, TMode>;`,
      ];

      return {
        patches: [{ op: "set", path: fileName, content: sections.join("\n") + "\n" }],
        diagnostics,
      };
    },
  };
}

function renderFieldBlock<T>(
  source: Record<string, T>,
  options: { includeReservedState: boolean },
  mapField: (name: string, value: T) => DomainTypeField
): string {
  const names = Object.keys(source)
    .filter((name) => options.includeReservedState || !name.startsWith("$"))
    .sort();

  if (names.length === 0) {
    return "";
  }

  return names
    .map((name) => {
      const field = mapField(name, source[name]);
      const optional = field.optional ? "?" : "";
      return `    ${renderPropertyKey(name)}${optional}: ${renderDomainType(field.type)}`;
    })
    .join("\n");
}

function stateFieldToDomainField(
  name: string,
  spec: FieldSpec,
  fieldTypes: Readonly<Record<string, TypeDefinition>> | undefined,
  schemaTypes: Readonly<Record<string, TypeSpec>>,
  typeAliases: IdentifierAliasMap,
  diagnostics: Diagnostic[]
): DomainTypeField {
  const fieldType = fieldTypes?.[name];
  if (!fieldType) {
    return fieldSpecToDomainField(spec);
  }

  return {
    type: typeDefinitionToDomainType(fieldType, {
      diagnostics,
      plugin: PLUGIN_NAME,
      path: `state.fieldTypes.${name}`,
      ...createTypeRefOptions(schemaTypes, typeAliases),
    }),
    optional: !spec.required,
  };
}

type ContextBlock = {
  readonly fields: string;
  readonly usesJsonValue: boolean;
};

function renderContextFieldBlock(
  contextSpec: ContextSpec,
  schemaTypes: Readonly<Record<string, TypeSpec>>,
  diagnostics: Diagnostic[]
): ContextBlock {
  const names = Object.keys(contextSpec.fields)
    .filter((name) => !name.startsWith("$"))
    .sort();
  let usesJsonValue = false;

  const lines = names.map((name) => {
    const field = contextFieldToDomainField(
      name,
      contextSpec.fields[name],
      contextSpec.fieldTypes,
      schemaTypes,
      diagnostics
    );
    // External context is `Readonly<Record<string, JsonValue>>`; optional
    // properties would introduce `undefined`, so absence is encoded as null.
    const declared = field.optional
      ? unionOf([field.type, primitiveType("null")])
      : field.type;
    const safe = toContextSafeType(declared, schemaTypes);
    let rendered: DomainTypeField["type"];
    if (safe === null) {
      usesJsonValue = true;
      rendered = refType("JsonValue");
      diagnostics.push({
        level: "warn",
        plugin: PLUGIN_NAME,
        message: `Context field "${name}" cannot be represented as a JSON-safe TypeScript type. Emitting "JsonValue".`,
      });
    } else {
      rendered = safe;
    }
    return `    ${renderPropertyKey(name)}: ${renderDomainType(rendered)}`;
  });

  return { fields: lines.join("\n"), usesJsonValue };
}

function contextFieldToDomainField(
  name: string,
  spec: FieldSpec,
  fieldTypes: Readonly<Record<string, TypeDefinition>> | undefined,
  schemaTypes: Readonly<Record<string, TypeSpec>>,
  diagnostics: Diagnostic[]
): DomainTypeField {
  const fieldType = fieldTypes?.[name];
  if (!fieldType) {
    return fieldSpecToDomainField(spec);
  }

  return {
    // Refs are intentionally not renamed here: `toContextSafeType()` inlines
    // every ref structurally, so emitted context types never reference named
    // declarations.
    type: typeDefinitionToDomainType(fieldType, {
      diagnostics,
      plugin: PLUGIN_NAME,
      path: `context.fieldTypes.${name}`,
      resolveRef: (typeName) => Object.hasOwn(schemaTypes, typeName),
    }),
    optional: !spec.required,
  };
}

function renderActionSignature(
  actionName: string,
  action: ActionSpec,
  schemaTypes: Readonly<Record<string, TypeSpec>>,
  typeAliases: IdentifierAliasMap,
  diagnostics: Diagnostic[]
): string {
  const params = action.params;
  if (params) {
    if (params.length === 0) {
      return "() => void";
    }

    const fields = params.map((name) => resolveActionParamField(action, name, schemaTypes, typeAliases, diagnostics));
    const paramNames = sanitizeParameterNames(params);
    params.forEach((name, index) => {
      if (paramNames[index] !== name) {
        diagnostics.push({
          level: "warn",
          plugin: PLUGIN_NAME,
          message: `Action "${actionName}" parameter "${name}" is not a valid TypeScript identifier. Emitting sanitized parameter name "${paramNames[index]}".`,
        });
      }
    });
    const renderedParams = params.map((name, index) => {
      const paramName = paramNames[index]!;
      const field = fields[index]!;
      const renderedType = renderDomainType(field.type);
      const hasLaterRequired = fields.slice(index + 1).some((candidate) => !candidate.optional);
      if (field.optional && hasLaterRequired) {
        return `${paramName}: ${renderedType} | undefined`;
      }
      const optional = field.optional ? "?" : "";
      return `${paramName}${optional}: ${renderedType}`;
    });

    return `(${renderedParams.join(", ")}) => void`;
  }

  const inputType = action.inputType;
  if (inputType) {
    const renderedInput = renderDomainType(typeDefinitionToDomainType(inputType, {
      diagnostics,
      plugin: PLUGIN_NAME,
      path: "action.inputType",
      ...createTypeRefOptions(schemaTypes, typeAliases),
    }));
    return `(input: ${renderedInput}) => void`;
  }

  const input = action.input;
  if (!input || typeof input !== "object" || !("type" in input)) {
    return "() => void";
  }

  return `(input: ${renderDomainType(fieldSpecToDomainType(input))}) => void`;
}

function resolveActionParamField(
  action: ActionSpec,
  name: string,
  schemaTypes: Readonly<Record<string, TypeSpec>>,
  typeAliases: IdentifierAliasMap,
  diagnostics: Diagnostic[]
): DomainTypeField {
  const inputTypeField = getInputTypeObjectField(action.inputType, name);
  if (inputTypeField) {
    return {
      type: typeDefinitionToDomainType(inputTypeField.type, {
        diagnostics,
        plugin: PLUGIN_NAME,
        path: `action.inputType.fields.${name}`,
        ...createTypeRefOptions(schemaTypes, typeAliases),
      }),
      optional: inputTypeField.optional,
    };
  }

  const inputField = action.input?.type === "object"
    ? action.input.fields?.[name]
    : undefined;
  if (inputField) {
    return fieldSpecToDomainField(inputField);
  }

  diagnostics.push({
    level: "warn",
    plugin: PLUGIN_NAME,
    message: `Action parameter "${name}" is not declared by action input metadata. Emitting "unknown".`,
  });
  return {
    type: unknownType(),
    optional: false,
  };
}

function renderNamedTypeDeclarations(
  schemaTypes: Readonly<Record<string, TypeSpec>>,
  typeAliases: IdentifierAliasMap,
  diagnostics: Diagnostic[]
): string[] {
  return Object.keys(schemaTypes)
    .sort()
    .map((name) => renderNamedTypeDeclaration(name, schemaTypes[name], schemaTypes, typeAliases, diagnostics));
}

function renderNamedTypeDeclaration(
  name: string,
  spec: TypeSpec,
  schemaTypes: Readonly<Record<string, TypeSpec>>,
  typeAliases: IdentifierAliasMap,
  diagnostics: Diagnostic[]
): string {
  const declarationName = typeAliases.get(name) ?? name;
  if (spec.definition.kind === "object") {
    return renderNamedObjectDeclaration(name, declarationName, spec.definition, schemaTypes, typeAliases, diagnostics);
  }

  const renderedType = renderDomainType(typeDefinitionToDomainType(spec.definition, {
    diagnostics,
    plugin: PLUGIN_NAME,
    path: `types.${name}`,
    ...createTypeRefOptions(schemaTypes, typeAliases),
  }));
  return `export type ${declarationName} = ${renderedType};`;
}

function renderNamedObjectDeclaration(
  name: string,
  declarationName: string,
  definition: Extract<TypeDefinition, { readonly kind: "object" }>,
  schemaTypes: Readonly<Record<string, TypeSpec>>,
  typeAliases: IdentifierAliasMap,
  diagnostics: Diagnostic[]
): string {
  const fieldLines = Object.keys(definition.fields)
    .sort()
    .map((fieldName) => {
      const field = definition.fields[fieldName];
      const optional = field.optional ? "?" : "";
      const renderedType = renderDomainType(typeDefinitionToDomainType(field.type, {
        diagnostics,
        plugin: PLUGIN_NAME,
        path: `types.${name}.fields.${fieldName}`,
        ...createTypeRefOptions(schemaTypes, typeAliases),
      }));
      return `  ${renderPropertyKey(fieldName)}${optional}: ${renderedType};`;
    });

  return [
    `export interface ${declarationName} {`,
    ...fieldLines,
    "}",
  ].join("\n");
}

function createTypeRefOptions(
  schemaTypes: Readonly<Record<string, TypeSpec>>,
  typeAliases: IdentifierAliasMap
): {
  readonly resolveRef: (name: string) => boolean;
  readonly renameRef: (name: string) => string;
} {
  return {
    resolveRef: (name) => Object.hasOwn(schemaTypes, name),
    renameRef: (name) => typeAliases.get(name) ?? name,
  };
}

function ensureTypeDeclarationName(name: string): string {
  if (isTypeDeclarationName(name)) {
    return name;
  }
  let sanitized = sanitizeIdentifier(name);
  while (!isTypeDeclarationName(sanitized)) {
    sanitized = `_${sanitized}`;
  }
  return sanitized;
}

function getInputTypeObjectField(
  inputType: TypeDefinition | undefined,
  name: string
): { readonly type: TypeDefinition; readonly optional: boolean } | null {
  if (!inputType || inputType.kind !== "object") {
    return null;
  }
  return inputType.fields[name] ?? null;
}

function deriveInterfaceName(ctx: CodegenContext): string | null {
  const metaName = ctx.schema.meta?.name?.trim();
  if (metaName) {
    return metaName;
  }

  const basename = basenameWithoutExtension(ctx.sourceId);
  if (!basename) {
    return null;
  }

  const candidate = pascalCase(basename);
  return candidate.endsWith("Domain") ? candidate : `${candidate}Domain`;
}

function deriveFileName(sourceId?: string): string {
  if (!sourceId) {
    return "domain.domain.ts";
  }

  const normalized = sourceId.replace(/\\/g, "/");
  const stem = normalized.replace(/\.[^.]+$/, "");
  return `${stem}.domain.ts`;
}

function basenameWithoutExtension(sourceId?: string): string | null {
  if (!sourceId) {
    return null;
  }

  const normalized = sourceId.replace(/\\/g, "/");
  const basename = normalized.split("/").pop() ?? "";
  if (!basename) {
    return null;
  }

  return basename.replace(/\.[^.]+$/, "");
}

function pascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
}

function deriveFacadePrefix(interfaceName: string): string {
  if (interfaceName.endsWith("Domain") && interfaceName.length > "Domain".length) {
    return interfaceName.slice(0, -"Domain".length);
  }
  return interfaceName;
}
