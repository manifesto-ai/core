import { z } from "zod";
import { SemanticPath } from "./common.js";

/**
 * ErrorValue - Errors are values in Snapshot, not exceptions.
 */
export const ErrorValue = z.object({
  /**
   * Error code
   */
  code: z.string(),

  /**
   * Human-readable message
   */
  message: z.string(),

  /**
   * Where the error occurred
   */
  source: z.object({
    actionId: z.string(),
    nodePath: z.string(),
  }),

  /**
   * When the error occurred
   */
  timestamp: z.number(),

  /**
   * Additional context
   */
  context: z.record(z.string(), z.unknown()).optional(),
});
export type ErrorValue = z.infer<typeof ErrorValue>;

/**
 * FlowPosition - Position in the flow where effect was encountered
 */
export const FlowPosition = z.object({
  /**
   * Path to the effect node in the flow
   */
  nodePath: z.string(),

  /**
   * Snapshot version at time of effect
   */
  snapshotVersion: z.number(),
});
export type FlowPosition = z.infer<typeof FlowPosition>;

/**
 * Requirement - A recorded effect declaration waiting for Host fulfillment
 */
export const Requirement = z.object({
  /**
   * Unique identifier for this requirement.
   * Should be deterministic: hash(schemaHash, intentId, actionId, flowNodePath)
   */
  id: z.string(),

  /**
   * Effect type that generated this requirement
   */
  type: z.string(),

  /**
   * Resolved parameters
   */
  params: z.record(z.string(), z.unknown()),

  /**
   * The action that was being computed
   */
  actionId: z.string(),

  /**
   * Position in the flow where effect was encountered
   */
  flowPosition: FlowPosition,

  /**
   * Timestamp when requirement was created
   */
  createdAt: z.number(),
});
export type Requirement = z.infer<typeof Requirement>;

/**
 * SystemState - Internal system state
 */
export const SystemState = z.object({
  /**
   * Current status
   */
  status: z.enum(["idle", "computing", "pending", "error"]),

  /**
   * Last error (null if none)
   */
  lastError: ErrorValue.nullable(),

  /**
   * Error history
   */
  errors: z.array(ErrorValue),

  /**
   * Pending requirements waiting for Host
   */
  pendingRequirements: z.array(Requirement),

  /**
   * Current action being processed (if any)
   */
  currentAction: z.string().nullable(),
});
export type SystemState = z.infer<typeof SystemState>;

/**
 * SnapshotMeta - Snapshot metadata
 */
export const SnapshotMeta = z.object({
  /**
   * Monotonically increasing version.
   * Incremented by Core on each apply().
   */
  version: z.number(),

  /**
   * Timestamp of last modification.
   * Set by Core on each apply().
   */
  timestamp: z.number(),

  /**
   * Deterministic random seed from Host context
   */
  randomSeed: z.string(),

  /**
   * Hash of the schema this snapshot conforms to.
   */
  schemaHash: z.string(),
});
export type SnapshotMeta = z.infer<typeof SnapshotMeta>;

/**
 * Snapshot - Immutable, point-in-time representation of world state.
 * This is the ONLY medium of communication between Core and Host.
 */
export const Snapshot = z.object({
  /**
   * Domain data (matches StateSpec)
   */
  data: z.unknown(),

  /**
   * Computed values (matches ComputedSpec)
   */
  computed: z.record(SemanticPath, z.unknown()),

  /**
   * System state
   */
  system: SystemState,

  /**
   * Input for current action (if any)
   */
  input: z.unknown(),

  /**
   * Snapshot metadata
   */
  meta: SnapshotMeta,
});
export type Snapshot = z.infer<typeof Snapshot>;

/**
 * Create initial system state
 */
export function createInitialSystemState(): SystemState {
  return {
    status: "idle",
    lastError: null,
    errors: [],
    pendingRequirements: [],
    currentAction: null,
  };
}
