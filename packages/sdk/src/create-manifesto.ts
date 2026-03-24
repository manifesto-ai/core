/**
 * createManifesto() Factory
 *
 * The sole SDK-owned concept. Creates a ManifestoInstance that composes
 * the four protocol axes (Core, Host, World, Compiler) into a single handle.
 *
 * @see SDK SPEC v1.0.0 §5
 * @see ADR-010
 * @module
 */

import {
  createHost,
  type ManifestoHost,
  type EffectHandler as HostEffectHandler,
  type EffectContext as HostEffectContext,
} from "@manifesto-ai/host";
import {
  type DomainSchema,
  type Patch,
  type Snapshot,
  type Intent,
  semanticPathToPatchPath,
  extractDefaults,
} from "@manifesto-ai/core";
import { compileMelDomain } from "@manifesto-ai/compiler";

import type {
  ManifestoConfig,
  ManifestoInstance,
  ManifestoEvent,
  ManifestoEventPayload,
  EffectHandler,
  Selector,
  Unsubscribe,
} from "./types.js";
import { ReservedEffectError, DisposedError, ManifestoError, CompileError } from "./errors.js";

// =============================================================================
// Constants
// =============================================================================

/** Reserved effect type used by the compiler for $system.* references. */
const RESERVED_EFFECT_TYPE = "system.get";

/** Reserved namespace prefix for system actions. */
const RESERVED_NAMESPACE_PREFIX = "system.";

// =============================================================================
// createManifesto() — SDK SPEC v1.0.0 §5
// =============================================================================

/**
 * Create a ManifestoInstance.
 *
 * This is the sole entry point for SDK consumers. It composes the protocol
 * axes (Core via Host, Host, World, Compiler) into a single handle with
 * 5 methods: dispatch, subscribe, on, getSnapshot, dispose.
 *
 * @see SDK-FACTORY-1 through SDK-FACTORY-5
 * @see SDK-INV-1 through SDK-INV-6
 */
