/**
 * Schema Manager Module
 *
 * Manages domain schema compilation, caching, and validation.
 *
 * @see SPEC v2.0.0 §6.2 SCHEMA-1~6
 * @module
 */

import { hashSchemaEffectiveSync, type DomainSchema } from "@manifesto-ai/core";
import { compileMelDomain } from "@manifesto-ai/compiler";
import {
  DomainCompileError,
  ReservedNamespaceError,
} from "../errors/index.js";
import { RESERVED_NAMESPACE_PREFIX } from "../constants.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Schema Manager interface.
 *
 * Manages domain schema lifecycle: compilation, caching, and validation.
 */
export interface SchemaManager {
  /**
   * Check if schema is resolved.
   *
   * @see SCHEMA-2
   */
  readonly isResolved: boolean;

  /**
   * Get the current domain schema.
   *
   * @throws Error if schema is not resolved
   */
  getSchema(): DomainSchema;

  /**
   * Set the domain source (MEL text or DomainSchema).
   *
   * @param domain - MEL text or DomainSchema
   */
  setDomain(domain: string | DomainSchema): void;

  /**
   * Compile the domain if it's MEL text.
   *
   * @throws DomainCompileError if compilation fails
   */
  compile(): Promise<void>;

  /**
   * Cache a schema for referential identity.
   *
   * @see SCHEMA-4
   * @param schema - The schema to cache
   */
  cacheSchema(schema: DomainSchema): void;

  /**
   * Get a cached schema by hash.
   *
   * @param hash - The schema hash
   */
  getCachedSchema(hash: string): DomainSchema | undefined;

  /**
   * Validate reserved namespace usage.
   *
   * @see SPEC §18 NS-ACT-1~4
   * @throws ReservedNamespaceError if reserved namespace is used
   */
  validateReservedNamespaces(): void;

  /**
   * Mark schema as resolved.
   */
  markResolved(): void;

  /**
   * Get the current schema hash.
   */
  getCurrentSchemaHash(): string;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Schema Manager implementation.
 */
export class SchemaManagerImpl implements SchemaManager {
  /**
   * Domain source (MEL text or DomainSchema).
   */
  private _domain: string | DomainSchema;

  /**
   * Compiled domain schema.
   */
  private _domainSchema: DomainSchema | null = null;

  /**
   * Schema cache for referential identity.
   *
   * @see SCHEMA-4
   */
  private _schemaCache: Map<string, DomainSchema> = new Map();
  private _effectiveHashBySemantic: Map<string, string> = new Map();

  /**
   * Tracks if schema is resolved.
   *
   * @see SCHEMA-2, READY-6
   */
  private _schemaResolved: boolean = false;

  constructor(domain: string | DomainSchema) {
    this._domain = domain;
  }

  get isResolved(): boolean {
    return this._schemaResolved;
  }

  getSchema(): DomainSchema {
    if (!this._domainSchema) {
      throw new Error("Schema not compiled");
    }
    return this._domainSchema;
  }

  setDomain(domain: string | DomainSchema): void {
    this._domain = domain;
    this._domainSchema = null;
    this._schemaResolved = false;
  }

  async compile(): Promise<void> {
    if (typeof this._domain === "string") {
      try {
        const result = compileMelDomain(this._domain, { mode: "domain" });

        if (result.errors.length > 0) {
          const errorMessages = result.errors
            .map((e) => `[${e.code}] ${e.message}`)
            .join("; ");
          throw new DomainCompileError(`MEL compilation failed: ${errorMessages}`);
        }

        if (!result.schema) {
          throw new DomainCompileError("MEL compilation produced no schema");
        }

        this._domainSchema = withPlatformNamespaces(result.schema as DomainSchema);
      } catch (error) {
        if (error instanceof DomainCompileError) {
          throw error;
        }
        throw new DomainCompileError(
          error instanceof Error ? error.message : String(error),
          { cause: error }
        );
      }
    } else {
      this._domainSchema = withPlatformNamespaces(this._domain);
    }
  }

  cacheSchema(schema: DomainSchema): void {
    if (!this._schemaCache.has(schema.hash)) {
      this._schemaCache.set(schema.hash, schema);
    }

    const { hash: _hash, ...schemaWithoutHash } = schema;
    const effectiveHash = hashSchemaEffectiveSync(
      schemaWithoutHash as Omit<DomainSchema, "hash">
    );
    this._effectiveHashBySemantic.set(schema.hash, effectiveHash);
  }

  getCachedSchema(hash: string): DomainSchema | undefined {
    return this._schemaCache.get(hash);
  }

  validateReservedNamespaces(): void {
    if (!this._domainSchema) return;

    // NS-ACT-2: Check action types for reserved namespace
    const actions = this._domainSchema.actions || {};
    for (const actionType of Object.keys(actions)) {
      if (actionType.startsWith(RESERVED_NAMESPACE_PREFIX)) {
        throw new ReservedNamespaceError(actionType, "action");
      }
    }
  }

  markResolved(): void {
    this._schemaResolved = true;
  }

  getCurrentSchemaHash(): string {
    return this._domainSchema?.hash ?? "unknown";
  }
}

// =============================================================================
// Platform Namespace Injection
// =============================================================================

export function withPlatformNamespaces(schema: DomainSchema): DomainSchema {
  const fields = { ...schema.state.fields };
  let changed = false;

  const ensureObjectField = (
    name: "$host" | "$mel",
    defaultValue: Record<string, unknown>
  ): void => {
    const existing = fields[name];
    if (!existing) {
      fields[name] = {
        type: "object",
        required: false,
        default: defaultValue,
      };
      changed = true;
      return;
    }

    if (existing.type !== "object") {
      throw new DomainCompileError(
        `Reserved namespace '${name}' must be an object field`
      );
    }

    if (existing.default === undefined) {
      fields[name] = { ...existing, default: defaultValue };
      changed = true;
    }
  };

  const ensureMelGuardsField = (): void => {
    const existing = fields.$mel;
    const melDefault = { guards: { intent: {} } };

    if (!existing) {
      fields.$mel = {
        type: "object",
        required: false,
        default: melDefault,
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
      return;
    }

    if (existing.type !== "object") {
      throw new DomainCompileError(
        "Reserved namespace '$mel' must be an object field"
      );
    }

    let nextMel = existing;
    if (existing.default === undefined) {
      nextMel = { ...nextMel, default: melDefault };
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
    } else {
      if (guardsField.type !== "object") {
        throw new DomainCompileError(
          "Reserved namespace '$mel.guards' must be an object field"
        );
      }

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
        throw new DomainCompileError(
          "Reserved namespace '$mel.guards.intent' must be an object field"
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

    if (nextMel !== existing) {
      fields.$mel = nextMel;
      changed = true;
    }
  };

  ensureObjectField("$host", {});
  ensureMelGuardsField();

  if (!changed) {
    return schema;
  }

  const nextSchema: DomainSchema = {
    ...schema,
    state: {
      ...schema.state,
      fields,
    },
  };

  return nextSchema;
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a new SchemaManager instance.
 *
 * @param domain - MEL text or DomainSchema
 */
export function createSchemaManager(domain: string | DomainSchema): SchemaManager {
  return new SchemaManagerImpl(domain);
}
