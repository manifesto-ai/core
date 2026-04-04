import {
  type EffectContext as HostEffectContext,
  type EffectHandler as HostEffectHandler,
  type ManifestoHost,
  createHost,
} from "@manifesto-ai/host";
import {
  createIntent as createCoreIntent,
  extractDefaults,
  hashSchemaSync,
  semanticPathToPatchPath,
  type DomainSchema,
  type Intent,
  type Patch,
  type Snapshot as CoreSnapshot,
} from "@manifesto-ai/core";
import {
  compileMelDomain,
  parse as parseMel,
  tokenize as tokenizeMel,
} from "@manifesto-ai/compiler";

import {
  ACTION_PARAM_NAMES,
  activateComposable,
  attachRuntimeKernelFactory,
  createBaseRuntimeInstance,
  createRuntimeKernel,
} from "./internal.js";
import {
  type CreateIntentArgs,
  type BaseComposableLaws,
  type ComposableManifesto,
  type EffectHandler,
  type ManifestoDomainShape,
  type TypedActionRef,
  type TypedCreateIntent,
  type TypedIntent,
  type TypedMEL,
} from "./types.js";
import {
  buildSnapshotProjectionPlan,
  cloneAndDeepFreeze,
  projectEffectContextSnapshot,
  type SnapshotProjectionPlan,
} from "./snapshot-projection.js";
import {
  CompileError,
  ManifestoError,
  ReservedEffectError,
} from "./errors.js";

const RESERVED_EFFECT_TYPE = "system.get";
const RESERVED_NAMESPACE_PREFIX = "system.";
const BASE_LAWS: BaseComposableLaws = Object.freeze({ __baseLaws: true });

type RuntimeActionRef = TypedActionRef<ManifestoDomainShape> & {
  readonly [ACTION_PARAM_NAMES]: readonly string[] | null;
};

type ActionParamMetadata = readonly string[] | null;

type ResolvedSchema = {
  readonly schema: DomainSchema;
  readonly actionParamMetadata: Readonly<Record<string, ActionParamMetadata>>;
  readonly projectionPlan: SnapshotProjectionPlan;
};

type CompiledSchema = Omit<ResolvedSchema, "projectionPlan">;

export function createManifesto<T extends ManifestoDomainShape>(
  schemaInput: DomainSchema | string,
  effects: Record<string, EffectHandler>,
): ComposableManifesto<T, BaseComposableLaws> {
  if (RESERVED_EFFECT_TYPE in effects) {
    throw new ReservedEffectError(RESERVED_EFFECT_TYPE);
  }

  const resolved = resolveSchema(schemaInput);
  validateReservedNamespaces(resolved.schema);

  const manifesto = {
    _laws: BASE_LAWS,
    schema: resolved.schema,
    activate() {
      activateComposable(manifesto);
      return createBaseRuntimeInstance(
        createRuntimeKernel<T>({
          schema: resolved.schema,
          projectionPlan: resolved.projectionPlan,
          host: createInternalHost(
            resolved.schema,
            resolved.projectionPlan,
            effects,
          ),
          MEL: buildTypedMel<T>(resolved.schema, resolved.actionParamMetadata),
          createIntent: buildCreateIntent<T>(),
        }),
      );
    },
  };

  return attachRuntimeKernelFactory(manifesto, () =>
    createRuntimeKernel<T>({
      schema: resolved.schema,
      projectionPlan: resolved.projectionPlan,
      host: createInternalHost(resolved.schema, resolved.projectionPlan, effects),
      MEL: buildTypedMel<T>(resolved.schema, resolved.actionParamMetadata),
      createIntent: buildCreateIntent<T>(),
    }),
  );
}

function resolveSchema(schema: DomainSchema | string): ResolvedSchema {
  const resolved: CompiledSchema = typeof schema === "string"
    ? compileSchema(schema)
    : {
      schema,
      actionParamMetadata: deriveActionParamMetadata(schema),
    };

  const normalizedSchema = withPlatformNamespaces(resolved.schema);
  return {
    schema: normalizedSchema,
    actionParamMetadata: resolved.actionParamMetadata,
    projectionPlan: buildSnapshotProjectionPlan(normalizedSchema),
  };
}

