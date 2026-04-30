import type { CodegenContext, CodegenOutput, CodegenPlugin, Diagnostic } from "../types.js";
import type { ActionSpec, FieldSpec, TypeDefinition, TypeSpec } from "@manifesto-ai/core";
import { createInferenceContext, inferComputedType } from "./domain-type-inference.js";
import {
  fieldSpecToDomainField,
  fieldSpecToDomainType,
  renderDomainType,
  unknownType,
  type DomainTypeField,
} from "./domain-type-model.js";
import { typeDefinitionToDomainType } from "./domain-type-definition.js";

const PLUGIN_NAME = "codegen-plugin-domain";

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

      const interfaceName = options?.interfaceName
        ?? deriveInterfaceName(ctx)
        ?? "Domain";
      const facadePrefix = deriveFacadePrefix(interfaceName);
      const fileName = options?.fileName ?? deriveFileName(ctx.sourceId);
      const schemaTypes = ctx.schema.types;
      const namedTypeDeclarations = renderNamedTypeDeclarations(
        schemaTypes,
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
      const actionLines = actionNames.map((name) => {
        const action = ctx.schema.actions[name];
        return `    ${name}: ${renderActionSignature(action, schemaTypes, diagnostics)}`;
      });

      const sections = [
        "import type {",
        "  ActionArgs,",
        "  ActionHandle,",
        "  ActionInput,",
        "  ManifestoApp,",
        "  RuntimeMode,",
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
        "  readonly actions: {",
        actionLines.join("\n"),
        "  }",
        "}",
        "",
        `export type ${facadePrefix}ActionInput<Name extends keyof ${interfaceName}["actions"] & string> =`,
        `  ActionInput<${interfaceName}, Name>;`,
        "",
        `export type ${facadePrefix}ActionArgs<Name extends keyof ${interfaceName}["actions"] & string> =`,
        `  ActionArgs<${interfaceName}, Name>;`,
        "",
        `export type ${facadePrefix}Actions<TMode extends RuntimeMode> = {`,
        `  readonly [Name in keyof ${interfaceName}["actions"] & string]:`,
        `    ActionHandle<${interfaceName}, Name, TMode>;`,
        "};",
        "",
        `export type ${facadePrefix}ActionAccessor<TMode extends RuntimeMode> =`,
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
      return `    ${name}${optional}: ${renderDomainType(field.type)}`;
    })
    .join("\n");
}

function stateFieldToDomainField(
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
    type: typeDefinitionToDomainType(fieldType, {
      diagnostics,
      plugin: PLUGIN_NAME,
      path: `state.fieldTypes.${name}`,
      resolveRef: createTypeRefResolver(schemaTypes),
    }),
    optional: !spec.required,
  };
}

function renderActionSignature(
  action: ActionSpec,
  schemaTypes: Readonly<Record<string, TypeSpec>>,
  diagnostics: Diagnostic[]
): string {
  const params = action.params;
  if (params) {
    if (params.length === 0) {
      return "() => void";
    }

    const renderedParams = params.map((name) => {
      const field = resolveActionParamField(action, name, schemaTypes, diagnostics);
      const optional = field.optional ? "?" : "";
      return `${name}${optional}: ${renderDomainType(field.type)}`;
    });

    return `(${renderedParams.join(", ")}) => void`;
  }

  const inputType = action.inputType;
  if (inputType) {
    const renderedInput = renderDomainType(typeDefinitionToDomainType(inputType, {
      diagnostics,
      plugin: PLUGIN_NAME,
      path: "action.inputType",
      resolveRef: createTypeRefResolver(schemaTypes),
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
  diagnostics: Diagnostic[]
): DomainTypeField {
  const inputTypeField = getInputTypeObjectField(action.inputType, name);
  if (inputTypeField) {
    return {
      type: typeDefinitionToDomainType(inputTypeField.type, {
        diagnostics,
        plugin: PLUGIN_NAME,
        path: `action.inputType.fields.${name}`,
        resolveRef: createTypeRefResolver(schemaTypes),
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
  diagnostics: Diagnostic[]
): string[] {
  return Object.keys(schemaTypes)
    .sort()
    .map((name) => renderNamedTypeDeclaration(name, schemaTypes[name], schemaTypes, diagnostics));
}

function renderNamedTypeDeclaration(
  name: string,
  spec: TypeSpec,
  schemaTypes: Readonly<Record<string, TypeSpec>>,
  diagnostics: Diagnostic[]
): string {
  if (spec.definition.kind === "object") {
    return renderNamedObjectDeclaration(name, spec.definition, schemaTypes, diagnostics);
  }

  const renderedType = renderDomainType(typeDefinitionToDomainType(spec.definition, {
    diagnostics,
    plugin: PLUGIN_NAME,
    path: `types.${name}`,
    resolveRef: createTypeRefResolver(schemaTypes),
  }));
  return `export type ${name} = ${renderedType};`;
}

function renderNamedObjectDeclaration(
  name: string,
  definition: Extract<TypeDefinition, { readonly kind: "object" }>,
  schemaTypes: Readonly<Record<string, TypeSpec>>,
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
        resolveRef: createTypeRefResolver(schemaTypes),
      }));
      return `  ${fieldName}${optional}: ${renderedType};`;
    });

  return [
    `export interface ${name} {`,
    ...fieldLines,
    "}",
  ].join("\n");
}

function createTypeRefResolver(
  schemaTypes: Readonly<Record<string, TypeSpec>>
): (name: string) => boolean {
  return (name) => Object.hasOwn(schemaTypes, name);
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
