/**
 * Translation Context (SPEC-1.1.1v §6.16)
 *
 * TranslationContext MUST be derived from World.
 * Independent construction is a spec violation.
 */

import { z } from "zod";
import type { TypeIndex } from "./type-expr.js";
import { TypeIndexSchema } from "./type-expr.js";
import type { ActorRef, IntentId, WorldId } from "./types.js";
import { ActorRef as ActorRefSchema } from "./types.js";
import type { Glossary } from "./glossary.js";
import { GlossarySchema } from "./glossary.js";

// =============================================================================
// DomainSchema (from @manifesto-ai/core)
// =============================================================================

/**
 * DomainSchema reference type
 *
 * This should be imported from @manifesto-ai/core in actual usage.
 * Defined here for type safety within translator package.
 */
export interface DomainSchema {
  id: string;
  version: string;
  hash: string;
  state: unknown;
  computed: unknown;
  actions: Record<string, unknown>;
  types?: Record<string, unknown>;
}

export const DomainSchemaSchema = z.object({
  id: z.string(),
  version: z.string(),
  hash: z.string(),
  state: z.unknown(),
  computed: z.unknown(),
  actions: z.record(z.unknown()),
  types: z.record(z.unknown()).optional(),
});

// =============================================================================
// Snapshot (from @manifesto-ai/core)
// =============================================================================

/**
 * Snapshot reference type
 *
 * This should be imported from @manifesto-ai/core in actual usage.
 */
export interface Snapshot {
  data: Record<string, unknown>;
  computed: Record<string, unknown>;
  system?: unknown;
  meta?: unknown;
}

export const SnapshotSchema = z.object({
  data: z.record(z.unknown()),
  computed: z.record(z.unknown()),
  system: z.unknown().optional(),
  meta: z.unknown().optional(),
});

// =============================================================================
// TranslationContext
// =============================================================================

/**
 * TranslationContext: All context needed for translation
 *
 * Derivation from World:
 * - atWorldId: Direct from World
 * - schema: schemaStore.get(World.schemaHash)
 * - typeIndex: deriveTypeIndex(schema)
 * - snapshot: snapshotStore.get(World.snapshotHash) (optional)
 */
export interface TranslationContext {
  /** REQUIRED: World reference (source of truth) */
  atWorldId: WorldId;

  /** MUST be derived from World.schemaHash */
  schema: DomainSchema;

  /** MUST be derived from schema via deriveTypeIndex() */
  typeIndex: TypeIndex;

  /** Optional: for context-aware translation */
  snapshot?: Snapshot;

  /** Intent identifier for this translation */
  intentId: IntentId;

  /** Actor initiating translation */
  actor?: ActorRef;

  /** Optional glossary for normalization */
  glossary?: Glossary;
}

export const TranslationContextSchema = z.object({
  atWorldId: z.string(),
  schema: DomainSchemaSchema,
  typeIndex: TypeIndexSchema,
  snapshot: SnapshotSchema.optional(),
  intentId: z.string(),
  actor: ActorRefSchema.optional(),
  glossary: GlossarySchema.optional(),
});