function compileSchema(source: string): CompiledSchema {
  const result = compileMelDomain(source, { mode: "domain" });

  if (result.errors.length > 0) {
    const formatted = result.errors.map((diagnostic) => {
      const loc = diagnostic.location;
      if (!loc || (loc.start.line === 0 && loc.start.column === 0)) {
        return `[${diagnostic.code}] ${diagnostic.message}`;
      }

      const header = `[${diagnostic.code}] ${diagnostic.message} (${loc.start.line}:${loc.start.column})`;
      const line = source.split("\n")[loc.start.line - 1];
      if (!line) {
        return header;
      }

      const lineNum = String(loc.start.line).padStart(4, " ");
      const underlineLen = Math.max(
        1,
        loc.end.line === loc.start.line
          ? Math.min(loc.end.column - loc.start.column, Math.max(1, line.length - loc.start.column + 1))
          : 1,
      );
      const padding = " ".repeat(lineNum.length + 3 + loc.start.column - 1);
      return `${header}\n${lineNum} | ${line}\n${padding}${"^".repeat(underlineLen)}`;
    }).join("\n\n");

    throw new CompileError(result.errors, `MEL compilation failed:\n${formatted}`);
  }

  if (!result.schema) {
    throw new ManifestoError("COMPILE_ERROR", "MEL compilation produced no schema");
  }

  const schema = result.schema as DomainSchema;
  return {
    schema,
    actionParamMetadata: deriveActionParamMetadata(
      schema,
      extractActionParamOrderFromMel(source),
    ),
  };
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

function buildTypedMel<T extends ManifestoDomainShape>(
  schema: DomainSchema,
  actionParamMetadata: Readonly<Record<string, ActionParamMetadata>>,
): TypedMEL<T> {
  const actions = Object.fromEntries(
    Object.keys(schema.actions).map((name) => {
      const ref: Record<PropertyKey, unknown> = {
        __kind: "ActionRef",
        name,
      };
      Object.defineProperty(ref, ACTION_PARAM_NAMES, {
        enumerable: false,
        configurable: false,
        writable: false,
        value: Object.hasOwn(actionParamMetadata, name)
          ? actionParamMetadata[name]
          : [],
      });
      return [name, Object.freeze(ref)];
    }),
  );

  const state = Object.fromEntries(
    Object.keys(schema.state.fields)
      .filter((name) => !name.startsWith("$"))
      .map((name) => [name, Object.freeze({
        __kind: "FieldRef",
        path: name,
      })]),
  );

  const computed = Object.fromEntries(
    Object.keys(schema.computed.fields)
      .map((name) => [name, Object.freeze({
        __kind: "ComputedRef",
        path: name,
      })]),
  );

  return Object.freeze({
    actions: Object.freeze(actions),
    state: Object.freeze(state),
    computed: Object.freeze(computed),
  }) as unknown as TypedMEL<T>;
}

function buildCreateIntent<T extends ManifestoDomainShape>(): TypedCreateIntent<T> {
  return <K extends keyof T["actions"]>(
    action: TypedActionRef<T, K>,
    ...args: CreateIntentArgs<T, K>
  ): TypedIntent<T, K> => {
    const actionRef = action as unknown as RuntimeActionRef;
    const intentId = generateUUID();
    const input = packIntentInput(actionRef, args);
    return createCoreIntent(
      String(action.name),
      input,
      intentId,
    ) as TypedIntent<T, K>;
  };
}

function getActionParamNames(input: DomainSchema["actions"][string]["input"]): readonly string[] {
  if (!input || input.type !== "object" || !input.fields) {
    return [];
  }

  return Object.keys(input.fields);
}

function deriveActionParamMetadata(
  schema: DomainSchema,
  actionParamOrder?: Readonly<Record<string, readonly string[]>>,
): Readonly<Record<string, ActionParamMetadata>> {
  return Object.freeze(Object.fromEntries(
    Object.entries(schema.actions).map(([name, action]) => {
      const preferredOrder = actionParamOrder?.[name];
      if (preferredOrder && preferredOrder.length > 0) {
        return [name, Object.freeze([...preferredOrder])];
      }

      if (!action.input || action.input.type !== "object" || !action.input.fields) {
        return [name, []];
      }

      const fieldNames = getActionParamNames(action.input);
      return [name, fieldNames.length <= 1 ? fieldNames : null];
    }),
  ));
}

function extractActionParamOrderFromMel(
  source: string,
): Readonly<Record<string, readonly string[]>> | undefined {
  const lexed = tokenizeMel(source);
  if (lexed.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return undefined;
  }

  const parsed = parseMel(lexed.tokens);
  if (!parsed.program) {
    return undefined;
  }

  return Object.freeze(Object.fromEntries(
    parsed.program.domain.members
      .filter((member) => member.kind === "action")
      .map((action) => [action.name, Object.freeze(action.params.map((param) => param.name))]),
  ));
}

function packIntentInput(action: RuntimeActionRef, args: readonly unknown[]): unknown {
  const paramNames = Object.hasOwn(action, ACTION_PARAM_NAMES)
    ? action[ACTION_PARAM_NAMES]
    : [];
  if (args.length === 0) {
    return undefined;
  }

  if (paramNames === null) {
    if (args.length === 1 && isPlainObject(args[0])) {
      return args[0];
    }

    throw new ManifestoError(
      "INVALID_INTENT_ARGS",
      `Action "${String(action.name)}" requires a single object argument because positional parameter metadata is unavailable`,
    );
  }

  if (paramNames.length === 0) {
    if (args.length === 1) {
      return args[0];
    }

    throw new ManifestoError(
      "INVALID_INTENT_ARGS",
      `Action "${String(action.name)}" does not accept multiple positional arguments`,
    );
  }

  if (args.length === 1 && isPlainObject(args[0]) && paramNames.length > 1) {
    return args[0];
  }

  return Object.fromEntries(args.map((value, index) => [
    paramNames[index] ?? `arg${index}`,
    value,
  ]));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createInternalHost(
  schema: DomainSchema,
  projectionPlan: SnapshotProjectionPlan,
  effects: Record<string, EffectHandler>,
): ManifestoHost {
  const host = createHost(schema, {
    initialData: extractDefaults(schema.state),
  });

  host.registerEffect(RESERVED_EFFECT_TYPE, async (
    _type: string,
    params: Record<string, unknown>,
    ctx: HostEffectContext,
  ): Promise<Patch[]> => {
    const { patches } = executeSystemGet(params, ctx.snapshot as CoreSnapshot);
    return patches;
  });

  for (const [effectType, appHandler] of Object.entries(effects)) {
    const hostHandler: HostEffectHandler = async (
      _type: string,
      params: Record<string, unknown>,
      ctx: HostEffectContext,
    ): Promise<Patch[]> => {
      const patches = await appHandler(params, {
        snapshot: cloneAndDeepFreeze(
          projectEffectContextSnapshot(ctx.snapshot, projectionPlan),
        ),
      });
      return patches as Patch[];
    };

    host.registerEffect(effectType, hostHandler);
  }

  return host;
}

interface SystemGetReadParams {
  path: string;
  target?: string;
}

interface SystemGetGenerateParams {
  key: string;
  into: string;
}

function isGenerateParams(params: unknown): params is SystemGetGenerateParams {
  return (
    typeof params === "object" &&
    params !== null &&
    "key" in params &&
    "into" in params
  );
}

function executeSystemGet(
  params: unknown,
  snapshot: CoreSnapshot,
): { patches: Patch[] } {
  if (isGenerateParams(params)) {
    return {
      patches: [{
        op: "set",
        path: normalizeTargetPath(params.into),
        value: generateSystemValue(params.key),
      }],
    };
  }

  const { path, target } = params as SystemGetReadParams;
  const result = resolvePathValue(path, snapshot);
  if (!target) {
    return { patches: [] };
  }

  return {
    patches: [{
      op: "set",
      path: normalizeTargetPath(target),
      value: result.value,
    }],
  };
}

function generateSystemValue(key: string): unknown {
  switch (key) {
    case "uuid":
      return generateUUID();
    case "timestamp":
    case "time.now":
      return Date.now();
    case "isoTimestamp":
      return new Date().toISOString();
    default:
      return null;
  }
}

function normalizeTargetPath(path: string): Patch["path"] {
  const normalized = normalizePath(path);
  const withoutDataRoot = normalized.startsWith("data.")
    ? normalized.slice("data.".length)
    : normalized;
  return semanticPathToPatchPath(withoutDataRoot);
}

function normalizePath(path: string): string {
  if (path.startsWith("/")) {
    return path.slice(1).replace(/\//g, ".");
  }
  return path;
}

function resolvePathValue(
  path: string,
  snapshot: CoreSnapshot,
): { value: unknown; found: boolean } {
  const normalized = normalizePath(path);
  const parts = normalized.split(".");
  if (parts.length === 0) {
    return { value: undefined, found: false };
  }

  const [root, ...rest] = parts;
  let current: unknown;

  switch (root) {
    case "data":
      current = snapshot.data;
      break;
    case "computed":
      current = snapshot.computed;
      break;
    case "system":
      current = snapshot.system;
      break;
    case "meta":
      current = snapshot.meta;
      break;
    default:
      current = snapshot.data;
      rest.unshift(root);
      break;
  }

  for (const part of rest) {
    if (current === null || current === undefined || typeof current !== "object") {
      return { value: undefined, found: false };
    }
    current = (current as Record<string, unknown>)[part];
  }

  return { value: current, found: current !== undefined };
}
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