export function createManifesto(
  config: ManifestoConfig,
): ManifestoInstance {
  // ─── INV-3: Schema resolution ──────────────────────────────────────────
  const schema = resolveSchema(config.schema);

  // ─── INV-4: Reserved effect protection ─────────────────────────────────
  if (RESERVED_EFFECT_TYPE in config.effects) {
    throw new ReservedEffectError(RESERVED_EFFECT_TYPE);
  }

  // Validate no user actions use reserved namespace
  validateReservedNamespaces(schema);

  // ─── INV-5: Host creation + effect registration ────────────────────────
  const host = createInternalHost(schema, config.effects, config.snapshot);

  // ─── State holder (closure-captured) ───────────────────────────────────
  // Host always initializes with a snapshot (initialData defaults to {})
  let currentSnapshot: Snapshot = host.getSnapshot()!;

  // ─── Subscription store ────────────────────────────────────────────────
  const subscribers = new Set<Subscriber<unknown>>();

  // ─── Event channel (telemetry) ─────────────────────────────────────────
  const eventListeners = new Map<ManifestoEvent, Set<(payload: ManifestoEventPayload) => void>>();

  // ─── Serial dispatch queue (SDK-INV-5) ─────────────────────────────────
  let dispatchQueue: Promise<void> = Promise.resolve();

  // ─── Disposed flag ─────────────────────────────────────────────────────
  let disposed = false;

  // ─── Guard function ────────────────────────────────────────────────────
  const guard = config.guard ?? null;

  // =========================================================================
  // dispatch() — SDK-DISPATCH-1~4
  // =========================================================================

  function dispatch(intent: Intent): void {
    // SDK-DISPATCH-4
    if (disposed) {
      throw new DisposedError();
    }

    // SDK-DISPATCH-2: Enrich with intentId if not provided
    const enrichedIntent: Intent = intent.intentId
      ? intent
      : { ...intent, intentId: generateIntentId() };

    // SDK-DISPATCH-1, SDK-DISPATCH-3: Enqueue for serial processing
    const prev = dispatchQueue;
    dispatchQueue = prev
      .catch(() => {}) // Previous failure doesn't block queue
      .then(() => processIntent(enrichedIntent));
    // Tail always resolves
    dispatchQueue = dispatchQueue.catch(() => {});
  }

  /**
   * Process a single intent through the Host dispatch cycle.
   */
  async function processIntent(intent: Intent): Promise<void> {
    // SDK-DISPOSE-1: Do not process queued intents after dispose
    if (disposed) return;

    // SDK-INV-5: Guard evaluates against current snapshot at dequeue time
    if (guard) {
      try {
        // SDK-SNAP-IMMUTABLE: Prevent guard from mutating internal state
        const allowed = guard(intent, Object.freeze(structuredClone(currentSnapshot)));
        if (!allowed) {
          emitEvent("dispatch:rejected", {
            intentId: intent.intentId,
            intent,
            reason: "Guard rejected the intent",
          });
          return;
        }
      } catch (error) {
        emitEvent("dispatch:failed", {
          intentId: intent.intentId,
          intent,
          error: error instanceof Error ? error : new Error(String(error)),
        });
        return;
      }
    }

    try {
      const result = await host.dispatch(intent);

      if (result.status === "error") {
        currentSnapshot = result.snapshot;
        notifySubscribers();
        emitEvent("dispatch:failed", {
          intentId: intent.intentId,
          intent,
          error: result.error ?? new ManifestoError("HOST_ERROR", "Host dispatch failed"),
        });
        return;
      }

      // Update state
      currentSnapshot = result.snapshot;

      // SDK-INV-1: notify subscribers at terminal snapshot only
      notifySubscribers();

      emitEvent("dispatch:completed", {
        intentId: intent.intentId,
        intent,
        snapshot: result.snapshot,
      });
    } catch (error) {
      emitEvent("dispatch:failed", {
        intentId: intent.intentId,
        intent,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  // =========================================================================
  // subscribe() — SDK-SUB-1~4
  // =========================================================================

  function subscribe<R>(
    selector: Selector<R>,
    listener: (value: R) => void,
  ): Unsubscribe {
    if (disposed) return () => {};

    const sub: Subscriber<R> = {
      selector,
      listener,
      lastValue: selector(currentSnapshot),
      initialized: true,
    };

    subscribers.add(sub as Subscriber<unknown>);

    return () => {
      subscribers.delete(sub as Subscriber<unknown>);
    };
  }

  // =========================================================================
  // on() — SDK-EVENT-1~3, SDK-INV-2
  // =========================================================================

  function on(
    event: ManifestoEvent,
    handler: (payload: ManifestoEventPayload) => void,
  ): Unsubscribe {
    if (disposed) return () => {};

    let listeners = eventListeners.get(event);
    if (!listeners) {
      listeners = new Set();
      eventListeners.set(event, listeners);
    }
    listeners.add(handler);

    return () => {
      listeners!.delete(handler);
    };
  }

  // =========================================================================
  // getSnapshot() — SDK-SNAP-1
  // =========================================================================

  function getSnapshot(): Snapshot {
    // SDK-SNAP-IMMUTABLE: Return a frozen copy to prevent external mutation
    // that would bypass the patch/apply pipeline.
    return Object.freeze(structuredClone(currentSnapshot));
  }

  // =========================================================================
  // dispose() — SDK-DISPOSE-1~3
  // =========================================================================

  function dispose(): void {
    if (disposed) return;
    disposed = true;

    // Release all resources
    subscribers.clear();
    eventListeners.clear();
  }

  // =========================================================================
  // Internal helpers
  // =========================================================================

  /** Notify all subscribers with current snapshot (SDK-INV-1). */
  function notifySubscribers(): void {
    // SDK-SNAP-IMMUTABLE: Pass a frozen clone to selectors so that neither
    // selector nor listener can mutate internal state.
    const frozenSnap = Object.freeze(structuredClone(currentSnapshot));
    for (const sub of subscribers) {
      const selected = sub.selector(frozenSnap);

      // Selector-based change detection (SDK-SUB-4)
      if (sub.initialized && Object.is(sub.lastValue, selected)) {
        continue;
      }

      sub.lastValue = selected;
      sub.initialized = true;
      sub.listener(selected);
    }
  }

  /** Emit an event to the telemetry channel. */
  function emitEvent(
    event: ManifestoEvent,
    payload: ManifestoEventPayload,
  ): void {
    const listeners = eventListeners.get(event);
    if (!listeners) return;
    for (const handler of listeners) {
      try {
        handler(payload);
      } catch {
        // Event handlers must not break the dispatch loop
      }
    }
  }

  // =========================================================================
  // Return ManifestoInstance
  // =========================================================================

  return { dispatch, subscribe, on, getSnapshot, dispose };
}

// =============================================================================
// Schema Resolution (INV-3)
// =============================================================================

/**
 * Resolve schema from DomainSchema or MEL text string.
 * Injects platform namespaces ($host, $mel).
 */
function resolveSchema(schema: DomainSchema | string): DomainSchema {
  let domainSchema: DomainSchema;

  if (typeof schema === "string") {
    const result = compileMelDomain(schema, { mode: "domain" });

    if (result.errors.length > 0) {
      const formatted = result.errors.map((d) => {
        const loc = d.location;
        const header = loc && (loc.start.line > 0 || loc.start.column > 0)
          ? `[${d.code}] ${d.message} (${loc.start.line}:${loc.start.column})`
          : `[${d.code}] ${d.message}`;

        if (!loc || loc.start.line === 0) return header;

        const sourceLines = schema.split("\n");
        const lineContent = sourceLines[loc.start.line - 1];
        if (!lineContent) return header;

        const lineNumStr = String(loc.start.line).padStart(4, " ");
        const underlineLen = Math.max(1,
          loc.end.line === loc.start.line
            ? Math.min(loc.end.column - loc.start.column, lineContent.length - loc.start.column + 1)
            : 1);
        const padding = " ".repeat(lineNumStr.length + 3 + loc.start.column - 1);
        return `${header}\n${lineNumStr} | ${lineContent}\n${padding}${"^".repeat(underlineLen)}`;
      }).join("\n\n");

      throw new CompileError(
        result.errors,
        `MEL compilation failed:\n${formatted}`,
      );
    }

    if (!result.schema) {
      throw new ManifestoError(
        "COMPILE_ERROR",
        "MEL compilation produced no schema",
      );
    }

    domainSchema = result.schema as DomainSchema;
  } else {
    domainSchema = schema;
  }

  return withPlatformNamespaces(domainSchema);
}

// =============================================================================
// Platform Namespace Injection (INV-3)
// =============================================================================

/**
 * Inject $host and $mel platform namespaces into schema.
 * Absorbed from runtime/src/schema/schema-manager.ts.
 */
function withPlatformNamespaces(schema: DomainSchema): DomainSchema {
  const fields = { ...schema.state.fields };
  let changed = false;

  // $host namespace
  if (!fields.$host) {
    fields.$host = {
      type: "object",
      required: false,
      default: {},
    };
    changed = true;
  } else if (fields.$host.type !== "object") {
    throw new ManifestoError(
      "SCHEMA_ERROR",
      "Reserved namespace '$host' must be an object field",
    );
  } else if (fields.$host.default === undefined) {
    fields.$host = { ...fields.$host, default: {} };
    changed = true;
  }

  // $mel namespace with guards.intent structure
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
    throw new ManifestoError(
      "SCHEMA_ERROR",
      "Reserved namespace '$mel' must be an object field",
    );
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
      throw new ManifestoError(
        "SCHEMA_ERROR",
        "Reserved namespace '$mel.guards' must be an object field",
      );
    } else {
      let nextGuards = guardsField;
      if (guardsField.default === undefined) {
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
        throw new ManifestoError(
          "SCHEMA_ERROR",
          "Reserved namespace '$mel.guards.intent' must be an object field",
        );
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
      changed = true;
    }
  }

  if (!changed) return schema;

  return {
    ...schema,
    state: {
      ...schema.state,
      fields,
    },
  };
}

// =============================================================================
// Reserved Namespace Validation
// =============================================================================

function validateReservedNamespaces(schema: DomainSchema): void {
  const actions = schema.actions || {};
  for (const actionType of Object.keys(actions)) {
    if (actionType.startsWith(RESERVED_NAMESPACE_PREFIX)) {
      throw new ManifestoError(
        "RESERVED_NAMESPACE",
        `Action type "${actionType}" uses reserved namespace prefix "${RESERVED_NAMESPACE_PREFIX}"`,
      );
    }
  }
}

// =============================================================================
// Internal Host Creation (INV-5)
// Absorbed from runtime/src/execution/internal-host.ts
// =============================================================================

function createInternalHost(
  schema: DomainSchema,
  effects: Record<string, EffectHandler>,
  initialSnapshot?: Snapshot,
): ManifestoHost {
  const host = createHost(schema, {
    initialData: initialSnapshot?.data ?? extractDefaults(schema.state),
  });

  // P1-1: When restoring from a persisted snapshot, use host.reset() to
  // hydrate the full canonical Snapshot (meta, system, input) rather than
  // only forwarding data via initialData which resets meta.version to 0.
  if (initialSnapshot) {
    host.reset(initialSnapshot);
  }

  // Register reserved system.get handler (compiler-internal, CRITICAL)
  host.registerEffect(RESERVED_EFFECT_TYPE, async (
    _type: string,
    params: Record<string, unknown>,
    ctx: HostEffectContext,
  ): Promise<Patch[]> => {
    const { patches } = executeSystemGet(params, ctx.snapshot);
    return patches;
  });

  // Register user effects, adapting 2-param → 3-param signature
  for (const [effectType, appHandler] of Object.entries(effects)) {
    const hostHandler: HostEffectHandler = async (
      _type: string,
      params: Record<string, unknown>,
      ctx: HostEffectContext,
    ): Promise<Patch[]> => {
      const appCtx = { snapshot: ctx.snapshot };
      const patches = await appHandler(params, appCtx);
      return patches as Patch[];
    };

    host.registerEffect(effectType, hostHandler);
  }

  return host;
}

// =============================================================================
// system.get Effect Implementation
// Absorbed from runtime/src/execution/system-get.ts
// =============================================================================

interface SystemGetReadParams {
  path: string;
  target?: string;
}

interface SystemGetGenerateParams {
  key: string;
  into: string;
}

type SystemGetParams = SystemGetReadParams | SystemGetGenerateParams;

function isGenerateParams(params: unknown): params is SystemGetGenerateParams {
  return (
    typeof params === "object" &&
    params !== null &&
    "key" in params &&
    "into" in params
  );
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

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function executeSystemGet(
  params: unknown,
  snapshot: Snapshot,
): { patches: Patch[] } {
  if (isGenerateParams(params)) {
    const value = generateSystemValue(params.key);
    const patches: Patch[] = [{
      op: "set",
      path: normalizeTargetPath(params.into),
      value,
    }];
    return { patches };
  }

  // Read mode
  const { path, target } = params as SystemGetReadParams;
  const result = resolvePathValue(path, snapshot);

  const patches: Patch[] = [];
  if (target) {
    patches.push({
      op: "set",
      path: normalizeTargetPath(target),
      value: result.value,
    });
  }

  return { patches };
}

function normalizePath(path: string): string {
  if (path.startsWith("/")) {
    return path.slice(1).replace(/\//g, ".");
  }
  return path;
}

function normalizeTargetPath(path: string): Patch["path"] {
  const normalized = normalizePath(path);
  const withoutDataRoot = normalized.startsWith("data.")
    ? normalized.slice("data.".length)
    : normalized;
  return semanticPathToPatchPath(withoutDataRoot);
}

function resolvePathValue(
  path: string,
  snapshot: Snapshot,
): { value: unknown; found: boolean } {
  const normalized = normalizePath(path);
  const parts = normalized.split(".");

  if (parts.length === 0) {
    return { value: undefined, found: false };
  }

  const root = parts[0];
  const rest = parts.slice(1);

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
  }

  for (const part of rest) {
    if (current === null || current === undefined) {
      return { value: undefined, found: false };
    }
    if (typeof current !== "object") {
      return { value: undefined, found: false };
    }
    current = (current as Record<string, unknown>)[part];
  }

  return { value: current, found: current !== undefined };
}

// =============================================================================
// Subscriber Type (internal)
// =============================================================================

interface Subscriber<R> {
  selector: Selector<R>;
  listener: (value: R) => void;
  lastValue: R | undefined;
  initialized: boolean;
}

// =============================================================================
// Intent ID Generation (SDK-DISPATCH-2, SDK-INV-6)
// =============================================================================

function generateIntentId(): string {
  return generateUUID();
}
