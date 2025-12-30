/**
 * Projection Recorder
 *
 * Records projection outputs for audit, debugging, and replay.
 *
 * Per Intent & Projection Specification v1.0 (Section 12):
 * - Projection outputs SHOULD be recorded for debugging, replay, and audit
 * - Recording MUST NOT mutate semantic state
 */
import type { ActorRef } from "@manifesto-ai/world";
import type { SourceEvent } from "../schema/source-event.js";
import type { ProjectionResult } from "../schema/projection.js";
import type { ProjectionRecord } from "../schema/projection-record.js";
import { createProjectionRecord } from "../schema/projection-record.js";

// ============================================================================
// Projection Recorder Interface
// ============================================================================

/**
 * Projection recorder interface
 *
 * Records projection outputs for debugging and audit.
 * Recording is non-invasive and does not affect semantic state.
 */
export interface ProjectionRecorder {
  /**
   * Record a projection result
   *
   * @param projectionId - Which projection produced this
   * @param actor - Who acted
   * @param source - What triggered
   * @param result - What was produced
   * @param options - Optional metadata (snapshotVersion, intentId, intentKey)
   * @returns The created record
   */
  record(
    projectionId: string,
    actor: ActorRef,
    source: SourceEvent,
    result: ProjectionResult,
    options?: {
      snapshotVersion?: number;
      intentId?: string;
      intentKey?: string;
    }
  ): ProjectionRecord;

  /**
   * Get all records
   */
  getRecords(): ProjectionRecord[];

  /**
   * Get records by projection ID
   */
  getByProjectionId(projectionId: string): ProjectionRecord[];

  /**
   * Get records by actor ID
   */
  getByActorId(actorId: string): ProjectionRecord[];

  /**
   * Get records by intent ID
   */
  getByIntentId(intentId: string): ProjectionRecord[];

  /**
   * Get records within a time range
   *
   * @param from - Start time (inclusive)
   * @param to - End time (exclusive)
   */
  getByTimeRange(from: number, to: number): ProjectionRecord[];

  /**
   * Clear all records
   */
  clear(): void;
}

// ============================================================================
// In-Memory Implementation
// ============================================================================

/**
 * In-memory projection recorder implementation
 *
 * Stores records in memory. For production use, consider
 * implementing a persistent recorder.
 */
export class InMemoryProjectionRecorder implements ProjectionRecorder {
  /** All recorded projection records */
  private readonly records: ProjectionRecord[] = [];

  /** Index by projection ID for fast lookup */
  private readonly byProjectionId: Map<string, ProjectionRecord[]> = new Map();

  /** Index by actor ID for fast lookup */
  private readonly byActorId: Map<string, ProjectionRecord[]> = new Map();

  /** Index by intent ID for fast lookup */
  private readonly byIntentId: Map<string, ProjectionRecord[]> = new Map();

  /**
   * Record a projection result
   */
  record(
    projectionId: string,
    actor: ActorRef,
    source: SourceEvent,
    result: ProjectionResult,
    options?: {
      snapshotVersion?: number;
      intentId?: string;
      intentKey?: string;
    }
  ): ProjectionRecord {
    const record = createProjectionRecord(projectionId, actor, source, result, options);

    // Add to main list
    this.records.push(record);

    // Index by projection ID
    let byProjection = this.byProjectionId.get(projectionId);
    if (!byProjection) {
      byProjection = [];
      this.byProjectionId.set(projectionId, byProjection);
    }
    byProjection.push(record);

    // Index by actor ID
    let byActor = this.byActorId.get(actor.actorId);
    if (!byActor) {
      byActor = [];
      this.byActorId.set(actor.actorId, byActor);
    }
    byActor.push(record);

    // Index by intent ID if present
    if (options?.intentId) {
      let byIntent = this.byIntentId.get(options.intentId);
      if (!byIntent) {
        byIntent = [];
        this.byIntentId.set(options.intentId, byIntent);
      }
      byIntent.push(record);
    }

    return record;
  }

  /**
   * Get all records (returns a copy)
   */
  getRecords(): ProjectionRecord[] {
    return [...this.records];
  }

  /**
   * Get records by projection ID
   */
  getByProjectionId(projectionId: string): ProjectionRecord[] {
    return [...(this.byProjectionId.get(projectionId) ?? [])];
  }

  /**
   * Get records by actor ID
   */
  getByActorId(actorId: string): ProjectionRecord[] {
    return [...(this.byActorId.get(actorId) ?? [])];
  }

  /**
   * Get records by intent ID
   */
  getByIntentId(intentId: string): ProjectionRecord[] {
    return [...(this.byIntentId.get(intentId) ?? [])];
  }

  /**
   * Get records within a time range
   */
  getByTimeRange(from: number, to: number): ProjectionRecord[] {
    return this.records.filter(
      (record) => record.createdAt >= from && record.createdAt < to
    );
  }

  /**
   * Clear all records
   */
  clear(): void {
    this.records.length = 0;
    this.byProjectionId.clear();
    this.byActorId.clear();
    this.byIntentId.clear();
  }

  /**
   * Get the number of recorded records
   */
  get size(): number {
    return this.records.length;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new in-memory projection recorder
 */
export function createProjectionRecorder(): ProjectionRecorder {
  return new InMemoryProjectionRecorder();
}

// ============================================================================
// No-Op Implementation
// ============================================================================

/**
 * No-op projection recorder
 *
 * Does not record anything. Use when recording is not needed.
 */
export class NoOpProjectionRecorder implements ProjectionRecorder {
  record(
    projectionId: string,
    actor: ActorRef,
    source: SourceEvent,
    result: ProjectionResult,
    options?: {
      snapshotVersion?: number;
      intentId?: string;
      intentKey?: string;
    }
  ): ProjectionRecord {
    // Still create the record (for return value), but don't store it
    return createProjectionRecord(projectionId, actor, source, result, options);
  }

  getRecords(): ProjectionRecord[] {
    return [];
  }

  getByProjectionId(_projectionId: string): ProjectionRecord[] {
    return [];
  }

  getByActorId(_actorId: string): ProjectionRecord[] {
    return [];
  }

  getByIntentId(_intentId: string): ProjectionRecord[] {
    return [];
  }

  getByTimeRange(_from: number, _to: number): ProjectionRecord[] {
    return [];
  }

  clear(): void {
    // Nothing to clear
  }
}

/**
 * Create a no-op projection recorder
 */
export function createNoOpRecorder(): ProjectionRecorder {
  return new NoOpProjectionRecorder();
}
