import type { CodegenContext, CodegenOutput, CodegenPlugin, Diagnostic } from "../types.js";
import type { FieldSpec } from "@manifesto-ai/core";
import { createInferenceContext, inferComputedType } from "./domain-type-inference.js";
import {
  fieldSpecToDomainField,
  fieldSpecToDomainType,
  renderDomainType,
  type DomainTypeField,
} from "./domain-type-model.js";

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
      const fileName = options?.fileName ?? deriveFileName(ctx.sourceId);

      const stateFields = renderFieldBlock(
        ctx.schema.state.fields,
        { includeReservedState: options?.includeReservedState ?? false },
        (_name, spec) => fieldSpecToDomainField(spec)
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
        return `    ${name}: ${renderActionSignature(action.input)}`;
      });

      const sections = [
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

function renderActionSignature(input: FieldSpec | undefined): string {
  if (!input || typeof input !== "object" || !("type" in input)) {
    return "() => void";
  }

  if (input.type !== "object" || !input.fields) {
    return `(input: ${renderDomainType(fieldSpecToDomainType(input))}) => void`;
  }

  const names = Object.keys(input.fields);
  if (names.length === 0) {
    return "() => void";
  }

  const params = names.map((name) => {
    const field = fieldSpecToDomainField(input.fields![name]);
    const optional = field.optional ? "?" : "";
    return `${name}${optional}: ${renderDomainType(field.type)}`;
  });

  return `(${params.join(", ")}) => void`;
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
