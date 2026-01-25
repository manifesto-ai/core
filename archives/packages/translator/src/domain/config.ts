/**
 * Configuration Types (SPEC-1.1.1v §6.18)
 *
 * Translator configuration options.
 */

import { z } from "zod";

// =============================================================================
// Memory Policy
// =============================================================================

/**
 * Memory policy configuration
 *
 * - default: Memory is default path; graceful degradation if unavailable
 * - require: Memory is required; error if unavailable
 */
export interface MemoryPolicy {
  mode: "default" | "require";
  minAverageConfidence?: number;
  requireStrongEvidence?: boolean;
}

export const MemoryPolicySchema = z.object({
  mode: z.enum(["default", "require"]),
  minAverageConfidence: z.number().optional(),
  requireStrongEvidence: z.boolean().optional(),
});

// =============================================================================
// Confidence Policy
// =============================================================================

/**
 * Confidence thresholds for auto-accept/reject
 */
export interface ConfidencePolicy {
  /** Threshold for auto-accepting (>= this → fragment) */
  autoAcceptThreshold: number;
  /** Threshold for rejecting (< this → error) */
  rejectThreshold: number;
}

export const ConfidencePolicySchema = z.object({
  autoAcceptThreshold: z.number().min(0).max(1),
  rejectThreshold: z.number().min(0).max(1),
});

// =============================================================================
// Trace Configuration
// =============================================================================

/**
 * Trace output configuration
 */
export interface TraceConfig {
  sink?: "file" | "callback" | "none";
  includeRawInput: boolean;
  includeRawModelResponse: boolean;
  includeInputPreview: boolean;
  maxPreviewLength: number;
  redactSensitiveData: boolean;
}

export const TraceConfigSchema = z.object({
  sink: z.enum(["file", "callback", "none"]).optional(),
  includeRawInput: z.boolean(),
  includeRawModelResponse: z.boolean(),
  includeInputPreview: z.boolean(),
  maxPreviewLength: z.number(),
  redactSensitiveData: z.boolean(),
});

// =============================================================================
// Store Interfaces (Abstract)
// =============================================================================

/**
 * World store interface (abstract)
 */
export interface WorldStore {
  get(worldId: string): Promise<unknown | null>;
}

/**
 * Schema store interface (abstract)
 */
export interface SchemaStore {
  get(schemaHash: string): Promise<unknown | null>;
}

/**
 * Snapshot store interface (abstract)
 */
export interface SnapshotStore {
  get(snapshotHash: string): Promise<unknown | null>;
}

/**
 * Memory selector interface (abstract)
 */
export interface MemorySelector {
  select(query: unknown): Promise<unknown>;
}

// =============================================================================
// TranslatorConfig
// =============================================================================

/**
 * Complete translator configuration
 */
export interface TranslatorConfig {
  /** Store configuration */
  stores?: {
    world: WorldStore;
    schema: SchemaStore;
    snapshot?: SnapshotStore;
  };

  /** Memory selector */
  memorySelector?: MemorySelector;

  /** Memory policy */
  memoryPolicy?: MemoryPolicy;

  /** Retrieval tier (0 = offline/OSS, 1 = local, 2 = cloud) */
  retrievalTier: 0 | 1 | 2;

  /** Default model for proposer */
  slmModel: string;

  /** Threshold for escalating to larger model */
  escalationThreshold: number;

  /** Whether fast path is enabled */
  fastPathEnabled: boolean;

  /** Fast path only mode (no LLM fallback) */
  fastPathOnly: boolean;

  /** Confidence policy */
  confidencePolicy: ConfidencePolicy;

  /** Trace configuration */
  traceConfig: TraceConfig;

  /** Context verification mode */
  contextVerification?: "strict" | "trust";
}

export const TranslatorConfigSchema = z.object({
  stores: z
    .object({
      world: z.custom<WorldStore>(),
      schema: z.custom<SchemaStore>(),
      snapshot: z.custom<SnapshotStore>().optional(),
    })
    .optional(),
  memorySelector: z.custom<MemorySelector>().optional(),
  memoryPolicy: MemoryPolicySchema.optional(),
  retrievalTier: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  slmModel: z.string(),
  escalationThreshold: z.number(),
  fastPathEnabled: z.boolean(),
  fastPathOnly: z.boolean(),
  confidencePolicy: ConfidencePolicySchema,
  traceConfig: TraceConfigSchema,
  contextVerification: z.enum(["strict", "trust"]).optional(),
});

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Omit<TranslatorConfig, "stores"> = {
  memoryPolicy: {
    mode: "default",
  },
  retrievalTier: 0,
  slmModel: "gpt-4o-mini",
  escalationThreshold: 0.5,
  fastPathEnabled: true,
  fastPathOnly: false,
  confidencePolicy: {
    autoAcceptThreshold: 0.8,
    rejectThreshold: 0.3,
  },
  traceConfig: {
    sink: "none",
    includeRawInput: false,
    includeRawModelResponse: false,
    includeInputPreview: true,
    maxPreviewLength: 100,
    redactSensitiveData: true,
  },
  contextVerification: "strict",
};

/**
 * Create configuration with defaults
 */
export function createConfig(
  partial: Partial<TranslatorConfig>
): TranslatorConfig {
  const memoryPolicy: MemoryPolicy = {
    mode: partial.memoryPolicy?.mode ?? DEFAULT_CONFIG.memoryPolicy?.mode ?? "default",
    minAverageConfidence: partial.memoryPolicy?.minAverageConfidence ?? DEFAULT_CONFIG.memoryPolicy?.minAverageConfidence,
    requireStrongEvidence: partial.memoryPolicy?.requireStrongEvidence ?? DEFAULT_CONFIG.memoryPolicy?.requireStrongEvidence,
  };

  const confidencePolicy: ConfidencePolicy = {
    autoAcceptThreshold: partial.confidencePolicy?.autoAcceptThreshold ?? DEFAULT_CONFIG.confidencePolicy.autoAcceptThreshold,
    rejectThreshold: partial.confidencePolicy?.rejectThreshold ?? DEFAULT_CONFIG.confidencePolicy.rejectThreshold,
  };

  const traceConfig: TraceConfig = {
    sink: partial.traceConfig?.sink ?? DEFAULT_CONFIG.traceConfig.sink,
    includeRawInput: partial.traceConfig?.includeRawInput ?? DEFAULT_CONFIG.traceConfig.includeRawInput,
    includeRawModelResponse: partial.traceConfig?.includeRawModelResponse ?? DEFAULT_CONFIG.traceConfig.includeRawModelResponse,
    includeInputPreview: partial.traceConfig?.includeInputPreview ?? DEFAULT_CONFIG.traceConfig.includeInputPreview,
    maxPreviewLength: partial.traceConfig?.maxPreviewLength ?? DEFAULT_CONFIG.traceConfig.maxPreviewLength,
    redactSensitiveData: partial.traceConfig?.redactSensitiveData ?? DEFAULT_CONFIG.traceConfig.redactSensitiveData,
  };

  return {
    ...DEFAULT_CONFIG,
    ...partial,
    memoryPolicy,
    confidencePolicy,
    traceConfig,
  };
}
